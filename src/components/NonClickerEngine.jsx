// NonClickerEngine — sends a different-angle follow-up to contacts who received
// outreach 3-21 days ago but never clicked a link and haven't replied.
// Runs every 6 hours, max 5 per run.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'

const NONCICK_KEY  = 'phorm_nonclicker_v1'
const INTERVAL_MS  = 6 * 60 * 60 * 1000
const MAX_PER_RUN  = 5
const MIN_DAYS_MS  = 3  * 24 * 60 * 60 * 1000
const MAX_DAYS_MS  = 21 * 24 * 60 * 60 * 1000

const SKIP_STATUSES  = new Set(['Customer', 'Repeat Customer', 'Evangelist', 'Inactive'])
const OUTREACH_TYPES = new Set(['Email', 'SMS', 'DM', 'Reddit DM', 'Outreach'])
const REPLY_TYPES    = new Set(['Email Reply', 'Reddit Reply', 'DM Reply', 'Reply'])

function getNonClickerSet() {
  try { return new Set(JSON.parse(localStorage.getItem(NONCICK_KEY) || '[]')) }
  catch { return new Set() }
}

function saveNonClickerSet(set) {
  const arr = [...set]
  if (arr.length > 10000) arr.splice(0, arr.length - 10000)
  localStorage.setItem(NONCICK_KEY, JSON.stringify(arr))
}

const ANGLES = [
  (firstName, product, link) =>
    `Hey ${firstName}! Just wanted to circle back — a lot of people working on similar goals have had great results with ${product.name}. No pressure at all, just wanted to make sure you had the info 💪\n\n${link}`,
  (firstName, product, link) =>
    `${firstName} — quick thought. Instead of going straight to ${product.name}, have you considered what the full stack looks like? Sometimes the combo works way better. Happy to break it down if you're curious!\n\n${link}`,
  (firstName, _product, link) =>
    `Hey ${firstName}! Last one from me — if timing or budget was the hold-up, 1st Phorm regularly runs deals and I can point you to the right one. Just want to make sure you have what you need to crush it 🙌\n\n${link}`,
]

function runNonClicker(store) {
  const { contacts, interactions } = store
  if (!contacts.length) return

  const done = getNonClickerSet()
  const now  = Date.now()

  const outreachMap = new Map()
  const clickSet    = new Set()
  const replySet    = new Set()

  for (const i of interactions) {
    const ts = new Date(i.date).getTime()
    if (i.type === 'Link Click') {
      clickSet.add(i.contactId)
    } else if (OUTREACH_TYPES.has(i.type)) {
      const prev = outreachMap.get(i.contactId) || 0
      if (ts > prev) outreachMap.set(i.contactId, ts)
    } else if (REPLY_TYPES.has(i.type)) {
      replySet.add(i.contactId)
    }
  }

  let count = 0
  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (SKIP_STATUSES.has(contact.status)) continue
    if (done.has(contact.id)) continue
    if (clickSet.has(contact.id)) continue
    if (replySet.has(contact.id)) continue

    const lastOutreach = outreachMap.get(contact.id)
    if (!lastOutreach) continue
    const age = now - lastOutreach
    if (age < MIN_DAYS_MS || age > MAX_DAYS_MS) continue

    const product = matchProduct(contact)
    const link = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: 'nonclicker-angle2' }
    )
    const firstName = contact.name.split(' ')[0]
    const message = ANGLES[count % ANGLES.length](firstName, product, link)
    const channel = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'

    addToMQ({
      contactId: contact.id,
      contactName: contact.name,
      contactHandle: contact.social || '',
      contactEmail: contact.email || '',
      contactPhone: contact.phone || '',
      channel,
      subject: `${firstName} — still thinking about it?`,
      message,
      seqId: 'nonclicker-followup',
      stepKey: 'angle2',
      seqName: 'Non-Clicker Follow-Up',
      stepLabel: 'New Angle',
    })

    addPipelineLog({ type: 'nonclicker', contact: contact.name, channel })
    done.add(contact.id)
    count++
  }

  if (count > 0) {
    saveNonClickerSet(done)
    window.dispatchEvent(new CustomEvent('nonclicker-ran', { detail: { count } }))
  }
}

export default function NonClickerEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runNonClicker(storeRef.current)
    const t = setTimeout(run, 7 * 60 * 1000)
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
