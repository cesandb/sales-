// ChannelEscalationEngine — after 5+ days with no reply from a contact in an active
// sequence, auto-escalates to the next outreach channel: Email → SMS → Reddit DM.
// Each contact+outreach pair is escalated at most once (persisted in localStorage).

import { useRef, useEffect } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { sendTwilioSMS, isTwilioReady } from '../utils/twilioSms'
import { addPipelineLog } from './PipelineAutomationEngine'

const ESCALATION_KEY = 'phorm_channel_escalated_v1'
const INTERVAL_MS    = 15 * 60 * 1000 // check every 15 min
const STALE_DAYS     = 5

const OUTREACH_TYPES = new Set(['Email', 'SMS', 'Reddit DM', 'DM', 'Outreach'])
const REPLY_TYPES    = new Set(['Email Reply', 'Reddit Reply', 'DM Reply', 'Reply', 'Phone Call'])

function getEscalated() {
  try { return new Set(JSON.parse(localStorage.getItem(ESCALATION_KEY) || '[]')) }
  catch { return new Set() }
}
function saveEscalated(set) {
  localStorage.setItem(ESCALATION_KEY, JSON.stringify([...set].slice(-5000)))
}

async function runEscalation(store) {
  const { contacts, interactions, enrollments, addInteraction, updateContact } = store
  if (!contacts.length) return

  const escalated = getEscalated()
  const now = new Date()

  // Index interactions by contact
  const iByC = new Map()
  for (const i of interactions) {
    const a = iByC.get(i.contactId) || []; a.push(i); iByC.set(i.contactId, a)
  }

  // Only consider contacts currently in an active sequence
  const activeContactIds = new Set(
    (enrollments || []).filter(e => e.status === 'active').map(e => e.contactId)
  )

  for (const contact of contacts) {
    if (!activeContactIds.has(contact.id)) continue
    const ci = iByC.get(contact.id) || []
    if (!ci.length) continue

    const byDateDesc = [...ci].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const outreaches = byDateDesc.filter(i => OUTREACH_TYPES.has(i.type))
    const replies    = byDateDesc.filter(i => REPLY_TYPES.has(i.type))
    if (!outreaches.length) continue

    const lastOutreach = outreaches[0]
    if (differenceInDays(now, parseISO(lastOutreach.date)) < STALE_DAYS) continue

    // Skip if they've already replied since the last outreach
    if (replies.some(r => r.date >= lastOutreach.date)) continue

    const escalateKey = `${contact.id}::${lastOutreach.id}`
    if (escalated.has(escalateKey)) continue

    const triedChannels = new Set(outreaches.map(o => o.type))
    const daysSince = differenceInDays(now, parseISO(lastOutreach.date))
    const today = now.toISOString().split('T')[0]
    let done = false

    // Escalate email → SMS
    if (!done && !triedChannels.has('SMS') && contact.phone && isTwilioReady()) {
      const firstName = contact.name.split(' ')[0]
      const msg = `Hey ${firstName}! Just following up on our conversation about 1st Phorm. Still happy to answer any questions about supplements — let me know! 💪`
      const ok = await sendTwilioSMS(contact.phone, msg, `escalate::${escalateKey}`)
      if (ok) {
        addInteraction({
          contactId: contact.id, type: 'SMS',
          notes: `Channel escalated email→SMS after ${daysSince}d no reply`,
          date: today,
        })
        addPipelineLog({ type: 'channel-escalate', contact: contact.name, from: 'Email', to: 'SMS', days: daysSince })
        updateContact(contact.id, { lastContact: today })
        escalated.add(escalateKey)
        done = true
      }
    }

    // Escalate email → Reddit DM (queued — RedditDMSender handles actual send)
    if (!done && !triedChannels.has('Reddit DM') && contact.social) {
      addInteraction({
        contactId: contact.id, type: 'Reddit DM',
        notes: `Channel escalated to Reddit DM after ${daysSince}d no reply (queued for send)`,
        date: today,
      })
      addPipelineLog({ type: 'channel-escalate', contact: contact.name, from: 'Email', to: 'Reddit DM', days: daysSince })
      updateContact(contact.id, { lastContact: today })
      escalated.add(escalateKey)
      window.dispatchEvent(new CustomEvent('channel-escalate-reddit', {
        detail: { contactName: contact.name, social: contact.social },
      }))
      done = true
    }
  }

  saveEscalated(escalated)
}

export default function ChannelEscalationEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runEscalation(storeRef.current)
    const t = setTimeout(run, 3 * 60 * 1000) // first run 3 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
