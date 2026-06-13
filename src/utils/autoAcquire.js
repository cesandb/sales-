// Auto-acquisition engine: source configs, fetch functions, dedup, config persistence

const ENGINE_KEY = 'phorm_auto_engine'
const SEEN_KEY   = 'phorm_auto_seen'
const LOG_KEY    = 'phorm_auto_log'

export const YOUTUBE_KEY    = 'phorm_youtube_key'
export const NEWSAPI_KEY    = 'phorm_newsapi_key'
export const GNEWS_KEY      = 'phorm_gnews_key'
export const EVENTBRITE_KEY = 'phorm_eventbrite_key'

// ── Source registry ────────────────────────────────────────────────────────────
export const SOURCE_CONFIGS = [
  {
    id: 'hn',
    name: 'HackerNews',
    emoji: '🟠',
    color: 'text-orange-400',
    bg: 'bg-orange-900/20 border-orange-700/30',
    defaultIntervalMin: 30,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-fitness',
    name: 'Reddit/fitness',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 45,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-loseit',
    name: 'Reddit/loseit',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 60,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-supplements',
    name: 'Reddit/Supplements',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 60,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-running',
    name: 'Reddit/running',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-gainit',
    name: 'Reddit/gainit',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-xxfitness',
    name: 'Reddit/xxfitness',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'devto',
    name: 'Dev.to',
    emoji: '⬛',
    color: 'text-gray-300',
    bg: 'bg-gray-800/40 border-gray-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    emoji: '🐘',
    color: 'text-purple-400',
    bg: 'bg-purple-900/20 border-purple-700/30',
    defaultIntervalMin: 60,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'github',
    name: 'GitHub',
    emoji: '🐙',
    color: 'text-gray-300',
    bg: 'bg-gray-800/40 border-gray-700/30',
    defaultIntervalMin: 180,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'usaspending',
    name: 'USA Spending',
    emoji: '🏛',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-700/30',
    defaultIntervalMin: 360,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'youtube',
    name: 'YouTube Creators',
    emoji: '▶️',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
    requiresKey: YOUTUBE_KEY,
  },
  {
    id: 'medium',
    name: 'Medium Writers',
    emoji: '✍️',
    color: 'text-gray-300',
    bg: 'bg-gray-800/40 border-gray-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-crossfit',
    name: 'Reddit/crossfit',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-keto',
    name: 'Reddit/keto',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-1stphorm',
    name: 'Reddit/1stphorm',
    emoji: '🔴',
    color: 'text-brand-400',
    bg: 'bg-brand-900/20 border-brand-700/30',
    defaultIntervalMin: 60,
    seqId: 'seq-warm-convert',
  },
  {
    id: 'reddit-naturalbodybuilding',
    name: 'Reddit/naturalbodybuilding',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'google-news',
    name: 'Google News: Fitness',
    emoji: '📰',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'newsapi',
    name: 'NewsAPI: Fitness',
    emoji: '📡',
    color: 'text-sky-400',
    bg: 'bg-sky-900/20 border-sky-700/30',
    defaultIntervalMin: 240,
    seqId: 'seq-cold-intro',
    requiresKey: NEWSAPI_KEY,
  },
  {
    id: 'gnews',
    name: 'GNews: Fitness',
    emoji: '🗞️',
    color: 'text-indigo-400',
    bg: 'bg-indigo-900/20 border-indigo-700/30',
    defaultIntervalMin: 240,
    seqId: 'seq-cold-intro',
    requiresKey: GNEWS_KEY,
  },
  {
    id: 'reddit-intermittentfasting',
    name: 'Reddit/intermittentfasting',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-homegym',
    name: 'Reddit/homegym',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-weightraining',
    name: 'Reddit/weighttraining',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-hiit',
    name: 'Reddit/hiit',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-veganfitness',
    name: 'Reddit/veganfitness',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-leangains',
    name: 'Reddit/leangains',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'wordpress-fitness',
    name: 'WordPress Fitness Blogs',
    emoji: '📝',
    color: 'text-blue-300',
    bg: 'bg-blue-900/20 border-blue-700/30',
    defaultIntervalMin: 180,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'stackexchange-fitness',
    name: 'Stack Exchange: Fitness',
    emoji: '🔬',
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-700/30',
    defaultIntervalMin: 180,
    seqId: 'seq-cold-intro',
  },
  // ── New Reddit subs ────────────────────────────────────────────────────────
  {
    id: 'reddit-bodyweightfitness',
    name: 'Reddit/bodyweightfitness',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-nutrition',
    name: 'Reddit/nutrition',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-cycling',
    name: 'Reddit/cycling',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-triathlon',
    name: 'Reddit/triathlon',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-powerlifting',
    name: 'Reddit/powerlifting',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-kettlebell',
    name: 'Reddit/kettlebell',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-swimming',
    name: 'Reddit/swimming',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-mealprep',
    name: 'Reddit/MealPrepSunday',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-flexibility',
    name: 'Reddit/flexibility',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'reddit-1200isplenty',
    name: 'Reddit/1200isplenty',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  // ── New content / event sources ──────────────────────────────────────────
  {
    id: 'runsignup-races',
    name: 'RunSignUp Races',
    emoji: '🏃',
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'rss-healthline',
    name: 'Healthline: Fitness',
    emoji: '💊',
    color: 'text-teal-400',
    bg: 'bg-teal-900/20 border-teal-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'rss-menshealth',
    name: "Men's Health RSS",
    emoji: '💪',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'rss-womenshealth',
    name: "Women's Health RSS",
    emoji: '🌸',
    color: 'text-pink-400',
    bg: 'bg-pink-900/20 border-pink-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'rss-tnation',
    name: 'T-Nation RSS',
    emoji: '🏋️',
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/20 border-yellow-700/30',
    defaultIntervalMin: 90,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'eventbrite-fitness',
    name: 'Eventbrite: Fitness',
    emoji: '🎟️',
    color: 'text-orange-400',
    bg: 'bg-orange-900/20 border-orange-700/30',
    defaultIntervalMin: 240,
    seqId: 'seq-cold-intro',
    requiresKey: EVENTBRITE_KEY,
  },
  {
    id: 'product-hunt-fitness',
    name: 'Product Hunt: Health',
    emoji: '🐱',
    color: 'text-orange-300',
    bg: 'bg-orange-900/15 border-orange-700/20',
    defaultIntervalMin: 180,
    seqId: 'seq-cold-intro',
  },
  // ── New sources ────────────────────────────────────────────────────────────
  {
    id: 'bluesky',
    name: 'Bluesky Fitness',
    emoji: '🦋',
    color: 'text-sky-400',
    bg: 'bg-sky-900/20 border-sky-700/30',
    defaultIntervalMin: 60,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'substack-fitness',
    name: 'Substack Fitness Writers',
    emoji: '📮',
    color: 'text-orange-300',
    bg: 'bg-orange-900/20 border-orange-700/30',
    defaultIntervalMin: 120,
    seqId: 'seq-cold-intro',
  },
  {
    id: 'podcasts',
    name: 'Fitness Podcast Hosts',
    emoji: '🎙️',
    color: 'text-purple-400',
    bg: 'bg-purple-900/20 border-purple-700/30',
    defaultIntervalMin: 240,
    seqId: 'seq-cold-intro',
  },
]

// ── Config persistence ─────────────────────────────────────────────────────────
export function getDefaultConfig() {
  const sources = {}
  for (const src of SOURCE_CONFIGS) {
    sources[src.id] = {
      enabled: src.id !== 'usaspending',
      intervalMin: src.defaultIntervalMin,
      lastRun: null,
      addedToday: 0,
      addedAllTime: 0,
      lastAddedDate: null,
    }
  }
  return { enabled: false, sources }
}

export function getEngineConfig() {
  try {
    const raw = localStorage.getItem(ENGINE_KEY)
    if (!raw) return getDefaultConfig()
    const parsed = JSON.parse(raw)
    const defaults = getDefaultConfig()
    return { ...defaults, ...parsed, sources: { ...defaults.sources, ...parsed.sources } }
  } catch {
    return getDefaultConfig()
  }
}

export function saveEngineConfig(config) {
  localStorage.setItem(ENGINE_KEY, JSON.stringify(config))
}

// ── Dedup set ──────────────────────────────────────────────────────────────────
function getSeenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) }
  catch { return new Set() }
}

function saveSeenSet(set) {
  const arr = [...set]
  if (arr.length > 10000) arr.splice(0, arr.length - 10000)
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
}

// ── Activity log ───────────────────────────────────────────────────────────────
export function addToLog(entry) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    log.unshift({ ...entry, ts: new Date().toISOString() })
    if (log.length > 50) log.splice(50)
    localStorage.setItem(LOG_KEY, JSON.stringify(log))
  } catch {}
}

export function getLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]') }
  catch { return [] }
}

// ── Reddit OAuth helpers ───────────────────────────────────────────────────────
export const REDDIT_KEY    = 'phorm_reddit_id'
export const REDDIT_SECRET = 'phorm_reddit_secret'
const REDDIT_TOKEN_KEY     = 'phorm_reddit_token'

export function getRedditCreds() {
  return {
    clientId:     localStorage.getItem(REDDIT_KEY)    || '',
    clientSecret: localStorage.getItem(REDDIT_SECRET) || '',
  }
}

export async function getRedditToken() {
  const { clientId, clientSecret } = getRedditCreds()
  if (!clientId || !clientSecret) return null

  try {
    const cached = JSON.parse(localStorage.getItem(REDDIT_TOKEN_KEY) || 'null')
    if (cached?.expiresAt > Date.now() + 60_000) return cached.token
  } catch {}

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'web:phorm-crm:v1 (by /u/PhormCRM)',
    },
    body: 'grant_type=client_credentials&device_id=DO_NOT_TRACK_THIS_DEVICE',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.access_token) return null

  localStorage.setItem(REDDIT_TOKEN_KEY, JSON.stringify({
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }))
  return data.access_token
}

// ── Multi-proxy CORS fallback ──────────────────────────────────────────────────
// Tries each proxy in order; returns parsed JSON on first success.
const CORS_PROXIES = [
  {
    wrap: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    parse: async (r) => { const j = await r.json(); return JSON.parse(j.contents) },
  },
  {
    wrap: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    parse: (r) => r.json(),
  },
  {
    wrap: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    parse: (r) => r.json(),
  },
  {
    wrap: (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
    parse: (r) => r.json(),
  },
  {
    wrap: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    parse: (r) => r.json(),
  },
]

async function fetchWithProxy(url) {
  let lastErr
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy.wrap(url), { signal: AbortSignal.timeout(8000) })
      if (!res.ok) { lastErr = new Error(`proxy ${res.status}`); continue }
      return await proxy.parse(res)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('All CORS proxies failed')
}

// ── Per-source fetch functions ─────────────────────────────────────────────────
const HN_KEYWORDS = [
  'protein', 'creatine', 'fitness supplement', 'pre workout', 'weight loss',
  'muscle building', 'marathon training', 'crossfit', 'bodybuilding', 'nutrition',
]

const REDDIT_KEYWORDS = [
  'supplement', 'protein powder', 'pre workout', 'creatine', 'fat burner',
  'muscle gain', 'whey protein', 'BCAAs', 'weight loss stack',
]

const DEVTO_TAGS = ['fitness', 'health', 'running', 'workout', 'nutrition']

const MASTODON_TAGS = ['fitness', 'workout', 'nutrition', 'running', 'supplements', 'weightloss']

const GH_QUERIES = [
  'fitness coach', 'personal trainer', 'nutrition coach',
  'supplement reviewer', 'bodybuilder', 'powerlifter',
  'crossfit athlete', 'marathon runner', 'weight loss coach',
]

async function fetchHN() {
  const kw = HN_KEYWORDS[Math.floor(Math.random() * HN_KEYWORDS.length)]
  const since = Math.floor(Date.now() / 1000 - 7 * 86400)
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(kw)}&tags=story&hitsPerPage=15&numericFilters=created_at_i>=${since}`
  )
  if (!res.ok) throw new Error(`HN ${res.status}`)
  const data = await res.json()
  return (data.hits || [])
    .filter(h => h.author)
    .map(h => ({
      dedupKey: `hn:${h.author}`,
      name: h.author,
      social: `hn:${h.author}`,
      notes: `Auto HN: "${(h.title || '').slice(0, 100)}" (kw: ${kw})`,
      tags: ['auto-feed', 'hackernews', 'tech-fitness'],
    }))
}

async function fetchReddit(subreddit) {
  const kw = REDDIT_KEYWORDS[Math.floor(Math.random() * REDDIT_KEYWORDS.length)]
  let data

  // Strategy 1: Reddit OAuth (fast, no proxy, no rate limits if credentials saved)
  const token = await getRedditToken().catch(() => null)
  if (token) {
    try {
      const url = `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(kw)}&sort=new&t=week&limit=15&restrict_sr=1&raw_json=1`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'web:phorm-crm:v1 (by /u/PhormCRM)',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) data = await res.json()
    } catch { /* fall through */ }
  }

  // Strategy 2: Multi-proxy JSON search
  if (!data) {
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(kw)}&sort=new&t=week&limit=15&restrict_sr=1&raw_json=1`
    data = await fetchWithProxy(url).catch(() => null)
  }

  // Strategy 3: /new.json — no search query needed, simpler endpoint
  if (!data) {
    data = await fetchWithProxy(`https://www.reddit.com/r/${subreddit}/new.json?limit=15&raw_json=1`).catch(() => null)
  }

  // Strategy 4: RSS/Atom feed — parsed as XML, works when JSON endpoints are blocked
  if (!data) {
    try {
      const rssStr = await fetchTextWithProxy(`https://www.reddit.com/r/${subreddit}/new.rss`)
      const doc = new DOMParser().parseFromString(rssStr, 'application/xml')
      const entries = Array.from(doc.querySelectorAll('entry'))
      const authors = new Map()
      for (const entry of entries) {
        const author = entry.querySelector('author name')?.textContent?.replace('/u/', '').trim()
        const title = entry.querySelector('title')?.textContent?.trim()
        if (!author || author === '[deleted]' || authors.has(author)) continue
        authors.set(author, {
          dedupKey: `reddit:${author}`,
          name: author,
          social: `u/${author}`,
          notes: `Auto Reddit r/${subreddit}: "${(title || '').slice(0, 100)}"`,
          tags: ['auto-feed', 'reddit', 'intent-signal'],
        })
      }
      return [...authors.values()]
    } catch { /* give up */ }
  }

  return (data?.data?.children || [])
    .map(c => c.data)
    .filter(p => p.author && p.author !== '[deleted]' && p.author !== 'AutoModerator')
    .map(p => ({
      dedupKey: `reddit:${p.author}`,
      name: p.author,
      social: `u/${p.author}`,
      notes: `Auto Reddit r/${subreddit}: "${(p.title || '').slice(0, 100)}"`,
      tags: ['auto-feed', 'reddit', 'intent-signal'],
    }))
}

async function fetchDevTo() {
  const tag = DEVTO_TAGS[Math.floor(Math.random() * DEVTO_TAGS.length)]
  const url = `https://dev.to/api/articles?tag=${tag}&per_page=15&top=7`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(url)
  return (Array.isArray(data) ? data : [])
    .filter(a => a.user?.username)
    .map(a => ({
      dedupKey: `devto:${a.user.username}`,
      name: a.user.name || a.user.username,
      social: `@${a.user.username}`,
      notes: `Auto Dev.to #${tag}: "${(a.title || '').slice(0, 100)}"`,
      tags: ['auto-feed', 'devto', 'tech-fitness'],
    }))
}

async function fetchMastodon() {
  const tag = MASTODON_TAGS[Math.floor(Math.random() * MASTODON_TAGS.length)]
  const url = `https://mastodon.social/api/v1/timelines/tag/${tag}?limit=15`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(url).catch(() => [])
  return (Array.isArray(data) ? data : [])
    .filter(p => p.account?.username)
    .map(p => ({
      dedupKey: `mastodon:${p.account.username}`,
      name: p.account.display_name || p.account.username,
      social: `@${p.account.username}@mastodon.social`,
      notes: `Auto Mastodon #${tag}: "${(p.content || '').replace(/<[^>]*>/g, '').slice(0, 100)}"`,
      tags: ['auto-feed', 'mastodon', tag],
    }))
}

async function fetchGitHub() {
  const q = GH_QUERIES[Math.floor(Math.random() * GH_QUERIES.length)]
  let data = null
  try {
    const res = await fetch(
      `https://api.github.com/search/users?q=${encodeURIComponent(q)}+in:bio&per_page=10&sort=joined`,
      { headers: { Accept: 'application/vnd.github.v3+json' }, signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) data = await res.json()
  } catch { /* rate-limited or network error */ }
  return (data?.items || []).map(u => ({
    dedupKey: `github:${u.login}`,
    name: u.login,
    social: `github:${u.login}`,
    notes: `Auto GitHub bio "${q}": ${u.html_url}`,
    tags: ['auto-feed', 'github-verified', 'tech-fitness'],
  }))
}

async function fetchUSASpending() {
  const today = new Date().toISOString().split('T')[0]
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]
  const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        time_period: [{ start_date: sixMonthsAgo, end_date: today }],
        award_type_codes: ['A', 'B', 'C', 'D'],
        naics_codes: ['713940', '812191', '446191', '424490', '325411'],
      },
      fields: ['Recipient Name', 'Award Amount', 'Awarding Agency Name'],
      page: 1, limit: 15, sort: 'Award Amount', order: 'desc',
    }),
  })
  if (!res.ok) throw new Error(`USASpending ${res.status}`)
  const data = await res.json()
  return (data.results || [])
    .filter(r => r['Recipient Name'])
    .map(r => ({
      dedupKey: `usaspending:${r['Recipient Name'].toLowerCase().replace(/\s+/g, '-')}`,
      name: r['Recipient Name'],
      social: '',
      notes: `Auto USASpending: award ${r['Award Amount'] ? '$' + Number(r['Award Amount']).toLocaleString() : 'n/a'} — ${r['Awarding Agency Name'] || ''}`,
      tags: ['auto-feed', 'federal_award', 'usaspending', 'intent-signal', 'b2b-prospect'],
    }))
}

// ── Text proxy (for RSS/XML feeds) ────────────────────────────────────────────
async function fetchTextWithProxy(url) {
  const res = await fetch(
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(10000) }
  )
  if (!res.ok) throw new Error(`allorigins ${res.status}`)
  const j = await res.json()
  if (!j.contents) throw new Error('empty contents from proxy')
  return j.contents
}

// ── YouTube creator search ─────────────────────────────────────────────────────
const YT_QUERIES = [
  '1st phorm review',
  'fitness supplement review',
  'best protein powder review',
  'pre workout supplement honest review',
  'weight loss supplement stack',
  '1stphorm results',
  'fitness nutrition review channel',
]

const EMAIL_RE = /[\w.+-]+@(?!example|domain|email|your|youremail)[\w.-]+\.[a-z]{2,}/gi

async function fetchYouTube() {
  const apiKey = localStorage.getItem(YOUTUBE_KEY)
  if (!apiKey) return []
  const q = YT_QUERIES[Math.floor(Math.random() * YT_QUERIES.length)]
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=25&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`YouTube ${res.status}`)
  const data = await res.json()
  const channels = new Map()
  const channelIds = []
  for (const item of (data.items || [])) {
    const channelId = item.snippet?.channelId
    const channelTitle = item.snippet?.channelTitle
    if (!channelId || !channelTitle || channels.has(channelId)) continue
    channels.set(channelId, {
      dedupKey: `youtube:${channelId}`,
      name: channelTitle,
      social: `youtube:${channelId}`,
      notes: `Auto YouTube: "${(item.snippet?.title || q).slice(0, 90)}"`,
      tags: ['auto-feed', 'youtube', 'content-creator', 'fitness'],
    })
    channelIds.push(channelId)
  }

  // Fetch channel descriptions to extract business emails
  if (channelIds.length > 0) {
    try {
      const ids = channelIds.slice(0, 10).join(',')
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&id=${ids}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (chRes.ok) {
        const chData = await chRes.json()
        for (const ch of (chData.items || [])) {
          const entry = channels.get(ch.id)
          if (!entry) continue
          const desc = (ch.snippet?.description || '') + ' ' + (ch.brandingSettings?.channel?.description || '')
          const emails = (desc.match(EMAIL_RE) || []).filter(e => !e.includes('noreply'))
          if (emails[0]) {
            channels.set(ch.id, { ...entry, email: emails[0].toLowerCase() })
          }
          if (ch.snippet?.customUrl) {
            channels.set(ch.id, { ...(channels.get(ch.id) || entry), social: `youtube:${ch.snippet.customUrl}` })
          }
        }
      }
    } catch { /* enrichment is best-effort */ }
  }

  return [...channels.values()]
}

// ── Medium RSS writer scrape ───────────────────────────────────────────────────
const MEDIUM_TAGS = ['fitness', 'nutrition', 'supplements', 'weight-loss', 'running', 'workout', 'bodybuilding']

async function fetchMedium() {
  const tag = MEDIUM_TAGS[Math.floor(Math.random() * MEDIUM_TAGS.length)]
  const xmlStr = await fetchTextWithProxy(`https://medium.com/feed/tag/${tag}`)
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  const seen = new Map()
  for (const item of items) {
    const DC_NS = 'http://purl.org/dc/elements/1.1/'
    const creator =
      item.getElementsByTagNameNS(DC_NS, 'creator')[0]?.textContent?.trim() ||
      item.querySelector('author')?.textContent?.trim()
    if (!creator || seen.has(creator)) continue
    seen.set(creator, {
      dedupKey: `medium:${creator.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: creator,
      social: `medium:@${creator.toLowerCase().replace(/\s+/g, '')}`,
      notes: `Auto Medium #${tag}: fitness/nutrition writer`,
      tags: ['auto-feed', 'medium', 'content-creator', 'blogger'],
    })
  }
  return [...seen.values()]
}

// ── Google News RSS (no key, unlimited) ───────────────────────────────────────
const GNEWS_RSS_QUERIES = [
  'fitness supplements', 'protein powder review', 'weight loss supplement',
  'creatine supplement', '1st phorm', 'pre workout supplement',
  'muscle building nutrition', 'workout nutrition guide',
]

async function fetchGoogleNewsRSS() {
  const q = GNEWS_RSS_QUERIES[Math.floor(Math.random() * GNEWS_RSS_QUERIES.length)]
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
  const xmlStr = await fetchTextWithProxy(rssUrl)
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  const seen = new Map()
  for (const item of items) {
    const title = item.querySelector('title')?.textContent?.trim()
    const sourceEl = item.querySelector('source')
    const publisher = sourceEl?.textContent?.trim()
    const sourceUrl = sourceEl?.getAttribute('url') || ''
    if (!publisher || seen.has(publisher)) continue
    const domain = sourceUrl
      ? (() => { try { return new URL(sourceUrl).hostname.replace('www.', '') } catch { return '' } })()
      : ''
    seen.set(publisher, {
      dedupKey: `google-news:${publisher.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: publisher,
      social: domain,
      notes: `Auto Google News: "${(title || q).slice(0, 100)}"`,
      tags: ['auto-feed', 'google-news', 'media-contact', 'news-publisher'],
    })
  }
  return [...seen.values()]
}

// ── NewsAPI (free key, 100 req/day, CORS via proxy) ───────────────────────────
const NEWSAPI_QUERIES = [
  'fitness supplements', 'protein powder', 'weight loss supplement',
  '1st phorm', 'workout nutrition', 'pre workout', 'creatine supplement',
]

async function fetchNewsAPI() {
  const apiKey = localStorage.getItem(NEWSAPI_KEY)
  if (!apiKey) return []
  const q = NEWSAPI_QUERIES[Math.floor(Math.random() * NEWSAPI_QUERIES.length)]
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`
  // Free tier blocks CORS — route through allorigins, fall back to direct
  let data = null
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) })
    if (res.ok) data = JSON.parse((await res.json()).contents || '{}')
  } catch { /* fall through */ }
  if (!data) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (res?.ok) data = await res.json().catch(() => null)
  }
  if (!data || data.status !== 'ok') return []
  const seen = new Map()
  for (const article of (data.articles || [])) {
    const author = article.author || article.source?.name
    if (!author || seen.has(author)) continue
    seen.set(author, {
      dedupKey: `newsapi:${author.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: author,
      social: article.source?.name || '',
      notes: `Auto NewsAPI: "${(article.title || q).slice(0, 100)}"`,
      tags: ['auto-feed', 'newsapi', 'media-contact', 'content-creator'],
    })
  }
  return [...seen.values()]
}

// ── GNews API (free key, 100 req/day, CORS supported) ─────────────────────────
const GNEWS_API_QUERIES = [
  'fitness supplements', 'protein powder supplement', 'weight loss supplement',
  'muscle building nutrition', 'workout supplement review', '1st phorm supplement',
]

async function fetchGNews() {
  const apiKey = localStorage.getItem(GNEWS_KEY)
  if (!apiKey) return []
  const q = GNEWS_API_QUERIES[Math.floor(Math.random() * GNEWS_API_QUERIES.length)]
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=20&token=${apiKey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`GNews ${res.status}`)
  const data = await res.json()
  const seen = new Map()
  for (const article of (data.articles || [])) {
    const publisher = article.source?.name
    if (!publisher || seen.has(publisher)) continue
    const domain = article.source?.url
      ? (() => { try { return new URL(article.source.url).hostname.replace('www.', '') } catch { return '' } })()
      : ''
    seen.set(publisher, {
      dedupKey: `gnews:${publisher.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: publisher,
      social: domain,
      notes: `Auto GNews: "${(article.title || q).slice(0, 100)}"`,
      tags: ['auto-feed', 'gnews', 'media-contact', 'news-publisher'],
    })
  }
  return [...seen.values()]
}

// ── WordPress.com public blog search (no auth needed) ─────────────────────────
const WP_QUERIES = [
  'fitness supplements', 'protein powder', 'weight loss supplements',
  'pre workout review', 'creatine benefits', 'muscle building diet',
  'nutrition coach', '1st phorm', 'workout nutrition',
]

async function fetchWordPressFitness() {
  const q = WP_QUERIES[Math.floor(Math.random() * WP_QUERIES.length)]
  const url = `https://public-api.wordpress.com/rest/v1.1/read/search?q=${encodeURIComponent(q)}&number=20`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(url).catch(() => null)
  const seen = new Map()
  for (const post of (data?.posts || [])) {
    const author = post.author?.login || post.author?.name
    if (!author || seen.has(author)) continue
    seen.set(author, {
      dedupKey: `wordpress:${author.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: post.author?.name || author,
      social: post.author?.profile_URL || `wordpress:${author}`,
      notes: `Auto WordPress: "${(post.title || q).slice(0, 100)}"`,
      tags: ['auto-feed', 'wordpress', 'blogger', 'fitness'],
    })
  }
  return [...seen.values()]
}

// ── Stack Exchange Fitness (no auth, generous free tier) ──────────────────────
const SE_TAGS = ['nutrition', 'supplements', 'protein', 'weight-loss', 'strength-training']

async function fetchStackFitness() {
  const tag = SE_TAGS[Math.floor(Math.random() * SE_TAGS.length)]
  const url = `https://api.stackexchange.com/2.3/questions?tagged=${tag}&site=fitness&sort=activity&pagesize=20&filter=default`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(url).catch(() => null)
  const seen = new Map()
  for (const q of (data?.items || [])) {
    const user = q.owner?.display_name
    if (!user || q.owner?.user_type === 'does_not_exist' || seen.has(user)) continue
    seen.set(user, {
      dedupKey: `stackex:${user.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: user,
      social: q.owner?.link || '',
      notes: `Auto Stack Exchange Fitness: "${(q.title || '').slice(0, 100)}"`,
      tags: ['auto-feed', 'stack-exchange', 'fitness-enthusiast', tag],
    })
  }
  return [...seen.values()]
}

// ── RunSignUp race registrations (public API, no auth required) ───────────────
async function fetchRunSignUp() {
  const today = new Date().toISOString().split('T')[0]
  const url = `https://runsignup.com/Rest/races?format=json&results_per_page=25&sort=date-asc&start_date_from=${today}&future_events_only=T`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(url).catch(() => null)
  const seen = new Map()
  for (const entry of (data?.races || [])) {
    const race = entry.race || entry
    const orgName = race.race_director_name || race.name
    if (!orgName || seen.has(orgName)) continue
    const city = race.address?.city || ''
    const state = race.address?.state || ''
    const date = entry.next_date?.race_date || ''
    seen.set(orgName, {
      dedupKey: `runsignup:${orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)}`,
      name: orgName,
      social: race.url || '',
      notes: `Auto RunSignUp: "${(race.name || orgName).slice(0, 80)}"${date ? ` on ${date}` : ''}${city ? ` in ${city}, ${state}` : ''}`,
      tags: ['auto-feed', 'runsignup', 'runner', 'endurance', 'event-organizer'],
    })
  }
  return [...seen.values()]
}

// ── Fitness magazine / blog RSS feeds ────────────────────────────────────────
const FITNESS_RSS_FEEDS = {
  healthline:   ['https://www.healthline.com/rss/fitness', 'https://www.healthline.com/rss/nutrition', 'https://www.healthline.com/rss/weight-loss'],
  menshealth:   ['https://www.menshealth.com/rss/all.xml/'],
  womenshealth: ['https://www.womenshealthmag.com/rss/all.xml'],
  tnation:      ['https://www.t-nation.com/feed/', 'https://feeds.feedburner.com/T-Nation'],
}

const FITNESS_RSS_TAGS = {
  healthline:   ['healthline', 'health', 'fitness', 'content-creator'],
  menshealth:   ['menshealth', 'fitness', 'muscle', 'content-creator'],
  womenshealth: ['womenshealth', 'fitness', 'health', 'content-creator'],
  tnation:      ['tnation', 'powerlifting', 'bodybuilding', 'muscle', 'content-creator'],
}

async function fetchFitnessRSS(source) {
  const urls = FITNESS_RSS_FEEDS[source] || []
  const feedUrl = urls[Math.floor(Math.random() * urls.length)]
  const xmlStr = await fetchTextWithProxy(feedUrl).catch(() => null)
  if (!xmlStr) return []
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  const DC_NS = 'http://purl.org/dc/elements/1.1/'
  const seen = new Map()
  for (const item of items) {
    const author =
      item.getElementsByTagNameNS(DC_NS, 'creator')[0]?.textContent?.trim() ||
      item.querySelector('author')?.textContent?.trim()
    const title = item.querySelector('title')?.textContent?.trim()
    if (!author || author.length < 2 || seen.has(author)) continue
    seen.set(author, {
      dedupKey: `${source}:${author.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)}`,
      name: author,
      social: `${source}.com`,
      notes: `Auto ${source}: "${(title || '').slice(0, 100)}"`,
      tags: ['auto-feed', ...(FITNESS_RSS_TAGS[source] || ['fitness'])],
    })
  }
  return [...seen.values()]
}

// ── Eventbrite fitness events (requires API key) ──────────────────────────────
async function fetchEventbrite() {
  const apiKey = localStorage.getItem(EVENTBRITE_KEY)
  if (!apiKey) return []
  const today = new Date().toISOString().split('T')[0]
  const qs = ['fitness', 'marathon', 'crossfit', 'nutrition', 'supplement', 'wellness', 'obstacle race']
  const q = qs[Math.floor(Math.random() * qs.length)]
  const url = `https://www.eventbriteapi.com/v3/events/search/?token=${apiKey}&q=${encodeURIComponent(q)}&start_date.range_start=${today}T00:00:00Z&expand=organizer&sort_by=date&page_size=50`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through */ }
  if (!data) data = await fetchWithProxy(url).catch(() => null)
  if (!data?.events) return []
  const seen = new Map()
  for (const event of data.events) {
    const orgName = event.organizer?.name
    if (!orgName || seen.has(orgName)) continue
    const city = event.venue?.address?.city || ''
    const date = event.start?.local?.split('T')[0] || ''
    seen.set(orgName, {
      dedupKey: `eventbrite:${orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)}`,
      name: orgName,
      social: event.organizer?.website || event.url || '',
      notes: `Auto Eventbrite: "${(event.name?.text || orgName).slice(0, 100)}"${date ? ` on ${date}` : ''}${city ? ` in ${city}` : ''}`,
      tags: ['auto-feed', 'eventbrite', 'event-organizer', 'fitness', 'runner'],
    })
  }
  return [...seen.values()]
}

// ── Bluesky fitness hashtags (public AT Protocol API — no auth) ──────────────
const BLUESKY_TAGS = ['fitness', 'workout', 'supplements', 'nutrition', 'running', 'weightloss', 'gymlife', 'protein']

async function fetchBluesky() {
  const tag = BLUESKY_TAGS[Math.floor(Math.random() * BLUESKY_TAGS.length)]
  let data = null
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%23${tag}&limit=25`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%23${tag}&limit=25`).catch(() => null)
  const seen = new Map()
  for (const post of (data?.posts || [])) {
    const author = post.author
    if (!author?.handle || seen.has(author.handle)) continue
    seen.set(author.handle, {
      dedupKey: `bluesky:${author.handle}`,
      name: author.displayName || author.handle,
      social: `@${author.handle}`,
      notes: `Auto Bluesky #${tag}: "${(post.record?.text || '').replace(/\n/g, ' ').slice(0, 100)}"`,
      tags: ['auto-feed', 'bluesky', 'fitness', tag],
    })
  }
  return [...seen.values()]
}

// ── Substack fitness newsletters (RSS, no auth) ───────────────────────────────
const SUBSTACK_FEEDS = [
  'https://peakperformancemag.substack.com/feed',
  'https://evidencemag.substack.com/feed',
  'https://rpstrength.substack.com/feed',
  'https://tdeecalculator.substack.com/feed',
  'https://fitnesswriter.substack.com/feed',
  'https://nutritionscience.substack.com/feed',
  'https://strengthcoach.substack.com/feed',
]

async function fetchSubstack() {
  const feedUrl = SUBSTACK_FEEDS[Math.floor(Math.random() * SUBSTACK_FEEDS.length)]
  const xmlStr = await fetchTextWithProxy(feedUrl).catch(() => null)
  if (!xmlStr) return []
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  const DC_NS = 'http://purl.org/dc/elements/1.1/'
  const seen = new Map()
  for (const item of items) {
    const creator =
      item.getElementsByTagNameNS(DC_NS, 'creator')[0]?.textContent?.trim() ||
      item.querySelector('author')?.textContent?.trim()
    const title = item.querySelector('title')?.textContent?.trim()
    if (!creator || seen.has(creator)) continue
    const domain = (() => { try { return new URL(feedUrl).hostname } catch { return 'substack.com' } })()
    seen.set(creator, {
      dedupKey: `substack:${creator.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)}`,
      name: creator,
      social: domain,
      notes: `Auto Substack: "${(title || '').slice(0, 100)}" from ${domain}`,
      tags: ['auto-feed', 'substack', 'newsletter-writer', 'fitness', 'content-creator'],
    })
  }
  return [...seen.values()]
}

// ── iTunes / Apple Podcast fitness host search ────────────────────────────────
const PODCAST_QUERIES = [
  'fitness supplements', 'nutrition podcast', 'workout motivation',
  'bodybuilding podcast', 'running marathon', 'health wellness',
  'personal trainer tips', 'weight loss tips',
]

async function fetchPodcasts() {
  const q = PODCAST_QUERIES[Math.floor(Math.random() * PODCAST_QUERIES.length)]
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&entity=podcast&limit=20&country=us`
  let data = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) data = await res.json()
  } catch { /* fall through to proxy */ }
  if (!data) data = await fetchWithProxy(url).catch(() => null)
  const seen = new Map()
  for (const pod of (data?.results || [])) {
    const artist = pod.artistName
    if (!artist || seen.has(artist)) continue
    seen.set(artist, {
      dedupKey: `podcast:${artist.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)}`,
      name: artist,
      social: pod.collectionViewUrl || pod.trackViewUrl || '',
      notes: `Auto Podcast: "${(pod.trackName || artist).slice(0, 100)}" — ${pod.primaryGenreName || 'Fitness'}`,
      tags: ['auto-feed', 'podcaster', 'fitness', 'content-creator'],
    })
  }
  return [...seen.values()]
}

// ── Product Hunt RSS (health & fitness) ───────────────────────────────────────
async function fetchProductHuntFitness() {
  const xmlStr = await fetchTextWithProxy('https://www.producthunt.com/feed?topic=health-and-fitness').catch(() => null)
  if (!xmlStr) return []
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  const DC_NS = 'http://purl.org/dc/elements/1.1/'
  const seen = new Map()
  for (const item of items) {
    const title = item.querySelector('title')?.textContent?.trim()
    const link = item.querySelector('link')?.textContent?.trim()
    const creator = item.getElementsByTagNameNS(DC_NS, 'creator')[0]?.textContent?.trim() || title
    if (!creator || seen.has(creator)) continue
    seen.set(creator, {
      dedupKey: `producthunt:${creator.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)}`,
      name: creator,
      social: link || 'producthunt.com',
      notes: `Auto Product Hunt: "${(title || '').slice(0, 100)}"`,
      tags: ['auto-feed', 'producthunt', 'health', 'fitness', 'entrepreneur', 'content-creator'],
    })
  }
  return [...seen.values()]
}

const FETCH_FNS = {
  'hn':                          fetchHN,
  'reddit-fitness':              () => fetchReddit('fitness'),
  'reddit-loseit':               () => fetchReddit('loseit'),
  'reddit-supplements':          () => fetchReddit('Supplements'),
  'reddit-running':              () => fetchReddit('running'),
  'reddit-gainit':               () => fetchReddit('gainit'),
  'reddit-xxfitness':            () => fetchReddit('xxfitness'),
  'devto':                       fetchDevTo,
  'mastodon':                    fetchMastodon,
  'github':                      fetchGitHub,
  'usaspending':                 fetchUSASpending,
  'youtube':                     fetchYouTube,
  'medium':                      fetchMedium,
  'reddit-crossfit':             () => fetchReddit('crossfit'),
  'reddit-keto':                 () => fetchReddit('keto'),
  'reddit-1stphorm':             () => fetchReddit('1stphorm'),
  'reddit-naturalbodybuilding':  () => fetchReddit('naturalbodybuilding'),
  'google-news':                 fetchGoogleNewsRSS,
  'newsapi':                     fetchNewsAPI,
  'gnews':                       fetchGNews,
  'reddit-intermittentfasting':  () => fetchReddit('intermittentfasting'),
  'reddit-homegym':              () => fetchReddit('homegym'),
  'reddit-weightraining':        () => fetchReddit('weighttraining'),
  'reddit-hiit':                 () => fetchReddit('hiit'),
  'reddit-veganfitness':         () => fetchReddit('veganfitness'),
  'reddit-leangains':            () => fetchReddit('leangains'),
  'wordpress-fitness':           fetchWordPressFitness,
  'stackexchange-fitness':       fetchStackFitness,
  'reddit-bodyweightfitness':    () => fetchReddit('bodyweightfitness'),
  'reddit-nutrition':            () => fetchReddit('nutrition'),
  'reddit-cycling':              () => fetchReddit('cycling'),
  'reddit-triathlon':            () => fetchReddit('triathlon'),
  'reddit-powerlifting':         () => fetchReddit('powerlifting'),
  'reddit-kettlebell':           () => fetchReddit('kettlebell'),
  'reddit-swimming':             () => fetchReddit('swimming'),
  'reddit-mealprep':             () => fetchReddit('MealPrepSunday'),
  'reddit-flexibility':          () => fetchReddit('flexibility'),
  'reddit-1200isplenty':         () => fetchReddit('1200isplenty'),
  'runsignup-races':             fetchRunSignUp,
  'rss-healthline':              () => fetchFitnessRSS('healthline'),
  'rss-menshealth':              () => fetchFitnessRSS('menshealth'),
  'rss-womenshealth':            () => fetchFitnessRSS('womenshealth'),
  'rss-tnation':                 () => fetchFitnessRSS('tnation'),
  'eventbrite-fitness':          fetchEventbrite,
  'product-hunt-fitness':        fetchProductHuntFitness,
  'bluesky':                     fetchBluesky,
  'substack-fitness':            fetchSubstack,
  'podcasts':                    fetchPodcasts,
}

// ── Main export: run a source, dedup, add contacts ─────────────────────────────
export async function runSourceWithDedup(sourceId, existingSocials, addContactFn, addEnrollmentFn) {
  const src = SOURCE_CONFIGS.find(s => s.id === sourceId)
  if (!src) throw new Error(`Unknown source: ${sourceId}`)

  const fetchFn = FETCH_FNS[sourceId]
  if (!fetchFn) throw new Error(`No fetch fn for: ${sourceId}`)

  const candidates = await fetchFn()
  const seen = getSeenSet()
  let added = 0

  for (const c of candidates) {
    if (seen.has(c.dedupKey)) continue
    if (c.social && existingSocials.has(c.social)) continue

    const id = addContactFn({
      name: c.name,
      email: c.email  || '',
      phone: c.phone  || '',
      social: c.social || '',
      source: 'Other',
      status: 'New Lead',
      notes: c.notes,
      tags: c.tags,
    })

    if (src.seqId && id) {
      addEnrollmentFn({ contactId: id, sequenceId: src.seqId })
    }

    seen.add(c.dedupKey)
    if (c.social) existingSocials.add(c.social)
    added++
  }

  saveSeenSet(seen)

  // Update per-source stats in engine config
  const config = getEngineConfig()
  const today = new Date().toISOString().split('T')[0]
  const srcCfg = config.sources[sourceId] || {}
  const isNewDay = srcCfg.lastAddedDate !== today
  config.sources[sourceId] = {
    ...srcCfg,
    lastRun: new Date().toISOString(),
    addedToday: isNewDay ? added : (srcCfg.addedToday || 0) + added,
    lastAddedDate: today,
    addedAllTime: (srcCfg.addedAllTime || 0) + added,
  }
  saveEngineConfig(config)

  addToLog({ source: src.name, count: added, ok: true })

  return { added }
}
