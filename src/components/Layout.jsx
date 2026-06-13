import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, MoreHorizontal, X, ExternalLink, ChevronRight, KeyRound, LogOut } from 'lucide-react'
import Sidebar, { BOTTOM_NAV, NAV } from './Sidebar'
import AutoAcquireManager from './AutoAcquireManager'
import PipelineAutomationEngine from './PipelineAutomationEngine'
import GoogleSync from './GoogleSync'
import OutreachAutoSender from './OutreachAutoSender'
import SalesAutomationEngine from './SalesAutomationEngine'
import RedditDMSender from './RedditDMSender'
import DigestSender from './DigestSender'
import GmailReplyMonitor from './GmailReplyMonitor'
import RedditInboxMonitor from './RedditInboxMonitor'
import BitlyMonitor from './BitlyMonitor'
import ChannelEscalationEngine from './ChannelEscalationEngine'
import AutoReplyDrafter from './AutoReplyDrafter'
import LinkClickConversionEngine from './LinkClickConversionEngine'
import RevivalEngine from './RevivalEngine'
import NonClickerEngine from './NonClickerEngine'
import SeasonalCampaignEngine from './SeasonalCampaignEngine'
import MQAutoSender from './MQAutoSender'
import WeeklyBlastEngine from './WeeklyBlastEngine'
import HotLeadNurtureEngine from './HotLeadNurtureEngine'
import ToastNotifier from './ToastNotifier'
import { useAuth } from './AuthGate'

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const { logout, changePassword } = useAuth()

  function closeMore() { setMoreOpen(false) }

  return (
    <div className="flex min-h-screen">
      <AutoAcquireManager />
      <PipelineAutomationEngine />
      <GoogleSync />
      <OutreachAutoSender />
      <SalesAutomationEngine />
      <RedditDMSender />
      <DigestSender />
      <GmailReplyMonitor />
      <RedditInboxMonitor />
      <BitlyMonitor />
      <ChannelEscalationEngine />
      <AutoReplyDrafter />
      <LinkClickConversionEngine />
      <RevivalEngine />
      <NonClickerEngine />
      <SeasonalCampaignEngine />
      <MQAutoSender />
      <WeeklyBlastEngine />
      <HotLeadNurtureEngine />
      <ToastNotifier />

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
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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

        {/* ── Mobile bottom navigation ── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex safe-bottom">
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-xs font-medium transition-colors ${
                  isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Show all pages"
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px]">More</span>
          </button>
        </nav>

        {/* ── More sheet (bottom drawer with all pages) ── */}
        {moreOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={closeMore}
            />
            <div className="more-sheet fixed bottom-0 inset-x-0 z-50 md:hidden bg-gray-900 border-t border-gray-800 rounded-t-2xl max-h-[88vh] overflow-y-auto safe-bottom">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3">
                <span className="font-bold text-white text-base">All Pages</span>
                <button
                  onClick={closeMore}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Nav grid — 3 columns of icon tiles */}
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                {NAV.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={closeMore}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border transition-colors text-center ${
                        isActive
                          ? 'bg-brand-600/20 border-brand-700/30 text-brand-400'
                          : 'bg-gray-800/60 border-gray-700/30 text-gray-400 active:bg-gray-700'
                      }`
                    }
                  >
                    <Icon size={22} />
                    <span className="text-[11px] font-medium leading-tight">{label}</span>
                  </NavLink>
                ))}
              </div>

              {/* Divider + quick-action row */}
              <div className="px-4 pt-2 pb-4 border-t border-gray-800 space-y-2">
                <a
                  href="https://1stphorm.com/Conan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-brand-600/10 border border-brand-700/30 text-sm text-brand-300 active:bg-brand-600/20 transition-colors"
                >
                  <ExternalLink size={16} />
                  <span className="font-medium">My 1st Phorm Store</span>
                  <ChevronRight size={14} className="ml-auto opacity-60" />
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { changePassword(); closeMore() }}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gray-800/60 border border-gray-700/30 text-xs text-gray-400 active:bg-gray-700 transition-colors"
                  >
                    <KeyRound size={14} />
                    Change Password
                  </button>
                  <button
                    onClick={() => { logout(); closeMore() }}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-900/20 border border-red-800/30 text-xs text-red-400 active:bg-red-900/30 transition-colors"
                  >
                    <LogOut size={14} />
                    Lock App
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
