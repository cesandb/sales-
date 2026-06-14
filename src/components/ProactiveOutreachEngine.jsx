// ProactiveOutreachEngine — ensures every active contact is always in an outreach
// sequence. Detects contacts that have fallen through the cracks (no active
// enrollment, no recent contact) and re-enrolls them in the appropriate sequence.
// Also surfaces contacts who've never been contacted so they get a first-touch fast.
// Runs every 2 hours; initial delay 15 min to let PAE run first.

import { useEffect, useRef } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { getDailySentCount } from '../utils/dailyCap'
import { addPipelineLog } from './PipelineAutomationEngine'

const INITIAL_MS  = 15 * 60 * 1000
const INTERVAL_MS = 2 * 60 * 60 * 1000
const MAX_PER_RUN = 10
const SENT_KEY    = 'phorm_proactive_v1'

// Per-stage cadence: how many days without contact before proactive outreach kicks in
const STAGE_CADENCE = {
  'New Lead':   1,   // touch within 24h
  'Warm Lead':  5,
  'Hot Lead':   3,
  'At Risk':    7,
  'Opportunity': 4,
}

// Per-stage sequence to enroll in when proactive triggers
const STAGE_SEQUENCE = {
  'New Lead':   'seq-cold-intro',
  'Warm Lead':  'seq-warm-convert',
  'Hot Lead':   'seq-hot-close',
  'At Risk':    'seq-win-back',
  'Opportunity': 'seq-hot-close',
}

// Per-stage backup message when no sequence step is available
const STAGE_MESSAGE = {
  'New Lead':   (name) => `Hey ${name}! I came across your profile and thought you'd love what we have at 1st Phorm. Mind if I share something quick?`,
  'Warm Lead':  (name) => `Hey ${name}, just circling back — have you had a chance to check out what I sent over? Happy to answer any questions!`,
  'Hot Lead':   (name) => `Hey ${name}! Still thinking things over? I'm here if you want to jump on it — our stock on that moves fast. 🔥`,
  'At Risk':    (name) => `Hey ${name}, it's been a while! Hope everything's great. Wanted to check in and see how your fitness journey is going lately?`,
  'Opportunity': (name) => `Hey ${name} — wanted to follow up on what we discussed. Ready to get started when you are!`,
}

function getSentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]')) }
  catch { return new Set() }
}

function saveSentSet(set) {
  const arr = [...set]
  if (arr.length > 5000) arr.splice(0, arr.length - 5000)
  localStorage.setItem(SENT_KEY, JSON.stringify(arr))
}

function getWeekKey() {
  const d = new Date()
  const week = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000)
  return `${d.getFullYear()}W${String(week).padStart(2, '0')}`
}

async function runProactive(s) {
  const { contacts, enrollments, interactions, addEnrollment, updateContact } = s
  if (!contacts?.length) return

  const now    = new Date()
  const hour   = now.getHours()
  // Only run during active hours
  if (hour < 8 || hour > 21) return

  const dailySent = getDailySentCount()
  if (dailySent >= 50) return // daily cap already hit

  const enrByC = new Map()
  for (const e of (enrollments || [])) {
    const a = enrByC.get(e.contactId) || []; a.push(e); enrByC.set(e.contactId, a)
  }

  const iByC = new Map()
  for (const i of (interactions || [])) {
    const a = iByC.get(i.contactId) || []; a.push(i); iByC.set(i.contactId, a)
  }

  const sent   = getSentSet()
  const weekKey = getWeekKey()
  let count    = 0

  const targetStatuses = Object.keys(STAGE_CADENCE)

  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (!targetStatuses.includes(contact.status)) continue

    const cadenceDays = STAGE_CADENCE[contact.status]
    const lastContactDate = contact.lastContact
      ? parseISO(contact.lastContact)
      : parseISO(contact.createdAt)
    const daysSince = differenceInDays(now, lastContactDate)

    if (daysSince < cadenceDays) continue

    // Skip if already has an active enrollment
    const cEnr = enrByC.get(contact.id) || []
    if (cEnr.some(e => e.status === 'active')) continue

    // Dedup: only one proactive touch per contact per week per status
    const sentKey = `${contact.id}::${contact.status}::${weekKey}`
    if (sent.has(sentKey)) continue

    // Enroll in the appropriate sequence
    const seqId = STAGE_SEQUENCE[contact.status]
    if (seqId) {
      addEnrollment({ contactId: contact.id, sequenceId: seqId })
      addPipelineLog({ type: 'proactive-enroll', contact: contact.name, status: contact.status, daysSince, seq: seqId })
    }

    // Queue a direct message as backup (in case sequence step has a day delay)
    const firstName = contact.name?.split(' ')[0] || contact.name
    const msgFn = STAGE_MESSAGE[contact.status]
    if (msgFn) {
      const channel = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'
      addToMQ({
        contactId:     contact.id,
        contactName:   contact.name,
        contactHandle: contact.social || contact.email || '',
        contactEmail:  contact.email || '',
        contactPhone:  contact.phone || '',
        channel,
        subject:  `Hey ${firstName}!`,
        message:  msgFn(firstName),
        seqId:    'proactive',
        stepKey:  `proactive-${contact.status.toLowerCase().replace(/\s+/g, '-')}`,
        seqName:  'Proactive Outreach',
        stepLabel: `${contact.status} Re-engagement`,
      })
    }

    sent.add(sentKey)
    count++

    // Mark lastContact updated so we don't immediately re-trigger
    updateContact(contact.id, { lastContact: now.toISOString() })
  }

  saveSentSet(sent)

  if (count > 0) {
    window.dispatchEvent(new CustomEvent('proactive-outreach-ran', { detail: { count } }))
  }
}

export default function ProactiveOutreachEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runProactive(storeRef.current)
    const t   = setTimeout(run, INITIAL_MS)
    const iv  = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
