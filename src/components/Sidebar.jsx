import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, GitBranch, Package, Bell,
  MessageSquare, BarChart3, Target, ExternalLink, ChevronRight,
  Compass, Radar, Megaphone, DollarSign,
} from 'lucide-react'

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts',    icon: Users,           label: 'Contacts' },
  { to: '/pipeline',    icon: GitBranch,       label: 'Pipeline' },
  { to: '/discover',    icon: Compass,         label: 'Recommender' },
  { to: '/followups',   icon: Bell,            label: 'Follow-ups' },
  { to: '/reach',       icon: Radar,           label: 'Reach Intel' },
  { to: '/campaigns',   icon: Megaphone,       label: 'Campaigns' },
  { to: '/commissions', icon: DollarSign,      label: 'Commissions' },
  { to: '/products',    icon: Package,         label: 'Products' },
  { to: '/templates',   icon: MessageSquare,   label: 'Templates' },
  { to: '/analytics',   icon: BarChart3,       label: 'Analytics' },
  { to: '/goals',       icon: Target,          label: 'Goals' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-black text-sm">1P</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Phorm CRM</p>
            <p className="text-gray-500 text-xs">Conan's Sales Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Quick link to storefront */}
      <div className="px-3 pb-4">
        <a
          href="https://1stphorm.com/Conan"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-gray-500 hover:text-brand-400 hover:bg-gray-800 transition-colors"
        >
          <ExternalLink size={13} />
          My 1st Phorm Store
          <ChevronRight size={12} className="ml-auto" />
        </a>
      </div>
    </aside>
  )
}
