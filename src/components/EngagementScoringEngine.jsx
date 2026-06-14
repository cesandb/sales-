// EngagementScoringEngine — scores every contact using batchCalcLeadScores(),
// writes the tier as a tag (tier:hot, tier:warm, etc.), and flags contacts
// missing critical data so enrichment engines can prioritize them.
// Runs every 12 hours; initial delay 5 min to let the store settle.

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { batchCalcLeadScores } from '../utils/leadScore'

const INITIAL_MS  = 5 * 60 * 1000
const INTERVAL_MS = 12 * 60 * 60 * 1000
const TIER_TAGS   = ['tier:champion', 'tier:hot', 'tier:warm', 'tier:cold']
const DATA_TAGS   = ['needs-email', 'needs-phone', 'needs-social']

function runScoring(s) {
  const { contacts, interactions, followups, pipeline, updateContact } = s
  if (!contacts?.length) return

  const scores = batchCalcLeadScores(contacts, interactions || [], followups || [], pipeline || [])

  let updated = 0
  for (const contact of contacts) {
    const result = scores.get(contact.id)
    if (!result) continue

    const currentTags = contact.tags || []
    let newTags = currentTags.filter(t => !TIER_TAGS.includes(t) && !DATA_TAGS.includes(t))

    // Add tier tag
    newTags.push(`tier:${result.tier}`)

    // Add data-gap tags to prioritize enrichment
    if (!contact.email)  newTags.push('needs-email')
    if (!contact.phone)  newTags.push('needs-phone')
    if (!contact.social) newTags.push('needs-social')

    // Only update if tags actually changed
    const before = [...currentTags].sort().join(',')
    const after  = [...new Set(newTags)].sort().join(',')
    if (before !== after) {
      updateContact(contact.id, { tags: [...new Set(newTags)] })
      updated++
    }
  }

  window.dispatchEvent(new CustomEvent('engagement-scores-updated', {
    detail: { total: contacts.length, updated }
  }))
}

export default function EngagementScoringEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runScoring(storeRef.current)
    const t   = setTimeout(run, INITIAL_MS)
    const iv  = setInterval(run, INTERVAL_MS)

    // Allow manual trigger for instant re-score
    const onManual = () => runScoring(storeRef.current)
    window.addEventListener('rescore-contacts-now', onManual)

    return () => { clearTimeout(t); clearInterval(iv); window.removeEventListener('rescore-contacts-now', onManual) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
