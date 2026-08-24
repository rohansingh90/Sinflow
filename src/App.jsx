import React, { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './Lib/Firebase'
import Login from './Auth/Login'
import Singup from './Auth/Singup'
import Dashboard from './components/UI/Dashboard'
import Wireframe from './components/UI/Wireframe'
import Publicview from './components/Publicview'

const App = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login') // 'login' or 'signup'
  const [pendingShare, setPendingShare] = useState(null)

  useEffect(() => {
    // 1. Query Params Check (?share=xxx&token=yyy)
    const params = new URLSearchParams(window.location.search)
    const shareDocId = params.get('share')
    const token = params.get('token')

    // 2. Direct Path Route Check (/doc/lH5KFuBLKwcjxQC79e1c)
    const pathParts = window.location.pathname.split('/') // ['' , 'doc', 'lH5KFuBLKwcjxQC79e1c']
    const isDocPath = pathParts[1] === 'doc' && pathParts[2]

    if (shareDocId && token) {
      setPendingShare({ docId: shareDocId, token })
    } else if (isDocPath) {
      // Direct URL path se Document ID extract karein
      setPendingShare({ docId: pathParts[2], token: token || null })
    }
  }, [])

  useEffect(() => {
    // Listen to Firebase authentication state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="relative flex items-center justify-center">
          {/* Animated Glow Rings */}
          <div className="absolute w-16 h-16 rounded-full border-4 border-indigo-500/20 animate-ping"></div>
          <div className="absolute w-20 h-20 rounded-full border-4 border-violet-500/10 animate-pulse"></div>
          
          {/* Spinner */}
          <div className="w-12 h-12 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-violet-500 border-l-transparent animate-spin"></div>
        </div>
        <p className="mt-6 text-sm font-medium tracking-wider text-slate-400 animate-pulse uppercase">
          Loading SingFlow...
        </p>
      </div>
    )
  }

  // 🔓 IMPORTANT: User login hone se PEHLE `pendingShare` check hoga
  // Isse bina login ke direct public link (localhost:5173/doc/xxxx) open ho jayega
  if (pendingShare) {
    return <Publicview shareId={pendingShare.docId} token={pendingShare.token} />
  }

  if (user) {
    return <Wireframe user={user} pendingShare={pendingShare} />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 select-none overflow-x-hidden">
      {view === 'login' ? (
        <Login setView={setView} />
      ) : (
        <Singup setView={setView} />
      )}
    </div>
  )
}

export default App