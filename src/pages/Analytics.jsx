import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import { DEFAULT_SEQUENCES } from '../utils/affiliateLinks'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { format, parseISO, startOfMonth, subMonths, isAfter } from 'date-fns'

const COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444']

export default function Analytics() {
  const { contacts, pipeline, followups, interactions, productClicks, contactProducts, enrollments } = useStore()

  const now = new Date()

  // Contacts added per month (last 6 months)
  const contactsByMonth = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      return { label: format(d, 'MMM'), start: startOfMonth(d) }
    })
    return months.map((m, i) => ({
      month: m.label,
      contacts: contacts.filter(c => {
        const d = parseISO(c.createdAt)
        const start = m.start
        const end = months[i + 1]?.start || new Date(9999, 0)
        return isAfter(d, start) && !isAfter(d, end)
      }).length,
    }))
  }, [contacts])

  // Status distribution
  const statusDist = useMemo(() => {
    const map = {}
    contacts.forEach(c => { map[c.status] = (map[c.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [contacts])

  // Source distribution
  const sourceDist = useMemo(() => {
    const map = {}
    contacts.forEach(c => {
      const src = c.source || 'Unknown'
      map[src] = (map[src] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [contacts])

  // Pipeline by stage
  const pipelineByStage = useMemo(() => {
    const STAGES = ['New Lead', 'First Contact', 'Interested', 'Recommended', 'Purchased', 'Repeat/Upsell']
    return STAGES.map(s => ({ stage: s, count: pipeline.filter(p => p.stage === s).length }))
  }, [pipeline])

  // Top products by click
  const topProducts = useMemo(() => {
    return Object.entries(productClicks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, clicks]) => {
        const p = PRODUCTS.find(pr => pr.id === id)
        return { name: p ? p.name.split(' ').slice(0, 2).join(' ') : id, clicks }
      })
  }, [productClicks])

  // Interactions by type
  const interactionTypes = useMemo(() => {
    const map = {}
    interactions.forEach(i => { map[i.type] = (map[i.type] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [interactions])

  const totalRevenue = pipeline
    .filter(p => p.stage === 'Purchased' || p.stage === 'Repeat/Upsell')
    .reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0)

  const conversionRate = contacts.length > 0
    ? Math.round((contacts.filter(c => c.status === 'Customer' || c.status === 'Repeat Customer').length / contacts.length) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics & Growth</h1>
        <p className="text-gray-400 text-sm mt-0.5">Track your performance and identify opportunities.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Contacts"   value={contacts.length}      color="blue" />
        <StatCard label="Conversion Rate"  value={`${conversionRate}%`} color="green" />
        <StatCard label="Pipeline Items"   value={pipeline.length}      color="purple" />
        <StatCard label="Est. Revenue"     value={`$${totalRevenue.toFixed(0)}`} color="orange" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Contacts over time */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">New Contacts (6 months)</h2>
          {contacts.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={contactsByMonth} barSize={28}>
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
                <Bar dataKey="contacts" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline funnel */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Pipeline by Stage</h2>
          {pipeline.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineByStage} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
                <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status pie */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Contact Status Breakdown</h2>
          {statusDist.length === 0 ? <EmptyChart /> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {statusDist.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-400 truncate flex-1">{entry.name}</span>
                    <span className="text-white font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Source breakdown */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Leads by Source</h2>
          {sourceDist.length === 0 ? <EmptyChart /> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={sourceDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {sourceDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {sourceDist.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-400 truncate flex-1">{entry.name}</span>
                    <span className="text-white font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Most Shared Products</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
              <Bar dataKey="clicks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Interaction types */}
      {interactionTypes.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Interactions by Type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {interactionTypes.map((t, i) => (
              <div key={t.name} className="bg-gray-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{t.value}</p>
                <p className="text-xs text-gray-400 mt-1">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source → Conversion Rate */}
      <SourceConversionTable contacts={contacts} contactProducts={contactProducts} />

      {/* Best Times to Message */}
      <OptimalSendTime interactions={interactions} />

      {/* Sequence Performance */}
      <SequencePerformanceCard enrollments={enrollments || []} />
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    blue:   'border-blue-800/40',
    green:  'border-green-800/40',
    purple: 'border-purple-800/40',
    orange: 'border-brand-700/40',
  }
  return (
    <div className={`card border ${colors[color]}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}

function EmptyChart() {
  return <p className="text-center text-gray-600 py-12 text-sm">No data yet — add contacts to see insights.</p>
}

function SourceConversionTable({ contacts, contactProducts }) {
  const data = useMemo(() => {
    const customerIds = new Set((contactProducts || []).map(cp => cp.contactId))
    const sourceMap = {}
    contacts.forEach(c => {
      const src = c.source || 'Unknown'
      if (!sourceMap[src]) sourceMap[src] = { total: 0, customers: 0 }
      sourceMap[src].total += 1
      if (customerIds.has(c.id)) sourceMap[src].customers += 1
    })
    return Object.entries(sourceMap)
      .map(([source, { total, customers }]) => ({
        source,
        total,
        customers,
        rate: total > 0 ? Math.round((customers / total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate)
  }, [contacts, contactProducts])

  const bestSource = data[0]?.source

  if (data.length === 0) return null

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Source → Conversion Rate</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4 text-right">Total</th>
              <th className="pb-2 pr-4 text-right">Customers</th>
              <th className="pb-2 text-right">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.source} className="border-b border-gray-800/50 last:border-0">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${row.source === bestSource ? 'text-green-400' : 'text-white'}`}>{row.source}</span>
                    {row.source === bestSource && (
                      <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-700/40 px-1.5 py-0.5 rounded-full font-semibold">Best</span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-400">{row.total}</td>
                <td className="py-2.5 pr-4 text-right text-gray-400">{row.customers}</td>
                <td className="py-2.5 text-right">
                  <span className={`font-bold ${row.rate >= 20 ? 'text-green-400' : row.rate >= 10 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {row.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OptimalSendTime({ interactions }) {
  const hourData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    interactions.forEach(i => {
      if (!i.date) return
      try {
        const h = new Date(i.date).getHours()
        counts[h].count += 1
      } catch {}
    })
    return counts
  }, [interactions])

  const top3Hours = useMemo(() => {
    return [...hourData].sort((a, b) => b.count - a.count).slice(0, 3).map(h => h.hour)
  }, [hourData])

  const chartData = hourData.map(d => ({
    ...d,
    label: `${d.hour === 0 ? 12 : d.hour > 12 ? d.hour - 12 : d.hour}${d.hour < 12 ? 'am' : 'pm'}`,
    fill: top3Hours.includes(d.hour) ? '#f97316' : '#374151',
  }))

  const hasData = interactions.length > 0

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-semibold text-white">Best Times to Message</h2>
        <span className="text-xs text-gray-500">Based on your logged interactions</span>
      </div>
      {top3Hours.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          Top hours: {top3Hours.map(h => `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`).join(', ')}
        </p>
      )}
      {!hasData ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={14}>
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }}
              formatter={(v) => [v, 'Interactions']}
              labelFormatter={(l) => `Hour: ${l}`}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function SequencePerformanceCard({ enrollments }) {
  const rows = DEFAULT_SEQUENCES
    .map(seq => {
      const all       = enrollments.filter(e => e.sequenceId === seq.id)
      const active    = all.filter(e => e.status === 'active').length
      const completed = all.filter(e => e.status === 'completed').length
      const total     = all.length
      return { seq, total, active, completed }
    })
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  if (!rows.length) return null

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Sequence Performance</h2>
      <div className="space-y-3">
        {rows.map(({ seq, total, active, completed }) => {
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0
          return (
            <div key={seq.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300 truncate flex-1 mr-3">{seq.name}</span>
                <div className="flex items-center gap-3 text-xs flex-shrink-0">
                  <span><span className="text-yellow-400 font-bold">{active}</span><span className="text-gray-600"> active</span></span>
                  <span><span className="text-green-400 font-bold">{completed}</span><span className="text-gray-600"> done</span></span>
                  <span className="text-gray-500">{total} total</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              {pct > 0 && <p className="text-[10px] text-gray-600 mt-0.5">{pct}% completion rate</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
