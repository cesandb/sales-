import { useState, useMemo } from 'react'
import {
  DollarSign, TrendingUp, Link2, Package, Trash2, Plus, Info,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import { format, parseISO, startOfMonth, isAfter } from 'date-fns'
import Modal from '../components/Modal'

// ── Log Purchase Modal ─────────────────────────────────────────────────────────
function LogPurchaseModal({ contacts, settings, onClose, onSave }) {
  const [contactId, setContactId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderValue, setOrderValue] = useState(settings.avgOrderValue.toString())
  const [commissionRate, setCommissionRate] = useState((settings.commissionRate * 100).toFixed(0))

  function handleSave() {
    if (!contactId || !productId) return
    onSave({
      contactId,
      productId,
      orderValue: parseFloat(orderValue) || settings.avgOrderValue,
      commissionRate: parseFloat(commissionRate) / 100 || settings.commissionRate,
    })
    onClose()
  }

  const estimated = ((parseFloat(orderValue) || 0) * (parseFloat(commissionRate) / 100 || 0)).toFixed(2)

  return (
    <Modal title="Log Purchase" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Contact *</label>
          <select className="input" value={contactId} onChange={e => setContactId(e.target.value)}>
            <option value="">Choose a contact…</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Product *</label>
          <select className="input" value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">Choose a product…</option>
            {PRODUCTS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Order Value ($)</label>
            <input
              type="number"
              className="input"
              min="0"
              step="0.01"
              value={orderValue}
              onChange={e => setOrderValue(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Commission Rate (%)</label>
            <input
              type="number"
              className="input"
              min="0"
              max="100"
              step="0.5"
              value={commissionRate}
              onChange={e => setCommissionRate(e.target.value)}
            />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/30">
          <p className="text-sm text-emerald-300 font-semibold">
            Estimated Commission: <span className="text-emerald-400">${estimated}</span>
          </p>
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-800">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={!contactId || !productId}
            onClick={handleSave}
          >
            <Plus size={14} /> Log Purchase
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Commission Tracker ────────────────────────────────────────────────────
export default function CommissionTracker() {
  const {
    contacts, linkShares, contactProducts, settings,
    addContactProduct, deleteContactProduct, updateSettings,
  } = useStore()

  const [logModal, setLogModal] = useState(false)
  const [commissionInput, setCommissionInput] = useState(((settings?.commissionRate || 0.15) * 100).toFixed(0))
  const [avgOrderInput, setAvgOrderInput] = useState((settings?.avgOrderValue || 45).toString())

  const safeSettings = settings || { commissionRate: 0.15, avgOrderValue: 45 }

  function saveSettings() {
    updateSettings({
      commissionRate: parseFloat(commissionInput) / 100 || 0.15,
      avgOrderValue: parseFloat(avgOrderInput) || 45,
    })
  }

  const now = new Date()
  const monthStart = startOfMonth(now)

  // This month stats
  const monthLinks = useMemo(() =>
    linkShares.filter(ls => isAfter(parseISO(ls.date), monthStart)).length
  , [linkShares, monthStart])

  const monthPurchases = useMemo(() =>
    contactProducts.filter(cp => isAfter(parseISO(cp.purchaseDate), monthStart))
  , [contactProducts, monthStart])

  const monthCommission = useMemo(() =>
    monthPurchases.reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)
  , [monthPurchases])

  // Unique customers who purchased
  const uniqueCustomers = useMemo(() =>
    new Set(contactProducts.map(cp => cp.contactId)).size
  , [contactProducts])

  const projectedMonthly = uniqueCustomers * safeSettings.avgOrderValue * safeSettings.commissionRate

  // All-time totals
  const totalCommission = useMemo(() =>
    contactProducts.reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)
  , [contactProducts])

  const estimatedLTV = uniqueCustomers * safeSettings.avgOrderValue * safeSettings.commissionRate * 12

  // Per-product performance
  const productPerf = useMemo(() => {
    const map = {}
    PRODUCTS.forEach(p => {
      map[p.id] = { product: p, linksShared: 0, purchases: 0, commission: 0 }
    })
    linkShares.forEach(ls => {
      if (map[ls.productId]) map[ls.productId].linksShared++
    })
    contactProducts.forEach(cp => {
      if (map[cp.productId]) {
        map[cp.productId].purchases++
        map[cp.productId].commission += cp.orderValue * cp.commissionRate
      }
    })
    return Object.values(map)
      .filter(p => p.linksShared > 0 || p.purchases > 0)
      .sort((a, b) => b.commission - a.commission)
  }, [linkShares, contactProducts])

  // Sorted purchase log
  const sortedPurchases = useMemo(() =>
    [...contactProducts].sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
  , [contactProducts])

  function getContactName(id) {
    return contacts.find(c => c.id === id)?.name || 'Unknown'
  }

  function getProductName(id) {
    return PRODUCTS.find(p => p.id === id)?.name || 'Unknown Product'
  }

  function handleLogPurchase(data) {
    addContactProduct(data)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign size={22} className="text-emerald-400" />
          Commission Tracker
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Track your affiliate earnings, purchases, and lifetime customer value.
        </p>
      </div>

      {/* Settings */}
      <div className="card border border-gray-700">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Info size={15} className="text-brand-400" /> Commission Settings
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Commission Rate (%)</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="input"
                min="0"
                max="100"
                step="0.5"
                value={commissionInput}
                onChange={e => setCommissionInput(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Average Order Value ($)</label>
            <input
              type="number"
              className="input"
              min="0"
              step="1"
              value={avgOrderInput}
              onChange={e => setAvgOrderInput(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Info size={11} />
            Commissions range 10–25%. Customers are permanently tied to you for all repeat orders.
          </p>
          <button className="btn-primary" onClick={saveSettings}>Save Settings</button>
        </div>
      </div>

      {/* This Month summary cards */}
      <div>
        <h2 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide text-gray-400">
          This Month — {format(now, 'MMMM yyyy')}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card border border-blue-800/30 bg-blue-900/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Links Shared</p>
            <p className="text-3xl font-bold text-white mt-1">{monthLinks}</p>
            <p className="text-xs text-gray-500 mt-1">this month</p>
          </div>
          <div className="card border border-purple-800/30 bg-purple-900/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Purchases Tracked</p>
            <p className="text-3xl font-bold text-white mt-1">{monthPurchases.length}</p>
            <p className="text-xs text-gray-500 mt-1">this month</p>
          </div>
          <div className="card border border-emerald-800/30 bg-emerald-900/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Commission Earned</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">${monthCommission.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">this month</p>
          </div>
          <div className="card border border-green-800/30 bg-green-900/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Repeat Potential</p>
            <p className="text-3xl font-bold text-green-400 mt-1">${projectedMonthly.toFixed(0)}</p>
            <p className="text-xs text-gray-500 mt-1">/mo projected</p>
          </div>
        </div>
      </div>

      {/* All-time totals */}
      <div>
        <h2 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide text-gray-400">
          All-Time Totals
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500">Total Links Shared</p>
            <p className="text-2xl font-bold text-white mt-1">{linkShares.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Total Purchases</p>
            <p className="text-2xl font-bold text-white mt-1">{contactProducts.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Total Commission</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">${totalCommission.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Est. Lifetime Value</p>
            <p className="text-2xl font-bold text-green-400 mt-1">${estimatedLTV.toFixed(0)}</p>
            <p className="text-xs text-gray-600">12-month projection</p>
          </div>
        </div>
      </div>

      {/* Per-product performance */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Package size={15} className="text-brand-400" /> Per-Product Performance
        </h2>
        {productPerf.length === 0 ? (
          <div className="text-center py-8">
            <Package size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No data yet.</p>
            <p className="text-gray-600 text-xs mt-1">Share product links to start tracking performance.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="pb-2 pr-4">Product</th>
                  <th className="pb-2 pr-4 text-right">Links Shared</th>
                  <th className="pb-2 pr-4 text-right">Purchases</th>
                  <th className="pb-2 pr-4 text-right">Commission</th>
                  <th className="pb-2 text-right">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {productPerf.map(({ product, linksShared, purchases, commission }) => {
                  const convRate = linksShared > 0 ? Math.round((purchases / linksShared) * 100) : 0
                  return (
                    <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="text-white font-medium">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-300">{linksShared}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-300">{purchases}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">
                        ${commission.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-semibold ${convRate > 20 ? 'text-green-400' : convRate > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                          {convRate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchase log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp size={15} className="text-brand-400" /> Purchase Log
          </h2>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setLogModal(true)}
          >
            <Plus size={14} /> Log Purchase
          </button>
        </div>
        {sortedPurchases.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No purchases logged yet.</p>
            <button
              className="btn-primary mt-3 flex items-center gap-2 mx-auto"
              onClick={() => setLogModal(true)}
            >
              <Plus size={14} /> Log First Purchase
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="pb-2 pr-4">Contact</th>
                  <th className="pb-2 pr-4">Product</th>
                  <th className="pb-2 pr-4 text-right">Order Value</th>
                  <th className="pb-2 pr-4 text-right">Commission</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedPurchases.map(cp => (
                  <tr key={cp.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 pr-4 text-white font-medium">{getContactName(cp.contactId)}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{getProductName(cp.productId)}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300">${cp.orderValue.toFixed(2)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">
                      ${(cp.orderValue * cp.commissionRate).toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-500">
                      {format(parseISO(cp.purchaseDate), 'MMM d, yyyy')}
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => deleteContactProduct(cp.id)}
                        className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logModal && (
        <LogPurchaseModal
          contacts={contacts}
          settings={safeSettings}
          onClose={() => setLogModal(false)}
          onSave={handleLogPurchase}
        />
      )}
    </div>
  )
}
