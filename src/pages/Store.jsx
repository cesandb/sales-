// Store — Affiliate Link Hub. Every 1st Phorm product with one-click UTM-tracked
// links ready to drop into DMs, comments, emails, and bio links.

import { useState, useMemo } from 'react'
import { PRODUCTS } from '../data/products'
import { buildUTMLink } from '../utils/affiliateLinks'
import { Copy, Check, ExternalLink, ShoppingBag, Search, Filter } from 'lucide-react'

const BASE_AFFILIATE = 'https://1stphorm.com/?a_aid=Conan'
const CATEGORIES = [...new Set(PRODUCTS.map(p => p.category))]

function CopyButton({ text, label = 'Copy', small = false }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  if (small) {
    return (
      <button
        onClick={copy}
        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          copied
            ? 'bg-green-900/40 text-green-400 border border-green-700/40'
            : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700'
        }`}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied!' : label}
      </button>
    )
  }
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
        copied
          ? 'bg-green-900/30 text-green-400 border-green-700/40'
          : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border-gray-700'
      }`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function ProductCard({ product }) {
  const link = buildUTMLink(product.url, { medium: 'store', stepKey: 'store-share' })
  const dmBlurb = `Hey! Thought this might be a great fit for you — ${product.name}: ${link}`

  return (
    <div className="card group hover:border-gray-600 transition-colors flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{product.category}</span>
            <h3 className="text-sm font-semibold text-white leading-tight mt-0.5">{product.name}</h3>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{product.description}</p>
        {product.targetAudience?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {product.targetAudience.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-900/30 text-brand-300 border border-brand-800/40">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2.5 border-t border-gray-800 space-y-2">
        {/* Truncated URL */}
        <div className="flex items-center gap-2">
          <code className="text-[10px] text-gray-500 font-mono truncate flex-1 min-w-0">
            {link.replace('https://', '')}
          </code>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <ExternalLink size={11} />
          </a>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <CopyButton text={link} label="Copy Link" small />
          <CopyButton text={dmBlurb} label="Copy DM" small />
        </div>
      </div>
    </div>
  )
}

export default function Store() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => PRODUCTS.filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [category, search])

  const allLinks = useMemo(() =>
    filtered.map(p => {
      const link = buildUTMLink(p.url, { medium: 'store', stepKey: 'store-share' })
      return `• ${p.name}: ${link}`
    }).join('\n'),
    [filtered]
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShoppingBag size={22} className="text-brand-400" />
            Affiliate Link Hub
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Every 1st Phorm product with tracked links. Copy and drop in any DM, email, or comment.
          </p>
        </div>
        <CopyButton text={allLinks} label={`Copy All ${filtered.length} Links`} />
      </div>

      {/* Base affiliate URL card */}
      <div className="rounded-xl bg-brand-900/20 border border-brand-700/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brand-300">Your Affiliate Store URL</p>
          <p className="text-xs text-gray-300 font-mono mt-0.5 truncate">{BASE_AFFILIATE}</p>
          <p className="text-[11px] text-gray-500 mt-1">Share this when you don't have a specific product in mind</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <CopyButton text={BASE_AFFILIATE} label="Copy URL" />
          <a
            href={BASE_AFFILIATE}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition-colors"
          >
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </div>

      {/* DM template */}
      <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          Quick DM Template
        </p>
        <p className="text-xs text-gray-400 font-mono leading-relaxed">
          "Hey [Name]! Based on your goals, I think [Product] would be perfect for you. Here's my link with more info: [paste link]"
        </p>
        <CopyButton
          text={`Hey [Name]! Based on your goals, I think you'd love the [Product]. It's been a game-changer for people looking to [goal]. Here's my link: ${BASE_AFFILIATE}`}
          label="Copy Base Template"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 text-sm w-full"
          />
        </div>
        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="input pl-8 text-sm pr-8"
          >
            <option value="all">All Categories ({PRODUCTS.length})</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat} ({PRODUCTS.filter(p => p.category === cat).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">
        {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        {search || category !== 'all' ? ` matching "${search || category}"` : ''}
      </p>

      {/* Product grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

    </div>
  )
}
