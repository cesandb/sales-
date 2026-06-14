// UpsellEngine — targets existing Customers with a personalized upsell message
// for a complementary product they haven't purchased yet. Runs twice daily.
// One upsell per contact per ISO week, max 5 per run.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { PRODUCTS } from '../data/products'
import { addToMQ } from '../utils/messageQueue'
import { addPipelineLog } from './PipelineAutomationEngine'

const INTERVAL   = 12 * 60 * 60 * 1000
const INITIAL    = 37 * 60 * 1000
const MAX_PER_RUN = 5
const UPSELL_KEY = 'phorm_upsell_v1'

function getISOWeek() {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return `${d.getFullYear()}-W${Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)}`
}

function getSent() {
  try { return JSON.parse(localStorage.getItem(UPSELL_KEY) || '{}') } catch { return {} }
}
function markSent(contactId) {
  const sent = getSent()
  const cutoff = `${new Date().getFullYear() - 1}-W`
  for (const k of Object.keys(sent)) if (k.split('::')[1] < cutoff) delete sent[k]
  sent[`${contactId}::${getISOWeek()}`] = new Date().toISOString()
  localStorage.setItem(UPSELL_KEY, JSON.stringify(sent))
}
function wasSentThisWeek(contactId) {
  return !!getSent()[`${contactId}::${getISOWeek()}`]
}

// Find the best complementary product the contact hasn't bought yet
function getUpsellProduct(contact, purchasedIds) {
  // Use the TAG_SCORES-based approach via product scoring
  const tags  = (contact.tags  || []).map(t => t.toLowerCase())
  const notes = (contact.notes || '').toLowerCase()
  const goal  = (contact.goalSummary || '').toLowerCase()
  const text  = `${tags.join(' ')} ${notes} ${goal}`

  const candidates = PRODUCTS.filter(p => !purchasedIds.has(p.id))
  if (!candidates.length) return null

  // Simple relevance: name/category overlap with contact text
  const scored = candidates.map(p => {
    let score = 0
    const pName = p.name.toLowerCase()
    const pCat  = (p.category || '').toLowerCase()
    if (text.includes(p.id))    score += 8
    if (text.includes(pCat))    score += 4
    if (tags.some(t => pName.includes(t) || t.includes(p.id))) score += 6
    return { product: p, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].product
}

const UPSELL_ANGLES = [
  (fn, prod, prev, link) =>
    `Hey ${fn}! Now that ${prev} is part of your routine, I wanted to share what stacks perfectly with it — ${prod}. My clients who pair these two consistently see better results. Here's my link: ${link}`,
  (fn, prod, _prev, link) =>
    `${fn} — one thing I forgot to mention when you got started: ${prod} is honestly one of the most underrated products in the 1st Phorm lineup for your goals. Thought of you when I saw it. ${link}`,
  (fn, prod, prev, link) =>
    `Hey ${fn}! Quick follow-up — you've been crushing it with ${prev}. The next thing I'd add to your stack is ${prod}. It fills in the gaps and compounds what you're already doing. ${link}`,
]

function runUpsells(store) {
  const { contacts, contactProducts } = store
  if (!contacts?.length) return

  const purchasesByContact = new Map()
  for (const cp of (contactProducts || [])) {
    const a = purchasesByContact.get(cp.contactId) || []; a.push(cp); purchasesByContact.set(cp.contactId, a)
  }

  const eligible = contacts.filter(c =>
    (c.status === 'Customer' || c.status === 'Repeat Customer') &&
    c.status !== 'Inactive' &&
    !wasSentThisWeek(c.id) &&
    (purchasesByContact.get(c.id) || []).length > 0
  )

  let count = 0
  for (const contact of eligible) {
    if (count >= MAX_PER_RUN) break

    const purchases   = purchasesByContact.get(contact.id) || []
    const purchasedIds = new Set(purchases.map(p => p.productId))
    const upsell = getUpsellProduct(contact, purchasedIds)
    if (!upsell) continue

    const lastPurchaseId = purchases[purchases.length - 1]?.productId
    const prevName = PRODUCTS.find(p => p.id === lastPurchaseId)?.name || 'your supplements'

    const link     = buildUTMLink(`https://1stphorm.com/products/${upsell.id}/?a_aid=Conan`, { contactId: contact.id, stepKey: 'upsell' })
    const firstName = contact.name.split(' ')[0]
    const msgFn    = UPSELL_ANGLES[count % UPSELL_ANGLES.length]
    const message  = msgFn(firstName, upsell.name, prevName, link)

    addToMQ({
      contactId:     contact.id,
      contactName:   contact.name,
      contactHandle: contact.social || contact.email || '',
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel:       contact.email ? 'email' : contact.phone ? 'sms' : 'dm',
      subject:       `${firstName}, this pairs perfectly with what you're already using`,
      message,
      seqId:   'upsell',
      stepKey: `upsell-${upsell.id}`,
      seqName: 'Upsell',
      stepLabel: `Upsell: ${upsell.name}`,
    })

    markSent(contact.id)
    addPipelineLog({ type: 'upsell-queued', contact: contact.name, product: upsell.name })
    count++
  }

  if (count > 0) {
    window.dispatchEvent(new CustomEvent('upsell-ran', { detail: { count } }))
  }
}

export default function UpsellEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const t = setTimeout(() => runUpsells(storeRef.current), INITIAL)
    const interval = setInterval(() => runUpsells(storeRef.current), INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
