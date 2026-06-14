// DealAutoCreateEngine — automatically creates pipeline deals for contacts that
// have crossed the engagement threshold (tier:hot or tier:champion) but have no
// open deal yet. Runs every 3 hours. Keeps the pipeline populated without
// requiring manual deal creation.

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { matchProduct } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'
import { batchCalcLeadScores } from '../utils/leadScore'

const INITIAL_MS  = 25 * 60 * 1000
const INTERVAL_MS = 3 * 60 * 60 * 1000
const DONE_KEY    = 'phorm_deal_auto_v1'  // Set of contactIds already had deal created
const MAX_PER_RUN = 5
const MIN_SCORE   = 55  // threshold to auto-create a deal

function getDoneSet() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')) }
  catch { return new Set() }
}

function saveDoneSet(set) {
  const arr = [...set]
  if (arr.length > 2000) arr.splice(0, arr.length - 2000)
  localStorage.setItem(DONE_KEY, JSON.stringify(arr))
}

function runDealAutoCreate(s) {
  const { contacts, deals, interactions, followups, pipeline, addDeal } = s
  if (!contacts?.length || typeof addDeal !== 'function') return

  const scores  = batchCalcLeadScores(contacts, interactions || [], followups || [], pipeline || [])
  const done    = getDoneSet()

  // Build set of contactIds that already have an open deal
  const openDeals = new Set(
    (deals || [])
      .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
      .map(d => d.contactId)
  )

  let count = 0
  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (done.has(contact.id)) continue
    if (openDeals.has(contact.id)) continue

    const sc = scores.get(contact.id)
    if (!sc || sc.score < MIN_SCORE) continue

    // Only create for leads/hot leads — not for existing customers (they go through UpsellEngine)
    if (['Customer', 'Repeat Customer', 'Evangelist', 'Inactive'].includes(contact.status)) continue

    const product = matchProduct(contact)
    const value   = product.price || 49.99

    addDeal({
      contactId:   contact.id,
      title:       `${contact.name} — ${product.name}`,
      stage:       contact.status === 'Hot Lead' ? 'proposal' : 'qualified',
      amount:      value,
      probability: contact.status === 'Hot Lead' ? 60 : 30,
      notes:       `Auto-created: engagement score ${sc.score} (${sc.tier} tier). Recommended product: ${product.name}.`,
    })

    done.add(contact.id)
    count++
    addPipelineLog({ type: 'deal-auto-created', contact: contact.name, score: sc.score, product: product.name })
  }

  saveDoneSet(done)

  if (count > 0) {
    window.dispatchEvent(new CustomEvent('deal-auto-created', { detail: { count } }))
  }
}

export default function DealAutoCreateEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runDealAutoCreate(storeRef.current)
    const t   = setTimeout(run, INITIAL_MS)
    const iv  = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
