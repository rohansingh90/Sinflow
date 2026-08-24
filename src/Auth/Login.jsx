import React, { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../Lib/Firebase'

const Login = ({ setView }) => {
  const [step, setStep] = useState(1) // 1: Email, 2: Password
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleNext = (e) => {
    e.preventDefault()
    setError('')
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setStep(2)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      console.error("Login error code:", err.code)
      let message = 'Failed to sign in. Please check your credentials.'
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        message = 'Incorrect password. Please try again.'
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user

      // If user does not exist in Firestore, save details (Google sign up fallback)
      const docRef = doc(db, 'users', user.uid)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        const username = user.email.split('@')[0]
        await setDoc(docRef, {
          uid: user.uid,
          username: username,
          fullName: user.displayName || username,
          email: user.email,
          photoURL: user.photoURL || '',
          createdAt: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error("Google auth error:", err)
      setError('Failed to log in with Google. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overflow-hidden  bg-white flex flex-col font-sans text-[#323232] select-text">
      {/* Header Bar */}
      <header className="w-full px-8 py-5 border-b border-[#f5f6f8] flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight text-slate-800">
          <span className="flex gap-1.5 items-center">
            <span className="w-2.5 h-6 rounded-full bg-[#ff3d57] transform rotate-12"></span>
            <span className="w-2.5 h-6 rounded-full bg-[#ff9f00] transform rotate-12"></span>
            <span className="w-2.5 h-6 rounded-full bg-[#00ca72] transform rotate-12"></span>
          </span>
          <span className="text-[23px] font-extrabold text-[#1c1c1c] tracking-tight ml-1.5 select-none">
            sing<span className="text-[#0073ea]">flow</span>
          </span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px] bg-white border border-[#e2e4e9] rounded-lg shadow-sm p-8 sm:p-12">
          
          {/* Title */}
          <h2 className="text-[32px] font-light text-center text-[#1c1c1c] tracking-tight mb-8 font-sans">
            Log in to your account
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Multi-step Login Form */}
          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-normal text-center text-[#323232]">
                  Enter your work email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Example@company.com"
                  className="w-full px-3 py-2 border border-[#d0d4dc] rounded text-sm text-[#323232] placeholder-slate-400 focus:outline-none focus:border-[#0073ea] transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded bg-[#0073ea] hover:bg-[#0060c0] active:bg-[#004ca3] text-white text-sm font-normal transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Next</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Email: <strong className="text-slate-700">{email}</strong></span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[#0073ea] hover:underline focus:outline-none cursor-pointer text-xs"
                  >
                    Edit
                  </button>
                </div>
                <label className="text-sm font-normal text-[#323232]">
                  Enter your password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 border border-[#d0d4dc] rounded text-sm text-[#323232] placeholder-slate-400 focus:outline-none focus:border-[#0073ea] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded bg-[#0073ea] hover:bg-[#0060c0] active:bg-[#004ca3] text-white text-sm font-normal transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <span>Log In</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Divider Line */}
          <div className="relative my-8 flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-[#e2e4e9]"></div>
            <span className="relative px-4 bg-white text-xs text-slate-500 font-normal">
              Or Sign in with
            </span>
          </div>

          {/* Google Login Button */}
          <div className="flex justify-center">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full sm:w-auto min-w-[240px] flex items-center justify-center px-4 py-2 border border-[#d0d4dc] rounded text-sm text-[#323232] hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer focus:outline-none"
            >
              <svg className="w-4 h-4 mr-2.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Help & Switch View Footer */}
          <div className="mt-8 text-center text-xs text-slate-500 space-y-2">
            <div>
              Don't have an account yet?{' '}
              <button
                onClick={() => setView('signup')}
                className="text-[#0073ea] hover:underline cursor-pointer focus:outline-none font-normal"
              >
                Sign up
              </button>
            </div>
            <div>
              Can't log in?{' '}
              <a
                href="https://monday.com/help"
                target="_blank"
                rel="noreferrer"
                className="text-[#0073ea] hover:underline font-normal"
              >
                Visit our help center
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Login


