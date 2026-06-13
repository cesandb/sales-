// Bitly link tracker — creates short affiliate links and polls for click counts.
// Requires a Bitly Generic Access Token stored in localStorage.

export const BITLY_KEY  = 'phorm_bitly_key'
const LINKS_KEY = 'phorm_bitly_links_v1'

export function getBitlyKey() { return localStorage.getItem(BITLY_KEY) || '' }

function getLinks() {
  try { return JSON.parse(localStorage.getItem(LINKS_KEY) || '{}') }
  catch { return {} }
}
function saveLinks(l) { localStorage.setItem(LINKS_KEY, JSON.stringify(l)) }

// Returns an existing short link or creates a new one via Bitly API.
export async function createBitlyLink(longUrl, contactId) {
  const token = getBitlyKey()
  if (!token) return null

  const cacheKey = `${contactId}::${longUrl}`
  const existing = getLinks()[cacheKey]
  if (existing) return existing

  try {
    const res = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ long_url: longUrl }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const entry = { id: data.id, shortUrl: data.link, clicks: 0, lastChecked: null, cacheKey, contactId }
    const links = getLinks()
    links[cacheKey] = entry
    saveLinks(links)
    return entry
  } catch { return null }
}

// Polls Bitly for updated click counts. Returns array of { cacheKey, contactId, prev, clicks }.
export async function refreshBitlyClicks() {
  const token = getBitlyKey()
  if (!token) return []

  const links = getLinks()
  const keys  = Object.keys(links)
  if (!keys.length) return []

  const updated = []
  for (const cacheKey of keys) {
    const entry = links[cacheKey]
    try {
      const res = await fetch(
        `https://api-ssl.bitly.com/v4/bitlinks/${encodeURIComponent(entry.id)}/clicks/summary?unit=day&units=30`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const newClicks = data.total_clicks || 0
      if (newClicks > entry.clicks) {
        updated.push({ cacheKey, contactId: entry.contactId, prev: entry.clicks, clicks: newClicks })
        links[cacheKey] = { ...entry, clicks: newClicks, lastChecked: new Date().toISOString() }
      } else {
        links[cacheKey] = { ...entry, lastChecked: new Date().toISOString() }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  if (updated.length || keys.length) saveLinks(links)
  return updated
}

export function getBitlyLinks() { return getLinks() }
