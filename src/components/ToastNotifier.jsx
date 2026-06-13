// ToastNotifier — listens to all automation CustomEvents and shows in-app toast alerts.
// Appears bottom-right (above mobile nav). Dismisses automatically after 6 seconds.

import { useState, useEffect, useCallback } from 'react'
import { Mail, MessageCircle, Link2, TrendingUp, Sun, Zap, UserMinus } from 'lucide-react'

const DURATION = 6000

const EVENT_CONFIG = {
  'gmail-reply-detected':    { Icon: Mail,          cls: 'border-green-700/60 bg-green-900/30 text-green-200',  label: 'Email Reply' },
  'reddit-reply-detected':   { Icon: MessageCircle, cls: 'border-orange-700/60 bg-orange-900/30 text-orange-200', label: 'Reddit Reply' },
  'bitly-click-detected':    { Icon: Link2,         cls: 'border-brand-700/60 bg-brand-900/30 text-brand-200',  label: 'Link Clicked!' },
  'channel-escalate-reddit': { Icon: TrendingUp,    cls: 'border-yellow-700/60 bg-yellow-900/30 text-yellow-200', label: 'Channel Escalated' },
  'morning-burst-ran':       { Icon: Sun,           cls: 'border-blue-700/60 bg-blue-900/30 text-blue-200',     label: 'Morning Burst' },
  'sales-automation-ran':    { Icon: Zap,           cls: 'border-purple-700/60 bg-purple-900/30 text-purple-200', label: 'Automation' },
  'contact-opted-out':       { Icon: UserMinus,     cls: 'border-red-700/60 bg-red-900/30 text-red-200',        label: 'Opt-Out Detected' },
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
    default:                        return ''
  }
}

let _id = 0

export default function ToastNotifier() {
  const [toasts, setToasts] = useState([])

  const push = useCallback((name, detail) => {
    const cfg = EVENT_CONFIG[name]
    if (!cfg) return
    const msg = describe(name, detail)
    if (!msg) return
    const id = ++_id
    setToasts(prev => [...prev.slice(-4), { id, cfg, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION)
  }, [])

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

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
      {toasts.map(({ id, cfg, msg }) => {
        const { Icon, cls, label } = cfg
        return (
          <div
            key={id}
            className={`toast-item pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-2xl max-w-xs ${cls}`}
          >
            <Icon size={13} className="flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-bold">{label}</span>
              <span className="text-[11px] ml-1.5 opacity-75 leading-tight">{msg}</span>
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
