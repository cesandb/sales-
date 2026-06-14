// MQAutoSender — the missing link. Processes every pending Message Queue item
// for email and SMS channels. Without this, all the automation engines queue
// messages that never get delivered. Runs every 30 min, max 20 per run.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getMQ, markMQItemStatus, markMQItemFailed } from '../utils/messageQueue'
import { sendViaGmail, isGmailSendReady } from '../utils/gmailSend'
import { sendTwilioSMS, isTwilioReady, sendWhatsApp, isWhatsAppReady } from '../utils/twilioSms'
import { addPipelineLog } from './PipelineAutomationEngine'
import { canSendToday, markSentToday } from '../utils/dailyCap'

const INTERVAL_MS = 30 * 60 * 1000
const MAX_PER_RUN = 20
const SEND_START  = 7   // 7am
const SEND_END    = 22  // 10pm

function isWithinSendWindow() {
  const h = new Date().getHours()
  return h >= SEND_START && h < SEND_END
}

async function runMQAutoSender(store) {
  if (!isWithinSendWindow()) return

  const canEmail = isGmailSendReady()
  const canSMS   = isTwilioReady()
  const canWA    = isWhatsAppReady()
  if (!canEmail && !canSMS && !canWA) return

  const { addInteraction } = store
  const pending = getMQ().filter(i => i.status === 'pending')
  if (!pending.length) return

  const emailItems = canEmail         ? pending.filter(i => i.channel === 'email' && i.contactEmail) : []
  const smsItems   = (canSMS || canWA) ? pending.filter(i => i.channel === 'sms'  && i.contactPhone) : []

  let count = 0

  for (const item of emailItems) {
    if (count >= MAX_PER_RUN) break
    if (!canSendToday(item.contactId)) continue  // daily cap: 1 automated message per contact per day
    const sentKey = `mq::${item.id}`
    const ok = await sendViaGmail(
      item.contactEmail,
      item.contactName,
      item.subject || `Hey ${item.contactName.split(' ')[0]}!`,
      item.message,
      sentKey,
    )
    if (ok) {
      markMQItemStatus(item.id, 'sent')
      markSentToday(item.contactId)
      addInteraction({
        contactId: item.contactId,
        type: 'Email',
        notes: `Auto-sent: [${item.seqName}] ${item.stepLabel}`,
      })
      addPipelineLog({ type: 'mq-email', contact: item.contactName, seq: item.seqName })
      count++
      await new Promise(r => setTimeout(r, 1200))
    } else {
      markMQItemFailed(item.id)
    }
  }

  for (const item of smsItems) {
    if (count >= MAX_PER_RUN) break
    if (!canSendToday(item.contactId)) continue  // daily cap
    const sentKey = `mq::${item.id}`
    // WhatsApp first (higher engagement), fall back to SMS
    const ok = canWA
      ? (await sendWhatsApp(item.contactPhone, item.message, sentKey))
          || (canSMS ? await sendTwilioSMS(item.contactPhone, item.message, sentKey) : false)
      : await sendTwilioSMS(item.contactPhone, item.message, sentKey)
    if (ok) {
      markMQItemStatus(item.id, 'sent')
      markSentToday(item.contactId)
      addInteraction({
        contactId: item.contactId,
        type: canWA ? 'WhatsApp' : 'SMS',
        notes: `Auto-sent ${canWA ? 'WhatsApp' : 'SMS'}: [${item.seqName}] ${item.stepLabel}`,
      })
      addPipelineLog({ type: canWA ? 'mq-whatsapp' : 'mq-sms', contact: item.contactName, seq: item.seqName })
      count++
      await new Promise(r => setTimeout(r, 800))
    } else {
      markMQItemFailed(item.id)
    }
  }

  if (count > 0) {
    window.dispatchEvent(new CustomEvent('mq-auto-sent', { detail: { count } }))
  }
}

export default function MQAutoSender() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runMQAutoSender(storeRef.current)
    const t = setTimeout(run, 2 * 60 * 1000) // 2 min after load — send queued items fast
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
