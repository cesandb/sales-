// BitlyMonitor — polls Bitly every 30 min for new clicks on tracked affiliate links.
// On new click detected: logs a "Link Click" interaction, schedules a follow-up,
// and queues a fast warm follow-up message as status:'draft' for human review.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { refreshBitlyClicks, getBitlyKey } from '../utils/bitlyTracker'
import { getMQ } from '../utils/messageQueue'
import { addPipelineLog } from './PipelineAutomationEngine'

const INTERVAL_MS = 30 * 60 * 1000
const MQ_KEY = 'phorm_mq_v1'

function saveMQ(items) {
  try { localStorage.setItem(MQ_KEY, JSON.stringify(items.slice(0, 2000))) } catch {}
}

async function checkBitlyClicks(store) {
  if (!getBitlyKey()) return
  const { contacts, addInteraction, addFollowup } = store

  const updated = await refreshBitlyClicks()
  if (!updated.length) return

  const contactMap = new Map(contacts.map(c => [c.id, c]))
  const today = new Date().toISOString().split('T')[0]

  for (const { contactId, prev, clicks } of updated) {
    const contact = contactMap.get(contactId)
    if (!contact) continue
    const newClicks = clicks - prev

    addInteraction({
      contactId,
      type: 'Link Click',
      notes: `${newClicks} new affiliate link click${newClicks !== 1 ? 's' : ''} via Bitly (total: ${clicks})`,
      date: today,
    })

    addFollowup({
      contactId,
      date: today,
      notes: `Clicked your affiliate link ${newClicks}x — great time to follow up!`,
      type: 'Email',
    })

    // Queue a warm follow-up draft for review
    const mq = getMQ()
    const hasDraft = mq.some(m => m.contactId === contactId && m.status === 'draft' && m.seqId === 'link-click-followup')
    if (!hasDraft) {
      const firstName = contact.name.split(' ')[0]
      const channel = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'
      const draftItem = {
        id: `mq-click-${Date.now()}-${contactId}`,
        contactId,
        contactName: contact.name,
        contactHandle: contact.social || '',
        contactEmail: contact.email || '',
        contactPhone: contact.phone || '',
        channel,
        subject: `Re: Your 1st Phorm link`,
        message: `Hey ${firstName}! I noticed you checked out that link — did you have any questions? Happy to help you get started! 💪`,
        seqId: 'link-click-followup',
        stepKey: 'click-reply',
        seqName: 'Link Click Follow-Up',
        stepLabel: 'Warm Follow-Up',
        status: 'draft',
        createdAt: new Date().toISOString(),
        sentAt: null,
      }
      saveMQ([draftItem, ...mq])
    }

    addPipelineLog({ type: 'link-click', contact: contact.name, clicks: newClicks })
    window.dispatchEvent(new CustomEvent('bitly-click-detected', {
      detail: { contactName: contact.name, clicks: newClicks },
    }))
  }
}

export default function BitlyMonitor() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => checkBitlyClicks(storeRef.current)
    const t = setTimeout(run, 5 * 60 * 1000) // first run 5 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
