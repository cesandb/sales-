import { useState, useMemo } from 'react'
import { Radar, Clock, AlertCircle, Bell, MessageSquare, User, ChevronDown, ChevronUp, Calendar, Share2, CheckCircle2, Link2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import { PRODUCTS } from '../data/products'

const STATUS_COLOR = {
  'New Lead':        'bg-blue-900/40 text-blue-300',
  'Warm Lead':       'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':        'bg-orange-900/40 text-orange-300',
  'Customer':        'bg-green-900/40 text-green-300',
  'Repeat Customer': 'bg-emerald-900/40 text-emerald-300',
  'Inactive':        'bg-gray-800 text-gray-400',
}

const STAGE_COLOR = {
  'New Lead':     'bg-blue-900/40 text-blue-300',
  'First Contact':'bg-purple-900/40 text-purple-300',
  'Interested':   'bg-yellow-900/40 text-yellow-300',
  'Recommended':  'bg-orange-900/40 text-orange-300',
  'Purchased':    'bg-green-900/40 text-green-300',
  'Repeat/Upsell':'bg-emerald-900/40 text-emerald-300',
}

const INTERACTION_TYPES = ['Call', 'DM', 'Email', 'Text', 'In Person', 'Comment', 'Other']
const STATUSES = ['New Lead', 'Warm Lead', 'Hot Lead', 'Customer', 'Repeat Customer', 'Inactive']

function timeSince(dateStr) {
  if (!dateStr) return 'Never contacted'
  const days = differenceInDays(new Date(), parseISO(dateStr))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// ── Inline Log Interaction Modal ──────────────────────────────────────────────
function LogModal({ contact, onClose, onSave }) {
  const [type, setType] = useState('Call')
  const [notes, setNotes] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const { updateContact } = useStore()

  function save() {
    onSave({ type, notes })
    if (newStatus) updateContact(contact.id, { status: newStatus })
    onClose()
  }

  return (
    <Modal title={`Log Interaction — ${contact.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-20 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was discussed?"
          />
        </div>
        <div>
          <label className="label">Update Status (optional)</label>
          <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
            <option value="">Keep current status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Log Interaction</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Inline Schedule Follow-up Modal ──────────────────────────────────────────
function FollowupModal({ contact, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('medium')

  return (
    <Modal title={`Schedule Follow-up — ${contact.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-16 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Reminder note…"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!date}
            onClick={() => date && onSave({ date, notes, priority })}
          >
            Schedule
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Section Component ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  const colorMap = {
    red:    'text-red-400 bg-red-900/20 border-red-800/40',
    orange: 'text-orange-400 bg-orange-900/20 border-orange-800/40',
    yellow: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40',
    blue:   'text-blue-400 bg-blue-900/20 border-blue-800/40',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-800/40',
  }

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${open ? '' : 'border-b-0'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg border ${colorMap[color] || colorMap.blue}`}>
            <Icon size={15} />
          </div>
          <div className="text-left">
            <span className="font-semibold text-white text-sm">{title}</span>
            {count > 0 && (
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${colorMap[color] || colorMap.blue}`}>
                {count}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && (
        <div className="divide-y divide-gray-800">
          {count === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-500">All clear — nothing to action here.</div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}

// ── Contact Row ───────────────────────────────────────────────────────────────
function ContactRow({ contact, lastContact, subText, actions }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
      <div className="w-9 h-9 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
        {contact.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white text-sm">{contact.name}</span>
          <span className={`badge ${STATUS_COLOR[contact.status] || 'bg-gray-800 text-gray-400'}`}>
            {contact.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={11} />
            {lastContact}
          </span>
          {subText && <span className="text-xs text-gray-600">{subText}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
      </div>
    </div>
  )
}

// ── Share Follow-up Modal (for unfollow-up shared links) ─────────────────────
function ShareFollowupModal({ linkShare, contact, product, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState(`Follow-up on shared ${product?.name || 'link'}`)
  const [priority, setPriority] = useState('medium')

  return (
    <Modal title={`Schedule Follow-up — ${contact?.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-brand-900/20 border border-brand-700/40">
          <p className="text-xs text-gray-400 mb-0.5">Shared link</p>
          <p className="text-sm font-semibold text-brand-300">{product?.name || 'Unknown Product'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Shared {differenceInDays(new Date(), parseISO(linkShare.date))} days ago
          </p>
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-16 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!date}
            onClick={() => date && onSave({ date, notes, priority })}
          >
            Schedule Follow-up
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Reach() {
  const { contacts, pipeline, followups, interactions, addInteraction, addFollowup, linkShares, updateLinkShare } = useStore()

  const [logModal, setLogModal] = useState(null)   // contact object
  const [fuModal, setFuModal] = useState(null)     // contact object
  const [shareFuModal, setShareFuModal] = useState(null) // { linkShare, contact, product }

  const now = new Date()

  // 1. Going Cold — Hot/Warm leads with lastContact > 5 days or never contacted
  const goingCold = useMemo(() => {
    return contacts
      .filter(c => c.status === 'Hot Lead' || c.status === 'Warm Lead')
      .filter(c => {
        if (!c.lastContact) return true
        return differenceInDays(now, parseISO(c.lastContact)) > 5
      })
      .sort((a, b) => {
        if (!a.lastContact) return -1
        if (!b.lastContact) return 1
        return parseISO(a.lastContact) - parseISO(b.lastContact)
      })
  }, [contacts, now])

  // 2. Pipeline Stalled — items > 10 days old not in final stages
  const stalledPipeline = useMemo(() => {
    return pipeline
      .filter(p =>
        p.stage !== 'Purchased' &&
        p.stage !== 'Repeat/Upsell' &&
        differenceInDays(now, parseISO(p.updatedAt)) > 10
      )
      .sort((a, b) => parseISO(a.updatedAt) - parseISO(b.updatedAt))
      .map(p => ({
        ...p,
        contact: contacts.find(c => c.id === p.contactId),
        daysSince: differenceInDays(now, parseISO(p.updatedAt)),
      }))
      .filter(p => p.contact)
  }, [pipeline, contacts, now])

  // 3. No Follow-up Scheduled — Warm/Hot/Customer with no pending followup
  const noFollowup = useMemo(() => {
    const pendingContactIds = new Set(
      followups.filter(f => f.status === 'pending').map(f => f.contactId)
    )
    return contacts.filter(c =>
      (c.status === 'Warm Lead' || c.status === 'Hot Lead' || c.status === 'Customer') &&
      !pendingContactIds.has(c.id)
    )
  }, [contacts, followups])

  // 4. Overdue Follow-ups
  const overdueFollowups = useMemo(() => {
    return followups
      .filter(f => f.status === 'pending' && new Date(f.date) < now)
      .sort((a, b) => parseISO(a.date) - parseISO(b.date))
      .map(f => ({
        ...f,
        contact: contacts.find(c => c.id === f.contactId),
        daysPast: differenceInDays(now, parseISO(f.date)),
      }))
      .filter(f => f.contact)
  }, [followups, contacts, now])

  // 5. New Leads Not Contacted
  const notContacted = useMemo(() => {
    const contactedIds = new Set(interactions.map(i => i.contactId))
    return contacts.filter(c => c.status === 'New Lead' && !contactedIds.has(c.id))
  }, [contacts, interactions])

  const totalNeedingAttention = goingCold.length + stalledPipeline.length + overdueFollowups.length + notContacted.length

  // 6. Unfollow-up Shared Links — followedUp=false and date > 2 days ago
  const unfollowedLinks = useMemo(() => {
    return (linkShares || [])
      .filter(ls => {
        if (ls.followedUp) return false
        return differenceInDays(now, parseISO(ls.date)) > 2
      })
      .sort((a, b) => parseISO(a.date) - parseISO(b.date))
      .map(ls => ({
        ...ls,
        contact: contacts.find(c => c.id === ls.contactId),
        product: PRODUCTS.find(p => p.id === ls.productId),
        daysAgo: differenceInDays(now, parseISO(ls.date)),
      }))
      .filter(ls => ls.contact)
  }, [linkShares, contacts, now])

  function actionBtn(label, icon, onClick, variant = 'secondary') {
    return (
      <button
        key={label}
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          variant === 'primary'
            ? 'bg-brand-700/30 text-brand-400 hover:bg-brand-600/50 hover:text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radar size={22} className="text-brand-400" />
          Reach Intelligence
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Surfaces contacts and pipeline items that need your attention right now.
        </p>
      </div>

      {/* Summary banner */}
      <div className={`card border ${totalNeedingAttention > 0 ? 'border-orange-800/50 bg-orange-900/10' : 'border-green-800/40 bg-green-900/10'}`}>
        <div className="flex items-center gap-3">
          {totalNeedingAttention > 0
            ? <AlertCircle size={18} className="text-orange-400 flex-shrink-0" />
            : <div className="w-[18px] h-[18px] rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"><span className="text-green-400 text-xs">✓</span></div>
          }
          <div>
            {totalNeedingAttention > 0 ? (
              <>
                <p className="font-semibold text-white">
                  {totalNeedingAttention} contact{totalNeedingAttention !== 1 ? 's' : ''} need attention today
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {goingCold.length} going cold ·{' '}
                  {stalledPipeline.length} pipeline stalled ·{' '}
                  {overdueFollowups.length} overdue follow-ups ·{' '}
                  {notContacted.length} new leads not contacted
                </p>
              </>
            ) : (
              <p className="font-semibold text-green-300">You\'re all caught up! No contacts need immediate attention.</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 0: Unfollow-up Shared Links */}
      <Section title="Unfollow-up Shared Links" icon={Share2} color="purple" count={unfollowedLinks.length}>
        {unfollowedLinks.map(item => (
          <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
            <div className="w-9 h-9 rounded-full bg-purple-700/20 border border-purple-700/30 flex items-center justify-center text-purple-300 font-bold text-xs flex-shrink-0">
              {item.contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white text-sm">{item.contact.name}</span>
                <span className={`badge ${STATUS_COLOR[item.contact.status] || 'bg-gray-800 text-gray-400'}`}>
                  {item.contact.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs text-purple-300 flex items-center gap-1">
                  <Link2 size={11} />
                  {item.product?.name || 'Unknown Product'}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={11} />
                  Shared {item.daysAgo} day{item.daysAgo !== 1 ? 's' : ''} ago
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {actionBtn('Schedule Follow-up', <Bell size={12} />, () => setShareFuModal({ linkShare: item, contact: item.contact, product: item.product }), 'primary')}
              {actionBtn('Mark Done', <CheckCircle2 size={12} />, () => updateLinkShare(item.id, { followedUp: true }))}
            </div>
          </div>
        ))}
      </Section>

      {/* Section 1: Going Cold */}
      <Section title="Going Cold" icon={Clock} color="orange" count={goingCold.length}>
        {goingCold.map(contact => (
          <ContactRow
            key={contact.id}
            contact={contact}
            lastContact={timeSince(contact.lastContact)}
            subText={contact.lastContact ? undefined : 'No contact recorded'}
            actions={
              <>
                {actionBtn('Log Interaction', <MessageSquare size={12} />, () => setLogModal(contact), 'primary')}
                {actionBtn('Follow-up', <Bell size={12} />, () => setFuModal(contact))}
                <Link
                  to="/contacts"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <User size={12} />
                  <span className="hidden sm:inline">View</span>
                </Link>
              </>
            }
          />
        ))}
      </Section>

      {/* Section 2: Pipeline Stalled */}
      <Section title="Pipeline Stalled" icon={AlertCircle} color="red" count={stalledPipeline.length}>
        {stalledPipeline.map(item => (
          <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
            <div className="w-9 h-9 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
              {item.contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white text-sm">{item.contact.name}</span>
                <span className={`badge ${STAGE_COLOR[item.stage] || 'bg-gray-800 text-gray-400'}`}>
                  {item.stage}
                </span>
              </div>
              <span className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                <Clock size={11} />
                Stalled {item.daysSince} day{item.daysSince !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {actionBtn('Log Interaction', <MessageSquare size={12} />, () => setLogModal(item.contact), 'primary')}
              <Link
                to="/pipeline"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <span className="hidden sm:inline">Pipeline</span>
                <span className="sm:hidden">→</span>
              </Link>
            </div>
          </div>
        ))}
      </Section>

      {/* Section 3: No Follow-up Scheduled */}
      <Section title="No Follow-up Scheduled" icon={Bell} color="yellow" count={noFollowup.length} defaultOpen={false}>
        {noFollowup.map(contact => (
          <ContactRow
            key={contact.id}
            contact={contact}
            lastContact={timeSince(contact.lastContact)}
            actions={
              <>
                {actionBtn('Schedule Follow-up', <Bell size={12} />, () => setFuModal(contact), 'primary')}
                {actionBtn('Log Interaction', <MessageSquare size={12} />, () => setLogModal(contact))}
              </>
            }
          />
        ))}
      </Section>

      {/* Section 4: Overdue Follow-ups */}
      <Section title="Overdue Follow-ups" icon={AlertCircle} color="red" count={overdueFollowups.length}>
        {overdueFollowups.map(f => (
          <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
            <div className="w-9 h-9 rounded-full bg-red-700/20 border border-red-700/30 flex items-center justify-center text-red-300 font-bold text-xs flex-shrink-0">
              {f.contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white text-sm">{f.contact.name}</span>
                <span className={`badge ${STATUS_COLOR[f.contact.status] || 'bg-gray-800 text-gray-400'}`}>
                  {f.contact.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <Calendar size={11} />
                  Due {format(parseISO(f.date), 'MMM d')} · {f.daysPast} day{f.daysPast !== 1 ? 's' : ''} overdue
                </span>
                {f.notes && <span className="text-xs text-gray-500 truncate max-w-48">{f.notes}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {actionBtn('Log Interaction', <MessageSquare size={12} />, () => setLogModal(f.contact), 'primary')}
              <Link
                to="/followups"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <span className="hidden sm:inline">Follow-ups</span>
                <span className="sm:hidden">→</span>
              </Link>
            </div>
          </div>
        ))}
      </Section>

      {/* Section 5: New Leads Not Contacted */}
      <Section title="New Leads Not Contacted" icon={User} color="blue" count={notContacted.length}>
        {notContacted.map(contact => (
          <ContactRow
            key={contact.id}
            contact={contact}
            lastContact="Never contacted"
            actions={
              <>
                {actionBtn('First Contact', <MessageSquare size={12} />, () => setLogModal(contact), 'primary')}
                {actionBtn('Schedule Follow-up', <Bell size={12} />, () => setFuModal(contact))}
              </>
            }
          />
        ))}
      </Section>

      {/* Log Interaction Modal */}
      {logModal && (
        <LogModal
          contact={logModal}
          onClose={() => setLogModal(null)}
          onSave={data => {
            addInteraction({ contactId: logModal.id, ...data })
            setLogModal(null)
          }}
        />
      )}

      {/* Schedule Follow-up Modal */}
      {fuModal && (
        <FollowupModal
          contact={fuModal}
          onClose={() => setFuModal(null)}
          onSave={data => {
            addFollowup({ contactId: fuModal.id, ...data })
            setFuModal(null)
          }}
        />
      )}

      {/* Share Follow-up Modal (for unfollow-up shared links) */}
      {shareFuModal && (
        <ShareFollowupModal
          linkShare={shareFuModal.linkShare}
          contact={shareFuModal.contact}
          product={shareFuModal.product}
          onClose={() => setShareFuModal(null)}
          onSave={data => {
            addFollowup({ contactId: shareFuModal.contact.id, ...data })
            updateLinkShare(shareFuModal.linkShare.id, { followedUp: true })
            setShareFuModal(null)
          }}
        />
      )}
    </div>
  )
}
