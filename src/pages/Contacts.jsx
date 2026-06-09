import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, Search, Trash2, Edit2, MessageSquare, Bell, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { PRODUCTS } from '../data/products'

const STATUSES = ['New Lead', 'Warm Lead', 'Hot Lead', 'Customer', 'Repeat Customer', 'Inactive']
const SOURCES  = ['Instagram', 'Facebook', 'TikTok', 'Twitter/X', 'YouTube', 'Referral', 'In Person', 'Email', 'Other']
const INTERACTION_TYPES = ['Call', 'DM', 'Email', 'Text', 'In Person', 'Comment', 'Other']

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
    contacts, addContact, updateContact, deleteContact,
    addInteraction, addFollowup, addPipelineItem,
  } = useStore()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [viewContact, setViewContact] = useState(null)
  const [logContact, setLogContact] = useState(null)
  const [fuContact, setFuContact] = useState(null)

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
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [contacts, search, filterStatus])

  function openAdd() { setEditContact({ ...BLANK_CONTACT }); setShowModal(true) }
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
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">No contacts found. <button onClick={openAdd} className="text-brand-400">Add one →</button></p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Last Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
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
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {c.lastContact ? format(parseISO(c.lastContact), 'MMM d') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
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
function ContactView({ contact: c, onClose, onEdit, onLog, onFollowup, onPipeline }) {
  return (
    <Modal title={c.name} onClose={onClose}>
      <div className="space-y-4">
        <span className={`badge ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
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
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button className="btn-secondary" onClick={onLog}>Log Interaction</button>
          <button className="btn-secondary" onClick={onFollowup}>Schedule Follow-up</button>
          <button className="btn-secondary" onClick={onPipeline}>Add to Pipeline</button>
          <button className="btn-primary" onClick={onEdit}>Edit Contact</button>
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
          <textarea className="input min-h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed?" />
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
