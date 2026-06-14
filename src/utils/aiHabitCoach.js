// aiHabitCoach — generates a personalized accountability + habit-building coaching
// response when a contact replies to outreach. Uses Claude Haiku for cost efficiency.
// The coach identifies their fitness goal from the reply, gives 2 actionable habits,
// recommends a product, and offers a weekly check-in accountability partnership.

import { getApiKey } from './aiDraft'

const COACHING_CACHE_KEY = 'phorm_coaching_cache_v1'

function getCoachingCache() {
  try { return new Set(JSON.parse(localStorage.getItem(COACHING_CACHE_KEY) || '[]')) }
  catch { return new Set() }
}

export function isCoachingCached(interactionId) {
  return getCoachingCache().has(interactionId)
}

export function markCoachingCached(interactionId) {
  const s = getCoachingCache()
  s.add(interactionId)
  localStorage.setItem(COACHING_CACHE_KEY, JSON.stringify([...s].slice(-2000)))
}

// Detect whether a reply is about fitness goals / habits (worth coaching response)
const GOAL_KEYWORDS = [
  'lose', 'weight', 'fat', 'muscle', 'gain', 'bulk', 'cut', 'shred', 'energy',
  'tired', 'workout', 'gym', 'run', 'marathon', 'crossfit', 'diet', 'nutrition',
  'health', 'goal', 'trying', 'start', 'habit', 'routine', 'motivated', 'struggling',
  'help', 'advice', 'tips', 'protein', 'supplement', 'interested', 'curious', 'how',
]

export function isGoalRelatedReply(text) {
  const lower = (text || '').toLowerCase()
  return GOAL_KEYWORDS.some(kw => lower.includes(kw))
}

export async function generateHabitCoachReply(contact, replyText, productName, affiliateLink) {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const firstName = contact.name.split(' ')[0]
  const tags = (contact.tags || []).join(', ')
  const goalSummary = contact.goalSummary || ''

  const prompt = `You are Conan, a 1st Phorm fitness supplement affiliate and personal accountability coach. A contact just replied to your outreach message.

Contact: ${firstName} | Tags: ${tags || 'none'}${goalSummary ? ` | Known goal: ${goalSummary}` : ''}
Their reply: "${replyText.slice(0, 400)}"
Recommended supplement: ${productName}
Your affiliate link: ${affiliateLink}

Write a warm, coaching-style reply (4-6 sentences) that:
1. Acknowledges what they said specifically
2. Gives ONE concrete habit tip aligned to their apparent goal (nutrition timing, consistency, sleep, etc.)
3. Explains why ${productName} fits their specific goal
4. Offers to be their accountability partner with a weekly check-in
5. Includes the affiliate link naturally

Be genuine, direct, and coach-like. No generic sales speak. Do NOT mention you are AI. Keep it conversational.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 280,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text?.trim() || null
  } catch { return null }
}
