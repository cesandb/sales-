import { useState } from 'react'
import { useStore } from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, Copy, Check, Edit2, Trash2, MessageSquare } from 'lucide-react'

const CATEGORIES = ['Outreach', 'Recommendation', 'Retention', 'Re-Engagement', 'Other']

export default function Templates() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, contacts } = useStore()
  const [editTpl, setEditTpl] = useState(null)
  const [copied, setCopied] = useState(null)
  const [previewContact, setPreviewContact] = useState('')
  const [filterCat, setFilterCat] = useState('All')

  const filtered = templates.filter(t => filterCat === 'All' || t.category === filterCat)

  function applyMerge(body) {
    const contact = contacts.find(c => c.id === previewContact)
    if (!contact) return body
    return body.replace(/\{\{name\}\}/g, contact.name)
  }

  async function copyTemplate(tpl) {
    const text = applyMerge(tpl.body)
    await navigator.clipboard.writeText(text)
    setCopied(tpl.id)
    setTimeout(() => setCopied(null), 2500)
  }

  function save(form) {
    if (form.id) updateTemplate(form.id, form)
    else addTemplate(form)
    setEditTpl(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Templates</h1>
          <p className="text-gray-400 text-sm mt-0.5">{templates.length} message templates</p>
        </div>
        <button onClick={() => setEditTpl({ title: '', category: 'Outreach', body: '' })} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Merge preview bar */}
      <div className="card flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <MessageSquare size={14} className="text-brand-400" />
          Preview merge tags as:
        </div>
        <select
          className="input w-auto"
          value={previewContact}
          onChange={e => setPreviewContact(e.target.value)}
        >
          <option value="">No contact selected</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-xs text-gray-500">Select a contact to preview {"{{name}}"} substitution before copying.</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...CATEGORIES].map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterCat === c ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {filtered.map(tpl => (
          <div key={tpl.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="badge bg-brand-900/40 text-brand-300 mb-2">{tpl.category}</span>
                <h3 className="font-semibold text-white">{tpl.title}</h3>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditTpl({ ...tpl })} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 rounded hover:bg-red-900/30 text-gray-400 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-400 bg-gray-800/40 rounded-lg p-3 whitespace-pre-wrap leading-relaxed flex-1 max-h-48 overflow-y-auto">
              {applyMerge(tpl.body)}
            </p>

            <button
              onClick={() => copyTemplate(tpl)}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                copied === tpl.id
                  ? 'bg-green-900/40 text-green-300'
                  : 'bg-brand-600/20 text-brand-400 hover:bg-brand-600/40 hover:text-white'
              }`}
            >
              {copied === tpl.id ? <><Check size={14} /> Copied to clipboard!</> : <><Copy size={14} /> Copy Message</>}
            </button>
          </div>
        ))}
      </div>

      {editTpl && (
        <TemplateModal
          initial={editTpl}
          onSave={save}
          onClose={() => setEditTpl(null)}
        />
      )}
    </div>
  )
}

function TemplateModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title={form.id ? 'Edit Template' : 'New Template'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={f('title')} placeholder="Template name…" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={f('category')}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Message Body *</label>
          <p className="text-xs text-gray-500 mb-2">Use {"{{name}}"} to insert contact's name.</p>
          <textarea
            className="input min-h-52 resize-none font-mono text-xs"
            value={form.body}
            onChange={f('body')}
            placeholder="Write your message here…"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => form.title && form.body && onSave(form)}
            disabled={!form.title || !form.body}
          >
            {form.id ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
