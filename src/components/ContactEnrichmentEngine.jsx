// ContactEnrichmentEngine — background component that continuously fills gaps in
// contact data using free APIs (Gravatar, Emailrep.io, Reddit public profile,
// Hunter.io, Apollo.io). Runs every 4 hours; processes max 8 contacts per run
// to stay within free-tier rate limits.

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { getGravatarUrl, emailrepLookup, enrichRedditPublic, gravatarProfile, keybaseLookup, githubSearchByEmail, pdlEnrich, snovioFindEmail, getPdlKey, getSnovClient } from '../utils/freeEnrich'
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

  // 0. PDL full enrichment — highest priority when key set (email + phone + all social in one call)
  if (contact.email && getPdlKey() && shouldTry(done, contact.id, 'pdl', 30)) {
    markDone(done, contact.id, 'pdl')
    const nameParts = (contact.name || '').split(' ')
    const result = await pdlEnrich({ email: contact.email, firstName: nameParts[0], lastName: nameParts.slice(1).join(' ') })
    if (result) {
      if (result.phone    && !contact.phone)    patch.phone    = result.phone
      if (result.linkedin && !contact.social)   patch.social   = result.linkedin
      if (result.twitter  && !contact.social && !patch.social) patch.social = result.twitter
      if (result.github   && !contact.social && !patch.social) patch.social = `github:${result.github.split('/').pop()}`
      if (result.photoUrl && !contact.avatarUrl) patch.avatarUrl = result.photoUrl
      if (result.company  && contact.notes && !contact.notes.includes(result.company)) {
        patch.notes = (contact.notes || '') + `\nCompany: ${result.company}${result.title ? ' · ' + result.title : ''}${result.location ? ' · ' + result.location : ''}`
      }
    }
  }

  // 1. Gravatar photo — if they have email and no avatar yet
  if (contact.email && !contact.avatarUrl && !patch.avatarUrl && shouldTry(done, contact.id, 'gravatar', 14)) {
    markDone(done, contact.id, 'gravatar')
    const url = await getGravatarUrl(contact.email)
    if (url) patch.avatarUrl = url
  }

  // 1b. Gravatar profile JSON — linked social accounts (Twitter, LinkedIn, etc.)
  if (contact.email && (!contact.social || !patch.social) && shouldTry(done, contact.id, 'gravatar-profile', 14)) {
    markDone(done, contact.id, 'gravatar-profile')
    const profile = await gravatarProfile(contact.email)
    if (profile) {
      if (profile.photoUrl && !contact.avatarUrl && !patch.avatarUrl) patch.avatarUrl = profile.photoUrl
      if (!contact.social && !patch.social && profile.accounts?.length > 0) {
        const igAccount = profile.accounts.find(a => a.domain?.includes('instagram'))
        const liAccount = profile.accounts.find(a => a.domain?.includes('linkedin'))
        const twAccount = profile.accounts.find(a => a.domain?.includes('twitter') || a.domain?.includes('x.com'))
        if (igAccount) patch.social = igAccount.url || `instagram:${igAccount.username}`
        else if (liAccount) patch.social = liAccount.url
        else if (twAccount) patch.social = `@${twAccount.username}`
      }
    }
  }

  // 1c. Keybase — find GitHub/Twitter/Reddit handles from email (free, no key)
  if (contact.email && (!contact.social || !patch.social) && shouldTry(done, contact.id, 'keybase', 14)) {
    markDone(done, contact.id, 'keybase')
    const kb = await keybaseLookup(contact.email)
    if (kb) {
      if (!contact.social && !patch.social) {
        if (kb.twitter)    patch.social = `@${kb.twitter}`
        else if (kb.github) patch.social = `github:${kb.github}`
        else if (kb.reddit) patch.social = `u/${kb.reddit}`
      }
    }
  }

  // 1d. GitHub email search — find GitHub profile by email (free, 10 req/min)
  if (contact.email && shouldTry(done, contact.id, 'github-search', 30)) {
    markDone(done, contact.id, 'github-search')
    const ghProfile = await githubSearchByEmail(contact.email)
    if (ghProfile?.login && !contact.social && !patch.social) {
      patch.social = `github:${ghProfile.login}`
      if (ghProfile.avatarUrl && !contact.avatarUrl && !patch.avatarUrl) patch.avatarUrl = ghProfile.avatarUrl
    }
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

  // 4b. Snov.io — email finder as additional source
  if (!contact.email && !patch.email && getSnovClient() && shouldTry(done, contact.id, 'snov', 30)) {
    const social = contact.social || ''
    const isDomain = /^https?:\/\//.test(social) || /\.(com|io|co|net|org)/.test(social)
    if (isDomain) {
      markDone(done, contact.id, 'snov')
      const nameParts = (contact.name || '').split(' ')
      const domain = social.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
      const found = await snovioFindEmail(nameParts[0], nameParts.slice(1).join(' '), domain)
      if (found) patch.email = found
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
