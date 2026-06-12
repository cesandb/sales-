import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import {
  Plus, DollarSign, TrendingUp, Trophy, Target, Edit2, Trash2,
  X, Check, ChevronDown, ChevronUp, ExternalLink, AlertTriangle,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { Link } from 'react-router-dom'

export const DEAL_STAGES = [
  { id: 'prospecting', label: 'Prospecting',   color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-700/30',     probability: 10  },
  { id: 'qualifying',  label: 'Qualifying',    color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-700/30', probability: 25  },
  { id: 'proposal',    label: 'Proposal Sent', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', probability: 50  },
  { id: 'negotiating', label: 'Negotiating',   color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-700/30', probability: 75  },
  { id: 'closed_won',  label: 'Closed Won',    color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30',   probability: 100 },
  { id: 'closed_lost', label: 'Closed Lost',   color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/30',       probability: 0   },
]

const EMPTY_FORM = { contactId: '', title: '', amount: '', stage: 'prospecting', probability: 10, closeDate: '', renewalDate: '', notes: '' }

function DealModal({ contacts, deal, onSave, onClose }) {
  const [form, setForm] = useState(deal ? {
    contactId: deal.contactId || '',
    title: deal.title || '',
    amount: String(deal.amount || ''),
    stage: deal.stage || 'prospecting',
    probability: deal.probability ?? 10,
    closeDate: deal.closeDate ? deal.closeDate.split('T')[0] : '',
    renewalDate: deal.renewalDate ? deal.renewalDate.split('T')[0] : '',
    notes: deal.notes || '',
  } : { ...EMPTY_FORM })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleStageChange(stage) {
    const meta = DEAL_STAGES.find(s => s.id === stage)
    set('stage', stage)
    set('probability', meta?.probability ?? 10)
  }

  function handleSave() {
    if (!form.contactId || !form.title.trim()) return
    onSave({
      ...form,
      amount: parseFloat(form.amount) || 0,
      probability: parseInt(form.probability) || 10,
      closeDate: form.closeDate || null,
      renewalDate: form.renewalDate || null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">{deal ? 'Edit Deal' : 'New Deal'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div>
          <label className="label">Contact *</label>
          <select className="input" value={form.contactId} onChange={e => set('contactId', e.target.value)}>
            <option value="">Select contact…</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Deal Title *</label>
          <input className="input" placeholder="e.g. Protein Stack Package" value={form.title}
            onChange={e => set('title', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Value ($)</label>
            <input type="number" min="0" className="input" placeholder="0" value={form.amount}
              onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="label">Win Probability %</label>
            <input type="number" min="0" max="100" className="input" value={form.probability}
              onChange={e => set('probability', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Stage</label>
          <select className="input" value={form.stage} onChange={e => handleStageChange(e.target.value)}>
            {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Expected Close</label>
            <input type="date" className="input text-xs" value={form.closeDate}
              onChange={e => set('closeDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Renewal Date</label>
            <input type="date" className="input text-xs" value={form.renewalDate}
              onChange={e => set('renewalDate', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input text-sm min-h-16 resize-none" placeholder="Product interest, objections, next steps…"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!form.contactId || !form.title.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Check size={14} /> {deal ? 'Save Changes' : 'Create Deal'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function DealCard({ deal, contact, onEdit, onDelete, onStageChange }) {
  const [expanded, setExpanded] = useState(false)
  const stage = DEAL_STAGES.find(s => s.id === deal.stage) || DEAL_STAGES[0]
  const weighted = deal.amount * (deal.probability / 100)
  const daysToClose = deal.closeDate ? differenceInDays(parseISO(deal.closeDate), new Date()) : null
  const overdue = daysToClose !== null && daysToClose < 0 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'

  return (
    <div className={`card p-0 overflow-hidden ${overdue ? 'border border-red-800/40' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm truncate">{deal.title}</p>
            <span className={`badge text-[10px] ${stage.bg} ${stage.color}`}>{stage.label}</span>
            {overdue && <span className="badge text-[10px] bg-red-900/40 text-red-300"><AlertTriangle size={8} /> Overdue</span>}
          </div>
          {contact && (
            <Link to="/contacts" className="text-xs text-gray-500 hover:text-brand-400 transition-colors">
              {contact.name}
            </Link>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-white">${deal.amount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">${weighted.toFixed(0)} weighted</p>
        </div>
        <button onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          {deal.notes && <p className="text-xs text-gray-400">{deal.notes}</p>}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            {deal.closeDate && <span>Close: {format(parseISO(deal.closeDate), 'MMM d')}{daysToClose !== null && <span className={overdue ? 'text-red-400 ml-1' : 'text-gray-400 ml-1'}>({overdue ? `${Math.abs(daysToClose)}d overdue` : `${daysToClose}d`})</span>}</span>}
            {deal.renewalDate && <span>Renewal: {format(parseISO(deal.renewalDate), 'MMM d')}</span>}
            <span>Probability: {deal.probability}%</span>
          </div>
          <div className="flex gap-2">
            <select value={deal.stage}
              onChange={e => onStageChange(deal.id, e.target.value)}
              className="input text-xs flex-1">
              {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button onClick={() => onEdit(deal)}
              className="p-2 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-gray-800 transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(deal.id)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Deals() {
  const { deals = [], contacts, addDeal, updateDeal, deleteDeal } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const openDeals   = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const wonThisMonth = deals.filter(d => d.stage === 'closed_won' && new Date(d.updatedAt) >= monthStart)
  const lostDeals   = deals.filter(d => d.stage === 'closed_lost')
  const wonDeals    = deals.filter(d => d.stage === 'closed_won')
  const pipelineValue = openDeals.reduce((s, d) => s + d.amount * (d.probability / 100), 0)
  const wonMonthValue = wonThisMonth.reduce((s, d) => s + d.amount, 0)
  const winRate = wonDeals.length + lostDeals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : null

  const filtered = useMemo(() => {
    if (stageFilter === 'all') return deals
    return deals.filter(d => d.stage === stageFilter)
  }, [deals, stageFilter])

  function handleSave(form) {
    if (editDeal) updateDeal(editDeal.id, form)
    else addDeal(form)
    setEditDeal(null)
  }

  function handleEdit(deal) { setEditDeal(deal); setShowModal(true) }
  function handleDelete(id) { if (confirm('Delete this deal?')) deleteDeal(id) }
  function handleStageChange(id, stage) {
    const meta = DEAL_STAGES.find(s => s.id === stage)
    updateDeal(id, { stage, probability: meta?.probability ?? 10 })
  }

  const contactMap = useMemo(() => {
    const m = new Map()
    contacts.forEach(c => m.set(c.id, c))
    return m
  }, [contacts])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Deals</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track opportunities through your sales pipeline</p>
        </div>
        <button onClick={() => { setEditDeal(null); setShowModal(true) }}
          className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={14} /> New Deal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xl font-bold text-white">{openDeals.length}</p>
          <p className="text-xs text-gray-500">Open Deals</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-brand-400">${pipelineValue.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Weighted Pipeline</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-green-400">${wonMonthValue.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Won This Month</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-white">{winRate !== null ? `${winRate}%` : '—'}</p>
          <p className="text-xs text-gray-500">Win Rate</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStageFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${stageFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          All ({deals.length})
        </button>
        {DEAL_STAGES.map(s => {
          const count = deals.filter(d => d.stage === s.id).length
          if (count === 0) return null
          return (
            <button key={s.id} onClick={() => setStageFilter(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${stageFilter === s.id ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Deal List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16 space-y-2">
          <TrendingUp size={32} className="text-brand-400 mx-auto" />
          <p className="text-white font-semibold">No deals yet</p>
          <p className="text-sm text-gray-500">Create a deal to start tracking your pipeline value.</p>
          <button onClick={() => { setEditDeal(null); setShowModal(true) }}
            className="btn-primary mx-auto flex items-center gap-2 mt-4">
            <Plus size={13} /> Create First Deal
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(deal => (
            <DealCard key={deal.id} deal={deal}
              contact={contactMap.get(deal.contactId)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStageChange={handleStageChange}
            />
          ))}
        </div>
      )}

      {(showModal || editDeal) && (
        <DealModal
          contacts={contacts}
          deal={editDeal}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditDeal(null) }}
        />
      )}
    </div>
  )
}
