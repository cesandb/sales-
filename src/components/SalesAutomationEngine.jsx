import { useRef, useEffect } from 'react'
import { addDays, format } from 'date-fns'
import { useStore } from '../store/useStore'
import { matchProduct } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'
import { calcLeadScore } from '../utils/leadScore'

const RUN_INTERVAL = 10 * 60 * 1000 // every 10 minutes

const PURCHASE_SIGNALS = [
  'just ordered', 'placed an order', 'bought it', 'purchased', 'ordered it',
  'checked out', 'bought the', 'made a purchase', 'placed order', 'just bought',
  'i ordered', 'already ordered', 'went ahead and ordered', 'just got it',
  'ordered today', 'bought today', 'made the purchase', 'went with it',
]

// Notes/tags keyword → extra tags to add
const KEYWORD_TAG_MAP = {
  'protein':             ['protein', 'fitness'],
  'marathon':            ['marathon', 'endurance', 'runner'],
  'triathlon':           ['triathlon', 'endurance'],
  'crossfit':            ['crossfit', 'hiit'],
  'keto':                ['keto', 'weightloss'],
  'weight loss':         ['weightloss', 'fatburner'],
  'lose weight':         ['weightloss', 'fatburner'],
  'build muscle':        ['muscle', 'protein'],
  'bulk':                ['bulking', 'muscle', 'protein'],
  'bodybuilding':        ['bodybuilding', 'muscle'],
  'running':             ['runner', 'endurance'],
  'pre-workout':         ['pre-workout', 'energy'],
  'preworkout':          ['pre-workout', 'energy'],
  'creatine':            ['muscle', 'gym', 'supplements'],
  'greens':              ['health', 'opti-greens'],
  'vitamins':            ['health', 'supplements'],
  'energy':              ['energy'],
  'recovery':            ['recovery'],
  'joints':              ['joints', 'recovery'],
  'kids':                ['parent', 'family'],
  'children':            ['parent', 'family'],
  'vegan':               ['vegan', 'health', 'fitness'],
  'paleo':               ['paleo', 'health'],
  'intermittent fasting':['weightloss', 'keto'],
  'hiit':                ['hiit', 'energy'],
  'endurance':           ['endurance', 'runner'],
  'b2b':                 ['b2b-prospect'],
  'gym owner':           ['b2b-prospect', 'gym'],
  'trainer':             ['athlete', 'fitness'],
  'coach':               ['health', 'fitness'],
  'yoga':                ['health', 'fitness'],
}

// Score thresholds for auto-promotion along the status funnel
const STATUS_PROMOTIONS = [
  { from: 'New Lead',  minScore: 55, to: 'Warm Lead' },
  { from: 'Warm Lead', minScore: 72, to: 'Hot Lead' },
  { from: 'Hot Lead',  minScore: 88, to: 'Opportunity' },
]

const PURCHASE_KEY  = 'phorm_purchase_detected'
const TAG_KEY       = 'phorm_tag_enriched'
const PIPELINE_KEY  = 'phorm_pipeline_auto'
const DEAL_KEY      = 'phorm_deal_auto'
const PROMOTE_KEY   = 'phorm_status_promoted'

function getSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) }
  catch { return new Set() }
}

function saveSet(key, set) {
  const arr = [...set]
  if (arr.length > 5000) arr.splice(0, arr.length - 5000)
  localStorage.setItem(key, JSON.stringify(arr))
}

async function runSalesAutomation(store) {
  const {
    contacts, interactions, pipeline, followups, deals,
    settings, contactProducts, enrollments,
    addContactProduct, addPipelineItem, addDeal, addFollowup,
    updateContact,
  } = store

  const purchaseDetected = getSet(PURCHASE_KEY)
  const tagEnriched      = getSet(TAG_KEY)
  const pipelineAuto     = getSet(PIPELINE_KEY)
  const dealAuto         = getSet(DEAL_KEY)
  const promoted         = getSet(PROMOTE_KEY)

  let changes = 0
  const now = new Date()

  // ── A: Auto-detect purchases from interaction notes ──────────────────────
  for (const interaction of interactions) {
    const notes = (interaction.notes || '').toLowerCase()
    const key = `${interaction.contactId}::${interaction.id}`
    if (purchaseDetected.has(key)) { continue }

    const hasPurchaseSignal = PURCHASE_SIGNALS.some(sig => notes.includes(sig))
    purchaseDetected.add(key)
    if (!hasPurchaseSignal) continue

    const contact = contacts.find(c => c.id === interaction.contactId)
    if (!contact) continue

    // Avoid double-logging within 7 days
    const recentPurchase = contactProducts.find(cp => {
      if (cp.contactId !== contact.id) return false
      return (now - new Date(cp.purchaseDate)) < 7 * 24 * 60 * 60 * 1000
    })
    if (recentPurchase) continue

    const product = matchProduct(contact)
    addContactProduct({
      contactId: contact.id,
      productId: product.id,
      orderValue: settings.avgOrderValue || 45,
      commissionRate: settings.commissionRate || 0.15,
    })
    // Promote contact to Customer if not already a buyer
    const nonCustomer = contact.status !== 'Customer' && contact.status !== 'Repeat Customer' && contact.status !== 'Evangelist'
    if (nonCustomer) updateContact(contact.id, { status: 'Customer' })
    addPipelineLog({ type: 'auto-purchase', contact: contact.name, product: product.name })
    changes++
  }
  saveSet(PURCHASE_KEY, purchaseDetected)

  // ── B: Auto-tag enrichment from notes keywords ────────────────────────
  for (const contact of contacts) {
    if (tagEnriched.has(contact.id)) continue
    tagEnriched.add(contact.id)

    const text = [(contact.notes || ''), ...(contact.tags || [])].join(' ').toLowerCase()
    const existingTags = new Set((contact.tags || []).map(t => t.toLowerCase()))
    const newTags = []

    for (const [keyword, tags] of Object.entries(KEYWORD_TAG_MAP)) {
      if (text.includes(keyword)) {
        for (const tag of tags) {
          if (!existingTags.has(tag)) {
            newTags.push(tag)
            existingTags.add(tag)
          }
        }
      }
    }

    if (newTags.length > 0) {
      updateContact(contact.id, { tags: [...(contact.tags || []), ...newTags] })
      changes++
    }
  }
  saveSet(TAG_KEY, tagEnriched)

  // ── C: Auto-status promotion based on lead score ─────────────────────
  for (const contact of contacts) {
    const promo = STATUS_PROMOTIONS.find(p => p.from === contact.status)
    if (!promo) continue

    // Only promote each contact once per status level
    const promoteKey = `${contact.id}::${contact.status}`
    if (promoted.has(promoteKey)) continue

    const score = calcLeadScore(contact, interactions, followups, pipeline)
    if (score >= promo.minScore) {
      updateContact(contact.id, { status: promo.to })
      addPipelineLog({ type: 'auto-promote', contact: contact.name, from: promo.from, to: promo.to, score })
      promoted.add(promoteKey)
      changes++
    }
  }
  saveSet(PROMOTE_KEY, promoted)

  // ── D: Auto-pipeline entry for Hot Leads & Opportunities ─────────────
  for (const contact of contacts) {
    if (contact.status !== 'Hot Lead' && contact.status !== 'Opportunity') continue
    if (pipelineAuto.has(contact.id)) continue
    pipelineAuto.add(contact.id)

    const hasPipeline = pipeline.some(p => p.contactId === contact.id)
    if (hasPipeline) continue

    const stage = contact.status === 'Opportunity' ? 'qualifying' : 'prospecting'
    addPipelineItem({
      contactId: contact.id,
      stage,
      notes: `Auto-added: ${contact.status}`,
      updatedAt: new Date().toISOString(),
    })
    addPipelineLog({ type: 'auto-pipeline', contact: contact.name, stage })
    changes++
  }
  saveSet(PIPELINE_KEY, pipelineAuto)

  // ── E: Auto-deal creation for Opportunities ───────────────────────────
  for (const contact of contacts) {
    if (contact.status !== 'Opportunity') continue
    if (dealAuto.has(contact.id)) continue
    dealAuto.add(contact.id)

    const hasOpenDeal = (deals || []).some(
      d => d.contactId === contact.id && d.stage !== 'closed_lost'
    )
    if (hasOpenDeal) continue

    const product = matchProduct(contact)
    const closeDate = format(addDays(now, 14), 'yyyy-MM-dd')
    addDeal({
      contactId: contact.id,
      title: `${contact.name} – ${product.name}`,
      amount: settings.avgOrderValue || 45,
      stage: 'qualifying',
      probability: 40,
      closeDate,
      notes: 'Auto-created from Opportunity status',
    })
    addPipelineLog({ type: 'auto-deal', contact: contact.name, product: product.name })
    changes++
  }
  saveSet(DEAL_KEY, dealAuto)

  // ── F: Auto-schedule follow-ups for stale Hot / Warm leads ───────────
  const staleStatuses = new Set(['Hot Lead', 'Warm Lead'])
  const threeDaysAgo  = new Date(now - 3 * 24 * 60 * 60 * 1000)

  for (const contact of contacts) {
    if (!staleStatuses.has(contact.status)) continue

    const hasPending = followups.some(
      f => f.contactId === contact.id && f.status === 'pending'
    )
    if (hasPending) continue

    const lastTouched = contact.lastContact
      ? new Date(contact.lastContact)
      : new Date(contact.createdAt)
    if (lastTouched > threeDaysAgo) continue

    const staleDays = Math.floor((now - lastTouched) / 86400000)
    const followupDate = format(addDays(now, 1), 'yyyy-MM-dd')
    addFollowup({
      contactId: contact.id,
      date: followupDate,
      notes: `Auto-scheduled: ${contact.status} — ${staleDays}d since last contact`,
      type: 'Email',
    })
    addPipelineLog({ type: 'auto-followup', contact: contact.name, status: contact.status, staleDays })
    changes++
  }

  if (changes > 0) {
    window.dispatchEvent(new CustomEvent('sales-automation-ran', { detail: { changes } }))
  }
}

export default function SalesAutomationEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const t = setTimeout(() => runSalesAutomation(storeRef.current), 60000)
    const interval = setInterval(() => runSalesAutomation(storeRef.current), RUN_INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
