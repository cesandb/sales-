// HotLeadNurtureEngine — sends aggressive follow-ups to Hot Lead contacts
// with no outreach in the last 12 hours. Up to 3 touches per contact with
// rotating angles, then stops. Runs every 2 hours. MQAutoSender delivers.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { createBitlyLink, getBitlyKey } from '../utils/bitlyTracker'
import { addPipelineLog } from './PipelineAutomationEngine'

const NURTURE_KEY  = 'phorm_hot_nurture_v1'
const INTERVAL_MS  = 2 * 60 * 60 * 1000
const COOLDOWN_MS  = 12 * 60 * 60 * 1000
const MAX_TOUCHES  = 3
const MAX_PER_RUN  = 5

const OUTREACH_TYPES = new Set(['Email', 'SMS', 'DM', 'Reddit DM', 'Outreach'])

const TOUCHES = [
  (n, p, l) =>
    `Hey ${n}! Just checking in — have you had a chance to look at that ${p.name} link? Happy to answer any questions before you decide 💪\n\n${l}`,
  (n, p, l) =>
    `${n} — quick note. The most common questions I get about ${p.name}: Does it actually work? (Yes, for the right goals.) Is it worth it? (For most people I've recommended it to, absolutely.) What else can I answer?\n\n${l}`,
  (n, p, l) =>
    `Hey ${n}! Last follow-up from me on this — if ${p.name} isn't the right fit for where you're at, I can help you find what is. 1st Phorm has a full lineup and I know it well. Just say the word 🙌\n\n${l}`,
]

function getNurtureData() {
  try { return JSON.parse(localStorage.getItem(NURTURE_KEY) || '{}') }
  catch { return {} }
}

function saveNurtureData(data) {
  localStorage.setItem(NURTURE_KEY, JSON.stringify(data))
}

async function runHotLeadNurture(store) {
  const { contacts, interactions } = store
  if (!contacts.length) return

  const now = Date.now()
  const nurtureData = getNurtureData()

  // Latest outreach per contact from interaction log
  const lastOutreach = new Map()
  for (const i of interactions) {
    if (!OUTREACH_TYPES.has(i.type)) continue
    const ts = new Date(i.date).getTime()
    const prev = lastOutreach.get(i.contactId) || 0
    if (ts > prev) lastOutreach.set(i.contactId, ts)
  }

  let count = 0
  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (contact.status !== 'Hot Lead') continue

    const nd = nurtureData[contact.id] || { touches: 0, lastTs: 0 }
    if (nd.touches >= MAX_TOUCHES) continue
    if (now - nd.lastTs < COOLDOWN_MS) continue

    const lastIA = lastOutreach.get(contact.id) || 0
    if (now - lastIA < COOLDOWN_MS) continue

    const product = matchProduct(contact)
    let link = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: `hot-nurture-t${nd.touches + 1}` }
    )
    if (getBitlyKey()) {
      try {
        const b = await createBitlyLink(link, contact.id)
        if (b?.shortUrl) link = b.shortUrl
      } catch {}
    }

    const firstName = contact.name.split(' ')[0]
    const msgFn     = TOUCHES[nd.touches % TOUCHES.length]
    const channel   = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'

    addToMQ({
      contactId: contact.id,
      contactName: contact.name,
      contactHandle: contact.social || '',
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel,
      subject: `${firstName} — quick question`,
      message: msgFn(firstName, product, link),
      seqId:     'hot-lead-nurture',
      stepKey:   `touch-${nd.touches + 1}`,
      seqName:   'Hot Lead Nurture',
      stepLabel: `Touch ${nd.touches + 1}`,
    })

    addPipelineLog({ type: 'hot-nurture', contact: contact.name, touch: nd.touches + 1 })
    nurtureData[contact.id] = { touches: nd.touches + 1, lastTs: now }
    count++
  }

  if (count > 0) {
    saveNurtureData(nurtureData)
    window.dispatchEvent(new CustomEvent('hot-nurture-ran', { detail: { count } }))
  }
}

export default function HotLeadNurtureEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runHotLeadNurture(storeRef.current)
    const t = setTimeout(run, 3 * 60 * 1000)
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
