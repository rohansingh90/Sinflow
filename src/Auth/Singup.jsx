import React, { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../Lib/Firebase'

const Singup = ({ setView }) => {
  const [step, setStep] = useState(1) // 1: Email, 2: Profile (Name, Full Name, Password)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleContinue = (e) => {
    e.preventDefault()
    setError('')
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setStep(2)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // 2. Save user info to Firestore database
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: username.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        createdAt: new Date().toISOString(),
      })

    } catch (err) {
      console.error("Signup error details:", err)
      let message = 'Failed to create account. Please try again.'
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.'
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.'
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }





  const handleGoogleSignUp = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user

      // If user does not exist in Firestore, save details
      const docRef = doc(db, 'users', user.uid)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        const generatedUsername = user.email.split('@')[0]
        await setDoc(docRef, {
          uid: user.uid,
          username: generatedUsername,
          fullName: user.displayName || generatedUsername,
          email: user.email,
          createdAt: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error("Google signup error:", err)
      setError('Failed to sign up with Google. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-white flex flex-col font-sans text-[#323232] select-text overflow-hidden">
      {/* Header Bar */}
      <header className="w-full px-6 py-4 border-b border-[#f5f6f8] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight text-slate-800">
          <span className="flex gap-1.5 items-center">
            <span className="w-2.5 h-6 rounded-full bg-[#ff3d57] transform rotate-12"></span>
            <span className="w-2.5 h-6 rounded-full bg-[#ff9f00] transform rotate-12"></span>
            <span className="w-2.5 h-6 rounded-full bg-[#00ca72] transform rotate-12"></span>
          </span>
          <span className="text-[21px] font-extrabold text-[#1c1c1c] tracking-tight ml-1.5 select-none">
            sing<span className="text-[#0073ea]">flow</span>
          </span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-y-auto">
        <div className="w-full max-w-[490px] bg-white border border-[#e2e4e9] rounded-lg shadow-sm p-6 sm:p-8 animate-fadeIn">
          
          {/* Step 1: Email & Google */}
          {step === 1 ? (
            <>
              {/* Title & Subtitle */}
              <div className="text-center mb-3">
                <h2 className="text-[30px] font-semibold text-[#1c1c1c] tracking-tight mb-2 font-sans">
                  Welcome to singflow
                </h2>
                <p className="text-sm font-normal text-slate-500">
                  Get started - it's free. No credit card needed.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Google Button */}
              <button
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-[#d0d4dc] rounded text-sm text-[#323232] hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer focus:outline-none"
              >
                <svg className="w-4 h-4 mr-2.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute w-full h-[1px] bg-[#e2e4e9]"></div>
                <span className="relative px-3 bg-white text-xs text-slate-400 font-normal">
                  Or
                </span>
              </div>

              {/* Email Form */}
              <form onSubmit={handleContinue} className="space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 border border-[#d0d4dc] rounded text-sm text-[#323232] placeholder-slate-400 focus:outline-none focus:border-[#0073ea] transition-all"
                />

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded bg-[#0073ea] hover:bg-[#0060c0] active:bg-[#004ca3] text-white text-sm font-normal transition-all cursor-pointer flex items-center justify-center"
                >
                  <span>Continue</span>
                </button>
              </form>

              {/* Terms Agreement */}
              <div className="text-center text-[11px] text-slate-500 mt-5 leading-normal">
                By proceeding, you agree to the{' '}
                <a
                  href="https://monday.com/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0073ea] hover:underline"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="https://monday.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0073ea] hover:underline"
                >
                  Privacy Policy
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Title & Subtitle */}
              <div className="text-center mb-6">
                <h2 className="text-[26px] font-semibold text-[#1c1c1c] tracking-tight mb-1 font-sans">
                  Create your account
                </h2>
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <span>Signing up as <strong className="text-slate-700 truncate max-w-[150px] inline-block align-middle">{email}</strong></span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[#0073ea] hover:underline focus:outline-none cursor-pointer font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Signup Form Step 2 */}
              <form onSubmit={handleSignup} className="space-y-3">
          

                {/* Full Name */}
                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-normal text-[#323232]">Full name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-1.5 border border-[#d0d4dc] rounded text-sm text-[#323232] placeholder-slate-400 focus:outline-none focus:border-[#0073ea] transition-all"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-normal text-[#323232]">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    className="w-full px-3 py-1.5 border border-[#d0d4dc] rounded text-sm text-[#323232] placeholder-slate-400 focus:outline-none focus:border-[#0073ea] transition-all"
                  />
                </div>

                {/* Sign Up Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded bg-[#0073ea] hover:bg-[#0060c0] active:bg-[#004ca3] text-white text-sm font-normal transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Sign Up</span>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Switch View Footer */}
          <div className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => setView('login')}
              className="text-[#0073ea] hover:underline cursor-pointer focus:outline-none font-normal"
            >
              Log in
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Singup
