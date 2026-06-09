import { useState, useMemo } from 'react'
import { PRODUCTS, PRODUCT_CATEGORIES, GENERAL_LINK } from '../data/products'
import { useStore } from '../store/useStore'
import { ExternalLink, Copy, Check, Search, Star } from 'lucide-react'

export default function Products() {
  const { trackProductClick, productClicks } = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [copied, setCopied] = useState(null)

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

      <p className="text-xs text-gray-600">{filtered.length} products shown</p>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(product => {
          const clicks = productClicks[product.id] || 0
          const isMostRec = product.category === 'Most Recommended'
          return (
            <div key={product.id} className={`card flex flex-col gap-3 hover:border-gray-700 transition-colors ${isMostRec ? 'border-brand-700/40' : ''}`}>
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
              <p className="text-xs text-gray-400 flex-1">{product.description}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyLink(product)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    copied === product.id
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {copied === product.id ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
                </button>
                <button
                  onClick={() => openLink(product)}
                  className="p-2 rounded-lg bg-brand-700/30 text-brand-400 hover:bg-brand-600/50 hover:text-white transition-colors"
                  title="Open product page"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
