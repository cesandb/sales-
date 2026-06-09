import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, CheckCircle, Trash2, AlertCircle, Clock, Calendar } from 'lucide-react'
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns'

const PRIORITY_COLOR = {
  high:   'bg-red-900/40 text-red-300',
  medium: 'bg-yellow-900/40 text-yellow-300',
  low:    'bg-gray-800 text-gray-400',
}

export default function Followups() {
  const { followups, contacts, addFollowup, updateFollowup, deleteFollowup } = useStore()
  const [filter, setFilter] = useState('pending')
  const [showModal, setShowModal] = useState(false)

  const now = startOfDay(new Date())

  const sorted = useMemo(() => {
    return followups
      .filter(f => {
        if (filter === 'pending')   return f.status === 'pending'
        if (filter === 'overdue')   return f.status === 'pending' && isBefore(parseISO(f.date), now)
        if (filter === 'completed') return f.status === 'completed'
        return true
      })
      .sort((a, b) => parseISO(a.date) - parseISO(b.date))
  }, [followups, filter, now])

  const overdue = followups.filter(f => f.status === 'pending' && isBefore(parseISO(f.date), now))
  const pending = followups.filter(f => f.status === 'pending')

  const getContact = (id) => contacts.find(c => c.id === id)

  function complete(id) { updateFollowup(id, { status: 'completed' }) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-ups</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {pending.length} pending · <span className="text-red-400">{overdue.length} overdue</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Schedule
        </button>
      </div>

      {overdue.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-red-900/20 border border-red-800/40 flex items-center gap-3 text-sm text-red-300">
          <AlertCircle size={16} className="flex-shrink-0" />
          You have {overdue.length} overdue follow-up{overdue.length !== 1 ? 's' : ''}. Don't let leads go cold!
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { id: 'pending',   label: `Pending (${pending.length})` },
          { id: 'overdue',   label: `Overdue (${overdue.length})` },
          { id: 'completed', label: 'Completed' },
          { id: 'all',       label: 'All' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === t.id ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500">No follow-ups here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(fu => {
            const contact = getContact(fu.contactId)
            const isOverdue = fu.status === 'pending' && isBefore(parseISO(fu.date), now)
            return (
              <div key={fu.id} className={`card flex items-start gap-4 ${isOverdue ? 'border-red-800/40' : ''}`}>
                <div className={`mt-0.5 flex-shrink-0 ${fu.status === 'completed' ? 'text-green-400' : isOverdue ? 'text-red-400' : 'text-brand-400'}`}>
                  {fu.status === 'completed' ? <CheckCircle size={20} /> : isOverdue ? <AlertCircle size={20} /> : <Clock size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-white">{contact?.name || 'Unknown'}</p>
                    <span className={`badge ${PRIORITY_COLOR[fu.priority]}`}>{fu.priority}</span>
                    {isOverdue && <span className="badge bg-red-900/40 text-red-300">Overdue</span>}
                    {fu.status === 'completed' && <span className="badge bg-green-900/40 text-green-300">Done</span>}
                  </div>
                  {fu.notes && <p className="text-sm text-gray-400 mt-1">{fu.notes}</p>}
                  <p className="text-xs text-gray-600 mt-1">
                    {format(parseISO(fu.date), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {fu.status === 'pending' && (
                    <button onClick={() => complete(fu.id)} className="text-xs btn-secondary flex items-center gap-1">
                      <CheckCircle size={13} /> Done
                    </button>
                  )}
                  <button onClick={() => deleteFollowup(fu.id)} className="p-2 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddFollowupModal
          contacts={contacts}
          onClose={() => setShowModal(false)}
          onSave={(data) => { addFollowup(data); setShowModal(false) }}
        />
      )}
    </div>
  )
}

function AddFollowupModal({ contacts, onClose, onSave }) {
  const [form, setForm] = useState({ contactId: '', date: '', priority: 'medium', notes: '' })
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title="Schedule Follow-up" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Contact *</label>
          <select className="input" value={form.contactId} onChange={f('contactId')}>
            <option value="">Select contact…</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={form.date} onChange={f('date')} />
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={form.priority} onChange={f('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-20 resize-none" value={form.notes} onChange={f('notes')} placeholder="What to discuss / reminder…" />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => form.contactId && form.date && onSave(form)}
            disabled={!form.contactId || !form.date}
          >
            Schedule
          </button>
        </div>
      </div>
    </Modal>
  )
}
