// ICP score: how well does this contact match the ideal 1st Phorm customer?
// Returns 0–100. Engagement signals from interactions are factored in when provided.

const TAG_WEIGHTS = {
  'supplements': 25, 'intent-signal': 20, 'protein': 20, 'weightloss': 20,
  'fitness': 18, 'athlete': 18, 'crossfit': 18, 'bodybuilding': 18,
  'endurance': 15, 'marathon': 15, 'runner': 15, 'gym': 15, 'nutrition': 15,
  'keto': 12, 'paleo': 10, 'vegan': 10, 'entrepreneur': 12, 'developer': 10,
  'tech-fitness': 10, 'hackernews': 10, 'blogger': 8, 'content-creator': 8,
  'reddit': 8, 'github-verified': 7, 'hn-verified': 7, 'devto-verified': 7,
  'auto-feed': 5, 'federal_award': 15, 'new_business_registration': 12,
  'org_chart_change': 10, 'job_change': 10, 'usaspending': 8,
  'b2b-prospect': 7, 'irs-nonprofit': 5, 'enriched': 3,
}

const SOURCE_WEIGHTS = {
  'Referral': 15, 'In Person': 12, 'Instagram': 8, 'Facebook': 7,
  'TikTok': 6, 'YouTube': 6, 'Twitter/X': 5, 'WhatsApp': 5,
  'Email': 5, 'Other': 3, 'LinkedIn': 10, 'CSV Import': 4, 'Apollo': 6,
}

const STATUS_BONUS = {
  'Repeat Customer': 20, 'Customer': 15, 'Evangelist': 20,
  'Hot Lead': 10, 'Warm Lead': 5, 'Opportunity': 12,
  'At Risk': 5, 'New Lead': 0, 'Inactive': -10,
}

const NOTES_KEYWORDS = [
  'supplement', 'protein', 'weight', 'muscle', 'energy', 'fat loss',
  'workout', 'training', 'fitness', 'health', 'nutrition', 'pre-workout',
  'creatine', 'amino', 'lean', 'bulk', 'cut', 'gym', 'athlete',
]

const REPLY_TYPES = ['email reply', 'reddit reply', 'reply', 'dm reply']
const BUYING_KWS  = ['want to try', 'interested', 'how much', 'price', 'sign me up', 'ready', 'order', 'buy']

// interactions: pre-filtered for this contact (optional — pass [] for static-only scoring)
export function calcIcpScore(contact, interactions = []) {
  let score = 0

  for (const tag of (contact.tags || [])) {
    score += TAG_WEIGHTS[tag.toLowerCase()] || 0
  }
  score += SOURCE_WEIGHTS[contact.source] || 0
  score += STATUS_BONUS[contact.status] || 0
  const notes = (contact.notes || '').toLowerCase()
  score += Math.min(NOTES_KEYWORDS.filter(kw => notes.includes(kw)).length * 3, 15)

  // ── Engagement signals ──────────────────────────────────────────────────────
  if (interactions.length) {
    score += Math.min(interactions.length * 3, 12)

    if (interactions.some(i => REPLY_TYPES.includes((i.type || '').toLowerCase()))) score += 15
    if (interactions.some(i => BUYING_KWS.some(kw => (i.notes || '').toLowerCase().includes(kw)))) score += 15

    const latest = interactions.map(i => i.date || '').sort().at(-1)
    if (latest) {
      const days = (Date.now() - new Date(latest)) / 86400000
      score += days < 1 ? 10 : days < 7 ? 6 : days < 30 ? 3 : 0
    }
  }

  return Math.max(0, Math.min(100, score))
}

export function getIcpTier(score) {
  if (score >= 70) return { label: 'Strong Fit', color: 'bg-green-900/40 text-green-300' }
  if (score >= 50) return { label: 'Moderate Fit', color: 'bg-yellow-900/40 text-yellow-300' }
  if (score >= 30) return { label: 'Possible Fit', color: 'bg-blue-900/40 text-blue-300' }
  return { label: 'Low Fit', color: 'bg-gray-800 text-gray-400' }
}
