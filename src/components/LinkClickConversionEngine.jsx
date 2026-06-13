// LinkClickConversionEngine — fires the moment a Bitly click is detected.
// Promotes the contact to Hot Lead and immediately queues a pending (auto-send)
// follow-up message while the prospect is still engaged with the link.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { createBitlyLink, getBitlyKey } from '../utils/bitlyTracker'
import { addPipelineLog } from './PipelineAutomationEngine'

const HOT_KEY = 'phorm_click_hot_v1'
const PROMOTE_FROM = new Set(['New Lead', 'Warm Lead'])

function getTodayHotSet() {
  const today = new Date().toISOString().split('T')[0]
  try {
    const data = JSON.parse(localStorage.getItem(HOT_KEY) || '{}')
    if (data.date !== today) return new Set()
    return new Set(data.ids || [])
  } catch { return new Set() }
}

function saveTodayHotSet(set) {
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(HOT_KEY, JSON.stringify({ date: today, ids: [...set] }))
}

async function handleClick({ contactId, contactName }, store) {
  const { contacts, updateContact } = store
  const contact = contacts.find(c => c.id === contactId)
  if (!contact) return

  const hotSet = getTodayHotSet()
  if (hotSet.has(contactId)) return

  // 1. Promote to Hot Lead while the signal is fresh
  if (PROMOTE_FROM.has(contact.status)) {
    updateContact(contactId, { status: 'Hot Lead' })
    addPipelineLog({ type: 'click-promote', contact: contact.name })
  }

  // 2. Queue an immediate follow-up that auto-sends (status:'pending')
  const firstName = (contactName || contact.name).split(' ')[0]
  const product = matchProduct(contact)
  let link = buildUTMLink(
    `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
    { contactId, stepKey: 'click-hot' }
  )
  if (getBitlyKey()) {
    try {
      const bitly = await createBitlyLink(link, contactId)
      if (bitly?.shortUrl) link = bitly.shortUrl
    } catch {}
  }

  const channel = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'
  addToMQ({
    contactId,
    contactName: contact.name,
    contactHandle: contact.social || '',
    contactEmail: contact.email || '',
    contactPhone: contact.phone || '',
    channel,
    subject: `Hey ${firstName} — quick question`,
    message: `Hey ${firstName}! Noticed you checked out that ${product.name} link — did you have any questions? Happy to help you find the right stack for your goals 💪\n\n${link}`,
    seqId: 'link-click-hot',
    stepKey: 'hot-reply',
    seqName: 'Link Click Hot Follow-Up',
    stepLabel: 'Instant Hot Reply',
  })

  hotSet.add(contactId)
  saveTodayHotSet(hotSet)
  addPipelineLog({ type: 'click-hot', contact: contact.name, channel })
  window.dispatchEvent(new CustomEvent('link-click-hot', {
    detail: { contactName: contact.name },
  }))
}

export default function LinkClickConversionEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const handler = e => {
      const { contactId, contactName } = e.detail || {}
      if (contactId) handleClick({ contactId, contactName }, storeRef.current)
    }
    window.addEventListener('bitly-click-detected', handler)
    return () => window.removeEventListener('bitly-click-detected', handler)
  }, [])

  return null
}
