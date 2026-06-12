import { useState } from 'react'
import Modal from './Modal'
import { useStore } from '../store/useStore'
import { matchProduct } from '../utils/affiliateLinks'
import { PRODUCTS } from '../data/products'
import { CheckCircle } from 'lucide-react'

export default function ConversionModal({ contact, onClose }) {
  const { settings, addContactProduct, updateContact, addEnrollment } = useStore()
  const defaultProduct = matchProduct(contact)
  const [productId, setProductId] = useState(defaultProduct?.id || 'micro-factor')
  const [orderValue, setOrderValue] = useState(String(settings?.avgOrderValue || 80))
  const [done, setDone] = useState(false)

  const commission = (parseFloat(orderValue) || 0) * (settings?.commissionRate || 0.15)

  function confirm() {
    addContactProduct({
      contactId: contact.id,
      productId,
      orderValue: parseFloat(orderValue) || 0,
      commissionRate: settings?.commissionRate || 0.15,
    })
    updateContact(contact.id, { status: 'Customer' })
    addEnrollment({ contactId: contact.id, sequenceId: 'seq-reorder' })
    addEnrollment({ contactId: contact.id, sequenceId: 'seq-referral' })
    setDone(true)
  }

  if (done) return (
    <Modal title="Conversion Logged!" onClose={onClose}>
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700/40 flex items-center justify-center mx-auto">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <div>
          <p className="text-2xl font-black text-white">🎉 Sale recorded!</p>
          <p className="text-brand-400 font-bold text-lg mt-1">+${commission.toFixed(2)} commission</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-sm text-gray-300 text-left space-y-1.5">
          <p>✅ Status upgraded to Customer</p>
          <p>✅ Enrolled: 30-day Reorder sequence</p>
          <p>✅ Enrolled: Referral ask fires at Day 14</p>
        </div>
        <button className="btn-primary w-full" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )

  return (
    <Modal title={`Log Conversion — ${contact.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Product purchased</label>
          <select className="input" value={productId} onChange={e => setProductId(e.target.value)}>
            {PRODUCTS.slice(0, 35).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Order value ($)</label>
          <input
            type="number"
            className="input"
            value={orderValue}
            onChange={e => setOrderValue(e.target.value)}
            min="1"
            step="1"
          />
        </div>
        <div className="rounded-xl bg-brand-900/20 border border-brand-700/30 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Your commission:</span>
            <span className="text-brand-300 font-bold text-base">+${commission.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>{((settings?.commissionRate || 0.15) * 100).toFixed(0)}% rate</span>
            <span>Order: ${parseFloat(orderValue || 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-400">This will automatically:</p>
          <p>• Upgrade {contact.name} to Customer status</p>
          <p>• Start a 30-day Reorder sequence (restock reminder)</p>
          <p>• Schedule a Referral ask for Day 14</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={confirm}
            disabled={!parseFloat(orderValue)}
          >
            <CheckCircle size={14} /> Log Conversion 🎉
          </button>
        </div>
      </div>
    </Modal>
  )
}
