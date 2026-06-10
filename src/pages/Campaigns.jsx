import { useState, useMemo } from 'react'
import {
  Megaphone, Plus, Edit2, Trash2, Play, Pause, CheckCircle2,
  ChevronDown, ChevronUp, Share2, Bell, Users, Link2,
  TrendingUp, Search, X, Check,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { PRODUCTS } from '../data/products'
import { format, addDays, parseISO, differenceInDays } from 'date-fns'
import Modal from '../components/Modal'
import ShareTrackModal from '../components/ShareTrackModal'

const STATUS_COLOR = {
  'New Lead':        'bg-blue-900/40 text-blue-300',
  'Warm Lead':       'bg-yellow-900/40 text-yellow-300',
  'Hot Lead':        'bg-orange-900/40 text-orange-300',
  'Customer':        'bg-green-900/40 text-green-300',
  'Repeat Customer': 'bg-emerald-900/40 text-emerald-300',
  'Inactive':        'bg-gray-800 text-gray-400',
}

const CAMPAIGN_STATUS_COLOR = {
  Draft:     'bg-gray-800 text-gray-400',
  Active:    'bg-green-900/40 text-green-300',
  Paused:    'bg-yellow-900/40 text-yellow-300',
  Completed: 'bg-blue-900/40 text-blue-300',
}

const SEQUENCE_STEPS = [
  { day: 0,  label: 'Day 0',  title: 'Share the Link', template: 'Share the link — introduce the product naturally' },
  { day: 3,  label: 'Day 3',  title: 'Check In',       template: 'Check-in — did they see it? Any questions?' },
  { day: 7,  label: 'Day 7',  title: 'Value Add',      template: 'Value add — share a benefit, tip, or personal result' },
  { day: 14, label: 'Day 14', title: 'Soft Close',     template: 'Soft close — ready to try it?' },
]

// ── Campaign Form Modal ────────────────────────────────────────────────────────
function CampaignFormModal({ campaign, contacts, onClose, onSave }) {
  const isEdit = !!campaign
  const [name, setName] = useState(campaign?.name || '')
  const [status, setStatus] = useState(campaign?.status || 'Draft')
  const [goalNotes, setGoalNotes] = useState(campaign?.goalNotes || '')
  const [selectedProducts, setSelectedProducts] = useState(campaign?.productIds || [])
  const [selectedContacts, setSelectedContacts] = useState(campaign?.contactIds || [])
  const [productSearch, setProductSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')

  const filteredProducts = PRODUCTS.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  )
  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())
  )

  function toggleProduct(id) {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleContact(id) {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), status, goalNotes, productIds: selectedProducts, contactIds: selectedContacts })
    onClose()
  }

  return (
    <Modal title={isEdit ? 'Edit Campaign' : 'New Campaign'} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="label">Campaign Name *</label>
          <input
            className="input"
            placeholder="e.g. Level-1 Push — Instagram Gym Crowd"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Status */}
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            {['Draft', 'Active', 'Paused', 'Completed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Products */}
        <div>
          <label className="label">Products ({selectedProducts.length} selected)</label>
          <input
            className="input mb-2"
            placeholder="Search products…"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
            {filteredProducts.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800/60 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(p.id)}
                  onChange={() => toggleProduct(p.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{p.category}</span>
                </div>
              </label>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-xs text-gray-500 px-3 py-2">No products match.</p>
            )}
          </div>
        </div>

        {/* Contacts */}
        <div>
          <label className="label">Contacts ({selectedContacts.length} selected)</label>
          <input
            className="input mb-2"
            placeholder="Search contacts…"
            value={contactSearch}
            onChange={e => setContactSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
            {filteredContacts.map(c => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800/60 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(c.id)}
                  onChange={() => toggleContact(c.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-white flex-1">{c.name}</span>
                <span className={`badge ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>
                  {c.status}
                </span>
              </label>
            ))}
            {filteredContacts.length === 0 && (
              <p className="text-xs text-gray-500 px-3 py-2">
                {contacts.length === 0 ? 'No contacts yet.' : 'No contacts match.'}
              </p>
            )}
          </div>
        </div>

        {/* Goal Notes */}
        <div>
          <label className="label">Goal Notes</label>
          <textarea
            className="input min-h-20 resize-none"
            placeholder="e.g. Push Level-1 to gym crowd from Instagram"
            value={goalNotes}
            onChange={e => setGoalNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-gray-800">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={handleSave}
          >
            {isEdit ? 'Save Changes' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Commission Tracker Panel ───────────────────────────────────────────────────
function CommissionPanel({ campaign, contactProducts, settings }) {
  const campProducts = contactProducts.filter(cp => cp.campaignId === campaign.id)
  const converted = new Set(campProducts.map(cp => cp.contactId)).size
  const totalCommission = campProducts.reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)
  const remainingContacts = (campaign.contactIds || []).length - converted
  const projected = Math.max(0, remainingContacts) * settings.avgOrderValue * settings.commissionRate

  return (
    <div className="bg-emerald-900/10 border border-emerald-800/30 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
        <TrendingUp size={14} /> Commission Tracker
      </h4>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500">Converted</p>
          <p className="text-xl font-bold text-white">{converted}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Earned</p>
          <p className="text-xl font-bold text-emerald-400">${totalCommission.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Projected</p>
          <p className="text-xl font-bold text-gray-300">${projected.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Sequence Panel ────────────────────────────────────────────────────────────
function SequencePanel({ campaign, onUpdateCampaign }) {
  const steps = campaign.steps || SEQUENCE_STEPS.map(s => ({ ...s, message: s.template, completedContacts: [] }))

  function updateStepMessage(i, msg) {
    const updated = steps.map((s, idx) => idx === i ? { ...s, message: msg } : s)
    onUpdateCampaign({ steps: updated })
  }

  function markAllComplete(i) {
    const updated = steps.map((s, idx) =>
      idx === i
        ? { ...s, completedContacts: [...new Set([...(s.completedContacts || []), ...(campaign.contactIds || [])])] }
        : s
    )
    onUpdateCampaign({ steps: updated })
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-3">Outreach Sequence</h4>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-400 bg-brand-900/30 px-2 py-0.5 rounded">
                  {step.label}
                </span>
                <span className="text-sm font-semibold text-white">{step.title}</span>
              </div>
              <button
                onClick={() => markAllComplete(i)}
                className="text-xs text-gray-400 hover:text-green-400 transition-colors flex items-center gap-1"
                title="Mark complete for all contacts"
              >
                <CheckCircle2 size={13} /> Mark all done
              </button>
            </div>
            <textarea
              className="input min-h-16 resize-none text-xs"
              value={step.message}
              onChange={e => updateStepMessage(i, e.target.value)}
              placeholder="Message template… use {{name}} for personalization"
            />
            {(step.completedContacts || []).length > 0 && (
              <p className="text-xs text-green-400 mt-1">
                {step.completedContacts.length} contact{step.completedContacts.length !== 1 ? 's' : ''} completed
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Contact Progress Table ────────────────────────────────────────────────────
function ContactProgressTable({ campaign, contacts, contactProducts, linkShares, onShareTrack, onLogFollowup }) {
  const campContacts = (campaign.contactIds || [])
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean)

  const steps = campaign.steps || SEQUENCE_STEPS.map(s => ({ ...s, completedContacts: [] }))

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-3">Contact Progress</h4>
      {campContacts.length === 0 ? (
        <p className="text-sm text-gray-500">No contacts in this campaign yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4">Contact</th>
                <th className="pb-2 pr-2">Last Contact</th>
                <th className="pb-2 pr-2 text-center">Steps</th>
                <th className="pb-2 pr-2 text-center">Converted</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {campContacts.map(c => {
                const completedSteps = steps.filter(s => (s.completedContacts || []).includes(c.id)).length
                const converted = contactProducts.some(cp => cp.contactId === c.id && cp.campaignId === campaign.id)
                const shared = linkShares.filter(ls => ls.contactId === c.id && ls.campaignId === campaign.id).length

                return (
                  <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 font-bold text-xs flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium text-xs">{c.name}</p>
                          <span className={`badge text-xs ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-400'}`}>
                            {c.status}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-gray-400">
                      {c.lastContact
                        ? `${differenceInDays(new Date(), parseISO(c.lastContact))}d ago`
                        : 'Never'}
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {steps.map((_, i) => (
                          <div
                            key={i}
                            className={`w-2.5 h-2.5 rounded-full ${
                              (steps[i].completedContacts || []).includes(c.id)
                                ? 'bg-green-400'
                                : 'bg-gray-700'
                            }`}
                            title={`Step ${i + 1}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{completedSteps}/4</p>
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      {converted ? (
                        <Check size={14} className="text-green-400 mx-auto" />
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => onShareTrack(c.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-brand-700/30 text-brand-400 hover:bg-brand-600/50 hover:text-white transition-colors"
                        >
                          <Share2 size={10} /> Share
                        </button>
                        <button
                          onClick={() => onLogFollowup(c)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                          <Bell size={10} /> Follow-up
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Follow-up Modal ───────────────────────────────────────────────────────────
function FollowupModal({ contact, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('medium')

  return (
    <Modal title={`Schedule Follow-up — ${contact.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-16 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Reminder note…"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!date}
            onClick={() => date && onSave({ date, notes, priority })}
          >
            Schedule
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Campaign Detail Expand ─────────────────────────────────────────────────────
function CampaignDetail({ campaign, contacts, contactProducts, linkShares, settings, onUpdate }) {
  const [shareModal, setShareModal] = useState(null) // contactId or null (for general)
  const [fuModal, setFuModal] = useState(null)
  const { addLinkShare, addInteraction, trackProductClick, addFollowup } = useStore()

  function handleShareSave({ productId, contactId, notes, scheduleFollowup }) {
    addLinkShare({ contactId, productId, campaignId: campaign.id, notes })
    addInteraction({ contactId, type: 'Shared Link', notes: notes || `Shared ${PRODUCTS.find(p => p.id === productId)?.name}` })
    trackProductClick(productId)
    if (scheduleFollowup) {
      const followDate = addDays(new Date(), 3)
      addFollowup({
        contactId,
        date: followDate.toISOString().split('T')[0],
        notes: `Day 3 follow-up: shared ${PRODUCTS.find(p => p.id === productId)?.name}`,
        priority: 'medium',
      })
    }
    setShareModal(null)
  }

  return (
    <div className="border-t border-gray-800 px-5 py-5 space-y-6">
      <SequencePanel
        campaign={campaign}
        onUpdateCampaign={patch => onUpdate(campaign.id, patch)}
      />

      <ContactProgressTable
        campaign={campaign}
        contacts={contacts}
        contactProducts={contactProducts}
        linkShares={linkShares}
        onShareTrack={contactId => setShareModal(contactId)}
        onLogFollowup={contact => setFuModal(contact)}
      />

      <CommissionPanel
        campaign={campaign}
        contactProducts={contactProducts}
        settings={settings}
      />

      {shareModal !== null && (
        <ShareTrackModal
          defaultProductId={campaign.productIds?.[0] || ''}
          defaultContactId={shareModal || ''}
          contacts={contacts}
          onClose={() => setShareModal(null)}
          onSave={handleShareSave}
        />
      )}

      {fuModal && (
        <FollowupModal
          contact={fuModal}
          onClose={() => setFuModal(null)}
          onSave={data => {
            addFollowup({ contactId: fuModal.id, ...data })
            setFuModal(null)
          }}
        />
      )}
    </div>
  )
}

// ── Campaign Card ─────────────────────────────────────────────────────────────
function CampaignCard({ campaign, contacts, contactProducts, linkShares, settings, onEdit, onDelete, onStatusToggle, onUpdate }) {
  const [expanded, setExpanded] = useState(false)

  const campProducts = (campaign.productIds || [])
    .map(id => PRODUCTS.find(p => p.id === id))
    .filter(Boolean)

  const campContacts = (campaign.contactIds || []).length
  const campLinks = linkShares.filter(ls => ls.campaignId === campaign.id).length
  const campConversions = new Set(
    contactProducts
      .filter(cp => cp.campaignId === campaign.id)
      .map(cp => cp.contactId)
  ).size
  const campCommission = contactProducts
    .filter(cp => cp.campaignId === campaign.id)
    .reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)

  return (
    <div className="card p-0 overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white">{campaign.name}</h3>
              <span className={`badge ${CAMPAIGN_STATUS_COLOR[campaign.status] || 'bg-gray-800 text-gray-400'}`}>
                {campaign.status}
              </span>
            </div>
            {campaign.goalNotes && (
              <p className="text-xs text-gray-400 mt-1">{campaign.goalNotes}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(campaign)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onStatusToggle(campaign)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title={campaign.status === 'Active' ? 'Pause' : 'Launch'}
            >
              {campaign.status === 'Active' ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={() => onDelete(campaign.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Product badges */}
        {campProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {campProducts.map(p => (
              <span key={p.id} className="badge bg-brand-900/30 text-brand-300">{p.name}</span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{campContacts}</p>
            <p className="text-xs text-gray-500">Contacts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{campLinks}</p>
            <p className="text-xs text-gray-500">Links Shared</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{campConversions}</p>
            <p className="text-xs text-gray-500">Conversions</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400">${campCommission.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Commission</p>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-t border-gray-800 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 transition-colors"
      >
        {expanded ? <><ChevronUp size={13} /> Hide Details</> : <><ChevronDown size={13} /> Show Sequence & Contacts</>}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <CampaignDetail
          campaign={campaign}
          contacts={contacts}
          contactProducts={contactProducts}
          linkShares={linkShares}
          settings={settings}
          onUpdate={onUpdate}
        />
      )}
    </div>
  )
}

// ── Main Campaigns Page ───────────────────────────────────────────────────────
export default function Campaigns() {
  const {
    campaigns, contacts, contactProducts, linkShares, settings,
    addCampaign, updateCampaign, deleteCampaign,
  } = useStore()

  const [showForm, setShowForm] = useState(false)
  const [editCampaign, setEditCampaign] = useState(null)

  function handleSave(data) {
    if (editCampaign) {
      updateCampaign(editCampaign.id, data)
    } else {
      addCampaign(data)
    }
    setEditCampaign(null)
    setShowForm(false)
  }

  function handleEdit(campaign) {
    setEditCampaign(campaign)
    setShowForm(true)
  }

  function handleStatusToggle(campaign) {
    const next =
      campaign.status === 'Active' ? 'Paused' :
      campaign.status === 'Draft'  ? 'Active' :
      campaign.status === 'Paused' ? 'Active' :
      campaign.status === 'Completed' ? 'Active' :
      'Active'
    updateCampaign(campaign.id, { status: next })
  }

  const totalActive = campaigns.filter(c => c.status === 'Active').length
  const totalCommission = contactProducts.reduce((sum, cp) => sum + cp.orderValue * cp.commissionRate, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone size={22} className="text-brand-400" />
            Campaigns
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Focused outreach pushes with built-in follow-up sequences.
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { setEditCampaign(null); setShowForm(true) }}
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {/* Summary row */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{campaigns.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Campaigns</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-400">{totalActive}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-emerald-400">${totalCommission.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Commission</p>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">No campaigns yet</p>
          <p className="text-gray-600 text-sm mt-1">Create your first campaign to start tracking outreach.</p>
          <button
            className="btn-primary mt-4 flex items-center gap-2 mx-auto"
            onClick={() => setShowForm(true)}
          >
            <Plus size={16} /> Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {[...campaigns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              contacts={contacts}
              contactProducts={contactProducts}
              linkShares={linkShares}
              settings={settings || { commissionRate: 0.15, avgOrderValue: 45 }}
              onEdit={handleEdit}
              onDelete={deleteCampaign}
              onStatusToggle={handleStatusToggle}
              onUpdate={updateCampaign}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <CampaignFormModal
          campaign={editCampaign}
          contacts={contacts}
          onClose={() => { setShowForm(false); setEditCampaign(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
