import { useState, useMemo } from 'react'
import { PRODUCTS, PRODUCT_CATEGORIES, GENERAL_LINK, getProductById } from '../data/products'
import { useStore } from '../store/useStore'
import { ExternalLink, Copy, Check, Search, Star, Users, X, Zap, Target, FlaskConical, Share2 } from 'lucide-react'
import Modal from '../components/Modal'
import ShareTrackModal from '../components/ShareTrackModal'
import { addDays } from 'date-fns'

// ── Product Detail Modal ──────────────────────────────────────────────────────
function ProductDetailModal({ product, contacts, onClose, onCopyLink, onLogInteraction, copied }) {
  const [recommendModal, setRecommendModal] = useState(false)

  const pairsWithProducts = (product.pairsWell || [])
    .map(id => getProductById(id))
    .filter(Boolean)

  return (
    <Modal title={product.name} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Category + description */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-gray-800 text-gray-300">{product.category}</span>
            {product.category === 'Most Recommended' && (
              <span className="badge bg-brand-900/40 text-brand-300">
                <Star size={10} className="fill-brand-400 text-brand-400" /> Top Pick
              </span>
            )}
          </div>
          <p className="text-gray-300 text-sm">{product.description}</p>
        </div>

        {/* Benefits */}
        {product.benefits && product.benefits.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Zap size={12} className="text-brand-400" /> Key Benefits
            </h3>
            <ul className="space-y-1.5">
              {product.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                  <span className="text-brand-400 flex-shrink-0 mt-0.5">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Who it's for */}
        {product.targetAudience && product.targetAudience.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Target size={12} className="text-brand-400" /> Who It's For
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {product.targetAudience.map(a => (
                <span key={a} className="badge bg-gray-800 text-gray-300">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* When to use */}
        {product.when && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">When to Use</h3>
            <p className="text-sm text-gray-300 bg-gray-800/40 rounded-lg px-3 py-2">{product.when}</p>
          </div>
        )}

        {/* Talking Points */}
        {product.talkingPoints && product.talkingPoints.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Talking Points</h3>
            <ul className="space-y-2">
              {product.talkingPoints.map((tp, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-200 bg-brand-900/10 border border-brand-800/30 rounded-lg px-3 py-2">
                  <span className="text-brand-400 flex-shrink-0 font-bold">{i + 1}.</span>
                  {tp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Science note */}
        {product.science && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <FlaskConical size={12} className="text-brand-400" /> Science Note
            </h3>
            <p className="text-xs text-gray-400 bg-gray-800/40 rounded-lg px-3 py-2 italic">{product.science}</p>
          </div>
        )}

        {/* Pairs well with */}
        {pairsWithProducts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pairs Well With</h3>
            <div className="flex flex-wrap gap-2">
              {pairsWithProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onClose()
                    // product click handled externally
                  }}
                  className="badge bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors cursor-default"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-800 flex-wrap">
          <button
            onClick={() => onCopyLink(product)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              copied === product.id
                ? 'bg-green-900/40 text-green-400'
                : 'btn-secondary'
            }`}
          >
            {copied === product.id ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Affiliate Link</>}
          </button>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2"
          >
            <ExternalLink size={14} /> Open Product Page
          </a>
          <button
            onClick={() => setRecommendModal(true)}
            className="btn-primary flex items-center gap-2 ml-auto"
          >
            <Users size={14} /> Recommend to Contact
          </button>
        </div>
      </div>

      {/* Nested recommend modal */}
      {recommendModal && (
        <RecommendContactModal
          product={product}
          contacts={contacts}
          onClose={() => setRecommendModal(false)}
          onRecommend={(contactId, notes) => {
            onLogInteraction(product, contactId, notes)
            setRecommendModal(false)
          }}
        />
      )}
    </Modal>
  )
}

// ── Recommend to Contact Modal ────────────────────────────────────────────────
function RecommendContactModal({ product, contacts, onClose, onRecommend }) {
  const [selectedContact, setSelectedContact] = useState('')
  const [notes, setNotes] = useState(`Recommended ${product.name}`)

  return (
    <Modal title="Recommend to Contact" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-brand-900/20 border border-brand-700/40">
          <p className="text-sm font-semibold text-brand-300">{product.name}</p>
        </div>
        <div>
          <label className="label">Select Contact *</label>
          <select
            className="input"
            value={selectedContact}
            onChange={e => setSelectedContact(e.target.value)}
          >
            <option value="">Choose a contact…</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Note</label>
          <textarea
            className="input min-h-16 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        {contacts.length === 0 && (
          <p className="text-xs text-gray-500">No contacts yet — add contacts first.</p>
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!selectedContact}
            onClick={() => selectedContact && onRecommend(selectedContact, notes)}
          >
            Log Recommendation
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Products Page ────────────────────────────────────────────────────────
export default function Products() {
  const { trackProductClick, productClicks, contacts, addInteraction, addLinkShare, addFollowup } = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [copied, setCopied] = useState(null)
  const [detailProduct, setDetailProduct] = useState(null)
  const [shareProduct, setShareProduct] = useState(null)

  const filtered = useMemo(() => {
    return PRODUCTS.filter(p => {
      if (category !== 'All' && p.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [search, category])

  async function copyLink(product) {
    await navigator.clipboard.writeText(product.url)
    trackProductClick(product.id)
    setCopied(product.id)
    setTimeout(() => setCopied(null), 2000)
  }

  function openLink(product) {
    trackProductClick(product.id)
    window.open(product.url, '_blank', 'noopener,noreferrer')
  }

  function handleLogInteraction(product, contactId, notes) {
    addInteraction({
      contactId,
      type: 'Recommendation',
      notes: notes || `Recommended ${product.name}`,
    })
    trackProductClick(product.id)
  }

  function handleShareSave({ productId, contactId, notes, scheduleFollowup }) {
    const product = PRODUCTS.find(p => p.id === productId)
    addLinkShare({ contactId, productId, notes })
    addInteraction({
      contactId,
      type: 'Shared Link',
      notes: notes || `Shared ${product?.name || 'product'} link`,
    })
    trackProductClick(productId)
    if (scheduleFollowup) {
      const followDate = addDays(new Date(), 3)
      addFollowup({
        contactId,
        date: followDate.toISOString().split('T')[0],
        notes: `Day 3 follow-up: shared ${product?.name || 'product'} link`,
        priority: 'medium',
      })
    }
    setShareProduct(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Product Catalog</h1>
        <p className="text-gray-400 text-sm mt-0.5">{PRODUCTS.length} products with your affiliate links</p>
      </div>

      {/* General link card */}
      <div className="card border border-brand-700/40 bg-brand-900/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-semibold text-brand-300">Your General Storefront</p>
            <p className="text-sm text-gray-400 mt-0.5">Share this to let people browse everything.</p>
            <p className="text-xs text-gray-500 mt-1">{GENERAL_LINK}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => { await navigator.clipboard.writeText(GENERAL_LINK); setCopied('general'); setTimeout(()=>setCopied(null),2000) }}
              className="btn-secondary flex items-center gap-2"
            >
              {copied === 'general' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied === 'general' ? 'Copied!' : 'Copy Link'}
            </button>
            <a href={GENERAL_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
              <ExternalLink size={14} /> Open Store
            </a>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {['All', ...PRODUCT_CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                category === c ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-600">{filtered.length} products shown · Click a card for details</p>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(product => {
          const clicks = productClicks[product.id] || 0
          const isMostRec = product.category === 'Most Recommended'
          return (
            <div
              key={product.id}
              className={`card flex flex-col gap-3 hover:border-gray-600 transition-colors cursor-pointer ${isMostRec ? 'border-brand-700/40' : ''}`}
              onClick={() => setDetailProduct(product)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    {isMostRec && <Star size={11} className="text-brand-400 fill-brand-400 flex-shrink-0" />}
                    <p className="text-xs text-gray-500 truncate">{product.category}</p>
                  </div>
                  <p className="font-semibold text-white text-sm leading-tight">{product.name}</p>
                </div>
                {clicks > 0 && (
                  <span className="text-xs font-semibold text-brand-400 bg-brand-900/30 px-1.5 py-0.5 rounded flex-shrink-0">{clicks}x</span>
                )}
              </div>
              <p className="text-xs text-gray-400 flex-1 line-clamp-2">{product.description}</p>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); copyLink(product) }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    copied === product.id
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {copied === product.id ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShareProduct(product) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-500 transition-colors"
                  title="Share & Track"
                >
                  <Share2 size={12} /> Share &amp; Track
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openLink(product) }}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                  title="Open product page"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Product Detail Modal */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          contacts={contacts}
          onClose={() => setDetailProduct(null)}
          onCopyLink={copyLink}
          onLogInteraction={handleLogInteraction}
          copied={copied}
        />
      )}

      {/* Share & Track Modal */}
      {shareProduct && (
        <ShareTrackModal
          defaultProductId={shareProduct.id}
          contacts={contacts}
          onClose={() => setShareProduct(null)}
          onSave={handleShareSave}
        />
      )}
    </div>
  )
}
