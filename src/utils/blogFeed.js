// Blog feed utility — fetches and caches RSS articles from Healthline and Precision Nutrition.
// Cache TTL: 12h. Articles sorted newest-first, deduplicated by title.

const BLOG_CACHE_KEY = 'phorm_blog_cache_v2'
const BLOG_CACHE_TTL = 12 * 60 * 60 * 1000

const CORS_PROXY = 'https://api.allorigins.win/get?url='

export const BLOG_FEEDS = [
  { name: 'Healthline Fitness',      url: 'https://www.healthline.com/rss/fitness-exercise' },
  { name: 'Healthline Nutrition',    url: 'https://www.healthline.com/rss/nutrition' },
  { name: 'Healthline Weight Loss',  url: 'https://www.healthline.com/rss/weight-loss' },
  { name: 'Precision Nutrition',     url: 'https://www.precisionnutrition.com/feed' },
]

function parseRSS(xmlText) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
    return Array.from(doc.querySelectorAll('item')).map(item => ({
      title:   item.querySelector('title')?.textContent?.trim() || '',
      link:    item.querySelector('link')?.textContent?.trim() || '',
      summary: item.querySelector('description')?.textContent?.replace(/<[^>]*>/g, '').trim().slice(0, 240) || '',
      pubDate: item.querySelector('pubDate')?.textContent?.trim() || '',
    })).filter(a => a.title && a.link)
  } catch { return [] }
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(feed.url)}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const articles = parseRSS(json.contents || '')
    return articles.map(a => ({ ...a, source: feed.name }))
  } catch { return [] }
}

export async function fetchBlogArticles(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedArticles()
    if (cached) return cached
  }

  const results = await Promise.all(BLOG_FEEDS.map(fetchFeed))
  const seen = new Set()
  const articles = results
    .flat()
    .filter(a => {
      if (seen.has(a.title)) return false
      seen.add(a.title)
      return true
    })
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 60)

  if (articles.length) {
    localStorage.setItem(BLOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), articles }))
  }
  return articles
}

export function getCachedArticles() {
  try {
    const raw = JSON.parse(localStorage.getItem(BLOG_CACHE_KEY) || 'null')
    if (!raw || Date.now() - raw.ts > BLOG_CACHE_TTL) return null
    return raw.articles
  } catch { return null }
}
