import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { generateDailyBrief, getApiKey } from '../utils/aiDraft'
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Target, Users, TrendingUp, Bell } from 'lucide-react'
import { startOfMonth, parseISO, isAfter } from 'date-fns'
import { Link } from 'react-router-dom'

const todayKey = () => `phorm_ai_brief_${new Date().toISOString().split('T')[0]}`

const FOCUS_ICON = { new_leads: Users, follow_ups: Bell, customers: TrendingUp, pipeline: Target }
const URGENCY_COLOR = {
  high: 'bg-red-900/40 text-red-300',
  medium: 'bg-orange-900/40 text-orange-300',
  low: 'bg-blue-900/40 text-blue-300',
}

export default function AiBrief() {
  const { contacts, interactions, followups, pipeline, goals, contactProducts, settings } = useStore()
  const [brief, setBrief] = useState(() => {
    try { return JSON.parse(localStorage.getItem(todayKey()) || 'null') } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const hasKey = !!getApiKey()

  useEffect(() => {
    if (!hasKey || brief) return
    runBrief()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runBrief() {
    if (!getApiKey()) return
    setLoading(true)
    try {
      const monthStart = startOfMonth(new Date())
      const monthCommission = (contactProducts || [])
        .filter(cp => { try { return isAfter(parseISO(cp.purchaseDate), monthStart) } catch { return false } })
        .reduce((s, cp) => s + cp.orderValue * (cp.commissionRate || settings?.commissionRate || 0.15), 0)

      const result = await generateDailyBrief({
        contacts, interactions, followups, pipeline, goals,
        stats: { monthCommission },
      })
      setBrief(result)
      localStorage.setItem(todayKey(), JSON.stringify(result))
    } catch (e) {
      console.error('AI Brief:', e)
    }
    setLoading(false)
  }

  function refresh() {
    localStorage.removeItem(todayKey())
    setBrief(null)
    runBrief()
  }

  if (!hasKey) return (
    <div className="card border border-gray-700/30 flex items-center gap-3 py-3">
      <Sparkles size={14} className="text-gray-600 flex-shrink-0" />
      <p className="text-xs text-gray-500 flex-1">Add your Anthropic API key to enable the AI Morning Brief</p>
      <Link to="/settings" className="text-xs text-brand-400 hover:text-brand-300 flex-shrink-0 font-medium">Settings →</Link>
    </div>
  )

  if (loading) return (
    <div className="card border border-brand-700/20 flex items-center gap-3">
      <RefreshCw size={14} className="text-brand-400 animate-spin flex-shrink-0" />
      <p className="text-sm text-gray-400">Generating your AI morning brief…</p>
    </div>
  )

  if (!brief) return null

  const FocusIcon = FOCUS_ICON[brief.focusArea] || Target

  return (
    <div className="card border border-brand-700/20 bg-gradient-to-br from-brand-900/10 to-gray-900">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-brand-900/40 border border-brand-700/30 flex-shrink-0 mt-0.5">
          <Sparkles size={13} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white font-semibold text-sm">AI Morning Brief</p>
          {brief.greeting && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{brief.greeting}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); refresh() }}
            className="p-1.5 rounded text-gray-600 hover:text-gray-400 hover:bg-gray-800"
            title="Refresh brief"
          >
            <RefreshCw size={11} />
          </button>
          {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {brief.focusArea && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <FocusIcon size={12} className="text-brand-400" />
              Today's focus: <span className="text-brand-300 font-semibold capitalize ml-0.5">{brief.focusArea.replace('_', ' ')}</span>
            </div>
          )}

          {brief.topTargets?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Top priorities today:</p>
              <div className="space-y-1.5">
                {brief.topTargets.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-gray-800/40 rounded-lg px-3 py-2">
                    <span className={`badge text-[10px] flex-shrink-0 mt-0.5 ${URGENCY_COLOR[t.urgency] || 'bg-gray-800 text-gray-400'}`}>
                      {t.urgency}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-snug">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.suggestedAction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {brief.advice && (
            <div className="bg-gray-800/40 rounded-lg p-3">
              <p className="text-xs text-brand-300 font-semibold mb-1">Coach:</p>
              <p className="text-xs text-gray-300 leading-relaxed">{brief.advice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
