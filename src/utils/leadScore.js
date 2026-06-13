/**
 * calcLeadScore — computes a 0–100 lead score and tier for a contact.
 *
 * @param {object} contact      — contact record from useStore
 * @param {object[]} interactions — all interactions from useStore
 * @param {object[]} followups  — all followups from useStore
 * @param {object[]} pipeline   — all pipeline items from useStore
 * @returns {{ score: number, tier: 'cold'|'warm'|'hot'|'champion' }}
 */
const BUYING_SIGNALS = [
  'bought', 'purchase', 'order', 'want to try', 'sign me up', 'how much',
  "what's the price", 'interested in buying', 'ready to', 'just ordered',
  'going to buy', 'add to cart', 'checkout',
]

const REPLY_SIGNALS = ['replied', 'reply', 'responded', 'got back to me', 'got a reply']

export function calcLeadScore(contact, interactions = [], followups = [], pipeline = []) {
  let score = 0

  // ── Status weight ────────────────────────────────────────────────────────
  const statusWeights = {
    'New Lead':        10,
    'Warm Lead':       30,
    'Hot Lead':        55,
    'Opportunity':     60,
    'Customer':        70,
    'Repeat Customer': 90,
    'At Risk':         40,
    'Evangelist':      85,
    'Inactive':         0,
  }
  score += statusWeights[contact.status] ?? 0

  // ── Recency bonus (based on lastContact) ─────────────────────────────────
  if (contact.lastContact) {
    const now = new Date()
    const last = new Date(contact.lastContact)
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24))
    if (diffDays <= 3)       score += 15
    else if (diffDays <= 7)  score += 10
    else if (diffDays <= 14) score += 5
    else                     score -= 5
  }

  // ── Interaction quality (with time decay) ───────────────────────────────
  const contactInteractions = interactions.filter(i => i.contactId === contact.id)
  const now30 = Date.now()
  let interactionScore = 0
  for (const i of contactInteractions) {
    const ageDays = i.date ? Math.floor((now30 - new Date(i.date)) / 86400000) : 99
    if (ageDays <= 7)       interactionScore += 5
    else if (ageDays <= 14) interactionScore += 4
    else if (ageDays <= 30) interactionScore += 3
    else if (ageDays <= 60) interactionScore += 1
    // interactions >60 days contribute 0 (time decay)
  }
  score += Math.min(interactionScore, 20)

  const allNotes = contactInteractions.map(i => (i.notes || '').toLowerCase()).join(' ')
  if (BUYING_SIGNALS.some(kw => allNotes.includes(kw))) score += 20
  if (REPLY_SIGNALS.some(kw => allNotes.includes(kw))) score += 10

  // ── Contact quality signals ──────────────────────────────────────────────
  if (contact.email)  score += 4
  if (contact.phone)  score += 4
  if (contact.social) score += 2

  const tags = (contact.tags || []).map(t => t.toLowerCase())
  if (tags.some(t => ['b2b-prospect', 'federal_award', 'event-organizer'].includes(t))) score += 15
  if (tags.some(t => ['intent-signal', 'content-creator', 'youtube'].includes(t))) score += 10
  if (tags.length > 0) score += 3

  // ── Pipeline and follow-up ───────────────────────────────────────────────
  if (pipeline.some(p => p.contactId === contact.id)) score += 5
  if (followups.some(f => f.contactId === contact.id && f.status === 'pending')) score += 5

  // ── Urgency: At Risk needs action even if score would be lower ───────────
  if (contact.status === 'At Risk') score = Math.max(score, 45)

  score = Math.max(0, Math.min(100, score))

  let tier
  if (score <= 25)      tier = 'cold'
  else if (score <= 50) tier = 'warm'
  else if (score <= 75) tier = 'hot'
  else                  tier = 'champion'

  return { score, tier }
}

/**
 * batchCalcLeadScores — compute scores for all contacts in a single pass.
 * Builds per-contact index Maps once, then calls calcLeadScore with sliced arrays.
 * O(n) instead of O(n²) — critical for 1000+ contacts.
 */
export function batchCalcLeadScores(contacts, interactions, followups, pipeline) {
  const iByC   = new Map()
  const fuByC  = new Map()
  const piByC  = new Map()
  for (const i  of interactions) { const a = iByC.get(i.contactId)  || []; a.push(i);  iByC.set(i.contactId, a) }
  for (const f  of followups)    { const a = fuByC.get(f.contactId) || []; a.push(f);  fuByC.set(f.contactId, a) }
  for (const p  of pipeline)     { const a = piByC.get(p.contactId) || []; a.push(p);  piByC.set(p.contactId, a) }
  const results = new Map()
  for (const c of contacts) {
    results.set(c.id, calcLeadScore(c, iByC.get(c.id) || [], fuByC.get(c.id) || [], piByC.get(c.id) || []))
  }
  return results
}

/**
 * getTierColor — returns Tailwind color classes for a given tier.
 */
export function getTierColor(tier) {
  switch (tier) {
    case 'champion': return 'bg-yellow-900/40 text-yellow-300'
    case 'hot':      return 'bg-orange-900/40 text-orange-300'
    case 'warm':     return 'bg-blue-900/40 text-blue-300'
    case 'cold':
    default:         return 'bg-gray-800 text-gray-400'
  }
}
