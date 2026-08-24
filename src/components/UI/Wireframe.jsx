import React, { useEffect, useState } from 'react'
import Dashboard from './Dashboard'
import Sidebar from './Sidebar'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../../Lib/Firebase'
import { signOut as firebaseSignOut } from 'firebase/auth'
import DocmentsList from './DocmentsList'
import CreateDoc from '../CreateDoc'
import Docviewpage from '../Docviewpage'
import ActivityPage from './ActivityPage'

const Wireframe = ({ user, pendingShare }) => {
    const [screen, setScreen] = useState('home')
    const [profile, setProfile] = useState(null)
    const [createDocmodal, setcreateDocModal] = useState(false)
    const [openDoc, setOpenDoc] = useState(null)
    const [shareNotice, setShareNotice] = useState('')

    const handleSetScreen = (nextScreen) => {
        if (nextScreen !== 'documents') {
            setOpenDoc(null)
        }
        setScreen(nextScreen)
    }

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const docRef = doc(db, 'users', user.uid)
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                    setProfile(docSnap.data())
                } else {
                    // Fallback if the user does not have a Firestore doc yet
                    setProfile({
                        uid: user.uid,
                        email: user.email,
                        username: user.email.split('@')[0],
                        fullName: user.displayName || user.email.split('@')[0],
                        photoURL: user.photoURL || '',
                        createdAt: new Date().toISOString()
                    })
                }
            } catch (err) {
                console.error('Error fetching profile from Firestore:', err)
            } finally {
                // setLoading(false)
            }
        }
        fetchProfile()
    }, [user])

    useEffect(() => {
        if (!pendingShare?.docId || !pendingShare?.token || !user) return

        const openSharedDoc = async () => {
            try {
                const docRef = doc(db, 'documents', pendingShare.docId)
                const snap = await getDoc(docRef)
                if (!snap.exists()) {
                    setShareNotice('Shared document not found.')
                    return
                }
                const data = { id: snap.id, ...snap.data() }
                if (!data.publicShareEnabled || data.publicShareToken !== pendingShare.token) {
                    setShareNotice('This share link is invalid or expired.')
                    return
                }
                setOpenDoc(data)
                setScreen('documents')
                window.history.replaceState({}, '', window.location.pathname)
            } catch (err) {
                console.error('Share link error:', err)
                setShareNotice('Could not open shared document.')
            }
        }

        openSharedDoc()
    }, [pendingShare, user])

    const renderScreen = () => {
        switch (screen) {
            case 'home':
                return (
                    <Dashboard
                        user={user}
                        setScreen={handleSetScreen}
                        setcreateDocModal={setcreateDocModal}
                        setOpenDoc={setOpenDoc}
                    />
                )

            case 'documents':
                return openDoc ? (
                    <Docviewpage
                        docData={openDoc}
                        setOpenDoc={setOpenDoc}
                        user={user}
                    />
                ) : (
                    <div className="p-8 h-full">
                        <DocmentsList
                            setOpenDoc={setOpenDoc}
                            setScreen={handleSetScreen}
                            setcreateDocModal={setcreateDocModal}
                            user={user}
                        />
                    </div>
                )

            case 'activity':
                return <ActivityPage user={user} />

            default:
                return (
                    <Dashboard
                        user={user}
                        setScreen={handleSetScreen}
                        setcreateDocModal={setcreateDocModal}
                        setOpenDoc={setOpenDoc}
                    />
                )
        }
    }

    return (

        <div className="h-screen overflow-hidden bg-[#f8f9fb]">

            {/* Navbar */}
            <nav className="h-[64px] shrink-0 bg-white border-b border-[#e2e4e9] px-6">
                <div className="h-full flex items-center justify-between">

                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <span className="flex gap-1.5 items-center">
                            <span className="w-2.5 h-6 rounded-full bg-[#ff3d57] rotate-12" />
                            <span className="w-2.5 h-6 rounded-full bg-[#ff9f00] rotate-12" />
                            <span className="w-2.5 h-6 rounded-full bg-[#00ca72] rotate-12" />
                        </span>

                        <span className="text-[23px] font-extrabold text-[#1c1c1c] tracking-tight ml-1.5">
                            sing<span className="text-[#0073ea]">flow</span>
                        </span>
                    </div>

                    {/* Sign Out */}
                    <button
                        onClick={async () => {
                            try {
                                await firebaseSignOut(auth);
                                // redirect to login or root
                                window.location.href = '/';
                            } catch (err) {
                                console.error('Sign out failed:', err);
                                alert('Sign out failed. Please try again.');
                            }
                        }}
                        className="py-2 px-3.5 rounded-lg border border-[#d0d4dc]
                hover:bg-slate-50 text-slate-600 hover:text-slate-900
                text-xs font-medium transition-all active:scale-95
                flex items-center gap-2"
                    >
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                        </svg>

                        Sign Out
                    </button>

                </div>
            </nav>


            {/* Main Area */}
            <div className="flex h-[calc(100vh-64px)]">

                {/* Sidebar */}
                <aside className="w-[240px] shrink-0 bg-white border-r border-[#e2e4e9] overflow-hidden">
                    <Sidebar
                        profile={profile}
                        screen={screen}
                        setScreen={handleSetScreen}
                    />
                </aside>


                {/* Content */}
                <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                    {shareNotice && (
                        <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-100 text-[13px] text-amber-800">
                            {shareNotice}
                        </div>
                    )}
                    {renderScreen()}
                </main>

            </div>
            {
                createDocmodal && (
                    <CreateDoc
                        isOpen={createDocmodal}
                        onClose={() => setcreateDocModal(false)}
                    />
                )
            }
        </div>

    )
}

export default Wireframe