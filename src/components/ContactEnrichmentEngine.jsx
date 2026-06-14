// ContactEnrichmentEngine — background component that continuously fills gaps in
// contact data using free APIs (Gravatar, Emailrep.io, Reddit public profile,
// Hunter.io, Apollo.io). Runs every 4 hours; processes max 8 contacts per run
// to stay within free-tier rate limits.

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { getGravatarUrl, emailrepLookup, enrichRedditPublic } from '../utils/freeEnrich'
import { autoEnrichContact } from '../utils/contactEnrich'
import { apolloMatchPerson } from '../utils/apolloEnrich'
import { enrichRedditProfile } from '../utils/enrichContact'

const INITIAL_MS  = 45 * 1000
const INTERVAL_MS = 4 * 60 * 60 * 1000
const DONE_KEY    = 'phorm_enrich_engine_v1'   // contactId::fieldKey → ISO timestamp
const BATCH_SIZE  = 8

function getDoneMap() {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(DONE_KEY) || '{}'))) }
  catch { return new Map() }
}

function markDone(done, contactId, field) {
  done.set(`${contactId}::${field}`, new Date().toISOString())
  const obj = Object.fromEntries(done)
  // Keep last 5000 entries
  const keys = Object.keys(obj)
  if (keys.length > 5000) keys.slice(0, keys.length - 5000).forEach(k => delete obj[k])
  localStorage.setItem(DONE_KEY, JSON.stringify(obj))
}

function shouldTry(done, contactId, field, cooldownDays = 7) {
  const ts = done.get(`${contactId}::${field}`)
  if (!ts) return true
  return (Date.now() - new Date(ts)) > cooldownDays * 86400000
}

// Completeness score 0-5: email, phone, social, tags, notes/goalSummary
function completenessScore(c) {
  return [
    !!c.email,
    !!c.phone,
    !!c.social,
    (c.tags || []).length > 0,
    !!(c.notes || c.goalSummary),
  ].filter(Boolean).length
}

async function enrichOne(contact, updateContact, done) {
  const patch = {}

  // 1. Gravatar photo — if they have email and no avatar yet
  if (contact.email && !contact.avatarUrl && shouldTry(done, contact.id, 'gravatar', 14)) {
    markDone(done, contact.id, 'gravatar')
    const url = await getGravatarUrl(contact.email)
    if (url) patch.avatarUrl = url
  }

  // 2. Emailrep.io — extract social handles from email reputation data
  if (contact.email && shouldTry(done, contact.id, 'emailrep', 14)) {
    markDone(done, contact.id, 'emailrep')
    const rep = await emailrepLookup(contact.email)
    if (rep?.details) {
      const profiles = rep.details.profiles || []
      // If we don't have a social handle and emailrep found one, add it
      if (!contact.social && profiles.length > 0) {
        // Prefer Instagram or Reddit for fitness niche
        const ig = profiles.find(p => p.toLowerCase().includes('instagram'))
        const rd = profiles.find(p => p.toLowerCase().includes('reddit'))
        if (ig) patch.social = ig
        else if (rd) patch.social = rd
        else patch.social = profiles[0]
      }
      // Suspicious flag → tag
      if (rep.suspicious) {
        const tags = [...(contact.tags || [])]
        if (!tags.includes('suspicious-email')) {
          tags.push('suspicious-email')
          patch.tags = tags
        }
      }
    }
  }

  // 3. Reddit public profile — extract email from bio if they have a reddit handle
  const redditHandle = (() => {
    const s = (contact.social || '').trim()
    if (s.toLowerCase().startsWith('reddit:') || s.includes('reddit.com/u/')) {
      return s.replace(/.*reddit\.com\/u\//, '').replace(/^reddit:/i, '').replace(/^u\//, '').replace(/\/$/, '').trim()
    }
    return null
  })()

  if (redditHandle && !contact.email && shouldTry(done, contact.id, 'reddit-bio', 7)) {
    markDone(done, contact.id, 'reddit-bio')
    const rd = await enrichRedditPublic(redditHandle)
    if (rd?.email) patch.email = rd.email
    if (rd?.iconUrl && !contact.avatarUrl && !patch.avatarUrl) patch.avatarUrl = rd.iconUrl
    if (rd?.karma) {
      const tags = [...(contact.tags || []), ...(patch.tags || [])]
      if (!tags.includes('reddit-verified')) {
        patch.tags = [...new Set([...tags, 'reddit-verified'])]
      }
    }
  }

  // 4. Hunter.io — find email if missing and they have a domain/website in social
  if (!contact.email && !patch.email && shouldTry(done, contact.id, 'hunter', 30)) {
    markDone(done, contact.id, 'hunter')
    const social = contact.social || ''
    const isDomain = /^https?:\/\//.test(social) || (/\.com|\.io|\.co|\.net/.test(social) && !social.includes('@'))
    if (isDomain) {
      const result = await autoEnrichContact(contact, { isDomain: true, handle: social.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] })
      if (result) patch.email = result
    }
  }

  // 5. Apollo.io — person match by name + domain if still no email
  if (!contact.email && !patch.email && shouldTry(done, contact.id, 'apollo', 30)) {
    const social = contact.social || ''
    const isDomain = /^https?:\/\//.test(social) || /\.(com|io|co|net|org)/.test(social)
    if (isDomain) {
      markDone(done, contact.id, 'apollo')
      const nameParts = (contact.name || '').split(' ')
      const domain = social.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
      const result = await apolloMatchPerson(nameParts[0], nameParts.slice(1).join(' '), domain)
      if (result?.email) patch.email = result.email
      if (result?.phone && !contact.phone) patch.phone = result.phone
    }
  }

  if (Object.keys(patch).length > 0) {
    updateContact(contact.id, patch)
    return true
  }
  return false
}

export default function ContactEnrichmentEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    async function run() {
      const s = storeRef.current
      if (!s?.contacts?.length) return

      const done = getDoneMap()

      // Sort by completeness ascending — enrich the least-complete contacts first
      const active = s.contacts.filter(c =>
        c.status !== 'Inactive' && c.status !== 'Repeat Customer' && c.status !== 'Evangelist'
      )
      const prioritized = [...active].sort((a, b) => completenessScore(a) - completenessScore(b))

      let enriched = 0
      for (const contact of prioritized) {
        if (enriched >= BATCH_SIZE) break
        const changed = await enrichOne(contact, s.updateContact, done)
        if (changed) enriched++
      }

      if (enriched > 0) {
        window.dispatchEvent(new CustomEvent('contacts-enriched', { detail: { count: enriched } }))
      }
    }

    const t = setTimeout(run, INITIAL_MS)
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
