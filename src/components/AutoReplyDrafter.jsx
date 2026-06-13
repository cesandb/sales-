// AutoReplyDrafter — scans for recent reply interactions without a follow-up response,
// generates an AI draft reply via Claude Haiku, and queues it in the outreach MQ
// as status:'draft' for human review before sending.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { draftReply, isDrafted, markDrafted } from '../utils/aiReplyDraft'
import { getMQ } from '../utils/messageQueue'
import { addPipelineLog } from './PipelineAutomationEngine'
import { buildUTMLink, matchProduct } from '../utils/affiliateLinks'

const INTERVAL_MS = 10 * 60 * 1000 // every 10 minutes
const REPLY_TYPES = new Set(['Email Reply', 'Reddit Reply', 'DM Reply', 'Reply'])
const OUTREACH_TYPES = new Set(['Email', 'SMS', 'DM', 'Reddit DM', 'Outreach'])
const WINDOW_MS = 48 * 60 * 60 * 1000 // only draft for replies within 48h

function saveMQWithDraft(items) {
  try { localStorage.setItem('phorm_mq_v1', JSON.stringify(items.slice(0, 2000))) } catch {}
}

async function runDrafter(store) {
  const { contacts, interactions } = store
  if (!contacts.length) return

  const now = Date.now()
  const iByC = new Map()
  for (const i of interactions) {
    const a = iByC.get(i.contactId) || []; a.push(i); iByC.set(i.contactId, a)
  }

  for (const contact of contacts) {
    const ci = (iByC.get(contact.id) || [])
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    // Find the latest unprocessed reply
    const latestReply = ci.find(i => REPLY_TYPES.has(i.type) && !isDrafted(i.id))
    if (!latestReply) continue

    // Only draft for recent replies
    const replyAge = now - new Date(latestReply.date).getTime()
    if (replyAge > WINDOW_MS) { markDrafted(latestReply.id); continue }

    // Skip if there's already an outreach after the reply
    const hasFollowup = ci.some(i => OUTREACH_TYPES.has(i.type) && i.date >= latestReply.date)
    if (hasFollowup) { markDrafted(latestReply.id); continue }

    // Skip if a draft already exists in the MQ for this contact (avoid spam)
    const mq = getMQ()
    const hasDraft = mq.some(m => m.contactId === contact.id && m.status === 'draft')
    if (hasDraft) continue

    const replyText = (latestReply.notes || '').replace(/^Reddit DM reply: "|"$/g, '')
    const priorMessages = ci.filter(i => i.date < latestReply.date).slice(0, 4)

    const draft = await draftReply(contact, replyText, priorMessages)
    if (!draft) { markDrafted(latestReply.id); continue }

    // Build affiliate link for the draft
    const product = matchProduct(contact)
    const link = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: 'auto-reply' }
    )

    const id = `mq-draft-${Date.now()}-${contact.id}`
    const channel = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'
    const draftItem = {
      id, contactId: contact.id, contactName: contact.name,
      contactHandle: contact.social || '',
      contactEmail: contact.email || '',
      contactPhone: contact.phone || '',
      channel,
      subject: `Re: Hey ${contact.name.split(' ')[0]}!`,
      message: `${draft}\n\nHere's the link if you're ready to go: ${link}`,
      seqId: 'auto-reply', stepKey: 'auto-reply',
      seqName: 'Auto-Reply Draft', stepLabel: 'AI Draft Reply',
      status: 'draft',
      createdAt: new Date().toISOString(),
      sentAt: null,
      replyInteractionId: latestReply.id,
    }

    const items = getMQ()
    saveMQWithDraft([draftItem, ...items])
    markDrafted(latestReply.id)
    addPipelineLog({ type: 'auto-draft', contact: contact.name, channel })
    window.dispatchEvent(new CustomEvent('auto-reply-drafted', { detail: { contactName: contact.name } }))

    // Rate limit between AI calls
    await new Promise(r => setTimeout(r, 1500))
  }
}

export default function AutoReplyDrafter() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runDrafter(storeRef.current)
    const t = setTimeout(run, 4 * 60 * 1000) // first run 4 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
