// Hunter.io email enrichment — find emails for contacts who only have a social handle
// API key stored in localStorage only (never committed).

export const HUNTER_KEY = 'phorm_hunter_key'
const ENRICH_DONE_KEY  = 'phorm_enrich_done'  // Set of contactIds already tried
const ENRICH_RATE_KEY  = 'phorm_enrich_ts'    // Timestamps for rate limiting

export function getHunterKey() {
  return localStorage.getItem(HUNTER_KEY) || ''
}

export function saveHunterKey(key) {
  if (key) localStorage.setItem(HUNTER_KEY, key.trim())
  else localStorage.removeItem(HUNTER_KEY)
}

export function clearHunterKey() {
  localStorage.removeItem(HUNTER_KEY)
}

function getEnrichDoneSet() {
  try { return new Set(JSON.parse(localStorage.getItem(ENRICH_DONE_KEY) || '[]')) }
  catch { return new Set() }
}

function saveEnrichDoneSet(set) {
  const arr = [...set]
  if (arr.length > 5000) arr.splice(0, arr.length - 5000)
  localStorage.setItem(ENRICH_DONE_KEY, JSON.stringify(arr))
}

// Simple rate limiter — max 10 calls per minute (Hunter.io free tier: 25/mo)
function canMakeRequest() {
  try {
    const now = Date.now()
    const timestamps = JSON.parse(localStorage.getItem(ENRICH_RATE_KEY) || '[]')
    const recent = timestamps.filter(t => now - t < 60000)
    if (recent.length >= 10) return false
    recent.push(now)
    localStorage.setItem(ENRICH_RATE_KEY, JSON.stringify(recent))
    return true
  } catch { return true }
}

// Find email for a contact using Hunter.io email-finder endpoint
// Returns { email, confidence } or null
export async function hunterFindEmail(firstName, lastName, domain) {
  const key = getHunterKey()
  if (!key || !firstName || !domain) return null
  if (!canMakeRequest()) return null

  try {
    const params = new URLSearchParams({
      first_name: firstName,
      last_name:  lastName || '',
      domain,
      api_key: key,
    })
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data?.data?.email) {
      return {
        email:      data.data.email,
        confidence: data.data.confidence || 0,
      }
    }
  } catch {}
  return null
}

// Verify an email address — returns 'deliverable' | 'risky' | 'undeliverable' | 'unknown' | null
export async function hunterVerifyEmail(email) {
  const key = getHunterKey()
  if (!key || !email) return null
  if (!canMakeRequest()) return null

  try {
    const params = new URLSearchParams({ email, api_key: key })
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.result || null
  } catch { return null }
}

// Domain search — find emails associated with a company domain
// Returns array of { email, firstName, lastName, confidence }
export async function hunterDomainSearch(domain, limit = 5) {
  const key = getHunterKey()
  if (!key || !domain) return []
  if (!canMakeRequest()) return []

  try {
    const params = new URLSearchParams({ domain, limit, api_key: key })
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data?.emails || []).map(e => ({
      email:      e.value,
      firstName:  e.first_name  || '',
      lastName:   e.last_name   || '',
      confidence: e.confidence  || 0,
    }))
  } catch { return [] }
}

// Auto-enrich a single contact: tries email-finder if they have a domain in their social field.
// Returns the found email (string) or null. Marks the contactId as done regardless.
export async function autoEnrichContact(contact, parsedSocial) {
  const done = getEnrichDoneSet()
  if (done.has(contact.id)) return null

  done.add(contact.id)
  saveEnrichDoneSet(done)

  const key = getHunterKey()
  if (!key) return null

  // Only enrich contacts that don't have an email yet
  if (contact.email) return null

  // Need a domain to search — either parsed from social or from the raw social field
  let domain = null
  if (parsedSocial?.isDomain) {
    domain = parsedSocial.handle
  } else if (parsedSocial?.profileUrl) {
    try {
      domain = new URL(parsedSocial.profileUrl).hostname.replace(/^www\./, '')
    } catch {}
  }

  if (!domain) return null

  const nameParts = (contact.name || '').split(' ')
  const firstName = nameParts[0] || ''
  const lastName  = nameParts.slice(1).join(' ') || ''

  const result = await hunterFindEmail(firstName, lastName, domain)
  if (result?.email && result.confidence >= 50) {
    return result.email
  }
  return null
}
