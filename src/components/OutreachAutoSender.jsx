import { useRef, useEffect } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { trySendEmail, addPipelineLog } from './PipelineAutomationEngine'
import { DEFAULT_SEQUENCES } from '../utils/affiliateLinks'
import { parseSocialHandle } from '../utils/platformLinks'

const AUTO_SENT_KEY = 'phorm_outreach_auto_sent'
const RUN_INTERVAL  = 2 * 60 * 60 * 1000 // every 2 hours

function getAutoSentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(AUTO_SENT_KEY) || '[]')) }
  catch { return new Set() }
}

function saveAutoSentSet(set) {
  const arr = [...set]
  if (arr.length > 2000) arr.splice(0, arr.length - 2000)
  localStorage.setItem(AUTO_SENT_KEY, JSON.stringify(arr))
}

async function runAutoSend(store) {
  const { contacts, followups, linkShares, interactions, addInteraction, updateFollowup, updateLinkShare } = store
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const sent = getAutoSentSet()
  let totalSent = 0

  // Build outreach queue (same logic as Outreach page)
  const queue = []
  const seen = new Set()

  function push(item) {
    if (seen.has(item.contactId)) return
    seen.add(item.contactId)
    queue.push(item)
  }

  // Overdue follow-ups — include contacts without email (DM queue fallback)
  followups
    .filter(f => f.status === 'pending' && f.date < todayStr)
    .slice(0, 10)
    .forEach(f => {
      const contact = contacts.find(c => c.id === f.contactId)
      if (!contact) return
      push({ contactId: contact.id, contact, followupId: f.id, context: f.notes })
    })

  // Due today
  followups
    .filter(f => f.status === 'pending' && f.date === todayStr)
    .slice(0, 10)
    .forEach(f => {
      const contact = contacts.find(c => c.id === f.contactId)
      if (!contact) return
      push({ contactId: contact.id, contact, followupId: f.id, context: f.notes })
    })

  // Unactioned link shares
  linkShares
    .filter(ls => !ls.followedUp && differenceInDays(now, parseISO(ls.date)) >= 3)
    .slice(0, 5)
    .forEach(ls => {
      const contact = contacts.find(c => c.id === ls.contactId)
      if (!contact) return
      push({ contactId: contact.id, contact, linkShareId: ls.id })
    })

  // Find active enrollment for each queued contact to pick the right sequence step
  const { enrollments } = store

  for (const item of queue) {
    const { contact } = item
    const sentKey = `${contact.id}::auto::${todayStr}`
    if (sent.has(sentKey)) continue

    // Find the most relevant active enrollment step
    let seq = null
    let step = null
    const activeEnrollment = enrollments.find(e =>
      e.contactId === contact.id && e.status === 'active'
    )
    if (activeEnrollment) {
      const seqDef = DEFAULT_SEQUENCES.find(s => s.id === activeEnrollment.sequenceId)
      if (seqDef) {
        seq  = seqDef
        step = seqDef.steps[activeEnrollment.currentStep] || seqDef.steps[0]
      }
    }
    // Fallback to cold intro step
    if (!seq) {
      seq  = DEFAULT_SEQUENCES.find(s => s.id === 'seq-cold-intro')
      step = seq?.steps[0]
    }
    if (!seq || !step) continue

    const didSend = await trySendEmail(contact, seq, step)
    // For email contacts: didSend=true means EmailJS succeeded
    // For DM contacts: didSend=false but message is in the MQ — still count as queued
    const isDMContact = !contact.email && (contact.social || contact.phone)
    const parsed = contact.social ? parseSocialHandle(contact.social) : null
    const platformLabel = parsed?.platform || 'DM'

    if (didSend) {
      addInteraction({
        contactId: contact.id,
        type: 'Email',
        notes: `Auto-sent: [${seq.name}] ${step.label}`,
      })
      if (item.followupId) updateFollowup(item.followupId, { status: 'completed' })
      if (item.linkShareId) updateLinkShare(item.linkShareId, { followedUp: true })
      sent.add(sentKey)
      totalSent++
      await new Promise(r => setTimeout(r, 1500))
    } else if (isDMContact) {
      // Message queued to MQ for manual DM — log it and advance the followup
      addInteraction({
        contactId: contact.id,
        type: 'DM',
        notes: `DM queued (${platformLabel}): [${seq.name}] ${step.label}`,
      })
      if (item.followupId) updateFollowup(item.followupId, { status: 'completed' })
      if (item.linkShareId) updateLinkShare(item.linkShareId, { followedUp: true })
      sent.add(sentKey)
      totalSent++
    }
  }

  if (totalSent > 0) {
    saveAutoSentSet(sent)
    addPipelineLog({ type: 'auto-email-batch', count: totalSent })
    window.dispatchEvent(new CustomEvent('outreach-auto-sent', { detail: { count: totalSent } }))
  }
}

export default function OutreachAutoSender() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    // Delay first run by 30s to let the app settle
    const t = setTimeout(() => runAutoSend(storeRef.current), 30000)
    const interval = setInterval(() => runAutoSend(storeRef.current), RUN_INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
