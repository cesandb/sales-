import { useMemo, useState } from 'react'
import { differenceInDays, parseISO, isToday, isBefore } from 'date-fns'
import { AlertTriangle, Clock, Sparkles, ChevronRight, Bell, Flame, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'

function ActionItem({ icon: Icon, iconClass, label, sub, to, onClick }) {
  const inner = (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors group cursor-pointer">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconClass}`}>
        <Icon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-tight">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-1" />
    </div>
  )
  if (to) return <Link to={to}>{inner}</Link>
  if (onClick) return <button className="w-full text-left" onClick={onClick}>{inner}</button>
  return inner
}

export default function DailyDigest({ onOpenContact }) {
  const { contacts, followups, linkShares, pipeline, interactions } = useStore()
  const [dismissed, setDismissed] = useState(false)

  const actions = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const urgent = []
    const today = []
    const smart = []

    // ── Overdue follow-ups ──────────────────────────────────────────────────
    followups
      .filter(f => f.status === 'pending' && f.date < todayStr)
      .slice(0, 3)
      .forEach(f => {
        const contact = contacts.find(c => c.id === f.contactId)
        if (!contact) return
        const daysLate = differenceInDays(now, parseISO(f.date))
        urgent.push({
          key: f.id,
          icon: AlertTriangle,
          iconClass: 'bg-red-900/40 text-red-400',
          label: `Follow up with ${contact.name}`,
          sub: `${daysLate} day${daysLate > 1 ? 's' : ''} overdue`,
          to: '/followups',
        })
      })

    // ── Due today ───────────────────────────────────────────────────────────
    followups
      .filter(f => f.status === 'pending' && f.date === todayStr)
      .slice(0, 3)
      .forEach(f => {
        const contact = contacts.find(c => c.id === f.contactId)
        if (!contact) return
        today.push({
          key: f.id + '-today',
          icon: Bell,
          iconClass: 'bg-orange-900/40 text-orange-400',
          label: `Follow up with ${contact.name} today`,
          sub: f.notes || 'Scheduled follow-up',
          to: '/followups',
        })
      })

    // ── Shared links with no follow-up after 3 days ─────────────────────────
    linkShares
      .filter(ls => {
        if (ls.followedUp) return false
        return differenceInDays(now, parseISO(ls.date)) >= 3
      })
      .slice(0, 3)
      .forEach(ls => {
        const contact = contacts.find(c => c.id === ls.contactId)
        const product = PRODUCTS.find(p => p.id === ls.productId)
        if (!contact) return
        const daysAgo = differenceInDays(now, parseISO(ls.date))
        urgent.push({
          key: ls.id,
          icon: Flame,
          iconClass: 'bg-orange-900/40 text-orange-400',
          label: `${contact.name} hasn't been followed up`,
          sub: `${product?.name || 'Link'} shared ${daysAgo} days ago`,
          onClick: () => onOpenContact?.(contact),
        })
      })

    // ── Leads going cold ────────────────────────────────────────────────────
    contacts
      .filter(c => {
        if (c.status !== 'Hot Lead' && c.status !== 'Warm Lead') return false
        if (!c.lastContact) return differenceInDays(now, parseISO(c.createdAt)) > 3
        return differenceInDays(now, parseISO(c.lastContact)) > 5
      })
      .slice(0, 2)
      .forEach(c => {
        const days = c.lastContact
          ? differenceInDays(now, parseISO(c.lastContact))
          : differenceInDays(now, parseISO(c.createdAt))
        today.push({
          key: c.id + '-cold',
          icon: Flame,
          iconClass: 'bg-yellow-900/40 text-yellow-400',
          label: `${c.name} is going cold`,
          sub: `${c.status} · No contact for ${days} day${days > 1 ? 's' : ''}`,
          onClick: () => onOpenContact?.(c),
        })
      })

    // ── Smart: customers with no upsell attempt ─────────────────────────────
    contacts
      .filter(c => {
        if (c.status !== 'Customer') return false
        const myInteractions = interactions.filter(i => i.contactId === c.id)
        const hasRecommendation = myInteractions.some(i => i.type === 'Recommendation')
        return !hasRecommendation
      })
      .slice(0, 2)
      .forEach(c => {
        smart.push({
          key: c.id + '-upsell',
          icon: Sparkles,
          iconClass: 'bg-brand-900/40 text-brand-400',
          label: `Recommend a product to ${c.name}`,
          sub: 'Customer with no product recommendation yet',
          to: '/discover',
        })
      })

    // ── Smart: pipeline stalled ────────────────────────────────────────────
    pipeline
      .filter(p => {
        if (p.stage === 'Purchased' || p.stage === 'Repeat/Upsell') return false
        return differenceInDays(now, parseISO(p.updatedAt)) > 7
      })
      .slice(0, 2)
      .forEach(p => {
        const contact = contacts.find(c => c.id === p.contactId)
        if (!contact) return
        smart.push({
          key: p.id + '-stalled',
          icon: Clock,
          iconClass: 'bg-blue-900/40 text-blue-400',
          label: `${contact.name} stalled in pipeline`,
          sub: `${p.stage} for ${differenceInDays(now, parseISO(p.updatedAt))} days`,
          to: '/pipeline',
        })
      })

    return { urgent, today, smart }
  }, [contacts, followups, linkShares, pipeline, interactions])

  const total = actions.urgent.length + actions.today.length + actions.smart.length

  if (total === 0 || dismissed) {
    return (
      <div className="card flex items-center gap-3 border-green-800/40 bg-green-900/5">
        <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">You're all caught up!</p>
          <p className="text-xs text-gray-400">No urgent actions right now. Keep adding contacts and sharing links.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-1 p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-600/20 flex items-center justify-center">
            <Sparkles size={12} className="text-brand-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Today's Actions</h2>
          <span className="text-xs font-semibold bg-brand-600 text-white px-1.5 py-0.5 rounded-full">{total}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* Urgent */}
      {actions.urgent.length > 0 && (
        <div className="px-2">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide px-2 py-1">
            Urgent · {actions.urgent.length}
          </p>
          {actions.urgent.map(a => <ActionItem key={a.key} {...a} />)}
        </div>
      )}

      {/* Today */}
      {actions.today.length > 0 && (
        <div className="px-2">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide px-2 py-1">
            Do Today · {actions.today.length}
          </p>
          {actions.today.map(a => <ActionItem key={a.key} {...a} />)}
        </div>
      )}

      {/* Smart suggestions */}
      {actions.smart.length > 0 && (
        <div className="px-2 pb-2">
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide px-2 py-1">
            Smart Suggestions · {actions.smart.length}
          </p>
          {actions.smart.map(a => <ActionItem key={a.key} {...a} />)}
        </div>
      )}
    </div>
  )
}
