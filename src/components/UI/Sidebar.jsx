import React from 'react'
import { Home, FileText, Activity, Settings, CircleUserRound } from 'lucide-react'

const Sidebar = ({ screen, profile, setScreen }) => {

    const menuItems = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
        },
        {
            id: 'documents',
            label: 'Documents',
            icon: FileText,
        },
        {
            id: 'activity',
            label: 'Activity',
            icon: Activity,
        },
        // {
        //     id: 'Settings ',
        //     label: 'Settings ',
        //     icon: Settings,
        // },

    ]

    return (
        <aside className="w-full h-full bg-white px-3 py-5 flex flex-col">



            <div className="space-y-1">

                {menuItems.map((item) => {

                    const Icon = item.icon

                    return (
                        <button
                            key={item.id}
                            onClick={() => setScreen(item.id)}
                            className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${screen === item.id
                                    ? 'bg-blue-50 text-[#0073ea]'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >

                            <Icon className="w-5 h-5" />

                            <span>
                                {item.label}
                            </span>

                        </button>
                    )
                })}

            </div>



            <div className="mt-auto pt-4 border-t border-[#e2e4e9]">

                <button className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[#0073ea] shrink-0">
                        <CircleUserRound className="w-5 h-5" />
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                            {profile?.fullName || 'User'}

                        </p>

                        <p className="text-xs text-slate-400 truncate">
                            {profile?.email || 'user@email.com'}
                            {/* rohansingh@gmail.com */}
                        </p>
                    </div>




                </button>

            </div>

        </aside>
    )
}

export default Sidebar