/**
 * calcLeadScore — computes a 0–100 lead score and tier for a contact.
 *
 * @param {object} contact      — contact record from useStore
 * @param {object[]} interactions — all interactions from useStore
 * @param {object[]} followups  — all followups from useStore
 * @param {object[]} pipeline   — all pipeline items from useStore
 * @returns {{ score: number, tier: 'cold'|'warm'|'hot'|'champion' }}
 */
export function calcLeadScore(contact, interactions = [], followups = [], pipeline = []) {
  let score = 0

  // ── Status weight ────────────────────────────────────────────────────────
  const statusWeights = {
    'New Lead':        10,
    'Warm Lead':       30,
    'Hot Lead':        50,
    'Customer':        70,
    'Repeat Customer': 90,
    'Inactive':         0,
  }
  score += statusWeights[contact.status] ?? 0

  // ── Recency bonus (based on lastContact) ─────────────────────────────────
  if (contact.lastContact) {
    const now = new Date()
    const last = new Date(contact.lastContact)
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24))

    if (diffDays <= 3) {
      score += 15
    } else if (diffDays <= 7) {
      score += 10
    } else if (diffDays <= 14) {
      score += 5
    } else {
      score -= 5
    }
  }

  // ── Interaction count ────────────────────────────────────────────────────
  const contactInteractions = interactions.filter(i => i.contactId === contact.id)
  const interactionBonus = Math.min(contactInteractions.length * 3, 15)
  score += interactionBonus

  // ── Has pending followup ─────────────────────────────────────────────────
  const hasPendingFollowup = followups.some(
    f => f.contactId === contact.id && f.status === 'pending'
  )
  if (hasPendingFollowup) score += 5

  // ── In pipeline ──────────────────────────────────────────────────────────
  const inPipeline = pipeline.some(p => p.contactId === contact.id)
  if (inPipeline) score += 5

  // ── Has tags (engaged) ───────────────────────────────────────────────────
  if (contact.tags && contact.tags.length > 0) score += 3

  // ── Cap at 100 ───────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score))

  // ── Tier ────────────────────────────────────────────────────────────────
  let tier
  if (score <= 25) tier = 'cold'
  else if (score <= 50) tier = 'warm'
  else if (score <= 75) tier = 'hot'
  else tier = 'champion'

  return { score, tier }
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
