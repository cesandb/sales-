import { useStore } from '../store/useStore'
import { Users, GitBranch, Bell, TrendingUp, CheckCircle, AlertCircle, Clock, ExternalLink, Radar } from 'lucide-react'
import { format, isAfter, isBefore, addDays, parseISO, startOfMonth, differenceInDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { PRODUCTS } from '../data/products'
import { calcLeadScore, getTierColor } from '../utils/leadScore'

const STATUS_COLOR = {
  'New Lead':       'bg-blue-900/40 text-blue-300',
  'Warm Lead':      'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':       'bg-orange-900/40 text-orange-300',
  'Customer':       'bg-green-900/40 text-green-300',
  'Repeat Customer':'bg-emerald-900/40 text-emerald-300',
  'Inactive':       'bg-gray-800 text-gray-400',
}

const STAGE_ORDER = ['New Lead', 'First Contact', 'Interested', 'Recommended', 'Purchased', 'Repeat/Upsell']

export default function Dashboard() {
  const { contacts, pipeline, followups, interactions, goals, productClicks } = useStore()

  const now = new Date()
  const weekFromNow = addDays(now, 7)
  const monthStart = startOfMonth(now)

  const upcomingFollowups = followups
    .filter(f => f.status === 'pending' && isAfter(parseISO(f.date), now) && isBefore(parseISO(f.date), weekFromNow))
    .sort((a, b) => parseISO(a.date) - parseISO(b.date))
    .slice(0, 5)

  const overdueFollowups = followups.filter(f => f.status === 'pending' && isBefore(parseISO(f.date), now))

  const newThisMonth = contacts.filter(c => isAfter(parseISO(c.createdAt), monthStart)).length
  const customers = contacts.filter(c => c.status === 'Customer' || c.status === 'Repeat Customer').length
  const conversionRate = contacts.length > 0 ? Math.round((customers / contacts.length) * 100) : 0

  const recentActivity = interactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)

  // Top clicked products
  const topProducts = Object.entries(productClicks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, clicks]) => ({ product: PRODUCTS.find(p => p.id === id), clicks }))
    .filter(x => x.product)

  // Pipeline summary
  const pipelineSummary = STAGE_ORDER.map(stage => ({
    stage,
    count: pipeline.filter(p => p.stage === stage).length,
  }))

  const currentMonthGoals = goals.filter(g => {
    const now = new Date()
    return g.year === now.getFullYear() && g.month === now.getMonth()
  })

  const contactForId = (id) => contacts.find(c => c.id === id)

  // ── Reach Intel counts ────────────────────────────────────────────────────
  const goingColdCount = contacts.filter(c =>
    (c.status === 'Hot Lead' || c.status === 'Warm Lead') &&
    (!c.lastContact || differenceInDays(now, parseISO(c.lastContact)) > 5)
  ).length

  const stalledPipelineCount = pipeline.filter(p =>
    p.stage !== 'Purchased' &&
    p.stage !== 'Repeat/Upsell' &&
    differenceInDays(now, parseISO(p.updatedAt)) > 10
  ).length

  const pendingContactIds = new Set(
    followups.filter(f => f.status === 'pending').map(f => f.contactId)
  )
  const noFollowupCount = contacts.filter(c =>
    (c.status === 'Warm Lead' || c.status === 'Hot Lead' || c.status === 'Customer') &&
    !pendingContactIds.has(c.id)
  ).length

  // ── Top 5 contacts by lead score ─────────────────────────────────────────
  const topLeads = contacts
    .map(c => ({ contact: c, ...calcLeadScore(c, interactions, followups, pipeline) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">{format(now, 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Contacts" value={contacts.length} icon={<Users size={18} />} color="blue" sub={`+${newThisMonth} this month`} />
        <KPI label="Pipeline Items" value={pipeline.length} icon={<GitBranch size={18} />} color="purple" sub={`${STAGE_ORDER[0]}: ${pipeline.filter(p=>p.stage===STAGE_ORDER[0]).length}`} />
        <KPI label="Conversions" value={customers} icon={<TrendingUp size={18} />} color="green" sub={`${conversionRate}% conversion rate`} />
        <KPI label="Follow-ups Due" value={overdueFollowups.length} icon={<Bell size={18} />} color={overdueFollowups.length > 0 ? 'red' : 'orange'} sub={`${upcomingFollowups.length} upcoming (7d)`} />
      </div>

      {/* Reach Intel + Lead Scores */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Reach Intel Summary */}
        <div className="card border border-orange-800/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Radar size={15} className="text-orange-400" />
              Reach Intel
            </h2>
            <Link to="/reach" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-sm text-gray-300">Going cold (Hot/Warm leads)</span>
              </div>
              <span className={`text-sm font-bold ${goingColdCount > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                {goingColdCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm text-gray-300">Stalled pipeline items</span>
              </div>
              <span className={`text-sm font-bold ${stalledPipelineCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                {stalledPipelineCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-sm text-gray-300">No follow-up scheduled</span>
              </div>
              <span className={`text-sm font-bold ${noFollowupCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {noFollowupCount}
              </span>
            </div>
          </div>
          {(goingColdCount + stalledPipelineCount + noFollowupCount) > 0 ? (
            <Link
              to="/reach"
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-900/20 border border-orange-800/40 text-orange-400 text-sm font-semibold hover:bg-orange-900/30 transition-colors"
            >
              <AlertCircle size={14} />
              {goingColdCount + stalledPipelineCount + noFollowupCount} contacts need attention
            </Link>
          ) : (
            <p className="text-xs text-green-400 mt-4 text-center">All caught up!</p>
          )}
        </div>

        {/* Lead Scores */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-400" />
              Top Lead Scores
            </h2>
            <Link to="/contacts" className="text-xs text-brand-400 hover:text-brand-300">All contacts →</Link>
          </div>
          {topLeads.length === 0 ? (
            <p className="text-gray-500 text-sm">No contacts yet.</p>
          ) : (
            <div className="space-y-2">
              {topLeads.map(({ contact: c, score, tier }) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getTierColor(tier)}`}>{tier}</span>
                    <span className="text-sm font-bold text-white w-8 text-right">{score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Follow-ups */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><Bell size={15} className="text-brand-400" /> Upcoming Follow-ups</h2>
            <Link to="/followups" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          {overdueFollowups.length > 0 && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/40 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={13} /> {overdueFollowups.length} overdue follow-up{overdueFollowups.length !== 1 ? 's' : ''}
            </div>
          )}
          {upcomingFollowups.length === 0 && overdueFollowups.length === 0 ? (
            <p className="text-gray-500 text-sm">No follow-ups scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcomingFollowups.map(fu => {
                const contact = contactForId(fu.contactId)
                return (
                  <div key={fu.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                    <Clock size={14} className="text-brand-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{contact?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{format(parseISO(fu.date), 'MMM d')} · {fu.notes || 'No notes'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pipeline Overview */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><GitBranch size={15} className="text-brand-400" /> Pipeline</h2>
            <Link to="/pipeline" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          <div className="space-y-2">
            {pipelineSummary.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-32 truncate">{stage}</span>
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pipeline.length > 0 ? (count / pipeline.length) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
              </div>
            ))}
            {pipeline.length === 0 && <p className="text-gray-500 text-sm">No pipeline items yet.</p>}
          </div>
        </div>

        {/* Top Products */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><TrendingUp size={15} className="text-brand-400" /> Top Shared Products</h2>
            <Link to="/products" className="text-xs text-brand-400 hover:text-brand-300">All products →</Link>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">Share products to see your top picks.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map(({ product, clicks }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{product.name}</p>
                  </div>
                  <span className="text-xs text-brand-400 font-semibold">{clicks}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><Users size={15} className="text-brand-400" /> Recent Contacts</h2>
            <Link to="/contacts" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          {contacts.length === 0 ? (
            <p className="text-gray-500 text-sm">No contacts yet. <Link to="/contacts" className="text-brand-400">Add your first contact →</Link></p>
          ) : (
            <div className="space-y-2">
              {[...contacts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5).map(c => (
                <div key={c.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-brand-700/40 border border-brand-700/40 flex items-center justify-center text-brand-300 font-bold text-xs">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.source || 'No source'}</p>
                  </div>
                  <span className={`badge ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><CheckCircle size={15} className="text-brand-400" /> Recent Activity</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity logged yet.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(act => {
                const contact = contactForId(act.contactId)
                return (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">
                        <span className="font-medium">{contact?.name || 'Unknown'}</span>
                        <span className="text-gray-400"> · {act.type}</span>
                      </p>
                      {act.notes && <p className="text-xs text-gray-500 mt-0.5">{act.notes}</p>}
                      <p className="text-xs text-gray-600 mt-0.5">{format(parseISO(act.date), 'MMM d, h:mm a')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Goals Progress */}
      {currentMonthGoals.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Monthly Goals – {format(now, 'MMMM yyyy')}</h2>
            <Link to="/goals" className="text-xs text-brand-400 hover:text-brand-300">Manage goals →</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentMonthGoals.map(g => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100))
              return (
                <div key={g.id} className="bg-gray-800/60 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">{g.label}</p>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold text-white">{g.current}</span>
                    <span className="text-sm text-gray-400">/ {g.target}</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{pct}% complete</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, icon, color, sub }) {
  const colors = {
    blue:   'bg-blue-900/20 text-blue-400 border-blue-800/30',
    purple: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
    green:  'bg-green-900/20 text-green-400 border-green-800/30',
    orange: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
    red:    'bg-red-900/20 text-red-400 border-red-800/30',
  }
  return (
    <div className={`card border ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg border ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  )
}
