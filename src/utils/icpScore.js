// ICP score: how well does this contact match the ideal 1st Phorm customer?
// Adapted from contact-intel-pipeline spec's ICP scoring system.
// Returns 0–100. Threshold: >=70 = strong fit, >=50 = moderate fit

const TAG_WEIGHTS = {
  // Fitness intent signals (highest weight)
  'supplements': 25,
  'intent-signal': 20,
  'protein': 20,
  'weightloss': 20,
  'fitness': 18,
  'athlete': 18,
  'crossfit': 18,
  'bodybuilding': 18,
  'endurance': 15,
  'marathon': 15,
  'runner': 15,
  'gym': 15,
  'nutrition': 15,
  'keto': 12,
  'paleo': 10,
  'vegan': 10,
  // Income signals (high purchasing power)
  'entrepreneur': 12,
  'developer': 10,
  'tech-fitness': 10,
  'hackernews': 10,
  'blogger': 8,
  'content-creator': 8,
  'reddit': 8,
  'github-verified': 7,
  'hn-verified': 7,
  'devto-verified': 7,
  'auto-feed': 5,
  'enriched': 3,
}

const SOURCE_WEIGHTS = {
  'Referral': 15,
  'In Person': 12,
  'Instagram': 8,
  'Facebook': 7,
  'TikTok': 6,
  'YouTube': 6,
  'Twitter/X': 5,
  'WhatsApp': 5,
  'Email': 5,
  'Other': 3,
}

const STATUS_BONUS = {
  'Repeat Customer': 20,
  'Customer': 15,
  'Hot Lead': 10,
  'Warm Lead': 5,
  'New Lead': 0,
  'Inactive': -10,
}

const NOTES_KEYWORDS = [
  'supplement', 'protein', 'weight', 'muscle', 'energy', 'fat loss',
  'workout', 'training', 'fitness', 'health', 'nutrition', 'pre-workout',
  'creatine', 'amino', 'lean', 'bulk', 'cut', 'gym', 'athlete',
]

export function calcIcpScore(contact) {
  let score = 0

  // Tag weights
  for (const tag of (contact.tags || [])) {
    score += TAG_WEIGHTS[tag.toLowerCase()] || 0
  }

  // Source weight
  score += SOURCE_WEIGHTS[contact.source] || 0

  // Status bonus
  score += STATUS_BONUS[contact.status] || 0

  // Notes keyword matches (3 points each, up to 15)
  const notes = (contact.notes || '').toLowerCase()
  const noteHits = NOTES_KEYWORDS.filter(kw => notes.includes(kw)).length
  score += Math.min(noteHits * 3, 15)

  return Math.max(0, Math.min(100, score))
}

export function getIcpTier(score) {
  if (score >= 70) return { label: 'Strong Fit', color: 'bg-green-900/40 text-green-300' }
  if (score >= 50) return { label: 'Moderate Fit', color: 'bg-yellow-900/40 text-yellow-300' }
  if (score >= 30) return { label: 'Possible Fit', color: 'bg-blue-900/40 text-blue-300' }
  return { label: 'Low Fit', color: 'bg-gray-800 text-gray-400' }
}
