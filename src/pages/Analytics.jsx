import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { format, parseISO, startOfMonth, subMonths, isAfter } from 'date-fns'

const COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444']

export default function Analytics() {
  const { contacts, pipeline, followups, interactions, productClicks } = useStore()

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
