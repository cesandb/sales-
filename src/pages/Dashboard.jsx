import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Users, GitBranch, Bell, TrendingUp, CheckCircle, AlertCircle, Clock, ExternalLink, Radar, DollarSign, Link2, Activity, Radio, Zap, Play, Pause } from 'lucide-react'
import { format, isAfter, isBefore, addDays, parseISO, startOfMonth, differenceInDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { PRODUCTS } from '../data/products'
import { calcLeadScore, getTierColor } from '../utils/leadScore'
import DailyDigest from '../components/DailyDigest'
import AiBrief from '../components/AiBrief'
import { checkAndNotifyDue } from '../utils/notifications'
import { getEngineConfig, saveEngineConfig, SOURCE_CONFIGS } from '../utils/autoAcquire'
import { Send } from 'lucide-react'

// ── Auto-Acquire Engine status widget (Dashboard) ─────────────────────────────
function EngineStatusCard() {
  const [config, setConfig] = useState(() => getEngineConfig())

  useEffect(() => {
    function refresh() { setConfig(getEngineConfig()) }
    window.addEventListener('auto-acquire-update', refresh)
    window.addEventListener('auto-acquire-config-changed', refresh)
    return () => {
      window.removeEventListener('auto-acquire-update', refresh)
      window.removeEventListener('auto-acquire-config-changed', refresh)
    }
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const totalToday = SOURCE_CONFIGS.reduce((sum, src) => {
    const sc = config.sources[src.id]
    return sum + (sc?.lastAddedDate === today ? (sc.addedToday || 0) : 0)
  }, 0)
  const totalAllTime = SOURCE_CONFIGS.reduce((sum, src) => sum + (config.sources[src.id]?.addedAllTime || 0), 0)
  const enabledCount = SOURCE_CONFIGS.filter(src => config.sources[src.id]?.enabled).length

  function toggleEngine() {
    const next = { ...config, enabled: !config.enabled }
    saveEngineConfig(next)
    setConfig(next)
    window.dispatchEvent(new CustomEvent('auto-acquire-config-changed'))
  }

  return (
    <Link to="/acquire" className="block group">
      <div className={`card border transition-colors hover:border-brand-600/40 ${config.enabled ? 'border-green-700/30 bg-green-900/5' : 'border-gray-700/40'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${config.enabled ? 'bg-green-900/40' : 'bg-gray-800'}`}>
            <Zap size={16} className={config.enabled ? 'text-green-400' : 'text-gray-500'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">Auto-Acquire Engine</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${config.enabled ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                {config.enabled ? '● RUNNING' : 'PAUSED'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {enabledCount} sources active · <span className="text-green-400 font-medium">+{totalToday} today</span> · {totalAllTime} all-time
            </p>
          </div>
          <button
            onClick={e => { e.preventDefault(); toggleEngine() }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              config.enabled
                ? 'bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-900/50'
                : 'btn-primary text-xs py-1.5 px-3'
            }`}
          >
            {config.enabled ? <Pause size={12} /> : <Play size={12} />}
            {config.enabled ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>
    </Link>
  )
}

const STATUS_COLOR = {
  'New Lead':       'bg-blue-900/40 text-blue-300',
  'Warm Lead':      'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':       'bg-orange-900/40 text-orange-300',
  'Customer':       'bg-green-900/40 text-green-300',
  'Repeat Customer':'bg-emerald-900/40 text-emerald-300',
  'Inactive':       'bg-gray-800 text-gray-400',
}

const STAGE_ORDER = ['New Lead', 'First Contact', 'Interested', 'Recommended', 'Purchased', 'Repeat/Upsell']

// ── Signal Feed ───────────────────────────────────────────────────────────────
// Shows recent acquisition signals — contacts added from live feeds with intent tags
function SignalFeed({ contacts }) {
  const SIGNAL_TAGS = ['intent-signal', 'auto-feed', 'reddit', 'hackernews', 'blogger', 'content-creator', 'devto', 'tech-fitness', 'event-organizer', 'race', 'github']
  const SIGNAL_LABEL = {
    'intent-signal': 'Intent Surge',
    'auto-feed': 'Live Feed',
    'reddit': 'Reddit',
    'hackernews': 'HN',
    'blogger': 'Blog Author',
    'content-creator': 'Creator',
    'devto': 'Dev.to',
    'tech-fitness': 'Tech+Fitness',
    'event-organizer': 'Event Org.',
    'race': 'Race Event',
    'github': 'GitHub Dev',
  }
  const SIGNAL_COLOR = {
    'intent-signal': 'bg-red-900/40 text-red-300',
    'auto-feed': 'bg-green-900/40 text-green-300',
    'reddit': 'bg-orange-900/40 text-orange-300',
    'hackernews': 'bg-orange-900/30 text-orange-200',
    'blogger': 'bg-yellow-900/40 text-yellow-300',
    'content-creator': 'bg-pink-900/40 text-pink-300',
    'devto': 'bg-purple-900/40 text-purple-300',
    'tech-fitness': 'bg-blue-900/40 text-blue-300',
    'event-organizer': 'bg-teal-900/40 text-teal-300',
    'race': 'bg-teal-900/30 text-teal-200',
    'github': 'bg-gray-800 text-gray-300',
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

  const recentSignals = contacts
    .filter(c => {
      if (!c.createdAt) return false
      const created = new Date(c.createdAt)
      if (created < sevenDaysAgo) return false
      return (c.tags || []).some(t => SIGNAL_TAGS.includes(t.toLowerCase()))
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12)

  if (recentSignals.length === 0) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-900/30 border border-brand-700/30">
            <Radio size={13} className="text-brand-400" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Acquisition Signal Feed</p>
            <p className="text-xs text-gray-500">{recentSignals.length} new contacts from live sources this week</p>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {recentSignals.map(c => {
          const signalTag = (c.tags || []).find(t => SIGNAL_TAGS.includes(t.toLowerCase()))
          const label = SIGNAL_LABEL[signalTag?.toLowerCase()] || signalTag
          const color = SIGNAL_COLOR[signalTag?.toLowerCase()] || 'bg-gray-800 text-gray-400'
          const created = c.createdAt ? new Date(c.createdAt) : null
          const hoursAgo = created ? Math.floor((now - created) / 3600000) : null
          const timeLabel = hoursAgo !== null ? (hoursAgo < 1 ? 'just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`) : ''
          return (
            <div key={c.id} className="flex items-center gap-3 py-1.5 px-1 hover:bg-gray-800/30 rounded-lg transition-colors">
              <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm truncate">{c.name}</span>
                  <span className={`badge text-[10px] ${color}`}>{label}</span>
                </div>
                {c.notes && <p className="text-xs text-gray-500 truncate">{c.notes.slice(0, 80)}</p>}
              </div>
              <span className="text-xs text-gray-600 flex-shrink-0">{timeLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeadLeadRevivalCard() {
  const { contacts, interactions, enrollments, addEnrollment } = useStore()
  const [revived, setRevived] = useState(false)
  const now = new Date()

  const deadLeads = contacts.filter(c => {
    if (c.status !== 'New Lead' && c.status !== 'Warm Lead') return false
    const daysSince = c.lastContact
      ? differenceInDays(now, parseISO(c.lastContact))
      : 9999
    if (daysSince < 60) return false
    const hasActiveEnrollment = (enrollments || []).some(
      e => e.contactId === c.id && e.sequenceId === 'seq-re-engage' && e.status === 'active'
    )
    return !hasActiveEnrollment
  })

  function handleRevive() {
    deadLeads.forEach(c => addEnrollment({ contactId: c.id, sequenceId: 'seq-re-engage' }))
    setRevived(true)
  }

  return (
    <div className="card border border-yellow-800/30 bg-yellow-900/5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-yellow-900/40">
          <Activity size={14} className="text-yellow-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Dead Lead Revival</p>
          <p className="text-xs text-gray-500">60+ days with no contact</p>
        </div>
      </div>
      <p className="text-3xl font-bold text-yellow-400 mb-3">{deadLeads.length}</p>
      {revived ? (
        <p className="text-xs text-green-400 font-medium">✓ {deadLeads.length} contacts enrolled in Revival sequence!</p>
      ) : (
        <>
          <button
            onClick={handleRevive}
            disabled={deadLeads.length === 0}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-2"
          >
            Revive {deadLeads.length} Cold Lead{deadLeads.length !== 1 ? 's' : ''}
          </button>
          <Link to="/contacts" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">View contacts →</Link>
        </>
      )}
    </div>
  )
}

function RevenueForecasterCard() {
  const { contacts, contactProducts, settings, pipeline } = useStore()
  const safeSettings = settings || { commissionRate: 0.15, avgOrderValue: 45 }
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const CLOSE_RATES = { 'New Lead': 0.03, 'Warm Lead': 0.15, 'Hot Lead': 0.35 }

  const monthCommission = (contactProducts || [])
    .filter(cp => isAfter(parseISO(cp.purchaseDate), monthStart))
    .reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)

  const projectedRevenue = contacts.reduce((sum, c) => {
    const rate = CLOSE_RATES[c.status] || 0
    return sum + rate * safeSettings.avgOrderValue * safeSettings.commissionRate
  }, 0)

  const GOAL = 10000
  const gap = Math.max(0, GOAL - monthCommission)
  const progressPct = Math.min(100, Math.round((monthCommission / GOAL) * 100))

  const weightedConvRate = 0.03 * 0.4 + 0.15 * 0.4 + 0.35 * 0.2
  const commissionPerLead = weightedConvRate * safeSettings.avgOrderValue * safeSettings.commissionRate
  const leadsNeeded = commissionPerLead > 0 ? Math.ceil(gap / commissionPerLead) : 0

  return (
    <div className="card border border-emerald-800/30 bg-emerald-900/5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-emerald-900/40">
          <TrendingUp size={14} className="text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Revenue Forecaster</p>
          <p className="text-xs text-gray-500">Pipeline → commission estimate</p>
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Pipeline projection</span>
          <span className="text-emerald-400 font-bold">${projectedRevenue.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Earned this month</span>
          <span className="text-white font-semibold">${monthCommission.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Gap to $10k goal</span>
          <span className={`font-semibold ${gap > 0 ? 'text-orange-400' : 'text-green-400'}`}>${gap.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">New leads needed</span>
          <span className="text-white font-semibold">{leadsNeeded}</span>
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Monthly progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <Link to="/analytics" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">Full analytics →</Link>
    </div>
  )
}

export default function Dashboard() {
  const { contacts, pipeline, followups, interactions, goals, productClicks, linkShares, contactProducts, settings, enrollments } = useStore()

  // Fire browser notification for due follow-ups on first load
  useEffect(() => {
    checkAndNotifyDue(followups, contacts)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Commission stats ──────────────────────────────────────────────────────
  const safeSettings = settings || { commissionRate: 0.15, avgOrderValue: 45 }
  const monthLinks = (linkShares || []).filter(ls => isAfter(parseISO(ls.date), monthStart)).length
  const monthPurchases = (contactProducts || []).filter(cp => isAfter(parseISO(cp.purchaseDate), monthStart))
  const monthCommission = monthPurchases.reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)
  const uniqueCustomers = new Set((contactProducts || []).map(cp => cp.contactId)).size
  const projectedMonthly = uniqueCustomers * safeSettings.avgOrderValue * safeSettings.commissionRate

  // Unfollow-up shared links (>2 days, not followed up)
  const unfollowedLinksCount = (linkShares || []).filter(ls =>
    !ls.followedUp && differenceInDays(now, parseISO(ls.date)) > 2
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

      {/* Daily Outreach Progress */}
      {(() => {
        const todayStr = now.toISOString().split('T')[0]
        const sent = interactions.filter(i => i.date?.startsWith(todayStr)).length
        const target = settings?.dailyOutreachTarget || 10
        const pct = Math.min(100, Math.round((sent / target) * 100))
        const done = sent >= target
        return (
          <Link to="/outreach" className="block">
            <div className={`card border flex items-center gap-4 py-3 hover:border-brand-600/60 transition-colors ${done ? 'border-green-700/40' : 'border-brand-700/30'}`}>
              <Send size={16} className={done ? 'text-green-400' : 'text-brand-400'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">Today's Outreach</span>
                  <span className={`text-xs font-bold ${done ? 'text-green-400' : 'text-brand-400'}`}>{sent}/{target}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{done ? 'Goal hit!' : `${target - sent} to go`}</span>
            </div>
          </Link>
        )
      })()}

      {/* Auto-Acquire Engine status */}
      <EngineStatusCard />

      {/* Dead Lead Revival + Revenue Forecaster */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DeadLeadRevivalCard />
        <RevenueForecasterCard />
      </div>

      {/* AI Morning Brief — auto-generates once per day */}
      <AiBrief />

      {/* Daily Digest — smart action list */}
      <DailyDigest />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Contacts" value={contacts.length} icon={<Users size={18} />} color="blue" sub={`+${newThisMonth} this month`} />
        <KPI label="Pipeline Items" value={pipeline.length} icon={<GitBranch size={18} />} color="purple" sub={`${STAGE_ORDER[0]}: ${pipeline.filter(p=>p.stage===STAGE_ORDER[0]).length}`} />
        <KPI label="Conversions" value={customers} icon={<TrendingUp size={18} />} color="green" sub={`${conversionRate}% conversion rate`} />
        <KPI label="Follow-ups Due" value={overdueFollowups.length} icon={<Bell size={18} />} color={overdueFollowups.length > 0 ? 'red' : 'orange'} sub={`${upcomingFollowups.length} upcoming (7d)`} />
      </div>

      {/* Commission Summary Card */}
      <div className="card border border-emerald-800/40 bg-emerald-900/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
            <DollarSign size={15} className="text-emerald-400" />
            This Month — Commission Summary
          </h2>
          <Link to="/commissions" className="text-xs text-emerald-400 hover:text-emerald-300">View tracker →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1"><Link2 size={11} /> Links Shared</p>
            <p className="text-2xl font-bold text-white mt-0.5">{monthLinks}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Purchases Tracked</p>
            <p className="text-2xl font-bold text-white mt-0.5">{monthPurchases.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Commission Earned</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">${monthCommission.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Projected /mo</p>
            <p className="text-2xl font-bold text-green-400 mt-0.5">${projectedMonthly.toFixed(0)}</p>
          </div>
        </div>
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
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-sm text-gray-300">No follow-up scheduled</span>
              </div>
              <span className={`text-sm font-bold ${noFollowupCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {noFollowupCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-sm text-gray-300">Unfollow-up shared links</span>
              </div>
              <span className={`text-sm font-bold ${unfollowedLinksCount > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                {unfollowedLinksCount}
              </span>
            </div>
          </div>
          {(goingColdCount + stalledPipelineCount + noFollowupCount + unfollowedLinksCount) > 0 ? (
            <Link
              to="/reach"
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-900/20 border border-orange-800/40 text-orange-400 text-sm font-semibold hover:bg-orange-900/30 transition-colors"
            >
              <AlertCircle size={14} />
              {goingColdCount + stalledPipelineCount + noFollowupCount + unfollowedLinksCount} items need attention
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

      <SignalFeed contacts={contacts} />
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
