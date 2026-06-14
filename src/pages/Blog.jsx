import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { fetchBlogArticles, getCachedArticles } from '../utils/blogFeed'
import {
  BookOpen, RefreshCw, ExternalLink, Users, Check,
  Rss, Calendar, Plus, Minus,
} from 'lucide-react'

const SOURCE_COLORS = {
  'Healthline Fitness':     'bg-green-900/30 text-green-300 border-green-700/40',
  'Healthline Nutrition':   'bg-blue-900/30 text-blue-300 border-blue-700/40',
  'Healthline Weight Loss': 'bg-purple-900/30 text-purple-300 border-purple-700/40',
  'Precision Nutrition':    'bg-orange-900/30 text-orange-300 border-orange-700/40',
}

function formatDate(str) {
  if (!str) return ''
  try {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

function ArticleCard({ article }) {
  const colorCls = SOURCE_COLORS[article.source] || 'bg-gray-800/40 text-gray-400 border-gray-700/40'
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 flex flex-col gap-2 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-2 justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorCls}`}>
          {article.source}
        </span>
        {article.pubDate && (
          <span className="text-[10px] text-gray-600 flex items-center gap-1 whitespace-nowrap">
            <Calendar size={10} /> {formatDate(article.pubDate)}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-white leading-snug">{article.title}</h3>
      {article.summary && (
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{article.summary}</p>
      )}
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-auto pt-1 transition-colors"
      >
        Read article <ExternalLink size={10} />
      </a>
    </div>
  )
}

function SubscriberManager({ contacts, updateContact }) {
  const subscribers = useMemo(
    () => contacts.filter(c => (c.tags || []).includes('blog-subscriber')),
    [contacts]
  )

  const nonSubscribers = useMemo(
    () => contacts.filter(c =>
      !(c.tags || []).includes('blog-subscriber') &&
      c.status !== 'Inactive' &&
      (c.email || c.phone)
    ),
    [contacts]
  )

  function toggle(contact, add) {
    const tags = contact.tags || []
    updateContact(contact.id, {
      tags: add
        ? [...tags, 'blog-subscriber']
        : tags.filter(t => t !== 'blog-subscriber'),
    })
  }

  function subscribeAll() {
    nonSubscribers.forEach(c => toggle(c, true))
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-brand-400" />
          <h2 className="text-sm font-bold text-white">Blog Subscribers</h2>
          <span className="text-xs text-gray-500">({subscribers.length} active)</span>
        </div>
        {nonSubscribers.length > 0 && (
          <button
            onClick={subscribeAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-300 border border-brand-700/40 hover:bg-brand-600/30 transition-colors"
          >
            Subscribe all ({nonSubscribers.length})
          </button>
        )}
      </div>

      {subscribers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Subscribed</p>
          {subscribers.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-green-900/10 border border-green-800/30">
              <span className="text-xs text-gray-300">{c.name}</span>
              <button
                onClick={() => toggle(c, false)}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
              >
                <Minus size={10} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {nonSubscribers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Not subscribed</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {nonSubscribers.map(c => (
              <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
                <span className="text-xs text-gray-400">{c.name}</span>
                <button
                  onClick={() => toggle(c, true)}
                  className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-0.5"
                >
                  <Plus size={10} /> Subscribe
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {contacts.length === 0 && (
        <p className="text-xs text-gray-600">No contacts yet — add some in the Contacts page.</p>
      )}
    </div>
  )
}

export default function Blog() {
  const { contacts, updateContact } = useStore()
  const [articles, setArticles] = useState(() => getCachedArticles() || [])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('All')

  const sources = ['All', 'Healthline Fitness', 'Healthline Nutrition', 'Healthline Weight Loss', 'Precision Nutrition']

  const filtered = useMemo(
    () => filter === 'All' ? articles : articles.filter(a => a.source === filter),
    [articles, filter]
  )

  async function refresh() {
    setLoading(true)
    try {
      const result = await fetchBlogArticles(true)
      setArticles(result || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!articles.length) refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const subscriberCount = useMemo(
    () => contacts.filter(c => (c.tags || []).includes('blog-subscriber')).length,
    [contacts]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-brand-400" /> Health Blog
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daily articles from Healthline & Precision Nutrition — auto-broadcast to subscribers
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Fetching…' : 'Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
          <p className="text-2xl font-bold text-white">{articles.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Articles cached</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
          <p className="text-2xl font-bold text-brand-400">{subscriberCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Subscribers</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">4</p>
          <p className="text-xs text-gray-500 mt-0.5">RSS feeds</p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-blue-800/40 bg-blue-900/10 p-4 text-xs text-blue-300 space-y-1">
        <p className="font-semibold text-blue-200 flex items-center gap-1.5">
          <Rss size={12} /> How it works
        </p>
        <p>Every day, the system picks the top article from Healthline or Precision Nutrition and sends it to all blog subscribers via email or SMS — automatically, through the MQ system. Each message ends with your personal 1st Phorm affiliate link so subscribers can buy recommended supplements.</p>
        <p className="text-blue-400 font-medium mt-1 flex items-center gap-1"><Check size={10} /> Subscribe contacts below to start their daily health brief.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Articles */}
        <div className="md:col-span-2 space-y-4">
          {/* Source filter */}
          <div className="flex gap-2 flex-wrap">
            {sources.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  filter === s
                    ? 'bg-brand-600/30 text-brand-300 border-brand-700/50'
                    : 'bg-gray-800/50 text-gray-500 border-gray-700/40 hover:text-gray-300'
                }`}
              >
                {s === 'All' ? `All (${articles.length})` : s.replace('Healthline ', '')}
              </button>
            ))}
          </div>

          {loading && !articles.length ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              <RefreshCw size={24} className="animate-spin mx-auto mb-3 opacity-40" />
              Fetching articles…
            </div>
          ) : filtered.length ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((a, i) => <ArticleCard key={i} article={a} />)}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-600 text-sm">
              No articles yet — click Refresh to fetch.
            </div>
          )}
        </div>

        {/* Subscriber manager */}
        <div>
          <SubscriberManager contacts={contacts} updateContact={updateContact} />
        </div>
      </div>
    </div>
  )
}
