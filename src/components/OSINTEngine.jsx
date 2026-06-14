// OSINTEngine — background component. Analyzes contacts' Reddit activity with Claude Haiku
// to extract fitness goals, then enriches the contact with goalSummary + tags.
// Better goals → better matchProduct() results → more personalized outreach.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { analyzeContactGoals, hasBeenAnalyzed } from '../utils/osintResearch'
import { addPipelineLog } from './PipelineAutomationEngine'

const INTERVAL_MS = 6 * 60 * 60 * 1000
const MAX_PER_RUN = 3
const DELAY_MS    = 3500

const SKIP_STATUSES = new Set(['Inactive', 'Customer', 'Repeat Customer', 'Evangelist'])

const STATUS_PRIORITY = {
  'Hot Lead': 0,
  'Warm Lead': 1,
  'New Lead': 2,
  'Cold Lead': 3,
}

function prioritize(contacts) {
  return [...contacts].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9
    const pb = STATUS_PRIORITY[b.status] ?? 9
    if (pa !== pb) return pa - pb
    // Reddit contacts first (we can fetch their activity)
    const ar = /^reddit:/i.test(a.social || '') ? 0 : 1
    const br = /^reddit:/i.test(b.social || '') ? 0 : 1
    return ar - br
  })
}

async function runOSINT(store) {
  const { contacts, updateContact } = store
  if (!contacts?.length) return

  const eligible = contacts.filter(c =>
    !SKIP_STATUSES.has(c.status) &&
    !hasBeenAnalyzed(c.id) &&
    // Only contacts with some data to analyze
    (c.social || c.notes || (c.tags || []).length > 0)
  )

  if (!eligible.length) return

  const queue = prioritize(eligible).slice(0, MAX_PER_RUN)
  let count = 0

  for (const contact of queue) {
    const result = await analyzeContactGoals(contact)
    if (result) {
      const existingTags = contact.tags || []
      const newTags = result.osintTags.filter(t => !existingTags.includes(t))
      updateContact(contact.id, {
        goalSummary: result.goalSummary,
        tags: [...existingTags, ...newTags, 'osint-analyzed'],
      })
      addPipelineLog({ type: 'osint', contact: contact.name })
      count++
    }
    if (count < queue.length) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  if (count > 0) {
    window.dispatchEvent(new CustomEvent('osint-ran', { detail: { count } }))
  }
}

export default function OSINTEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runOSINT(storeRef.current)
    const t = setTimeout(run, 8 * 60 * 1000) // 8 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
