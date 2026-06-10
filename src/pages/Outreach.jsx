import { useState, useMemo, useCallback } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import {
  Send, MessageSquare, Mail, Instagram, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, SkipForward, CheckCircle, Zap, Search, Users,
  Phone, ExternalLink, AlertTriangle, Flame, Bell, Target, Plus,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import { generateOutreachDraft, getApiKey } from '../utils/aiDraft'
import { Link } from 'react-router-dom'
import ImportModal from '../components/ImportModal'

const PRIORITY_META = {
  urgent: { label: 'Overdue',    color: 'bg-red-900/40 text-red-300',    icon: AlertTriangle },
  today:  { label: 'Do Today',   color: 'bg-orange-900/40 text-orange-300', icon: Bell },
  new:    { label: 'New Lead',   color: 'bg-blue-900/40 text-blue-300',  icon: Users },
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

// ── Build the queue ─────────────────────────────────────────────────────────
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

  // 1 – Overdue follow-ups
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

  // 2 – Due today
  followups
    .filter(f => f.status === 'pending' && f.date === todayStr)
    .forEach(f => {
      const contact = contacts.find(c => c.id === f.contactId)
      if (!contact) return
      push({ id: f.id + '-t', contactId: contact.id, contact, priority: 'today', followupId: f.id,
        reason: 'Follow-up due today', context: f.notes })
    })

  // 3 – Unactioned link shares (3+ days)
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

  // 4 – New leads never contacted
  contacts
    .filter(c => c.status === 'New Lead' && !c.lastContact)
    .sort((a, b) => parseISO(a.createdAt) - parseISO(b.createdAt))
    .forEach(c => {
      const daysOld = differenceInDays(now, parseISO(c.createdAt))
      if (daysOld < 1) return
      push({ id: c.id + '-n', contactId: c.id, contact: c, priority: 'new',
        reason: `New lead — never contacted (added ${daysOld}d ago)` })
    })

  // 5 – Going cold
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

// ── Queue Item ───────────────────────────────────────────────────────────────
function QueueItem({ item, interactions, onDone, onSkip }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [platform, setPlatform] = useState('sms')
  const hasKey = !!getApiKey()

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
    } catch (e) {
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
    if (platform === 'sms' && contact.phone) {
      return `sms:${contact.phone.replace(/\D/g, '')}${encodeURIComponent('&body=' + body)}`
    }
    if (platform === 'email' && contact.email) {
      return `mailto:${contact.email}?body=${encodeURIComponent(body)}`
    }
    if (platform === 'ig' && contact.social) {
      const handle = contact.social.replace('@', '').trim()
      return `https://instagram.com/${handle}`
    }
    return null
  }

  const sendHref = getSendHref()

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-sm flex-shrink-0">
          {contact.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm">{contact.name}</p>
            <span className={`badge text-[10px] ${meta.color}`}>
              <Icon size={9} /> {meta.label}
            </span>
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

      {/* Expanded: draft + actions */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          {/* Platform selector */}
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
              {loading ? 'Drafting…' : 'AI Draft'}
            </button>
          </div>

          {/* Draft textarea */}
          <div className="relative">
            <textarea
              className="input text-sm min-h-20 resize-none pr-8"
              placeholder={hasKey ? 'Click AI Draft to generate a message…' : `Hey ${contact.name}! Just checking in…`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            {draft && (
              <button onClick={copy} className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300">
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            )}
          </div>

          {/* Send + Done + Skip */}
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
              title="Mark as sent"
            >
              <CheckCircle size={14} /> Done
            </button>
            <button
              onClick={() => onSkip(item)}
              className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
              title="Skip for now"
            >
              <SkipForward size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Daily Progress ───────────────────────────────────────────────────────────
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
        {done
          ? `Goal hit! ${count} outreaches sent today.`
          : `${target - count} more to hit your daily target of ${target}`
        }
      </p>
    </div>
  )
}

// ── Prospect Discovery ───────────────────────────────────────────────────────
function ProspectDiscovery({ onImport }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-brand-400" />
          <h2 className="text-sm font-bold text-white">Find New Prospects</h2>
        </div>
        <button
          onClick={onImport}
          className="btn-primary flex items-center gap-2 text-xs py-1.5"
        >
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
  const { contacts, followups, linkShares, interactions, updateFollowup, addInteraction, updateLinkShare, settings } = store
  const [skipped, setSkipped] = useState(new Set())
  const [showImport, setShowImport] = useState(false)

  const dailyTarget = settings.dailyOutreachTarget || 10

  const todayStr = new Date().toISOString().split('T')[0]
  const todayCount = interactions.filter(i => i.date?.startsWith(todayStr)).length

  const allQueue = useMemo(
    () => buildQueue({ contacts, followups, linkShares, interactions }),
    [contacts, followups, linkShares, interactions]
  )
  const queue = allQueue.filter(item => !skipped.has(item.id))

  function handleDone(item, platform, draft) {
    // Log interaction
    addInteraction({
      contactId: item.contactId,
      type: platform === 'sms' ? 'Text' : platform === 'email' ? 'Email' : 'DM',
      notes: draft ? `Sent: "${draft.slice(0, 80)}${draft.length > 80 ? '…' : ''}"` : 'Outreach sent',
    })
    // Mark follow-up complete
    if (item.followupId) updateFollowup(item.followupId, { status: 'completed' })
    // Mark link share followed up
    if (item.linkShareId) updateLinkShare(item.linkShareId, { followedUp: true })
    // Remove from queue
    setSkipped(s => new Set([...s, item.id]))
  }

  function handleSkip(item) {
    setSkipped(s => new Set([...s, item.id]))
  }

  const urgentCount  = queue.filter(i => i.priority === 'urgent').length
  const todayItems   = queue.filter(i => i.priority === 'today')
  const urgentItems  = queue.filter(i => i.priority === 'urgent')
  const newItems     = queue.filter(i => i.priority === 'new')
  const warmItems    = queue.filter(i => i.priority === 'warm')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Queue</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {queue.length === 0 ? 'All caught up!' : `${queue.length} people to reach out to`}
            {urgentCount > 0 && <span className="text-red-400"> · {urgentCount} urgent</span>}
          </p>
        </div>
        <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2 flex-shrink-0">
          <Plus size={14} /> Import
        </button>
      </div>

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
                <QueueItem key={item.id} item={item} interactions={interactions} onDone={handleDone} onSkip={handleSkip} />
              ))}
            </div>
          )}
          {todayItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wide flex items-center gap-2">
                <Bell size={12} /> Do Today — {todayItems.length}
              </p>
              {todayItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions} onDone={handleDone} onSkip={handleSkip} />
              ))}
            </div>
          )}
          {newItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wide flex items-center gap-2">
                <Users size={12} /> New Leads — {newItems.length}
              </p>
              {newItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions} onDone={handleDone} onSkip={handleSkip} />
              ))}
            </div>
          )}
          {warmItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                <Flame size={12} /> Going Cold — {warmItems.length}
              </p>
              {warmItems.map(item => (
                <QueueItem key={item.id} item={item} interactions={interactions} onDone={handleDone} onSkip={handleSkip} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prospect discovery */}
      <ProspectDiscovery onImport={() => setShowImport(true)} />

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
