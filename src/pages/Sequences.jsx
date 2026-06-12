import { useState, useMemo, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import { matchProduct, buildUTMLink, DEFAULT_SEQUENCES, STEP_MESSAGES } from '../utils/affiliateLinks'
import { generateOutreachDraft, getApiKey } from '../utils/aiDraft'
import { addDays, isPast, isToday, differenceInDays, parseISO, format } from 'date-fns'
import {
  Zap, Target, DollarSign, Send, Users, CheckCircle, SkipForward,
  ChevronDown, ChevronUp, Copy, Check, RefreshCw, Sparkles, Phone,
  Mail, ExternalLink, Search, Plus, X, Play, Pause, TrendingUp,
  Clock, AlertCircle, ArrowRight, List, RotateCcw,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
function stepDueDate(enrolledAt, dayOffset) {
  return addDays(parseISO(enrolledAt), dayOffset)
}

function getSequence(id) {
  return DEFAULT_SEQUENCES.find(s => s.id === id)
}

// ── Revenue Goal Tracker ──────────────────────────────────────────────────────
function RevenueGoalTracker({ contactProducts, settings, enrollments }) {
  const GOAL = 10000
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()
  const dayOfMonth = now.getDate()

  const earned = contactProducts
    .filter(cp => {
      const d = new Date(cp.purchaseDate)
      return d >= monthStart && d <= now
    })
    .reduce((sum, cp) => sum + cp.orderValue * (cp.commissionRate || settings.commissionRate), 0)

  const pct = Math.min(100, Math.round((earned / GOAL) * 100))
  const dailyRate = dayOfMonth > 1 ? earned / (dayOfMonth - 1) : 0
  const projected = Math.round(dailyRate * daysInMonth)
  const remaining = Math.max(0, GOAL - earned)
  const daysLeft = daysInMonth - dayOfMonth
  const neededPerDay = daysLeft > 0 ? (remaining / daysLeft).toFixed(0) : '0'

  const activeEnrollments = enrollments.filter(e => e.status === 'active').length

  return (
    <div className="card border border-brand-700/30 bg-gradient-to-br from-brand-900/20 to-gray-900">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-brand-400" />
          <h2 className="font-bold text-white">Monthly Revenue Goal</h2>
        </div>
        <span className="text-xs text-gray-500">{format(now, 'MMMM yyyy')}</span>
      </div>

      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-black text-white">${earned.toFixed(0)}</span>
        <span className="text-gray-500 text-sm mb-1">/ $10,000 commission goal</span>
      </div>

      <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-brand-600 to-brand-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mb-5">
        <span className="text-gray-500">{pct}% complete</span>
        <span className={remaining > 0 ? 'text-yellow-400 font-semibold' : 'text-green-400 font-semibold'}>
          {remaining > 0 ? `$${remaining.toFixed(0)} to go` : 'Goal reached! 🎉'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Projected', value: `$${projected.toLocaleString()}`, sub: 'end of month', highlight: projected >= GOAL },
          { label: 'Need/Day', value: `$${neededPerDay}`, sub: `${daysLeft} days left`, highlight: false },
          { label: 'Active Drips', value: activeEnrollments, sub: 'contacts in seq.', highlight: false },
          { label: 'Avg Order', value: `$${settings.avgOrderValue}`, sub: `${(settings.commissionRate * 100).toFixed(0)}% comm.`, highlight: false },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-gray-800/50 rounded-xl p-2.5 text-center">
            <p className={`text-sm font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
            <p className="text-[10px] text-gray-600 leading-tight">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Send Item (one due step) ──────────────────────────────────────────────────
function SendItem({ enrollment, contact, seq, step, interactions, onSent, onSkip }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [platform, setPlatform] = useState(() => {
    if (contact.phone) return 'sms'
    if (contact.email) return 'email'
    return 'copy'
  })

  const product = useMemo(() => matchProduct(contact), [contact])
  const utmLink = useMemo(
    () => buildUTMLink(product.url, { contactId: contact.id, medium: 'sequence', stepKey: step.stepKey }),
    [product, contact.id, step.stepKey]
  )

  const daysOverdue = useMemo(() => {
    const due = stepDueDate(enrollment.enrolledAt, step.day)
    return differenceInDays(new Date(), due)
  }, [enrollment.enrolledAt, step.day])

  function buildDefaultDraft() {
    const fn = STEP_MESSAGES[step.stepKey]
    return fn ? fn(contact.name.split(' ')[0], product.name, utmLink) : `Hey ${contact.name.split(' ')[0]}! ${utmLink}`
  }

  async function generateAiDraft() {
    if (!getApiKey()) return
    setLoading(true)
    try {
      const text = await generateOutreachDraft({
        contact,
        interactions,
        platform: platform === 'sms' ? 'Text/SMS' : platform === 'email' ? 'Email' : 'Instagram DM',
        productName: product.name,
        context: `Sequence: ${seq.name}, Step: ${step.label}. Include this affiliate link: ${utmLink}`,
      })
      setDraft(text)
    } catch {
      setDraft(buildDefaultDraft())
    }
    setLoading(false)
  }

  function handleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && !draft) setDraft(buildDefaultDraft())
  }

  async function copy() {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getSendHref() {
    if (!draft) return null
    if (platform === 'sms' && contact.phone)
      return `sms:${contact.phone.replace(/\D/g, '')}${encodeURIComponent('&body=' + draft)}`
    if (platform === 'email' && contact.email)
      return `mailto:${contact.email}?subject=${encodeURIComponent(`Hey ${contact.name.split(' ')[0]}!`)}&body=${encodeURIComponent(draft)}`
    if (platform === 'ig' && contact.social)
      return `https://instagram.com/${contact.social.replace('@', '').trim()}`
    return null
  }

  const sendHref = getSendHref()
  const isOverdue = daysOverdue > 0
  const isUrgent = daysOverdue > 2

  return (
    <div className={`card p-0 overflow-hidden border ${isUrgent ? 'border-red-700/40' : isOverdue ? 'border-orange-700/30' : 'border-gray-700/30'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-sm flex-shrink-0">
          {contact.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm">{contact.name}</p>
            <span className={`badge text-[10px] ${seq.bgClass} ${seq.colorClass}`}>{step.label}</span>
            {isOverdue && (
              <span className={`badge text-[10px] ${isUrgent ? 'bg-red-900/40 text-red-300' : 'bg-orange-900/40 text-orange-300'}`}>
                {isOverdue ? `${daysOverdue}d overdue` : 'Due today'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">
            {seq.name} · {product.name} · Step {enrollment.currentStep + 1}/{seq.steps.length}
          </p>
        </div>
        <button
          onClick={handleExpand}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          {/* Product + link */}
          <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">Matched product:</span>
            <span className="text-xs text-brand-400 font-semibold">{product.name}</span>
            <a href={utmLink} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-gray-500 hover:text-brand-400 flex items-center gap-1">
              <ExternalLink size={10} /> Preview link
            </a>
          </div>

          {/* Platform selector */}
          <div className="flex gap-1.5">
            {[
              { id: 'sms',   label: 'SMS',      icon: Phone,        disabled: !contact.phone },
              { id: 'email', label: 'Email',     icon: Mail,         disabled: !contact.email },
              { id: 'ig',    label: 'Instagram', icon: ExternalLink, disabled: !contact.social },
              { id: 'copy',  label: 'Copy',      icon: Copy,         disabled: false },
            ].map(({ id, label, icon: Ic, disabled }) => (
              <button
                key={id}
                disabled={disabled}
                onClick={() => setPlatform(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  platform === id
                    ? 'bg-brand-600 text-white'
                    : disabled ? 'bg-gray-800/40 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Ic size={11} /> {label}
              </button>
            ))}
            <button
              onClick={generateAiDraft}
              disabled={loading || !getApiKey()}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-brand-400 bg-gray-800 transition-colors"
              title={getApiKey() ? 'AI-personalize this draft' : 'Add API key in Settings for AI drafts'}
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {loading ? 'Drafting…' : 'AI Draft'}
            </button>
          </div>

          {/* Draft */}
          <div className="relative">
            <textarea
              className="input text-sm min-h-[100px] resize-none pr-8"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            {draft && (
              <button onClick={copy} className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300">
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {sendHref && platform !== 'copy' ? (
              <a
                href={sendHref}
                target={platform === 'ig' ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold"
              >
                <Send size={13} />
                {platform === 'sms' ? 'Open SMS' : platform === 'email' ? 'Open Email' : 'Open Instagram'}
              </a>
            ) : (
              <button
                onClick={copy}
                disabled={!draft}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Message</>}
              </button>
            )}
            <button
              onClick={() => onSent(enrollment, seq)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-green-900/40 hover:bg-green-800/50 text-green-400 text-sm font-semibold"
              title="Mark as sent — advances to next step"
            >
              <CheckCircle size={14} /> Sent
            </button>
            <button
              onClick={() => onSkip(enrollment)}
              className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"
              title="Skip this step"
            >
              <SkipForward size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Today's Sends ─────────────────────────────────────────────────────────────
function TodaysSends({ enrollments, contacts, interactions, onSent, onSkip }) {
  const dueItems = useMemo(() => {
    const now = new Date()
    const items = []
    for (const enr of enrollments) {
      if (enr.status !== 'active') continue
      const contact = contacts.find(c => c.id === enr.contactId)
      if (!contact) continue
      const seq = getSequence(enr.sequenceId)
      if (!seq) continue
      const step = seq.steps[enr.currentStep]
      if (!step) continue
      const dueDate = stepDueDate(enr.enrolledAt, step.day)
      if (isPast(dueDate) || isToday(dueDate)) {
        items.push({ enrollment: enr, contact, seq, step, dueDate })
      }
    }
    return items.sort((a, b) => a.dueDate - b.dueDate)
  }, [enrollments, contacts])

  if (dueItems.length === 0) {
    return (
      <div className="card border border-gray-700/30">
        <div className="flex items-center gap-2 mb-3">
          <Send size={16} className="text-brand-400" />
          <h2 className="font-bold text-white">Today's Sequence Sends</h2>
          <span className="badge bg-gray-800 text-gray-500 text-[10px] ml-auto">0 due</span>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          No sequence steps due today. Enroll contacts below to start drips.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Send size={16} className="text-brand-400" />
        <h2 className="font-bold text-white">Today's Sequence Sends</h2>
        <span className="badge bg-brand-900/40 text-brand-300 text-[10px] ml-auto">{dueItems.length} due</span>
      </div>
      <div className="space-y-2">
        {dueItems.map(({ enrollment, contact, seq, step }) => (
          <SendItem
            key={enrollment.id + '-' + enrollment.currentStep}
            enrollment={enrollment}
            contact={contact}
            seq={seq}
            step={step}
            interactions={interactions}
            onSent={onSent}
            onSkip={onSkip}
          />
        ))}
      </div>
    </div>
  )
}

// ── Auto-Enroll Banner ────────────────────────────────────────────────────────
function AutoEnrollBanner({ contacts, enrollments, onEnroll }) {
  const suggestions = useMemo(() => {
    const activeContactIds = new Set(
      enrollments.filter(e => e.status === 'active').map(e => e.contactId)
    )
    const result = []
    for (const seq of DEFAULT_SEQUENCES) {
      if (!seq.autoEnrollTags.length) continue
      const eligible = contacts.filter(c => {
        if (activeContactIds.has(c.id)) return false
        if (c.status === 'Inactive') return false
        const tags = (c.tags || []).map(t => t.toLowerCase())
        return seq.autoEnrollTags.some(t => tags.includes(t))
      })
      if (eligible.length > 0) result.push({ seq, eligible })
    }
    return result
  }, [contacts, enrollments])

  if (!suggestions.length) return null

  return (
    <div className="card border border-yellow-700/30 bg-yellow-900/10">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={15} className="text-yellow-400" />
        <h3 className="text-sm font-bold text-yellow-300">Auto-Enrollment Suggestions</h3>
      </div>
      <div className="space-y-2">
        {suggestions.map(({ seq, eligible }) => (
          <div key={seq.id} className="flex items-center justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-white">{eligible.length} contacts ready for <span className={seq.colorClass}>{seq.name}</span></p>
              <p className="text-xs text-gray-500 truncate">Tags: {seq.autoEnrollTags.slice(0, 4).join(', ')}</p>
            </div>
            <button
              onClick={() => eligible.forEach(c => onEnroll(c.id, seq.id))}
              className="btn-primary text-xs px-3 py-1.5 flex-shrink-0 flex items-center gap-1.5"
            >
              <Plus size={11} /> Enroll All
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Enroll Contact ────────────────────────────────────────────────────────────
function EnrollContact({ contacts, enrollments, onEnroll }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedSeqId, setSelectedSeqId] = useState(DEFAULT_SEQUENCES[0].id)

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return contacts
      .filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [contacts, query])

  const activeIds = useMemo(() => new Set(
    enrollments.filter(e => e.status === 'active' && e.sequenceId === selectedSeqId).map(e => e.contactId)
  ), [enrollments, selectedSeqId])

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full card border border-dashed border-gray-700 hover:border-brand-700 text-gray-500 hover:text-brand-400 flex items-center justify-center gap-2 py-3 text-sm transition-colors">
      <Plus size={15} /> Manually enroll a contact in a sequence
    </button>
  )

  return (
    <div className="card border border-gray-700/40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Enroll Contact</h3>
        <button onClick={() => { setOpen(false); setQuery('') }} className="text-gray-500 hover:text-white"><X size={15} /></button>
      </div>
      <div className="space-y-3">
        <div className="flex gap-2">
          {DEFAULT_SEQUENCES.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSeqId(s.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${selectedSeqId === s.id ? `${s.bgClass} ${s.colorClass} border-current` : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
            >
              {s.name.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input pl-8 text-sm"
            placeholder="Search contacts by name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {filtered.length > 0 && (
          <div className="space-y-1">
            {filtered.map(c => {
              const enrolled = activeIds.has(c.id)
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.status} · {(c.tags || []).slice(0, 3).join(', ')}</p>
                  </div>
                  <button
                    onClick={() => { onEnroll(c.id, selectedSeqId); setQuery('') }}
                    disabled={enrolled}
                    className={`text-xs px-2.5 py-1 rounded-md flex-shrink-0 ${enrolled ? 'bg-green-900/40 text-green-400' : 'btn-primary'}`}
                  >
                    {enrolled ? '✓ Enrolled' : 'Enroll'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {query.trim() && filtered.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-2">No contacts found for "{query}"</p>
        )}
      </div>
    </div>
  )
}

// ── Active Enrollments List ───────────────────────────────────────────────────
function EnrollmentList({ enrollments, contacts, onRemove, onPause, onResume }) {
  const [filter, setFilter] = useState('active')
  const [open, setOpen] = useState(false)

  const items = useMemo(() => {
    return enrollments
      .filter(e => filter === 'all' || e.status === filter)
      .map(e => {
        const contact = contacts.find(c => c.id === e.contactId)
        const seq = getSequence(e.sequenceId)
        if (!contact || !seq) return null
        const step = seq.steps[e.currentStep] || seq.steps[seq.steps.length - 1]
        const nextDue = e.status === 'active' && step && e.currentStep < seq.steps.length
          ? stepDueDate(e.enrolledAt, step.day)
          : null
        return { e, contact, seq, step, nextDue }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.nextDue && b.nextDue) return a.nextDue - b.nextDue
        return 0
      })
  }, [enrollments, contacts, filter])

  const counts = useMemo(() => ({
    active: enrollments.filter(e => e.status === 'active').length,
    paused: enrollments.filter(e => e.status === 'paused').length,
    completed: enrollments.filter(e => e.status === 'completed').length,
  }), [enrollments])

  return (
    <div className="card border border-gray-700/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <List size={16} className="text-gray-400" />
          <span className="font-bold text-white text-sm">Active Enrollments</span>
          <span className="badge bg-brand-900/40 text-brand-300 text-[10px]">{counts.active} active</span>
          {counts.paused > 0 && <span className="badge bg-yellow-900/40 text-yellow-400 text-[10px]">{counts.paused} paused</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-1.5">
            {[['active', 'Active'], ['paused', 'Paused'], ['completed', 'Done'], ['all', 'All']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${filter === val ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {label} {val !== 'all' && counts[val] !== undefined && `(${counts[val]})`}
              </button>
            ))}
          </div>

          {items.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No {filter} enrollments.</p>
          )}

          <div className="space-y-1.5">
            {items.map(({ e, contact, seq, step, nextDue }) => (
              <div key={e.id} className="flex items-center gap-3 bg-gray-800/30 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white">{contact.name}</p>
                    <span className={`text-[10px] badge ${seq.bgClass} ${seq.colorClass}`}>{seq.name.split(' ').slice(0, 2).join(' ')}</span>
                    {e.status === 'paused' && <span className="text-[10px] badge bg-yellow-900/40 text-yellow-400">Paused</span>}
                    {e.status === 'completed' && <span className="text-[10px] badge bg-green-900/40 text-green-400">Done</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Step {Math.min(e.currentStep + 1, seq.steps.length)}/{seq.steps.length}
                    {step && ` · ${step.label}`}
                    {nextDue && ` · Due ${isToday(nextDue) ? 'today' : isPast(nextDue) ? `${differenceInDays(new Date(), nextDue)}d ago` : format(nextDue, 'MMM d')}`}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {e.status === 'active' && (
                    <button onClick={() => onPause(e.id)} title="Pause" className="p-1.5 rounded text-gray-500 hover:text-yellow-400 hover:bg-gray-800">
                      <Pause size={12} />
                    </button>
                  )}
                  {e.status === 'paused' && (
                    <button onClick={() => onResume(e.id)} title="Resume" className="p-1.5 rounded text-gray-500 hover:text-green-400 hover:bg-gray-800">
                      <Play size={12} />
                    </button>
                  )}
                  <button onClick={() => onRemove(e.id)} title="Remove enrollment" className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sequence Library ──────────────────────────────────────────────────────────
function SequenceLibrary({ enrollments }) {
  const [open, setOpen] = useState(false)

  const stats = useMemo(() => {
    const m = {}
    for (const seq of DEFAULT_SEQUENCES) {
      m[seq.id] = {
        active: enrollments.filter(e => e.sequenceId === seq.id && e.status === 'active').length,
        completed: enrollments.filter(e => e.sequenceId === seq.id && e.status === 'completed').length,
      }
    }
    return m
  }, [enrollments])

  return (
    <div className="card border border-gray-700/30">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-gray-400" />
          <span className="font-bold text-white text-sm">Sequence Library</span>
          <span className="text-xs text-gray-600">({DEFAULT_SEQUENCES.length} sequences)</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {DEFAULT_SEQUENCES.map(seq => (
            <div key={seq.id} className={`rounded-xl border p-4 ${seq.bgClass}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className={`font-semibold text-sm ${seq.colorClass}`}>{seq.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{seq.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">{stats[seq.id]?.active || 0}</p>
                  <p className="text-[10px] text-gray-500">active</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                {seq.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${seq.bgClass} ${seq.colorClass}`}>
                      Day {step.day}: {step.label}
                    </div>
                    {i < seq.steps.length - 1 && <ArrowRight size={10} className="text-gray-600" />}
                  </div>
                ))}
              </div>
              {seq.autoEnrollTags.length > 0 && (
                <p className="text-[10px] text-gray-600 mt-2">
                  Auto-enroll tags: {seq.autoEnrollTags.join(', ')}
                </p>
              )}
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>{stats[seq.id]?.completed || 0} completed</span>
                <span>{seq.steps.length} steps</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Sequences() {
  const {
    contacts, interactions, contactProducts, enrollments, settings,
    addEnrollment, advanceEnrollment, updateEnrollment, deleteEnrollment, addInteraction,
  } = useStore()

  function handleEnroll(contactId, sequenceId) {
    addEnrollment({ contactId, sequenceId })
  }

  function handleSent(enrollment, seq) {
    addInteraction({
      contactId: enrollment.contactId,
      type: 'sequence_step',
      notes: `Sequence: ${seq.name}, Step ${enrollment.currentStep + 1}: ${seq.steps[enrollment.currentStep]?.label}`,
      channel: 'outreach',
    })
    advanceEnrollment(enrollment.id, seq.steps.length)
  }

  function handleSkip(enrollment) {
    const seq = getSequence(enrollment.sequenceId)
    if (!seq) return
    advanceEnrollment(enrollment.id, seq.steps.length)
  }

  function handlePause(id) { updateEnrollment(id, { status: 'paused' }) }
  function handleResume(id) { updateEnrollment(id, { status: 'active' }) }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-white">Sequence Engine</h1>
        <p className="text-sm text-gray-400 mt-1">Automated drip sequences with UTM-tracked 1st Phorm links — matched to each contact's goals.</p>
      </div>

      <RevenueGoalTracker
        contactProducts={contactProducts}
        settings={settings}
        enrollments={enrollments}
      />

      <TodaysSends
        enrollments={enrollments}
        contacts={contacts}
        interactions={interactions}
        onSent={handleSent}
        onSkip={handleSkip}
      />

      <AutoEnrollBanner
        contacts={contacts}
        enrollments={enrollments}
        onEnroll={handleEnroll}
      />

      <EnrollContact
        contacts={contacts}
        enrollments={enrollments}
        onEnroll={handleEnroll}
      />

      <EnrollmentList
        enrollments={enrollments}
        contacts={contacts}
        onRemove={deleteEnrollment}
        onPause={handlePause}
        onResume={handleResume}
      />

      <SequenceLibrary enrollments={enrollments} />
    </div>
  )
}
