// RevivalEngine — scans for contacts silent 60+ days with no active sequence
// and auto-enrolls them in seq-re-engage. Runs every 4 hours.
// Prevents the pipeline from going cold without anyone noticing.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addPipelineLog } from './PipelineAutomationEngine'

const REVIVAL_KEY   = 'phorm_revival_v1'
const INTERVAL_MS   = 4 * 60 * 60 * 1000
const SILENCE_MS    = 60 * 24 * 60 * 60 * 1000 // 60 days
const MAX_PER_RUN   = 10
const SEQ_ID        = 'seq-re-engage'

const SKIP_STATUSES = new Set(['Customer', 'Repeat Customer', 'Evangelist', 'Inactive'])

function getRevivedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(REVIVAL_KEY) || '[]')) }
  catch { return new Set() }
}

function saveRevivedSet(set) {
  const arr = [...set]
  if (arr.length > 10000) arr.splice(0, arr.length - 10000)
  localStorage.setItem(REVIVAL_KEY, JSON.stringify(arr))
}

function runRevival(store) {
  const { contacts, interactions, enrollments, addEnrollment } = store
  if (!contacts.length) return

  const revivedSet = getRevivedSet()
  const now = Date.now()
  const silenceCutoff = now - SILENCE_MS

  // Last interaction timestamp per contact
  const lastSeen = new Map()
  for (const i of interactions) {
    const ts = new Date(i.date).getTime()
    const prev = lastSeen.get(i.contactId) || 0
    if (ts > prev) lastSeen.set(i.contactId, ts)
  }

  // Contacts with an active enrollment
  const activeContacts = new Set(
    (enrollments || []).filter(e => e.status === 'active').map(e => e.contactId)
  )

  let count = 0
  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (SKIP_STATUSES.has(contact.status)) continue
    if (revivedSet.has(contact.id)) continue
    if (activeContacts.has(contact.id)) continue

    const lastTs = lastSeen.get(contact.id)
      || (contact.createdAt ? new Date(contact.createdAt).getTime() : 0)
    if (lastTs > silenceCutoff) continue

    addEnrollment({ contactId: contact.id, sequenceId: SEQ_ID })
    addPipelineLog({ type: 'revival', contact: contact.name })
    revivedSet.add(contact.id)
    count++
  }

  if (count > 0) {
    saveRevivedSet(revivedSet)
    window.dispatchEvent(new CustomEvent('revival-ran', { detail: { count } }))
  }
}

export default function RevivalEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runRevival(storeRef.current)
    const t = setTimeout(run, 10 * 60 * 1000) // first run 10 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
