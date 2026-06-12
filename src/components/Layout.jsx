import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar, { BOTTOM_NAV } from './Sidebar'
import AutoAcquireManager from './AutoAcquireManager'

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <AutoAcquireManager />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, sticky in-flow on desktop */}
      <div
        className={`
          fixed md:sticky top-0 left-0 z-50 h-screen
          transform transition-transform duration-300 ease-in-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center text-white font-black text-xs">1P</div>
            <span className="text-white font-semibold text-sm">Phorm CRM</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-5 md:px-6 md:py-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex safe-bottom">
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  )
}
