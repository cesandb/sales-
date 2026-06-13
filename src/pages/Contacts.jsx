import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import Modal from '../components/Modal'
import AIMessageModal from '../components/AIMessageModal'
import ConversionModal from '../components/ConversionModal'
import { Plus, Search, Trash2, Edit2, MessageSquare, Bell, Sparkles, ExternalLink, Zap, X, CheckCircle } from 'lucide-react'
import { enrichContact } from '../utils/enrichContact'
import { calcIcpScore, getIcpTier } from '../utils/icpScore'
import { DEFAULT_SEQUENCES } from '../utils/affiliateLinks'
import { format, parseISO } from 'date-fns'
import { PRODUCTS } from '../data/products'

const BUYING_SIGNALS = [
  'how much', "what's the price", 'how do i order', 'how do i buy',
  'want to try', "i'm interested", 'send me the link', 'how do i get',
  "let's do it", 'ready to', 'place an order', 'how to purchase',
  'sign me up', 'yes i want', 'where can i buy', 'how to get',
]

function detectBuyingSignals(text) {
  const lower = text.toLowerCase()
  return BUYING_SIGNALS.some(sig => lower.includes(sig))
}

const STATUSES = ['New Lead', 'Warm Lead', 'Hot Lead', 'Opportunity', 'Customer', 'Repeat Customer', 'At Risk', 'Evangelist', 'Inactive']
const SOURCES  = ['Instagram', 'Facebook', 'TikTok', 'Twitter/X', 'YouTube', 'WhatsApp', 'Referral', 'In Person', 'Email', 'Other']
const INTERACTION_TYPES = ['Call', 'DM', 'Email', 'Text', 'In Person', 'Comment', 'Other']

function getDMUrl(contact) {
  const handle = (contact.social || '').replace(/^@/, '').trim()
  const phone = (contact.phone || '').replace(/\D/g, '')
  const src = contact.source || ''
  if (src === 'Instagram' && handle) return `https://ig.me/m/${handle}`
  if (src === 'Facebook' && handle) return `https://m.me/${handle}`
  if (src === 'WhatsApp' && phone) return `https://wa.me/${phone}`
  if (src === 'Twitter/X' && handle) return `https://x.com/${handle}`
  if (src === 'TikTok' && handle) return `https://www.tiktok.com/@${handle}`
  if (contact.phone) return `sms:${contact.phone}`
  if (contact.email) return `mailto:${contact.email}`
  return null
}

const STATUS_COLOR = {
  'New Lead':        'bg-blue-900/40 text-blue-300',
  'Warm Lead':       'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':        'bg-orange-900/40 text-orange-300',
  'Customer':        'bg-green-900/40 text-green-300',
  'Repeat Customer': 'bg-emerald-900/40 text-emerald-300',
  'Inactive':        'bg-gray-800 text-gray-400',
}

const BLANK_CONTACT = {
  name: '', phone: '', email: '', social: '', source: '', status: 'New Lead',
  tags: '', notes: '', productsInterested: [],
}

export default function Contacts() {
  const {
    contacts, interactions, addContact, updateContact, deleteContact,
    addInteraction, addFollowup, addPipelineItem, addEnrollment,
  } = useStore()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [viewContact, setViewContact] = useState(null)
  const [logContact, setLogContact] = useState(null)
  const [fuContact, setFuContact] = useState(null)
  const [aiContact, setAiContact] = useState(null)
  const [conversionContact, setConversionContact] = useState(null)
  const [enrichContact_target, setEnrichContact_target] = useState(null)
  const [enrichResult, setEnrichResult] = useState(null)
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichError, setEnrichError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [sortBy, setSortBy] = useState('score')

  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function clearSelection() { setSelectedIds(new Set()) }
  function selectAll() { setSelectedIds(new Set(filtered.map(c => c.id))) }

  function applyBulkStatus(status) {
    for (const id of selectedIds) updateContact(id, { status })
    clearSelection()
  }
  function applyBulkEnroll(sequenceId) {
    for (const id of selectedIds) addEnrollment({ contactId: id, sequenceId })
    clearSelection()
  }
  function applyBulkTag(tag) {
    const t = tag.trim()
    if (!t) return
    for (const id of selectedIds) {
      const c = contacts.find(c => c.id === id)
      if (c) updateContact(id, { tags: [...new Set([...(c.tags || []), t])] })
    }
    clearSelection()
  }

  const iByC = useMemo(() => {
    const m = new Map()
    for (const i of interactions) {
      const a = m.get(i.contactId) || []
      a.push(i)
      m.set(i.contactId, a)
    }
    return m
  }, [interactions])

  const scoreMap = useMemo(() => {
    const m = new Map()
    for (const c of contacts) m.set(c.id, calcIcpScore(c, iByC.get(c.id) || []))
    return m
  }, [contacts, iByC])

  const filtered = useMemo(() => {
    return contacts
      .filter(c => {
        if (filterStatus !== 'All' && c.status !== filterStatus) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            c.name.toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.social || '').toLowerCase().includes(q) ||
            (c.phone || '').includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'score')  return (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0)
        if (sortBy === 'status') return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
  }, [contacts, search, filterStatus, sortBy, scoreMap])

  function openAdd() { setEditContact({ ...BLANK_CONTACT }); setShowModal(true) }
  async function handleEnrich(c) {
    setEnrichContact_target(c)
    setEnrichResult(null)
    setEnrichError('')
    setEnrichLoading(true)
    try {
      const result = await enrichContact(c)
      setEnrichResult(result)
    } catch (e) {
      setEnrichError(e.message)
    } finally {
      setEnrichLoading(false)
    }
  }

  function applyEnrichment() {
    if (!enrichResult || !enrichContact_target) return
    const existing = contacts.find(c => c.id === enrichContact_target.id)
    const newNotes = [existing?.notes, enrichResult.notesAppend].filter(Boolean).join('\n')
    const newTags = [...new Set([...(existing?.tags || []), ...(enrichResult.tagsAdd || [])])]
    const updates = { notes: newNotes, tags: newTags }
    if (enrichResult.nameOverride) updates.name = enrichResult.nameOverride
    updateContact(enrichContact_target.id, updates)
    setEnrichContact_target(null)
    setEnrichResult(null)
  }

  function openEdit(c) { setEditContact({ ...c, tags: (c.tags || []).join(', '), productsInterested: c.productsInterested || [] }); setShowModal(true) }

  function saveContact(form) {
    const payload = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    if (payload.id) updateContact(payload.id, payload)
    else addContact(payload)
    setShowModal(false)
    setEditContact(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 text-sm mt-0.5">{contacts.length} total contacts</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search name, email, social..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['All', ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {s} {s !== 'All' && `(${contacts.filter(c => c.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border-l border-gray-700 pl-3">
          <span className="text-xs text-gray-500 mr-1">Sort:</span>
          {[['score', '🎯 Score'], ['newest', 'Newest'], ['status', 'Status']].map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                sortBy === key ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">No contacts found. <button onClick={openAdd} className="text-brand-400">Add one →</button></p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(c => (
              <div key={c.id} className="card p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-brand-500 flex-shrink-0"
                />
                <button onClick={() => setViewContact(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-10 h-10 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-sm flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`badge text-[10px] ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                      <span className={`badge text-[10px] ${getIcpTier(scoreMap.get(c.id) || 0).color}`}>{scoreMap.get(c.id) || 0}</span>
                      {c.social && <p className="text-xs text-gray-500 truncate">{c.social}</p>}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => setConversionContact(c)} className="p-2 rounded-lg hover:bg-green-900/40 text-gray-400 hover:text-green-400 transition-colors" title="Log conversion">
                    <CheckCircle size={15} />
                  </button>
                  <button onClick={() => setAiContact(c)} className="p-2 rounded-lg hover:bg-brand-900/40 text-gray-400 hover:text-brand-400 transition-colors" title="AI draft">
                    <Sparkles size={15} />
                  </button>
                  <button onClick={() => setLogContact(c)} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Log">
                    <MessageSquare size={15} />
                  </button>
                  <button onClick={() => setFuContact(c)} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Follow-up">
                    <Bell size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      onChange={e => e.target.checked ? selectAll() : clearSelection()}
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-brand-500"
                    />
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Last Contact</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${selectedIds.has(c.id) ? 'bg-brand-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-brand-500"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => setViewContact(c)} className="flex items-center gap-3 text-left">
                        <div className="w-8 h-8 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white">{c.name}</p>
                          {c.social && <p className="text-xs text-gray-500">{c.social}</p>}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-400">
                      <div>{c.email}</div>
                      <div className="text-xs">{c.phone}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">{c.source}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`badge text-xs ${getIcpTier(scoreMap.get(c.id) || 0).color}`}>
                        {scoreMap.get(c.id) || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                      {c.lastContact ? format(parseISO(c.lastContact), 'MMM d') : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setConversionContact(c)} className="p-1.5 rounded hover:bg-green-900/40 text-gray-400 hover:text-green-400 transition-colors" title="Log conversion 🎉">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => setAiContact(c)} className="p-1.5 rounded hover:bg-brand-900/40 text-gray-400 hover:text-brand-400 transition-colors" title="AI draft message">
                          <Sparkles size={14} />
                        </button>
                        <button onClick={() => setLogContact(c)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Log interaction">
                          <MessageSquare size={14} />
                        </button>
                        <button onClick={() => setFuContact(c)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Schedule follow-up">
                          <Bell size={14} />
                        </button>
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteContact(c.id)} className="p-1.5 rounded hover:bg-red-900/40 text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && editContact && (
        <ContactForm
          initial={editContact}
          onSave={saveContact}
          onClose={() => { setShowModal(false); setEditContact(null) }}
        />
      )}

      {viewContact && (
        <ContactView
          contact={viewContact}
          onClose={() => setViewContact(null)}
          onEdit={() => { openEdit(viewContact); setViewContact(null) }}
          onLog={() => { setLogContact(viewContact); setViewContact(null) }}
          onFollowup={() => { setFuContact(viewContact); setViewContact(null) }}
          onPipeline={() => {
            addPipelineItem({ contactId: viewContact.id, stage: 'New Lead', notes: '', productId: '' })
            setViewContact(null)
          }}
          onAIDraft={() => { setAiContact(viewContact); setViewContact(null) }}
          onEnrich={() => { handleEnrich(viewContact); setViewContact(null) }}
          onConverted={() => { setConversionContact(viewContact); setViewContact(null) }}
        />
      )}

      {logContact && (
        <LogInteractionModal
          contact={logContact}
          onClose={() => setLogContact(null)}
          onSave={(data) => { addInteraction({ contactId: logContact.id, ...data }); setLogContact(null) }}
          onUpdateStatus={(status) => updateContact(logContact.id, { status })}
        />
      )}

      {fuContact && (
        <FollowupModal
          contact={fuContact}
          onClose={() => setFuContact(null)}
          onSave={(data) => { addFollowup({ contactId: fuContact.id, ...data }); setFuContact(null) }}
        />
      )}

      {enrichContact_target && (
        <EnrichModal
          contact={enrichContact_target}
          loading={enrichLoading}
          result={enrichResult}
          error={enrichError}
          onApply={applyEnrichment}
          onClose={() => { setEnrichContact_target(null); setEnrichResult(null); setEnrichError('') }}
        />
      )}

      {aiContact && (
        <AIMessageModal
          contact={aiContact}
          interactions={interactions}
          onClose={() => setAiContact(null)}
        />
      )}

      {conversionContact && (
        <ConversionModal
          contact={conversionContact}
          onClose={() => setConversionContact(null)}
        />
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onStatus={applyBulkStatus}
          onEnroll={applyBulkEnroll}
          onTag={applyBulkTag}
          onClear={clearSelection}
        />
      )}
    </div>
  )
}

// ── Contact Form ──────────────────────────────────────────────────────────────
function ContactForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v.target ? v.target.value : v }))

  return (
    <Modal title={form.id ? 'Edit Contact' : 'Add Contact'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={f('status')}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={f('email')} placeholder="email@example.com" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={f('phone')} placeholder="+1 555-000-0000" />
          </div>
          <div>
            <label className="label">Social Handle</label>
            <input className="input" value={form.social} onChange={f('social')} placeholder="@username" />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={form.source} onChange={f('source')}>
              <option value="">Select source…</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={form.tags} onChange={f('tags')} placeholder="gym, weight loss, vegan…" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-24 resize-none" value={form.notes} onChange={f('notes')} placeholder="Any notes about this contact…" />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.name.trim() && onSave(form)} disabled={!form.name.trim()}>
            {form.id ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Contact View ──────────────────────────────────────────────────────────────
function ContactView({ contact: c, onClose, onEdit, onLog, onFollowup, onPipeline, onAIDraft, onEnrich, onConverted }) {
  const icpScore = calcIcpScore(c)
  const icpTier = getIcpTier(icpScore)
  const canEnrich = c.social && /^(github:|hn:|devto:)/i.test(c.social.trim())

  return (
    <Modal title={c.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
          <span className={`badge text-xs ${icpTier.color}`}>ICP: {icpScore} — {icpTier.label}</span>
        </div>
        {c.source && <p className="text-xs text-gray-500">Source: {c.source}</p>}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {c.email  && <Kv k="Email"  v={c.email} />}
          {c.phone  && <Kv k="Phone"  v={c.phone} />}
          {c.social && <Kv k="Social" v={c.social} />}
        </div>
        {(c.tags?.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {c.tags.map(t => <span key={t} className="badge bg-gray-800 text-gray-300">{t}</span>)}
          </div>
        )}
        {c.notes && <p className="text-sm text-gray-300 bg-gray-800/40 rounded-lg p-3">{c.notes}</p>}
        {(() => { const dmUrl = getDMUrl(c); return dmUrl ? (
          <a
            href={dmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-brand-700/20 border border-brand-700/40 text-brand-300 hover:bg-brand-600/30 text-sm font-semibold transition-colors"
          >
            <ExternalLink size={13} /> Open DM on {c.source || 'Platform'}
          </a>
        ) : null })()}
        <button
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700/20 hover:bg-green-700/30 border border-green-700/40 text-green-300 font-bold text-sm transition-colors"
          onClick={onConverted}
        >
          <CheckCircle size={14} /> 🎉 Log Conversion — They Bought!
        </button>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button className="btn-secondary" onClick={onLog}>Log Interaction</button>
          <button className="btn-secondary" onClick={onFollowup}>Schedule Follow-up</button>
          <button className="btn-secondary" onClick={onPipeline}>Add to Pipeline</button>
          <button
            className="btn-primary flex items-center justify-center gap-2"
            onClick={onAIDraft}
          >
            <Sparkles size={13} /> Draft Message
          </button>
          {canEnrich && (
            <button
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={onEnrich}
            >
              <Zap size={13} /> Enrich Profile
            </button>
          )}
          <button className={`btn-secondary ${canEnrich ? '' : 'col-span-2'}`} onClick={onEdit}>Edit Contact</button>
        </div>
      </div>
    </Modal>
  )
}

function Kv({ k, v }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{k}</p>
      <p className="text-gray-200">{v}</p>
    </div>
  )
}

// ── Log Interaction ───────────────────────────────────────────────────────────
function LogInteractionModal({ contact, onClose, onSave, onUpdateStatus }) {
  const [type, setType] = useState('Call')
  const [notes, setNotes] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [hasBuyingSignal, setHasBuyingSignal] = useState(false)

  function save() {
    onSave({ type, notes })
    if (newStatus) onUpdateStatus(newStatus)
    onClose()
  }

  return (
    <Modal title={`Log Interaction – ${contact.name}`} onClose={onClose}>
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
            onChange={e => {
              setNotes(e.target.value)
              setHasBuyingSignal(detectBuyingSignals(e.target.value))
            }}
            placeholder="What was discussed?"
          />
          {hasBuyingSignal && (
            <div className="flex items-center gap-2 mt-2 bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2">
              <Sparkles size={11} className="text-green-400 flex-shrink-0" />
              <span className="text-green-300 text-xs font-semibold flex-1">Buying signal detected!</span>
              <button
                type="button"
                onClick={() => setNewStatus('Hot Lead')}
                className="text-xs text-green-400 hover:text-green-300 underline font-bold"
              >
                Upgrade to Hot Lead →
              </button>
            </div>
          )}
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

// ── Follow-up Modal ───────────────────────────────────────────────────────────
function FollowupModal({ contact, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('medium')

  return (
    <Modal title={`Follow-up – ${contact.name}`} onClose={onClose}>
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
          <textarea className="input min-h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reminder note…" />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => date && onSave({ date, notes, priority })} disabled={!date}>
            Schedule
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Enrich Modal ──────────────────────────────────────────────────────────────
function EnrichModal({ contact, loading, result, error, onApply, onClose }) {
  return (
    <Modal title={`Enrich — ${contact.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          Looking up public profile for <span className="text-brand-300 font-mono">{contact.social}</span>
        </p>

        {loading && (
          <div className="flex items-center gap-3 py-6 justify-center text-gray-400">
            <svg className="animate-spin h-5 w-5 text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm">Fetching profile data…</p>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result && !loading && (
          <div className="space-y-3">
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase">Data to add</p>
              <p className="text-sm text-gray-200 leading-relaxed">{result.notesAppend}</p>
              {result.tagsAdd?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.tagsAdd.map(t => (
                    <span key={t} className="badge bg-brand-900/40 text-brand-300 text-xs">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" onClick={onApply}>
                <Zap size={13} /> Apply to Contact
              </button>
            </div>
          </div>
        )}

        {!loading && !result && !error && (
          <p className="text-gray-500 text-sm text-center py-4">Starting enrichment…</p>
        )}
      </div>
    </Modal>
  )
}


// ── Bulk Action Bar ───────────────────────────────────────────────────────────
function BulkActionBar({ count, onStatus, onEnroll, onTag, onClear }) {
  const [tagInput, setTagInput] = useState('')
  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2 max-w-2xl w-full pointer-events-auto flex-wrap">
        <span className="text-sm font-bold text-white flex-shrink-0">{count} selected</span>
        <select
          className="input text-xs py-1.5 flex-1 min-w-28"
          defaultValue=""
          onChange={e => { if (e.target.value) { onStatus(e.target.value); e.target.value = '' } }}
        >
          <option value="">Update status…</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="input text-xs py-1.5 flex-1 min-w-28"
          defaultValue=""
          onChange={e => { if (e.target.value) { onEnroll(e.target.value); e.target.value = '' } }}
        >
          <option value="">Enroll in sequence…</option>
          {DEFAULT_SEQUENCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-1 flex-1 min-w-36">
          <input
            className="input text-xs py-1.5 flex-1"
            placeholder="Add tag…"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { onTag(tagInput); setTagInput('') } }}
          />
          <button
            onClick={() => { if (tagInput.trim()) { onTag(tagInput); setTagInput('') } }}
            className="btn-primary text-xs px-2.5 py-1.5 flex-shrink-0"
          >
            Tag
          </button>
        </div>
        <button onClick={onClear} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
