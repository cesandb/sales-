import { useState } from 'react'
import { useStore } from '../store/useStore'
import Modal from '../components/Modal'
import { Target, Plus, Trash2, Edit2, TrendingUp, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'

const GOAL_TYPES = [
  { value: 'new_contacts',   label: 'New Contacts' },
  { value: 'conversions',    label: 'Conversions' },
  { value: 'followups_done', label: 'Follow-ups Completed' },
  { value: 'interactions',   label: 'Interactions Logged' },
  { value: 'revenue',        label: 'Revenue ($)' },
  { value: 'custom',         label: 'Custom' },
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function Goals() {
  const { goals, setGoal, deleteGoal, contacts, followups, interactions, pipeline } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editGoal, setEditGoal] = useState(null)

  const now = new Date()

  function autoProgress(goal) {
    if (goal.autoTrack === false) return goal.current
    const monthContacts = contacts.filter(c => {
      const d = new Date(c.createdAt)
      return d.getFullYear() === goal.year && d.getMonth() === goal.month
    })
    if (goal.type === 'new_contacts')   return monthContacts.length
    if (goal.type === 'conversions')    return monthContacts.filter(c => c.status === 'Customer' || c.status === 'Repeat Customer').length
    if (goal.type === 'followups_done') {
      return followups.filter(f => {
        const d = new Date(f.createdAt)
        return f.status === 'completed' && d.getFullYear() === goal.year && d.getMonth() === goal.month
      }).length
    }
    if (goal.type === 'interactions') {
      return interactions.filter(i => {
        const d = new Date(i.date)
        return d.getFullYear() === goal.year && d.getMonth() === goal.month
      }).length
    }
    if (goal.type === 'revenue') {
      return pipeline
        .filter(p => (p.stage === 'Purchased' || p.stage === 'Repeat/Upsell') && p.value)
        .reduce((sum, p) => sum + parseFloat(p.value || 0), 0)
    }
    return goal.current
  }

  const sortedGoals = [...goals].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })

  function openAdd() {
    setEditGoal({ type: 'new_contacts', label: '', target: '', current: 0, year: now.getFullYear(), month: now.getMonth(), autoTrack: true })
    setShowModal(true)
  }

  function openEdit(g) { setEditGoal({ ...g }); setShowModal(true) }

  function save(form) {
    setGoal({ ...form, target: parseInt(form.target) || 0, current: parseInt(form.current) || 0 })
    setShowModal(false); setEditGoal(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals Tracker</h1>
          <p className="text-gray-400 text-sm mt-0.5">Set targets, measure your growth.</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card text-center py-20">
          <Target size={40} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 font-semibold">No goals yet.</p>
          <p className="text-gray-600 text-sm mt-1">Set your first goal to start tracking progress.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Create First Goal</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by year/month */}
          {Array.from(new Set(sortedGoals.map(g => `${g.year}-${g.month}`))).map(key => {
            const [year, month] = key.split('-').map(Number)
            const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
            const monthGoals = sortedGoals.filter(g => g.year === year && g.month === month)

            return (
              <div key={key}>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  {MONTHS[month]} {year}
                  {isCurrentMonth && <span className="badge bg-brand-600/30 text-brand-300">Current Month</span>}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {monthGoals.map(g => {
                    const current = autoProgress(g)
                    const pct = Math.min(100, g.target > 0 ? Math.round((current / g.target) * 100) : 0)
                    const isRevenue = g.type === 'revenue'
                    const typeLabel = GOAL_TYPES.find(t => t.value === g.type)?.label || g.type
                    const done = pct >= 100

                    return (
                      <div key={g.id} className={`card relative overflow-hidden ${done ? 'border-green-700/40' : ''}`}>
                        {done && (
                          <div className="absolute top-3 right-10">
                            <CheckCircle size={16} className="text-green-400" />
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{typeLabel}</p>
                            <p className="font-bold text-white mt-0.5">{g.label || typeLabel}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(g)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteGoal(g.id)} className="p-1 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-end gap-2 mb-3">
                          <span className="text-3xl font-black text-white">
                            {isRevenue ? `$${current.toFixed(0)}` : current}
                          </span>
                          <span className="text-gray-500 text-sm pb-1">
                            / {isRevenue ? `$${g.target}` : g.target}
                          </span>
                        </div>

                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-green-500' : pct > 70 ? 'bg-brand-400' : 'bg-brand-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{pct}% complete{done ? ' 🎉' : ''}</p>
                        {g.autoTrack && <p className="text-xs text-gray-600 mt-1">Auto-tracked</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && editGoal && (
        <GoalModal initial={editGoal} onSave={save} onClose={() => { setShowModal(false); setEditGoal(null) }} />
      )}
    </div>
  )
}

function GoalModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal title={form.id ? 'Edit Goal' : 'New Goal'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Goal Type</label>
          <select className="input" value={form.type} onChange={f('type')}>
            {GOAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input className="input" value={form.label} onChange={f('label')} placeholder="e.g. June new customers goal" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Month</label>
            <select className="input" value={form.month} onChange={f('month')}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input" value={form.year} onChange={f('year')} min={2024} max={2030} />
          </div>
        </div>
        <div>
          <label className="label">Target *</label>
          <input type="number" className="input" value={form.target} onChange={f('target')} placeholder="e.g. 10" />
        </div>
        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            id="autotrack"
            checked={form.autoTrack !== false}
            onChange={e => setForm(p => ({ ...p, autoTrack: e.target.checked }))}
            className="w-4 h-4 accent-brand-500"
          />
          <label htmlFor="autotrack" className="text-sm text-gray-300 cursor-pointer">
            Auto-track progress from CRM data
          </label>
        </div>
        {form.autoTrack === false && (
          <div>
            <label className="label">Current Progress</label>
            <input type="number" className="input" value={form.current} onChange={f('current')} placeholder="0" />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.target && onSave(form)} disabled={!form.target}>
            {form.id ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
