// ToastNotifier — listens to all automation CustomEvents and shows in-app toasts.
// Supports optional action buttons (used for credential expiry/reconnect flows).
// Appears bottom-right (above mobile nav). Auto-dismisses per-toast duration.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, MessageCircle, Link2, TrendingUp, Sun, Zap, UserMinus, Bot, Flame,
  RefreshCw, Calendar, Target, Brain, BookOpen, AlertTriangle, AlertCircle,
  CheckCircle2, Wifi, Cloud,
} from 'lucide-react'
import { triggerGoogleReauth } from '../utils/credentialHealth'

const DEFAULT_DURATION = 6000

const EVENT_CONFIG = {
  // Automation events
  'gmail-reply-detected':    { Icon: Mail,          cls: 'border-green-700/60 bg-green-900/30 text-green-200',     label: 'Email Reply',       duration: 6000 },
  'reddit-reply-detected':   { Icon: MessageCircle, cls: 'border-orange-700/60 bg-orange-900/30 text-orange-200', label: 'Reddit Reply',      duration: 6000 },
  'bitly-click-detected':    { Icon: Link2,         cls: 'border-brand-700/60 bg-brand-900/30 text-brand-200',    label: 'Link Clicked!',     duration: 6000 },
  'channel-escalate-reddit': { Icon: TrendingUp,    cls: 'border-yellow-700/60 bg-yellow-900/30 text-yellow-200', label: 'Channel Escalated', duration: 6000 },
  'morning-burst-ran':       { Icon: Sun,           cls: 'border-blue-700/60 bg-blue-900/30 text-blue-200',       label: 'Morning Burst',     duration: 6000 },
  'sales-automation-ran':    { Icon: Zap,           cls: 'border-purple-700/60 bg-purple-900/30 text-purple-200', label: 'Automation',        duration: 6000 },
  'contact-opted-out':       { Icon: UserMinus,     cls: 'border-red-700/60 bg-red-900/30 text-red-200',          label: 'Opt-Out Detected',  duration: 6000 },
  'auto-reply-drafted':      { Icon: Bot,           cls: 'border-teal-700/60 bg-teal-900/30 text-teal-200',       label: 'AI Draft Ready',    duration: 6000 },
  'link-click-hot':          { Icon: Flame,         cls: 'border-red-700/60 bg-red-900/30 text-red-200',          label: 'Hot Lead!',         duration: 6000 },
  'revival-ran':             { Icon: RefreshCw,     cls: 'border-indigo-700/60 bg-indigo-900/30 text-indigo-200', label: 'Re-Engage',         duration: 6000 },
  'nonclicker-ran':          { Icon: Target,        cls: 'border-yellow-700/60 bg-yellow-900/30 text-yellow-200', label: 'New Angle Sent',    duration: 6000 },
  'seasonal-campaign-ran':   { Icon: Calendar,      cls: 'border-purple-700/60 bg-purple-900/30 text-purple-200', label: 'Seasonal Campaign', duration: 6000 },
  'mq-auto-sent':            { Icon: Zap,           cls: 'border-green-700/60 bg-green-900/30 text-green-200',    label: 'Messages Sent',     duration: 6000 },
  'weekly-blast-ran':        { Icon: Mail,          cls: 'border-blue-700/60 bg-blue-900/30 text-blue-200',       label: 'Weekly Blast',      duration: 6000 },
  'hot-nurture-ran':         { Icon: Flame,         cls: 'border-red-700/60 bg-red-900/30 text-red-200',          label: 'Hot Nurture',       duration: 6000 },
  'osint-ran':               { Icon: Brain,         cls: 'border-teal-700/60 bg-teal-900/30 text-teal-200',       label: 'Goals Analyzed',    duration: 6000 },
  'blog-broadcast-ran':      { Icon: BookOpen,      cls: 'border-green-700/60 bg-green-900/30 text-green-200',    label: 'Blog Broadcast',    duration: 6000 },
  'coaching-checkin-ran':    { Icon: Target,        cls: 'border-brand-700/60 bg-brand-900/30 text-brand-200',    label: 'Coaching Check-In', duration: 6000 },
  'lost-deal-recovery-ran':  { Icon: RefreshCw,     cls: 'border-yellow-700/60 bg-yellow-900/30 text-yellow-200', label: 'Deal Recovery',     duration: 6000 },
  'upsell-ran':              { Icon: Zap,           cls: 'border-green-700/60 bg-green-900/30 text-green-200',    label: 'Upsell Queued',    duration: 6000 },
  // Credential events
  'credential-expiring':     { Icon: AlertTriangle, cls: 'border-yellow-600/70 bg-yellow-900/40 text-yellow-100', label: 'Token Expiring',    duration: 15000 },
  'credential-expired':      { Icon: AlertCircle,   cls: 'border-red-600/70 bg-red-900/40 text-red-100',          label: 'Disconnected',      duration: 20000 },
  'credential-reconnected':  { Icon: CheckCircle2,  cls: 'border-green-600/70 bg-green-900/40 text-green-100',    label: 'Reconnected',       duration: 8000  },
  // Drive sync events
  'drive-sync-saved':        { Icon: Cloud,         cls: 'border-blue-700/60 bg-blue-900/30 text-blue-200',       label: 'Drive Synced',      duration: 4000  },
  'drive-sync-loaded':       { Icon: Cloud,         cls: 'border-teal-700/60 bg-teal-900/30 text-teal-200',       label: 'Drive Loaded',      duration: 5000  },
}

function describe(name, d = {}) {
  switch (name) {
    case 'gmail-reply-detected':    return `${d.contactName} replied to your email`
    case 'reddit-reply-detected':   return `${d.contactName} replied on Reddit`
    case 'bitly-click-detected':    return `${d.contactName} clicked your link${d.clicks > 1 ? ` (${d.clicks}×)` : ''}`
    case 'channel-escalate-reddit': return `${d.contactName} — Reddit DM queued after ${d.days || '5'}d no reply`
    case 'morning-burst-ran':       return `${d.count} cold leads auto-enrolled in outreach`
    case 'sales-automation-ran':    return `${d.changes} pipeline action${d.changes !== 1 ? 's' : ''} completed`
    case 'contact-opted-out':       return `${d.contactName} opted out — marked Inactive`
    case 'auto-reply-drafted':      return `AI draft reply ready for ${d.contactName}`
    case 'link-click-hot':          return `${d.contactName} is HOT — follow-up queued to send`
    case 'revival-ran':             return `${d.count} silent contact${d.count !== 1 ? 's' : ''} re-enrolled in re-engage`
    case 'nonclicker-ran':          return `${d.count} non-clicker${d.count !== 1 ? 's' : ''} sent a new-angle follow-up`
    case 'seasonal-campaign-ran':   return `${d.count} message${d.count !== 1 ? 's' : ''} queued — ${(d.campaigns || []).join(', ')}`
    case 'mq-auto-sent':            return `${d.count} queued message${d.count !== 1 ? 's' : ''} delivered automatically`
    case 'weekly-blast-ran':        return `${d.count} weekly blast message${d.count !== 1 ? 's' : ''} queued to send`
    case 'hot-nurture-ran':         return `${d.count} hot lead${d.count !== 1 ? 's' : ''} getting a follow-up nudge`
    case 'osint-ran':               return `${d.count} contact${d.count !== 1 ? 's' : ''} analyzed — fitness goals extracted`
    case 'blog-broadcast-ran':      return `${d.count} subscriber${d.count !== 1 ? 's' : ''} sent today's health article`
    case 'coaching-checkin-ran':    return `${d.count} coaching check-in${d.count !== 1 ? 's' : ''} queued for this week`
    case 'lost-deal-recovery-ran':  return `${d.count} lost deal${d.count !== 1 ? 's' : ''} re-engaged with win-back sequence`
    case 'upsell-ran':              return `${d.count} customer${d.count !== 1 ? 's' : ''} queued a complementary product upsell`
    case 'credential-expiring':     return `${d.name} expires in ${d.minsLeft}m — reconnect to keep automation running`
    case 'credential-expired':      return `${d.name} session ended — automation paused until reconnected`
    case 'credential-reconnected':  return `${d.name || d.key} connected and active`
    case 'drive-sync-saved':        return 'CRM state saved to Google Drive'
    case 'drive-sync-loaded':       return 'Data loaded from Google Drive and merged'
    default:                        return ''
  }
}

// Returns optional { label, onClick } action for a toast
function getAction(name, d, navigate) {
  switch (name) {
    case 'credential-expiring':
    case 'credential-expired':
      if (d.key === 'google') {
        return {
          label: 'Reconnect',
          onClick: () => triggerGoogleReauth(),
        }
      }
      return {
        label: 'Settings',
        onClick: () => navigate('/settings'),
      }
    default:
      return null
  }
}

let _id = 0

export default function ToastNotifier() {
  const [toasts, setToasts] = useState([])
  const navigate = useNavigate()

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  const push = useCallback((name, detail) => {
    const cfg = EVENT_CONFIG[name]
    if (!cfg) return
    const msg = describe(name, detail)
    if (!msg) return
    const id     = ++_id
    const action = getAction(name, detail, navigate)
    const dur    = cfg.duration ?? DEFAULT_DURATION
    setToasts(prev => [...prev.slice(-4), { id, cfg, msg, action }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), dur)
  }, [navigate])

  useEffect(() => {
    const cleanup = Object.keys(EVENT_CONFIG).map(name => {
      const fn = e => push(name, e.detail || {})
      window.addEventListener(name, fn)
      return () => window.removeEventListener(name, fn)
    })
    return () => cleanup.forEach(fn => fn())
  }, [push])

  if (!toasts.length) return null

  return (
    <div
      className="fixed bottom-20 right-3 md:bottom-5 md:right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(({ id, cfg, msg, action }) => {
        const { Icon, cls, label } = cfg
        return (
          <div
            key={id}
            className={`toast-item pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-2xl max-w-xs ${cls}`}
          >
            <Icon size={13} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold">{label}</span>
              <span className="text-[11px] ml-1.5 opacity-75 leading-tight">{msg}</span>
              {action && (
                <button
                  onClick={() => { action.onClick(); dismiss(id) }}
                  className="block mt-1 text-[10px] font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
                >
                  {action.label} →
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(id)}
              className="ml-1 text-current opacity-40 hover:opacity-70 flex-shrink-0 text-xs leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
