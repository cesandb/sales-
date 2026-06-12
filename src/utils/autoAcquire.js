// Auto-acquisition engine: source configs, fetch functions, dedup, config persistence

const ENGINE_KEY = 'phorm_auto_engine'
const SEEN_KEY   = 'phorm_auto_seen'
const LOG_KEY    = 'phorm_auto_log'

export const YOUTUBE_KEY = 'phorm_youtube_key'

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
  if (arr.length > 5000) arr.splice(0, arr.length - 5000)
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
  'fitness+supplement', 'workout+nutrition', 'marathon+training', 'crossfit+gym',
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
  const res = await fetch(`https://dev.to/api/articles?tag=${tag}&per_page=15&top=7`)
  if (!res.ok) throw new Error(`DevTo ${res.status}`)
  const data = await res.json()
  return data
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
  const res = await fetch(`https://mastodon.social/api/v1/timelines/tag/${tag}?limit=15`)
  if (!res.ok) throw new Error(`Mastodon ${res.status}`)
  const data = await res.json()
  return data
    .filter(p => p.account?.username)
    .map(p => ({
      dedupKey: `mastodon:${p.account.username}`,
      name: p.account.display_name || p.account.username,
      social: `@${p.account.username}@mastodon.social`,
      notes: `Auto Mastodon #${tag}: "${p.content.replace(/<[^>]*>/g, '').slice(0, 100)}"`,
      tags: ['auto-feed', 'mastodon', tag],
    }))
}

async function fetchGitHub() {
  const q = GH_QUERIES[Math.floor(Math.random() * GH_QUERIES.length)]
  const res = await fetch(
    `https://api.github.com/search/users?q=${encodeURIComponent(q)}+in:bio&per_page=10&sort=joined`,
    { headers: { Accept: 'application/vnd.github.v3+json' } }
  )
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const data = await res.json()
  return (data.items || []).map(u => ({
    dedupKey: `github:${u.login}`,
    name: u.login,
    social: `github:${u.login}`,
    notes: `Auto GitHub: fitness-bio user — ${u.html_url}`,
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

async function fetchYouTube() {
  const apiKey = localStorage.getItem(YOUTUBE_KEY)
  if (!apiKey) return []
  const q = YT_QUERIES[Math.floor(Math.random() * YT_QUERIES.length)]
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=25&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`YouTube ${res.status}`)
  const data = await res.json()
  const channels = new Map()
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
