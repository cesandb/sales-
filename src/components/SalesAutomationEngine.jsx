import { useRef, useEffect } from 'react'
import { addDays, format } from 'date-fns'
import { useStore } from '../store/useStore'
import { matchProduct } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'
import { batchCalcLeadScores } from '../utils/leadScore'
import { parseSocialHandle } from '../utils/platformLinks'
import { getHunterKey, autoEnrichContact } from '../utils/contactEnrich'
import { getApolloKey, apolloSearchFitnessPros, markContactImported, getImportedKeys } from '../utils/apolloEnrich'

const RUN_INTERVAL = 10 * 60 * 1000 // every 10 minutes

const PURCHASE_SIGNALS = [
  'just ordered', 'placed an order', 'bought it', 'purchased', 'ordered it',
  'checked out', 'bought the', 'made a purchase', 'placed order', 'just bought',
  'i ordered', 'already ordered', 'went ahead and ordered', 'just got it',
  'ordered today', 'bought today', 'made the purchase', 'went with it',
]

const CLOSE_SIGNALS = ['closed', 'closed the deal', 'signed up', 'paid', 'confirmed order', 'placed order', 'bought', 'purchased']

// Notes/tags keyword → extra tags to add
const KEYWORD_TAG_MAP = {
  'protein':              ['protein', 'fitness'],
  'marathon':             ['marathon', 'endurance', 'runner'],
  'triathlon':            ['triathlon', 'endurance'],
  'crossfit':             ['crossfit', 'hiit'],
  'keto':                 ['keto', 'weightloss'],
  'weight loss':          ['weightloss', 'fatburner'],
  'lose weight':          ['weightloss', 'fatburner'],
  'build muscle':         ['muscle', 'protein'],
  'bulk':                 ['bulking', 'muscle', 'protein'],
  'bodybuilding':         ['bodybuilding', 'muscle'],
  'powerlifting':         ['bodybuilding', 'muscle', 'gym'],
  'running':              ['runner', 'endurance'],
  'cycling':              ['endurance', 'athlete'],
  'swimming':             ['endurance', 'athlete'],
  'pre-workout':          ['pre-workout', 'energy'],
  'preworkout':           ['pre-workout', 'energy'],
  'creatine':             ['muscle', 'gym', 'supplements'],
  'greens':               ['health', 'supplements'],
  'vitamins':             ['health', 'supplements'],
  'energy':               ['energy'],
  'recovery':             ['recovery'],
  'joints':               ['joints', 'recovery'],
  'kids':                 ['parent', 'family'],
  'children':             ['parent', 'family'],
  'vegan':                ['vegan', 'health', 'fitness'],
  'paleo':                ['paleo', 'health'],
  'intermittent fasting': ['weightloss', 'keto'],
  'hiit':                 ['hiit', 'energy'],
  'endurance':            ['endurance', 'runner'],
  'b2b':                  ['b2b-prospect'],
  'gym owner':            ['b2b-prospect', 'gym'],
  'trainer':              ['athlete', 'fitness'],
  'coach':                ['health', 'fitness'],
  'yoga':                 ['health', 'fitness'],
  'meal prep':            ['health', 'fitness', 'nutrition'],
  'nutrition':            ['health', 'fitness'],
}

// Score thresholds for auto-promotion along the status funnel
const STATUS_PROMOTIONS = [
  { from: 'New Lead',  minScore: 55, to: 'Warm Lead' },
  { from: 'Warm Lead', minScore: 72, to: 'Hot Lead' },
  { from: 'Hot Lead',  minScore: 88, to: 'Opportunity' },
]

// Auto-advance deal stages based on interaction count
const DEAL_STAGE_ADVANCES = [
  { from: 'prospecting', to: 'qualifying',  minInteractions: 2,  probDelta: 15 },
  { from: 'qualifying',  to: 'proposal',    minInteractions: 4,  probDelta: 20 },
  { from: 'proposal',    to: 'negotiating', minInteractions: 6,  probDelta: 20 },
]

const PURCHASE_KEY        = 'phorm_purchase_detected'
const TAG_KEY             = 'phorm_tag_enriched'
const PIPELINE_KEY        = 'phorm_pipeline_auto'
const DEAL_KEY            = 'phorm_deal_auto'
const PROMOTE_KEY         = 'phorm_status_promoted'
const DEAL_ADV_KEY        = 'phorm_deal_advance'
const MORNING_BURST_KEY   = 'phorm_morning_burst_date'
const MORNING_BURST_LIMIT = 15
const MORNING_BURST_START = 7  // 7am
const MORNING_BURST_END   = 10 // 10am

function getSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) }
  catch { return new Set() }
}

function saveSet(key, set) {
  const arr = [...set]
  if (arr.length > 10000) arr.splice(0, arr.length - 10000)
  localStorage.setItem(key, JSON.stringify(arr))
}

// Build per-contact index Maps in a single pass — eliminates N+1 loops
function buildIndexMaps(interactions, followups, pipeline, contactProducts, deals) {
  const iByC  = new Map()
  const fuByC = new Map()
  const piByC = new Map()
  const cpByC = new Map()
  const dByC  = new Map()
  for (const i  of interactions)    { const a = iByC.get(i.contactId)  || []; a.push(i);  iByC.set(i.contactId, a) }
  for (const f  of followups)       { const a = fuByC.get(f.contactId) || []; a.push(f);  fuByC.set(f.contactId, a) }
  for (const p  of pipeline)        { const a = piByC.get(p.contactId) || []; a.push(p);  piByC.set(p.contactId, a) }
  for (const cp of contactProducts) { const a = cpByC.get(cp.contactId) || []; a.push(cp); cpByC.set(cp.contactId, a) }
  for (const d  of (deals || []))   { const a = dByC.get(d.contactId)  || []; a.push(d);  dByC.set(d.contactId, a) }
  return { iByC, fuByC, piByC, cpByC, dByC }
}

async function runSalesAutomation(store) {
  const {
    contacts, interactions, pipeline, followups, deals,
    settings, contactProducts, enrollments,
    addContactProduct, addPipelineItem, addDeal, addFollowup, addEnrollment,
    updateContact, updateDeal,
  } = store

  const purchaseDetected = getSet(PURCHASE_KEY)
  const tagEnriched      = getSet(TAG_KEY)
  const pipelineAuto     = getSet(PIPELINE_KEY)
  const dealAuto         = getSet(DEAL_KEY)
  const promoted         = getSet(PROMOTE_KEY)
  const dealAdvanced     = getSet(DEAL_ADV_KEY)

  let changes = 0
  const now = new Date()

  // Pre-build all lookup Maps — one pass each, no N+1 in loops below
  const { iByC, fuByC, piByC, cpByC, dByC } = buildIndexMaps(
    interactions, followups, pipeline, contactProducts, deals
  )
  const enrByC = new Map()
  for (const e of (enrollments || [])) {
    const a = enrByC.get(e.contactId) || []; a.push(e); enrByC.set(e.contactId, a)
  }

  // Pre-compute all lead scores in one batch (single pass over interactions/followups/pipeline)
  const scoreMap = batchCalcLeadScores(contacts, interactions, followups, pipeline)

  // ── A: Auto-detect purchases from interaction notes ──────────────────────
  for (const interaction of interactions) {
    const notes = (interaction.notes || '').toLowerCase()
    const key = `${interaction.contactId}::${interaction.id}`
    if (purchaseDetected.has(key)) { purchaseDetected.add(key); continue }

    const hasPurchaseSignal = PURCHASE_SIGNALS.some(sig => notes.includes(sig))
    purchaseDetected.add(key)
    if (!hasPurchaseSignal) continue

    const contact = contacts.find(c => c.id === interaction.contactId)
    if (!contact) continue

    const recentPurchase = (cpByC.get(contact.id) || []).find(cp =>
      (now - new Date(cp.purchaseDate)) < 7 * 24 * 60 * 60 * 1000
    )
    if (recentPurchase) continue

    const product = matchProduct(contact)
    addContactProduct({
      contactId: contact.id,
      productId: product.id,
      orderValue: settings.avgOrderValue || 45,
      commissionRate: settings.commissionRate || 0.15,
    })
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
          if (!existingTags.has(tag)) { newTags.push(tag); existingTags.add(tag) }
        }
      }
    }

    if (newTags.length > 0) {
      updateContact(contact.id, { tags: [...(contact.tags || []), ...newTags] })
      changes++
    }
  }
  saveSet(TAG_KEY, tagEnriched)

  // ── C: Auto-status promotion based on pre-computed lead scores ────────
  for (const contact of contacts) {
    const promo = STATUS_PROMOTIONS.find(p => p.from === contact.status)
    if (!promo) continue

    const promoteKey = `${contact.id}::${contact.status}`
    if (promoted.has(promoteKey)) continue

    const { score } = scoreMap.get(contact.id) || { score: 0 }
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

    if ((piByC.get(contact.id) || []).length > 0) continue

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

    const hasOpenDeal = (dByC.get(contact.id) || []).some(d => d.stage !== 'closed_lost')
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

    const hasPending = (fuByC.get(contact.id) || []).some(f => f.status === 'pending')
    if (hasPending) continue

    const lastTouched = contact.lastContact
      ? new Date(contact.lastContact)
      : new Date(contact.createdAt)
    if (lastTouched > threeDaysAgo) continue

    const staleDays = Math.floor((now - lastTouched) / 86400000)
    addFollowup({
      contactId: contact.id,
      date: format(addDays(now, 1), 'yyyy-MM-dd'),
      notes: `Auto-scheduled: ${contact.status} — ${staleDays}d since last contact`,
      type: 'Email',
    })
    addPipelineLog({ type: 'auto-followup', contact: contact.name, status: contact.status, staleDays })
    changes++
  }

  // ── G: Auto-advance deal stages based on interaction count ────────────
  for (const deal of (deals || [])) {
    if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') continue
    const advKey = `${deal.id}::${deal.stage}`
    if (dealAdvanced.has(advKey)) continue

    const contactInteractions = iByC.get(deal.contactId) || []
    const allNotes = contactInteractions.map(i => (i.notes || '').toLowerCase()).join(' ')

    // Check for close signal → closed_won
    if (CLOSE_SIGNALS.some(sig => allNotes.includes(sig))) {
      updateDeal(deal.id, { stage: 'closed_won', probability: 100 })
      addPipelineLog({ type: 'auto-deal-close', title: deal.title })
      dealAdvanced.add(advKey)
      changes++
      continue
    }

    const advance = DEAL_STAGE_ADVANCES.find(a => a.from === deal.stage)
    if (!advance) continue
    if (contactInteractions.length >= advance.minInteractions) {
      updateDeal(deal.id, { stage: advance.to, probability: Math.min((deal.probability || 10) + advance.probDelta, 90) })
      addPipelineLog({ type: 'auto-deal-advance', title: deal.title, from: advance.from, to: advance.to })
      dealAdvanced.add(advKey)
      changes++
    }
  }
  saveSet(DEAL_ADV_KEY, dealAdvanced)

  // ── I: Apollo.io auto-import fitness professionals ───────────────────────
  // Runs once per hour max — searches for new leads with verified emails
  if (getApolloKey()) {
    const apolloRanKey = 'phorm_apollo_last_run'
    const lastRun = parseInt(localStorage.getItem(apolloRanKey) || '0')
    if (Date.now() - lastRun > 60 * 60 * 1000) {
      localStorage.setItem(apolloRanKey, String(Date.now()))
      const { addContact } = store
      try {
        const newContacts = await apolloSearchFitnessPros()
        const imported = getImportedKeys()
        for (const c of newContacts) {
          const dk = c._dedupKey
          if (imported.has(dk)) continue
          // Check if we already have this email
          const emailExists = c.email && contacts.some(ex => ex.email === c.email)
          if (emailExists) { markContactImported(dk); continue }
          const { _dedupKey, ...contactData } = c
          addContact(contactData)
          markContactImported(dk)
          addPipelineLog({ type: 'apollo-import', contact: c.name, email: c.email })
          changes++
        }
      } catch {}
    }
  }

  // ── H: Auto-enrich contacts via Hunter.io (email finder) ─────────────
  // Only runs when a Hunter.io key is configured; limits to 5 contacts/run
  if (getHunterKey()) {
    const needsEnrich = contacts.filter(c =>
      !c.email && c.social && c.name
    ).slice(0, 5)

    for (const contact of needsEnrich) {
      const parsed = parseSocialHandle(contact.social)
      if (!parsed) continue
      // Only attempt for domain-type socials or known publisher platforms
      if (!parsed.isDomain && !['HackerNews', 'Medium', 'Dev.to', 'GitHub'].includes(parsed.platform)) continue

      try {
        const found = await autoEnrichContact(contact, parsed)
        if (found) {
          updateContact(contact.id, { email: found })
          addPipelineLog({ type: 'auto-enrich', contact: contact.name, email: found })
          changes++
        }
      } catch {}

      // Rate-limit between Hunter.io calls
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // ── J: Morning burst — auto-enroll top cold contacts once per day (7–10am) ──
  const burstHour = now.getHours()
  if (burstHour >= MORNING_BURST_START && burstHour < MORNING_BURST_END) {
    const todayBurst = now.toISOString().split('T')[0]
    if (localStorage.getItem(MORNING_BURST_KEY) !== todayBurst) {
      localStorage.setItem(MORNING_BURST_KEY, todayBurst)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      const burst = contacts
        .filter(c => {
          if (!['New Lead', 'Warm Lead'].includes(c.status)) return false
          if ((enrByC.get(c.id) || []).some(e => e.status === 'active')) return false
          const last = c.lastContact ? new Date(c.lastContact) : new Date(c.createdAt)
          return last < threeDaysAgo
        })
        .sort((a, b) => {
          const sa = (scoreMap.get(a.id) || { score: 0 }).score
          const sb = (scoreMap.get(b.id) || { score: 0 }).score
          return sb - sa
        })
        .slice(0, MORNING_BURST_LIMIT)
      for (const c of burst) {
        addEnrollment({ contactId: c.id, sequenceId: 'seq-cold-intro' })
        addPipelineLog({ type: 'morning-burst', contact: c.name })
      }
      if (burst.length) {
        changes += burst.length
        window.dispatchEvent(new CustomEvent('morning-burst-ran', { detail: { count: burst.length } }))
      }
    }
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
