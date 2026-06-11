import { useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import {
  generateDailyBrief,
  generateBatchDrafts,
  generateSalesCoaching,
  getApiKey,
} from '../utils/aiDraft'
import {
  Brain, Zap, Target, TrendingUp, Copy, CheckCircle2,
  RefreshCw, ChevronRight, AlertCircle, Sparkles, Users,
  MessageSquare, ArrowRight, ExternalLink,
} from 'lucide-react'
import { differenceInDays, parseISO, startOfMonth } from 'date-fns'

const URGENCY_COLOR = {
  high:   'border-l-red-500 bg-red-900/10',
  medium: 'border-l-yellow-500 bg-yellow-900/10',
  low:    'border-l-blue-500 bg-blue-900/10',
}

const URGENCY_BADGE = {
  high:   'bg-red-900/40 text-red-300',
  medium: 'bg-yellow-900/40 text-yellow-300',
  low:    'bg-blue-900/40 text-blue-300',
}

function getDMUrl(contact) {
  const handle = (contact.social || '').replace(/^@/, '').trim()
  const phone  = (contact.phone  || '').replace(/\D/g, '')
  const src    = contact.source  || ''
  if (src === 'Instagram' && handle) return `https://ig.me/m/${handle}`
  if (src === 'Facebook'  && handle) return `https://m.me/${handle}`
  if (src === 'WhatsApp'  && phone)  return `https://wa.me/${phone}`
  if (src === 'Twitter/X' && handle) return `https://x.com/${handle}`
  if (src === 'TikTok'    && handle) return `https://www.tiktok.com/@${handle}`
  if (contact.phone)  return `sms:${contact.phone}`
  if (contact.email)  return `mailto:${contact.email}`
  return null
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, icon: Icon, children, action }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-900/30 border border-brand-700/30">
            <Icon size={16} className="text-brand-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
    >
      {copied ? <CheckCircle2 size={11} className="text-green-400" /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── Daily Brief section ───────────────────────────────────────────────────────
function DailyBriefSection({ contacts, interactions, followups, pipeline, goals, stats }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!getApiKey()) { setError('Add your API key in Settings first.'); return }
    setLoading(true); setError('')
    try {
      const result = await generateDailyBrief({ contacts, interactions, followups, pipeline, goals, stats })
      setBrief(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]))

  return (
    <Section
      title="Daily Brief"
      subtitle="AI-prioritized list of who to contact today"
      icon={Zap}
      action={
        <button
          onClick={run}
          disabled={loading}
          className="btn-primary flex items-center gap-2 text-sm py-1.5"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {brief ? 'Refresh' : 'Generate Brief'}
        </button>
      }
    >
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!brief && !loading && (
        <p className="text-gray-500 text-sm text-center py-6">
          Click "Generate Brief" to get your AI-powered action plan for today.
        </p>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
          <RefreshCw size={20} className="animate-spin text-brand-400" />
          <p className="text-sm">Analyzing your pipeline…</p>
        </div>
      )}

      {brief && !loading && (
        <div className="space-y-4">
          {brief.greeting && (
            <div className="px-4 py-3 rounded-lg bg-brand-900/20 border border-brand-700/30">
              <p className="text-brand-200 font-semibold">{brief.greeting}</p>
            </div>
          )}

          {brief.advice && (
            <div className="px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700/40">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Today's Focus</p>
              <p className="text-sm text-gray-200">{brief.advice}</p>
            </div>
          )}

          {brief.topTargets?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Top Contacts to Reach Today</p>
              <div className="space-y-2">
                {brief.topTargets.map((t, i) => {
                  const contact = contactMap[t.contactId]
                  const dmUrl = contact ? getDMUrl(contact) : null
                  return (
                    <div key={i} className={`border-l-2 rounded-r-lg px-4 py-3 ${URGENCY_COLOR[t.urgency] || URGENCY_COLOR.low}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm">{t.name}</span>
                            <span className={`badge text-[10px] ${URGENCY_BADGE[t.urgency] || ''}`}>{t.urgency} priority</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{t.reason}</p>
                          <p className="text-xs text-brand-300 mt-1 font-medium">→ {t.suggestedAction}</p>
                        </div>
                        {dmUrl && (
                          <a
                            href={dmUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-700/30 text-brand-400 hover:bg-brand-600/40 text-xs font-semibold flex-shrink-0 transition-colors"
                          >
                            <ExternalLink size={11} /> DM
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Batch Draft section ───────────────────────────────────────────────────────
function BatchDraftSection({ contacts, interactions, followups }) {
  const [platform, setPlatform] = useState('Instagram DM')
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const now = new Date()
  const candidates = contacts
    .filter(c => c.status === 'Hot Lead' || c.status === 'Warm Lead')
    .filter(c => {
      const days = c.lastContact ? differenceInDays(now, parseISO(c.lastContact)) : 999
      const hasOverdue = followups.some(f => f.contactId === c.id && f.status === 'pending' && new Date(f.date) < now)
      return days > 3 || hasOverdue
    })
    .sort((a, b) => {
      const da = a.lastContact ? differenceInDays(now, parseISO(a.lastContact)) : 999
      const db = b.lastContact ? differenceInDays(now, parseISO(b.lastContact)) : 999
      return db - da
    })
    .slice(0, 10)

  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]))

  async function run() {
    if (!getApiKey()) { setError('Add your API key in Settings first.'); return }
    if (!candidates.length) { setError('No contacts need outreach right now.'); return }
    setLoading(true); setError('')
    try {
      const result = await generateBatchDrafts({ contacts: candidates, interactions, platform })
      setDrafts(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section
      title="Batch Draft Generator"
      subtitle={`Auto-write outreach messages for ${candidates.length} contacts needing attention`}
      icon={MessageSquare}
      action={
        <div className="flex items-center gap-2">
          <select
            className="input text-sm py-1.5 min-w-0 w-auto"
            value={platform}
            onChange={e => setPlatform(e.target.value)}
          >
            {['Instagram DM', 'Text/SMS', 'Facebook DM', 'Email', 'WhatsApp'].map(p =>
              <option key={p}>{p}</option>
            )}
          </select>
          <button
            onClick={run}
            disabled={loading || !candidates.length}
            className="btn-primary flex items-center gap-2 text-sm py-1.5"
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
            {drafts.length ? 'Re-generate' : 'Generate All'}
          </button>
        </div>
      }
    >
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!drafts.length && !loading && candidates.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-6">No warm/hot leads need outreach right now.</p>
      )}

      {!drafts.length && !loading && candidates.length > 0 && (
        <div className="space-y-1">
          <p className="text-gray-400 text-sm mb-2">Ready to draft messages for:</p>
          {candidates.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-gray-300 py-0.5">
              <div className="w-5 h-5 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 text-[10px] font-bold flex-shrink-0">
                {c.name.charAt(0)}
              </div>
              <span>{c.name}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500 text-xs">{c.status}</span>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
          <RefreshCw size={20} className="animate-spin text-brand-400" />
          <p className="text-sm">Writing personalized messages…</p>
        </div>
      )}

      {drafts.length > 0 && !loading && (
        <div className="space-y-3">
          {drafts.map((d, i) => {
            const contact = contactMap[d.contactId]
            const dmUrl = contact ? getDMUrl(contact) : null
            return (
              <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0">
                      {contact?.name?.charAt(0) || '?'}
                    </div>
                    <span className="font-semibold text-white text-sm">{contact?.name || d.contactId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyBtn text={d.message} />
                    {dmUrl && (
                      <a
                        href={dmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-brand-700/30 text-brand-400 hover:bg-brand-600/40 transition-colors"
                      >
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{d.message}</p>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ── Sales Coaching section ────────────────────────────────────────────────────
function SalesCoachSection({ contacts, interactions, followups, pipeline, contactProducts, linkShares, goals }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!getApiKey()) { setError('Add your API key in Settings first.'); return }
    setLoading(true); setError('')
    try {
      const result = await generateSalesCoaching({ contacts, interactions, followups, pipeline, contactProducts, linkShares, goals })
      setReport(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section
      title="$10k/Month Coach"
      subtitle="AI analysis of your gaps and exact steps to hit your revenue goal"
      icon={Target}
      action={
        <button
          onClick={run}
          disabled={loading}
          className="btn-primary flex items-center gap-2 text-sm py-1.5"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Brain size={13} />}
          {report ? 'Re-analyze' : 'Analyze My Business'}
        </button>
      }
    >
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!report && !loading && (
        <p className="text-gray-500 text-sm text-center py-6">
          Click "Analyze My Business" for a personalized roadmap to $10,000/month.
        </p>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
          <RefreshCw size={20} className="animate-spin text-brand-400" />
          <p className="text-sm">Analyzing your sales data…</p>
        </div>
      )}

      {report && !loading && (
        <div className="space-y-5">
          {/* Headline */}
          <div className="px-4 py-3 rounded-lg bg-brand-900/20 border border-brand-700/30">
            <p className="text-brand-200 font-bold">{report.headline}</p>
          </div>

          {/* Revenue stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Monthly Projection</p>
              <p className="text-xl font-bold text-white">${(report.monthlyProjection || 0).toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Gap to $10k</p>
              <p className={`text-xl font-bold ${(report.gapToGoal || 0) <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${Math.max(0, report.gapToGoal || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Goal</p>
              <p className="text-xl font-bold text-gray-300">$10,000</p>
            </div>
          </div>

          {/* Progress bar */}
          {report.monthlyProjection > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress to $10k/month</span>
                <span>{Math.min(100, Math.round((report.monthlyProjection / 10000) * 100))}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-brand-600 to-brand-400 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (report.monthlyProjection / 10000) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Strengths & Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.strengths?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">What's Working</p>
                <ul className="space-y-1">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.gaps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">Bottlenecks</p>
                <ul className="space-y-1">
                  {report.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Priority Actions */}
          {report.actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Top Actions to Take Now</p>
              <div className="space-y-2">
                {report.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-800/40 rounded-lg px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-brand-700/40 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0 mt-0.5">
                      {a.priority}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{a.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly targets */}
          {report.weeklyTarget && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weekly Targets to Hit $10k</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: 'New Contacts', value: report.weeklyTarget.newContacts },
                  { label: 'Outreach Messages', value: report.weeklyTarget.outreachMessages },
                  { label: 'Follow-Ups', value: report.weeklyTarget.followUps },
                  { label: 'Links Shared', value: report.weeklyTarget.linksShared },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-brand-400">{value || 0}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Social DM quick access ────────────────────────────────────────────────────
function SocialQuickAccessSection({ contacts }) {
  const now = new Date()
  const hot = contacts
    .filter(c => (c.status === 'Hot Lead' || c.status === 'Warm Lead') && (c.social || c.phone || c.email))
    .sort((a, b) => {
      const da = a.lastContact ? differenceInDays(now, parseISO(a.lastContact)) : 999
      const db = b.lastContact ? differenceInDays(now, parseISO(b.lastContact)) : 999
      return db - da
    })
    .slice(0, 15)

  if (!hot.length) return null

  return (
    <Section
      title="Quick DM Access"
      subtitle="One-tap to open DM for your hottest leads"
      icon={Users}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {hot.map(c => {
          const dmUrl = getDMUrl(c)
          const days = c.lastContact ? differenceInDays(now, parseISO(c.lastContact)) : null
          return (
            <div key={c.id} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-700/30 border border-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{c.name}</p>
                <p className="text-xs text-gray-500">
                  {c.source && <span className="text-gray-400">{c.source} · </span>}
                  {days !== null ? `${days}d ago` : 'Never contacted'}
                </p>
              </div>
              {dmUrl ? (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-700/30 text-brand-400 hover:bg-brand-600/40 text-xs font-semibold flex-shrink-0 transition-colors"
                >
                  <ExternalLink size={11} /> DM
                </a>
              ) : (
                <span className="text-xs text-gray-600 flex-shrink-0">No link</span>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── Main Coach page ───────────────────────────────────────────────────────────
export default function Coach() {
  const { contacts, interactions, followups, pipeline, contactProducts, linkShares, goals, settings } = useStore()

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthCommission = (contactProducts || [])
    .filter(cp => new Date(cp.purchaseDate) >= monthStart)
    .reduce((s, cp) => s + cp.orderValue * cp.commissionRate, 0)

  const stats = { monthCommission }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain size={22} className="text-brand-400" />
          AI Sales Coach
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Your proactive automation engine — daily briefs, batch drafts, and your roadmap to $10k/month.
        </p>
      </div>

      <DailyBriefSection
        contacts={contacts}
        interactions={interactions}
        followups={followups}
        pipeline={pipeline}
        goals={goals}
        stats={stats}
      />

      <BatchDraftSection
        contacts={contacts}
        interactions={interactions}
        followups={followups}
      />

      <SalesCoachSection
        contacts={contacts}
        interactions={interactions}
        followups={followups}
        pipeline={pipeline}
        contactProducts={contactProducts}
        linkShares={linkShares}
        goals={goals}
      />

      <SocialQuickAccessSection contacts={contacts} />
    </div>
  )
}
