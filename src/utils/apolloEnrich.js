// Apollo.io — people search and contact enrichment.
// Free tier: 10,000 export credits/month, ~50 API calls/day.
// Key stored in localStorage only.

export const APOLLO_KEY = 'phorm_apollo_key'
const IMPORT_DONE_KEY  = 'phorm_apollo_imported'
const APOLLO_RATE_KEY  = 'phorm_apollo_rate'
const APOLLO_PAGE_KEY  = 'phorm_apollo_page'  // which page to fetch next

export function getApolloKey() {
  return localStorage.getItem(APOLLO_KEY) || ''
}

// Rate limit: max 3 calls/minute (Apollo enforces hourly limits on free tier)
function canCallApollo() {
  try {
    const now = Date.now()
    const ts = JSON.parse(localStorage.getItem(APOLLO_RATE_KEY) || '[]')
    const recent = ts.filter(t => now - t < 60000)
    if (recent.length >= 3) return false
    recent.push(now)
    localStorage.setItem(APOLLO_RATE_KEY, JSON.stringify(recent))
    return true
  } catch { return true }
}

export function getImportedKeys() {
  try { return new Set(JSON.parse(localStorage.getItem(IMPORT_DONE_KEY) || '[]')) }
  catch { return new Set() }
}

function markImported(key) {
  const set = getImportedKeys()
  set.add(key)
  const arr = [...set]
  if (arr.length > 10000) arr.splice(0, arr.length - 10000)
  localStorage.setItem(IMPORT_DONE_KEY, JSON.stringify(arr))
}

function getNextPage() {
  return parseInt(localStorage.getItem(APOLLO_PAGE_KEY) || '1')
}

function advancePage(page) {
  localStorage.setItem(APOLLO_PAGE_KEY, String(page + 1))
}

// Search fitness professionals — returns formatted contact records ready to addContact()
export async function apolloSearchFitnessPros() {
  const key = getApolloKey()
  if (!key || !canCallApollo()) return []

  const page = getNextPage()

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        q_keywords: 'fitness health supplements protein workout',
        person_titles: [
          'personal trainer', 'fitness coach', 'nutrition coach',
          'gym owner', 'health coach', 'nutritionist',
          'physical trainer', 'strength coach', 'wellness coach',
          'CrossFit coach', 'fitness influencer', 'bodybuilder',
          'running coach', 'triathlon coach', 'yoga instructor',
        ],
        contact_email_status: ['verified', 'likely to engage'],
        page,
        per_page: 25,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (res.status === 429) return [] // rate limited
    if (!res.ok) return []

    const data = await res.json()
    const imported = getImportedKeys()
    const contacts = []

    for (const p of (data.people || [])) {
      const email = p.email || ''
      const phone = p.phone_numbers?.[0]?.sanitized_number || ''
      const name  = [p.first_name, p.last_name].filter(Boolean).join(' ')
      if (!name) continue

      const dedupKey = email || `${name}::${p.organization_name || ''}`
      if (imported.has(dedupKey)) continue

      const notes = [
        p.title           && `Title: ${p.title}`,
        p.organization_name && `Company: ${p.organization_name}`,
        p.city && p.state   && `Location: ${p.city}, ${p.state}`,
        p.seniority         && `Seniority: ${p.seniority}`,
      ].filter(Boolean).join('\n')

      contacts.push({
        name,
        email,
        phone: phone.replace(/\D/g, ''),
        social: p.linkedin_url || p.twitter_url || '',
        notes,
        tags: ['apollo-import', 'fitness-pro'],
        status: 'New Lead',
        _dedupKey: dedupKey,
      })
    }

    if (contacts.length > 0) advancePage(page)
    return contacts
  } catch { return [] }
}

export function markContactImported(dedupKey) {
  markImported(dedupKey)
}

// Enrich a single contact (match by name + domain) — returns { email, phone, linkedin } or null
export async function apolloMatchPerson(firstName, lastName, domain) {
  const key = getApolloKey()
  if (!key || !firstName || !domain) return null
  if (!canCallApollo()) return null

  try {
    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name:  lastName || '',
        domain,
        reveal_personal_emails: true,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const p = data.person
    if (!p) return null
    return {
      email: p.email || '',
      phone: p.phone_numbers?.[0]?.sanitized_number?.replace(/\D/g, '') || '',
      linkedin: p.linkedin_url || '',
    }
  } catch { return null }
}
