import { useState } from 'react'
import { useStore } from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, Trash2, Edit2, User, ArrowRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { PRODUCTS } from '../data/products'

const STAGES = [
  { id: 'New Lead',       color: 'border-blue-700/50    bg-blue-900/10' },
  { id: 'First Contact',  color: 'border-yellow-700/50  bg-yellow-900/10' },
  { id: 'Interested',     color: 'border-orange-700/50  bg-orange-900/10' },
  { id: 'Recommended',    color: 'border-purple-700/50  bg-purple-900/10' },
  { id: 'Purchased',      color: 'border-green-700/50   bg-green-900/10' },
  { id: 'Repeat/Upsell',  color: 'border-emerald-700/50 bg-emerald-900/10' },
]

const BLANK_ITEM = { contactId: '', stage: 'New Lead', productId: '', notes: '', value: '' }

export default function Pipeline() {
  const { pipeline, contacts, addPipelineItem, updatePipelineItem, deletePipelineItem } = useStore()
  const [editItem, setEditItem] = useState(null)
  const [showModal, setShowModal] = useState(false)

  function openAdd() { setEditItem({ ...BLANK_ITEM }); setShowModal(true) }
  function openEdit(item) { setEditItem({ ...item }); setShowModal(true) }

  function saveItem(form) {
    if (form.id) updatePipelineItem(form.id, form)
    else addPipelineItem(form)
    setShowModal(false); setEditItem(null)
  }

  function moveStage(item, direction) {
    const idx = STAGES.findIndex(s => s.id === item.stage)
    const next = STAGES[idx + direction]
    if (next) updatePipelineItem(item.id, { stage: next.id })
  }

  const getContact = (id) => contacts.find(c => c.id === id)
  const getProduct = (id) => PRODUCTS.find(p => p.id === id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
          <p className="text-gray-400 text-sm mt-0.5">{pipeline.length} active items</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add to Pipeline
        </button>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map(stage => {
            const items = pipeline.filter(p => p.stage === stage.id)
            return (
              <div key={stage.id} className={`pipeline-col border ${stage.color}`}>
                <div className="px-4 py-3 border-b border-gray-800/60">
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">{stage.id}</p>
                  <p className="text-brand-400 font-bold text-lg">{items.length}</p>
                </div>
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[65vh]">
                  {items.map(item => {
                    const contact = getContact(item.contactId)
                    const product = getProduct(item.productId)
                    const stageIdx = STAGES.findIndex(s => s.id === item.stage)
                    return (
                      <div key={item.id} className="bg-gray-900 border border-gray-700/60 rounded-xl p-3 hover:border-gray-600 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0">
                              {contact ? contact.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <p className="font-semibold text-white text-sm truncate">
                              {contact?.name || 'Unknown Contact'}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deletePipelineItem(item.id)} className="p-1 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {product && (
                          <p className="text-xs text-gray-400 mb-1 truncate">📦 {product.name}</p>
                        )}
                        {item.value && (
                          <p className="text-xs text-green-400 mb-1">💰 ${item.value}</p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-500 line-clamp-2">{item.notes}</p>
                        )}

                        <div className="flex gap-1 mt-3">
                          {stageIdx > 0 && (
                            <button
                              onClick={() => moveStage(item, -1)}
                              className="flex-1 text-xs text-gray-500 hover:text-white py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                            >
                              ← Back
                            </button>
                          )}
                          {stageIdx < STAGES.length - 1 && (
                            <button
                              onClick={() => moveStage(item, 1)}
                              className="flex-1 text-xs text-brand-400 hover:text-white py-1 rounded bg-brand-900/30 hover:bg-brand-700/50 transition-colors flex items-center justify-center gap-1"
                            >
                              Advance <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && (
                    <p className="text-center text-gray-600 text-xs py-8">Empty</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && editItem && (
        <PipelineItemModal
          initial={editItem}
          contacts={contacts}
          onSave={saveItem}
          onClose={() => { setShowModal(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}

function PipelineItemModal({ initial, contacts, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title={form.id ? 'Edit Pipeline Item' : 'Add Pipeline Item'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Contact *</label>
          <select className="input" value={form.contactId} onChange={f('contactId')}>
            <option value="">Select contact…</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Stage</label>
          <select className="input" value={form.stage} onChange={f('stage')}>
            {STAGES.map(s => <option key={s.id}>{s.id}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Product Interested In</label>
          <select className="input" value={form.productId} onChange={f('productId')}>
            <option value="">None / TBD</option>
            {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estimated Value ($)</label>
          <input type="number" className="input" value={form.value} onChange={f('value')} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-20 resize-none" value={form.notes} onChange={f('notes')} placeholder="Any notes…" />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.contactId && onSave(form)} disabled={!form.contactId}>
            {form.id ? 'Save' : 'Add to Pipeline'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
