import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import Modal from './Modal'
import { PRODUCTS } from '../data/products'

const STATUS_COLOR = {
  'New Lead':        'bg-blue-900/40 text-blue-300',
  'Warm Lead':       'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':        'bg-orange-900/40 text-orange-300',
  'Customer':        'bg-green-900/40 text-green-300',
  'Repeat Customer': 'bg-emerald-900/40 text-emerald-300',
  'Inactive':        'bg-gray-800 text-gray-400',
}

export default function ShareTrackModal({ defaultProductId, defaultContactId, contacts, onClose, onSave }) {
  const [productId, setProductId] = useState(defaultProductId || '')
  const [contactId, setContactId] = useState(defaultContactId || '')
  const [notes, setNotes] = useState('')
  const [scheduleFollowup, setScheduleFollowup] = useState(true)
  const [copied, setCopied] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')

  const selectedProduct = PRODUCTS.find(p => p.id === productId)
  const selectedContact = contacts.find(c => c.id === contactId)

  const filteredProducts = PRODUCTS.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())
  )

  async function copyLink() {
    if (!selectedProduct) return
    await navigator.clipboard.writeText(selectedProduct.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSave() {
    if (!productId || !contactId) return
    onSave({ productId, contactId, notes, scheduleFollowup })
    onClose()
  }

  return (
    <Modal title="Share & Track" onClose={onClose} wide>
      <div className="space-y-5">
        {/* Product selector */}
        <div>
          <label className="label">Product *</label>
          {defaultProductId ? (
            <div className="p-3 rounded-lg bg-brand-900/20 border border-brand-700/40">
              <p className="text-sm font-semibold text-brand-300">{selectedProduct?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{selectedProduct?.url}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="input"
                placeholder="Search products…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              <select
                className="input"
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                <option value="">Choose a product…</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Contact selector */}
        <div>
          <label className="label">Contact *</label>
          {defaultContactId ? (
            <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{selectedContact?.name}</span>
                {selectedContact && (
                  <span className={`badge ${STATUS_COLOR[selectedContact.status] || 'bg-gray-800 text-gray-400'}`}>
                    {selectedContact.status}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="input"
                placeholder="Search contacts…"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
              />
              <select
                className="input"
                value={contactId}
                onChange={e => setContactId(e.target.value)}
              >
                <option value="">Choose a contact…</option>
                {filteredContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
                ))}
              </select>
            </div>
          )}
          {contacts.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">No contacts yet — add contacts first.</p>
          )}
        </div>

        {/* Affiliate link display */}
        {selectedProduct && (
          <div>
            <label className="label">Affiliate Link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 truncate font-mono">
                {selectedProduct.url}
              </div>
              <button
                onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                  copied
                    ? 'bg-green-900/40 text-green-400'
                    : 'btn-secondary'
                }`}
              >
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-20 resize-none"
            placeholder="e.g. Sent via DM, mentioned fitness goals…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Schedule follow-up checkbox */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={scheduleFollowup}
            onChange={e => setScheduleFollowup(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
          />
          <div>
            <span className="text-sm text-white group-hover:text-brand-300 transition-colors">
              Schedule Day 3 follow-up reminder
            </span>
            <p className="text-xs text-gray-500">Adds a follow-up 3 days from today</p>
          </div>
        </label>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-800">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={!productId || !contactId}
            onClick={handleSave}
          >
            <Share2 size={14} /> Share & Track
          </button>
        </div>
      </div>
    </Modal>
  )
}
