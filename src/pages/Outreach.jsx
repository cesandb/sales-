import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import {
  Send, MessageSquare, Mail, Instagram, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, SkipForward, CheckCircle, Zap, Search, Users,
  Phone, ExternalLink, AlertTriangle, Flame, Bell, Target, Plus, X,
  FastForward, Inbox,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import { DEFAULT_SEQUENCES } from '../utils/affiliateLinks'
import { generateOutreachDraft, generateBatchDrafts, getApiKey } from '../utils/aiDraft'
import { trySendEmail, addPipelineLog, EMAILJS_KEY } from '../components/PipelineAutomationEngine'
import { getPendingMQ, markMQItemStatus, pruneMQ } from '../utils/messageQueue'
import { Link } from 'react-router-dom'
import ImportModal from '../components/ImportModal'
import ConversionModal from '../components/ConversionModal'

const PRIORITY_META = {
  urgent: { label: 'Overdue',    color: 'bg-red-900/40 text-red-300',       icon: AlertTriangle },
  today:  { label: 'Do Today',   color: 'bg-orange-900/40 text-orange-300', icon: Bell },
  new:    { label: 'New Lead',   color: 'bg-blue-900/40 text-blue-300',     icon: Users },
  warm:   { label: 'Going Cold', color: 'bg-yellow-900/40 text-yellow-300', icon: Flame },
}

const DISCOVERY_LINKS = [
  { label: 'Instagram #fitness',       url: 'https://www.instagram.com/explore/tags/fitness/', icon: '📸' },
  { label: 'Instagram #supplement',    url: 'https://www.instagram.com/explore/tags/supplementation/', icon: '📸' },
  { label: 'Instagram #weightloss',    url: 'https://www.instagram.com/explore/tags/weightlossjourney/', icon: '📸' },
  { label: 'Instagram #bodybuilding',  url: 'https://www.instagram.com/explore/tags/bodybuilding/', icon: '📸' },
  { label: 'TikTok #gymtok',           url: 'https://www.tiktok.com/tag/gymtok', icon: '🎵' },
  { label: 'TikTok #fitnesstok',       url: 'https://www.tiktok.com/tag/fitnesstok', icon: '🎵' },
  { label: 'FB: Fitness & Nutrition',  url: 'https://www.facebook.com/groups/search/results/?q=fitness+nutrition', icon: '👥' },
  { label: 'FB: Weight Loss Support',  url: 'https://www.facebook.com/groups/search/results/?q=weight+loss+support', icon: '👥' },
]

function buildQueue({ contacts, followups, linkShares, interactions }) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const seen = new Set()
  const items = []

  function push(item) {
    if (seen.has(item.contactId)) return
    seen.add(item.contactId)
    items.push(item)
  }

  followups
    .filter(f => f.status === 'pending' && f.date < todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(f => {
      const contact = contacts.find(c => c.id === f.contactId)
      if (!contact) return
      const daysLate = differenceInDays(now, parseISO(f.date))
      push({ id: f.id, contactId: contact.id, contact, priority: 'urgent', followupId: f.id,
        reason: `Follow-up ${daysLate}d overdue`, context: f.notes })
    })

  followups
    .filter(f => f.status === 'pending' && f.date === todayStr)
    .forEach(f => {
      const contact = contacts.find(c => c.id === f.contactId)
      if (!contact) return
      push({ id: f.id + '-t', contactId: contact.id, contact, priority: 'today', followupId: f.id,
        reason: 'Follow-up due today', context: f.notes })
    })

  linkShares
    .filter(ls => !ls.followedUp && differenceInDays(now, parseISO(ls.date)) >= 3)
    .forEach(ls => {
      const contact = contacts.find(c => c.id === ls.contactId)
      const product = PRODUCTS.find(p => p.id === ls.productId)
      if (!contact) return
      const d = differenceInDays(now, parseISO(ls.date))
      push({ id: ls.id, contactId: contact.id, contact, priority: 'today', linkShareId: ls.id,
        reason: `Shared ${product?.name || 'link'} — no follow-up (${d}d)`, context: product?.name })
    })

  contacts
    .filter(c => c.status === 'New Lead' && !c.lastContact)
    .sort((a, b) => parseISO(a.createdAt) - parseISO(b.createdAt))
    .forEach(c => {
      const daysOld = differenceInDays(now, parseISO(c.createdAt))
      if (daysOld < 1) return
      push({ id: c.id + '-n', contactId: c.id, contact: c, priority: 'new',
        reason: `New lead — never contacted (added ${daysOld}d ago)` })
    })

  contacts
    .filter(c => {
      if (c.status !== 'Hot Lead' && c.status !== 'Warm Lead') return false
      const days = c.lastContact
        ? differenceInDays(now, parseISO(c.lastContact))
        : differenceInDays(now, parseISO(c.createdAt))
      return days > 5
    })
    .forEach(c => {
      const days = c.lastContact
        ? differenceInDays(now, parseISO(c.lastContact))
        : differenceInDays(now, parseISO(c.createdAt))
      push({ id: c.id + '-cold', contactId: c.id, contact: c, priority: 'warm',
        reason: `${c.status} — no contact for ${days} days` })
    })

  return items
}

// ── Blitz Mode ───────────────────────────────────────────────────────────────
function BlitzMode({ queue, drafts, onDone, onSkip, onExit }) {
  const [idx, setIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const [platform, setPlatform] = useState('sms')

  if (idx >= queue.length) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center">
        <div className="text-center px-6">
          <CheckCircle size={52} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Blitz Complete!</h2>
          <p className="text-gray-400 mb-8">{queue.length} contacts worked through</p>
          <button onClick={onExit} className="btn-primary px-8 py-3 text-base">Done</button>
        </div>
      </div>
    )
  }

  const item = queue[idx]
  const draft = drafts[item.contactId] || ''
  const { contact } = item
  const meta = PRIORITY_META[item.priority]
  const Icon = meta.icon

  function getSendHref() {
    const body = draft || `Hey ${contact.name}!`
    if (platform === 'sms' && contact.phone)
      return `sms:${contact.phone.replace(/\D/g, '')}${encodeURIComponent('&body=' + body)}`
    if (platform === 'email' && contact.email)
      return `mailto:${contact.email}?body=${encodeURIComponent(body)}`
    if (platform === 'ig' && contact.social)
      return `https://instagram.com/${contact.social.replace('@', '').trim()}`
    return null
  }

  async function handleCopyDone() {
    if (draft) {
      try { await navigator.clipboard.writeText(draft) } catch {}
    }
    setCopied(true)
    setTimeout(() => {
      onDone(item, platform, draft)
      setIdx(i => i + 1)
      setCopied(false)
    }, 600)
  }

  function handleSkip() {
    onSkip(item)
    setIdx(i => i + 1)
  }

  const sendHref = getSendHref()
  const pct = Math.round((idx / queue.length) * 100)

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-800 flex-shrink-0">
        <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FastForward size={14} className="text-brand-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">Blitz Mode</span>
          <span className="text-xs text-gray-500">{idx + 1} / {queue.length}</span>
        </div>
        <button onClick={onExit} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800">
          <X size={16} />
        </button>
      </div>

      {/* Contact card */}
      <div className="flex-1 flex flex-col px-4 py-5 max-w-lg mx-auto w-full overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xl flex-shrink-0">
            {contact.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-lg leading-tight">{contact.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`badge text-[10px] ${meta.color}`}><Icon size={9} /> {meta.label}</span>
              <span className="text-xs text-gray-500 truncate">{item.reason}</span>
            </div>
          </div>
        </div>

        {/* Platform selector */}
        <div className="flex gap-1.5 mb-3">
          {[
            { id: 'sms',   label: 'SMS',   icon: Phone,        disabled: !contact.phone },
            { id: 'email', label: 'Email', icon: Mail,         disabled: !contact.email },
            { id: 'ig',    label: 'DM',    icon: ExternalLink, disabled: !contact.social },
          ].map(({ id, label, icon: Ic, disabled }) => (
            <button
              key={id}
              disabled={disabled}
              onClick={() => setPlatform(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                platform === id
                  ? 'bg-brand-600 text-white'
                  : disabled
                  ? 'bg-gray-800/40 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Ic size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Draft */}
        {draft ? (
          <div className="flex-1 flex flex-col">
            <div className="bg-gray-800/60 rounded-xl p-4 text-sm text-gray-200 leading-relaxed mb-4 min-h-[120px]">
              {draft}
            </div>
            <div className="space-y-2">
              {sendHref ? (
                <a
                  href={sendHref}
                  target={platform === 'ig' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(handleCopyDone, 800)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-base transition-colors"
                >
                  <Send size={16} />
                  {platform === 'sms' ? 'Open SMS & Done' : platform === 'email' ? 'Open Email & Done' : 'Open DM & Done'}
                </a>
              ) : (
                <button
                  onClick={handleCopyDone}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-base transition-colors"
                >
                  {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy & Done</>}
                </button>
              )}
              <button
                onClick={handleSkip}
                className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw size={28} className="text-brand-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-400">Generating draft…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Queue Item ───────────────────────────────────────────────────────────────
function QueueItem({ item, interactions, initialDraft, onDone, onSkip, onReplied }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(initialDraft || '')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [platform, setPlatform] = useState('sms')
  const [showConversion, setShowConversion] = useState(false)
  const hasKey = !!getApiKey()

  // Apply incoming auto-draft when it arrives
  useEffect(() => {
    if (initialDraft && !draft) setDraft(initialDraft)
  }, [initialDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  const { contact } = item
  const meta = PRIORITY_META[item.priority]
  const Icon = meta.icon

  async function generateDraft() {
    if (!hasKey) return
    setLoading(true)
    try {
      const text = await generateOutreachDraft({
        contact,
        interactions,
        platform: platform === 'sms' ? 'Text/SMS' : platform === 'email' ? 'Email' : 'Instagram DM',
        context: item.context,
      })
      setDraft(text)
    } catch {
      setDraft(`Hey ${contact.name}! ${item.context ? `Wanted to follow up on ${item.context}.` : 'Just checking in!'} How are things going with your fitness goals?`)
    }
    setLoading(false)
  }

  async function copy() {
    if (!draft) return
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getSendHref() {
    const body = draft || `Hey ${contact.name}!`
    if (platform === 'sms' && contact.phone)
      return `sms:${contact.phone.replace(/\D/g, '')}${encodeURIComponent('&body=' + body)}`
    if (platform === 'email' && contact.email)
      return `mailto:${contact.email}?body=${encodeURIComponent(body)}`
    if (platform === 'ig' && contact.social)
      return `https://instagram.com/${contact.social.replace('@', '').trim()}`
    return null
  }

  const sendHref = getSendHref()
  const hasDraft = !!draft

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-sm flex-shrink-0">
          {contact.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm">{contact.name}</p>
            <span className={`badge text-[10px] ${meta.color}`}><Icon size={9} /> {meta.label}</span>
            {hasDraft && <span className="text-[10px] text-green-400 font-medium">● Draft ready</span>}
          </div>
          <p className="text-xs text-gray-500 truncate">{item.reason}</p>
        </div>
        <button
          onClick={() => { setExpanded(e => !e); if (!expanded && !draft && hasKey) generateDraft() }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          <div className="flex gap-1.5">
            {[
              { id: 'sms',   label: 'SMS',      icon: Phone,        disabled: !contact.phone },
              { id: 'email', label: 'Email',     icon: Mail,         disabled: !contact.email },
              { id: 'ig',    label: 'Instagram', icon: ExternalLink, disabled: !contact.social },
            ].map(({ id, label, icon: Ic, disabled }) => (
              <button
                key={id}
                disabled={disabled}
                onClick={() => setPlatform(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  platform === id
                    ? 'bg-brand-600 text-white'
                    : disabled
                    ? 'bg-gray-800/40 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Ic size={11} /> {label}
              </button>
            ))}
            <button
              onClick={generateDraft}
              disabled={loading || !hasKey}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-brand-400 bg-gray-800 hover:bg-gray-700 transition-colors"
              title={hasKey ? 'Regenerate AI draft' : 'Add API key in Settings'}
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {loading ? 'Drafting…' : 'Redraft'}
            </button>
          </div>

          <div className="relative">
            <textarea
              className="input text-sm min-h-20 resize-none pr-8"
              placeholder={hasKey ? 'Draft auto-generated or click Redraft…' : `Hey ${contact.name}! Just checking in…`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            {draft && (
              <button onClick={copy} className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300">
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {sendHref ? (
              <a
                href={sendHref}
                target={platform === 'ig' ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
              >
                <Send size={13} />
                {platform === 'sms' ? 'Open SMS' : platform === 'email' ? 'Open Email' : 'Open Instagram'}
              </a>
            ) : (
              <button onClick={copy} disabled={!draft} className="flex-1 btn-primary flex items-center justify-center gap-2">
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Message</>}
              </button>
            )}
            <button
              onClick={() => onDone(item, platform, draft)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-green-900/40 hover:bg-green-800/50 text-green-400 text-sm font-semibold transition-colors"
            >
              <CheckCircle size={14} /> Done
            </button>
            <button
              onClick={() => onSkip(item)}
              className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
            >
              <SkipForward size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onReplied(item)}
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-900/20 hover:bg-blue-900/30 border border-blue-700/30 text-blue-400 text-xs font-semibold transition-colors"
            >
              <MessageSquare size={12} /> Got a Reply
            </button>
            <button
              onClick={() => setShowConversion(true)}
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-900/20 hover:bg-green-900/30 border border-green-700/30 text-green-400 text-xs font-semibold transition-colors"
            >
              <CheckCircle size={12} /> They Bought
            </button>
          </div>
        </div>
      )}
      {showConversion && (
        <ConversionModal contact={contact} onClose={() => setShowConversion(false)} />
      )}
    </div>
  )
}

function DailyProgress({ count, target }) {
  const pct = Math.min(100, Math.round((count / target) * 100))
  const done = count >= target
  return (
    <div className={`card border ${done ? 'border-green-700/40 bg-green-900/5' : 'border-brand-700/30 bg-brand-900/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target size={16} className={done ? 'text-green-400' : 'text-brand-400'} />
          <span className="text-sm font-bold text-white">Today's Outreach</span>
        </div>
        <span className={`text-sm font-bold ${done ? 'text-green-400' : 'text-brand-400'}`}>
          {count} / {target}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-brand-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {done ? `Goal hit! ${count} outreaches sent today.` : `${target - count} more to hit your daily target of ${target}`}
      </p>
    </div>
  )
}

function ProspectDiscovery({ onImport }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-brand-400" />
          <h2 className="text-sm font-bold text-white">Find New Prospects</h2>
        </div>
        <button onClick={onImport} className="btn-primary flex items-center gap-2 text-xs py-1.5">
          <Plus size={13} /> Import CSV
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Tap a platform to browse fitness communities. Find people → add as contact → they appear in your queue.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DISCOVERY_LINKS.map(({ label, url, icon }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <span>{icon}</span>
            <span className="truncate">{label.split(' ').slice(1).join(' ')}</span>
            <ExternalLink size={10} className="ml-auto flex-shrink-0 text-gray-600" />
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Outreach() {
  const store = useStore()
  const { contacts, followups, linkShares, interactions, enrollments, updateFollowup,
          addInteraction, updateLinkShare, updateContact, advanceEnrollment, settings } = store

  const [skipped, setSkipped]             = useState(new Set())
  const [showImport, setShowImport]       = useState(false)
  const [blitzMode, setBlitzMode]         = useState(false)
  const [drafts, setDrafts]               = useState({})    // contactId → draft string
  const [autoDrafting, setAutoDrafting]   = useState(false)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailProgress, setEmailProgress] = useState({ sent: 0, total: 0 })
  const [mqItems, setMqItems]             = useState(() => { pruneMQ(); return getPendingMQ() })
  const [copiedMqId, setCopiedMqId]       = useState(null)
  const draftedRef = useRef(false)

  // Refresh MQ when the page gains focus or after send
  function refreshMQ() { setMqItems(getPendingMQ()) }

  const dailyTarget = settings.dailyOutreachTarget || 10
  const todayStr    = new Date().toISOString().split('T')[0]
  const todayCount  = interactions.filter(i => i.date?.startsWith(todayStr)).length
  const hasApiKey   = !!getApiKey()
  const hasEmailJs  = !!localStorage.getItem(EMAILJS_KEY)

  const allQueue = useMemo(
    () => buildQueue({ contacts, followups, linkShares, interactions }),
    [contacts, followups, linkShares, interactions]
  )
  const queue = allQueue.filter(item => !skipped.has(item.id))

  // Auto-draft all queue items on load
  useEffect(() => {
    if (!hasApiKey || allQueue.length === 0 || draftedRef.current) return
    draftedRef.current = true
    setAutoDrafting(true)

    const batchContacts = allQueue.slice(0, 20).map(i => i.contact)
    generateBatchDrafts({ contacts: batchContacts, interactions, platform: 'Text/SMS' })
      .then(results => {
        const map = {}
        results.forEach(r => { if (r.contactId && r.message) map[r.contactId] = r.message })
        setDrafts(map)
      })
      .catch(() => {})
      .finally(() => setAutoDrafting(false))
  }, [allQueue.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDone(item, platform, draft) {
    addInteraction({
      contactId: item.contactId,
      type: platform === 'sms' ? 'Text' : platform === 'email' ? 'Email' : 'DM',
      notes: draft ? `Sent: "${draft.slice(0, 80)}${draft.length > 80 ? '…' : ''}"` : 'Outreach sent',
    })
    if (item.followupId) {
      const fu = followups.find(f => f.id === item.followupId)
      updateFollowup(item.followupId, { status: 'completed' })
      if (fu?.enrollmentId) {
        const enrollment = enrollments.find(e => e.id === fu.enrollmentId)
        if (enrollment?.status === 'active') {
          const seq = DEFAULT_SEQUENCES.find(s => s.id === enrollment.sequenceId)
          if (seq) advanceEnrollment(enrollment.id, seq.steps.length)
        }
      }
    }
    if (item.linkShareId) updateLinkShare(item.linkShareId, { followedUp: true })
    setSkipped(s => new Set([...s, item.id]))
  }

  function handleReplied(item) {
    addInteraction({
      contactId: item.contactId,
      type: 'Reply',
      notes: `Got a reply — ${item.reason}`,
    })
    const statusMap = { 'New Lead': 'Warm Lead', 'Warm Lead': 'Hot Lead' }
    const next = statusMap[item.contact.status]
    if (next) updateContact(item.contact.id, { status: next })
    if (item.followupId) updateFollowup(item.followupId, { status: 'completed' })
    setSkipped(s => new Set([...s, item.id]))
  }

  function handleSkip(item) {
    setSkipped(s => new Set([...s, item.id]))
  }

  async function handleSendAllEmails() {
    const emailItems = queue.filter(item => item.contact.email)
    if (!emailItems.length) return
    setSendingEmails(true)
    setEmailProgress({ sent: 0, total: emailItems.length })

    for (const item of emailItems) {
      const { contact } = item
      const activeEnrollment = enrollments.find(e =>
        e.contactId === contact.id && e.status === 'active'
      )
      let seq  = DEFAULT_SEQUENCES.find(s => s.id === (activeEnrollment?.sequenceId || 'seq-cold-intro'))
      let step = seq?.steps[activeEnrollment?.currentStep ?? 0] || seq?.steps[0]
      if (!seq || !step) continue

      const sent = await trySendEmail(contact, seq, step)
      if (sent) {
        addInteraction({
          contactId: contact.id,
          type: 'Email',
          notes: `Auto-sent: [${seq.name}] ${step.label}`,
        })
        if (item.followupId) updateFollowup(item.followupId, { status: 'completed' })
        if (item.linkShareId) updateLinkShare(item.linkShareId, { followedUp: true })
        setSkipped(s => new Set([...s, item.id]))
      }
      setEmailProgress(p => ({ ...p, sent: p.sent + 1 }))
      await new Promise(r => setTimeout(r, 800))
    }

    setSendingEmails(false)
    addPipelineLog({ type: 'auto-email-batch', count: emailProgress.sent })
  }

  const urgentItems = queue.filter(i => i.priority === 'urgent')
  const todayItems  = queue.filter(i => i.priority === 'today')
  const newItems    = queue.filter(i => i.priority === 'new')
  const warmItems   = queue.filter(i => i.priority === 'warm')
  const urgentCount = urgentItems.length
  const emailCount  = queue.filter(i => i.contact.email).length
  const draftCount  = Object.keys(drafts).filter(id => queue.some(i => i.contactId === id)).length

  return (
    <div className="space-y-6">
      {blitzMode && (
        <BlitzMode
          queue={queue}
          drafts={drafts}
          onDone={handleDone}
          onSkip={handleSkip}
          onExit={() => setBlitzMode(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Queue</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {queue.length === 0 ? 'All caught up!' : `${queue.length} to reach out to`}
            {urgentCount > 0 && <span className="text-red-400"> · {urgentCount} urgent</span>}
            {autoDrafting && <span className="text-brand-400 ml-1">· drafting…</span>}
            {!autoDrafting && draftCount > 0 && <span className="text-green-400 ml-1">· {draftCount} drafts ready</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2 text-xs py-1.5 px-3">
            <Plus size={13} /> Import
          </button>
        </div>
      </div>

      {/* Automation action bar */}
      {queue.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* Blitz Mode */}
          <button
            onClick={() => setBlitzMode(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold transition-colors"
          >
            <FastForward size={14} />
            Blitz Mode
            <span className="text-xs font-normal opacity-80">({queue.length} contacts)</span>
          </button>

          {/* Send All Emails */}
          {hasEmailJs && emailCount > 0 && (
            <button
              onClick={handleSendAllEmails}
              disabled={sendingEmails}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/40 text-emerald-400 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {sendingEmails ? (
                <><RefreshCw size={14} className="animate-spin" /> Sending {emailProgress.sent}/{emailProgress.total}…</>
              ) : (
                <><Mail size={14} /> Send All Emails <span className="text-xs font-normal opacity-70">({emailCount})</span></>
              )}
            </button>
          )}

          {/* Auto-draft status */}
          {hasApiKey && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs ${
              autoDrafting
                ? 'bg-brand-900/20 border-brand-700/30 text-brand-400'
                : draftCount > 0
                ? 'bg-green-900/20 border-green-700/30 text-green-400'
                : 'bg-gray-800/40 border-gray-700/30 text-gray-500'
            }`}>
              {autoDrafting
                ? <><RefreshCw size={12} className="animate-spin" /> Auto-drafting…</>
                : draftCount > 0
                ? <><Sparkles size={12} /> {draftCount} drafts ready</>
                : <><Sparkles size={12} /> Auto-draft on</>
              }
            </div>
          )}

          {/* Email auto-sender status */}
          {hasEmailJs && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-700/30 bg-green-900/10 text-xs text-green-400">
              <Zap size={12} /> Email auto-send active
            </div>
          )}
        </div>
      )}

      {/* Daily progress */}
      <DailyProgress count={todayCount} target={dailyTarget} />

      {/* Queue sections */}
      {queue.length === 0 ? (
        <div className="card text-center py-16 space-y-2">
          <CheckCircle size={32} className="text-green-400 mx-auto" />
          <p className="text-white font-semibold">Queue is clear!</p>
          <p className="text-sm text-gray-500">Find new prospects below or add contacts to keep growing.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {urgentItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle size={12} /> Urgent — {urgentItems.length}
              </p>
              {urgentItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions}
                  initialDraft={drafts[item.contactId]}
                  onDone={handleDone} onSkip={handleSkip} onReplied={handleReplied} />
              ))}
            </div>
          )}
          {todayItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wide flex items-center gap-2">
                <Bell size={12} /> Do Today — {todayItems.length}
              </p>
              {todayItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions}
                  initialDraft={drafts[item.contactId]}
                  onDone={handleDone} onSkip={handleSkip} onReplied={handleReplied} />
              ))}
            </div>
          )}
          {newItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wide flex items-center gap-2">
                <Users size={12} /> New Leads — {newItems.length}
              </p>
              {newItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions}
                  initialDraft={drafts[item.contactId]}
                  onDone={handleDone} onSkip={handleSkip} onReplied={handleReplied} />
              ))}
            </div>
          )}
          {warmItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                <Flame size={12} /> Going Cold — {warmItems.length}
              </p>
              {warmItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions}
                  initialDraft={drafts[item.contactId]}
                  onDone={handleDone} onSkip={handleSkip} onReplied={handleReplied} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DM Message Queue ── */}
      {mqItems.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox size={16} className="text-brand-400" />
              <h2 className="text-sm font-bold text-white">Message Queue</h2>
              <span className="badge bg-brand-900/40 text-brand-300 text-[10px]">{mqItems.length}</span>
            </div>
            <button
              onClick={() => { mqItems.forEach(i => markMQItemStatus(i.id, 'skipped')); refreshMQ() }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Pre-written messages ready to send. For contacts with email + EmailJS configured they send automatically. For everyone else — copy the message and DM them on their platform.
          </p>
          <div className="space-y-2">
            {mqItems.slice(0, 20).map(item => {
              const CHANNEL_META = {
                email: { label: 'Email', color: 'bg-blue-900/30 text-blue-300' },
                sms:   { label: 'SMS',   color: 'bg-green-900/30 text-green-300' },
                dm:    { label: 'DM',    color: 'bg-purple-900/30 text-purple-300' },
              }
              const ch = CHANNEL_META[item.channel] || CHANNEL_META.dm
              const isCopied = copiedMqId === item.id
              return (
                <div key={item.id} className="rounded-xl bg-gray-800/60 border border-gray-700/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                        {(item.contactName || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{item.contactName}</p>
                        {item.contactHandle && (
                          <p className="text-[10px] text-gray-500 truncate">{item.contactHandle}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`badge text-[10px] ${ch.color}`}>{ch.label}</span>
                      <span className="text-[10px] text-gray-600">{item.seqName}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 bg-gray-900/40 rounded-lg p-2">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(item.message) } catch {}
                        setCopiedMqId(item.id)
                        markMQItemStatus(item.id, 'copied')
                        addInteraction({ contactId: item.contactId, type: 'DM', notes: `Copied & sent: "${item.message.slice(0, 80)}…"` })
                        setTimeout(() => { setCopiedMqId(null); refreshMQ() }, 1500)
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
                    >
                      {isCopied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy &amp; Mark Sent</>}
                    </button>
                    {item.contactEmail && (
                      <a
                        href={`mailto:${item.contactEmail}?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(item.message)}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-xs font-semibold transition-colors"
                      >
                        <Mail size={11} /> Email
                      </a>
                    )}
                    {item.contactPhone && (
                      <a
                        href={`sms:${item.contactPhone.replace(/\D/g, '')}?&body=${encodeURIComponent(item.message)}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-300 text-xs font-semibold transition-colors"
                      >
                        <Phone size={11} /> SMS
                      </a>
                    )}
                    <button
                      onClick={() => { markMQItemStatus(item.id, 'skipped'); refreshMQ() }}
                      className="p-2 rounded-lg bg-gray-700/40 hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
            {mqItems.length > 20 && (
              <p className="text-xs text-gray-500 text-center py-2">+{mqItems.length - 20} more — work through these first</p>
            )}
          </div>
        </div>
      )}

      <ProspectDiscovery onImport={() => setShowImport(true)} />
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
