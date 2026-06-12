// Auto-acquisition engine: source configs, fetch functions, dedup, config persistence

const ENGINE_KEY = 'phorm_auto_engine'
const SEEN_KEY   = 'phorm_auto_seen'
const LOG_KEY    = 'phorm_auto_log'

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
  const direct = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(kw)}&sort=new&t=week&limit=15&restrict_sr=1`
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(direct)}`)
  if (!res.ok) throw new Error(`Reddit ${res.status}`)
  const wrapper = await res.json()
  const data = JSON.parse(wrapper.contents)
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

const FETCH_FNS = {
  'hn':                fetchHN,
  'reddit-fitness':    () => fetchReddit('fitness'),
  'reddit-loseit':     () => fetchReddit('loseit'),
  'reddit-supplements':() => fetchReddit('Supplements'),
  'devto':             fetchDevTo,
  'mastodon':          fetchMastodon,
  'github':            fetchGitHub,
  'usaspending':       fetchUSASpending,
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
