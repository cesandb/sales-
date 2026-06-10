const API_KEY_STORAGE = 'phorm_anthropic_key'

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || ''
}

export function saveApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim())
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE)
}

export async function testApiKey(key) {
  const res = await callClaude('Say "OK" only.', key, 10)
  return res.trim().toLowerCase().includes('ok')
}

async function callClaude(prompt, key, maxTokens = 400) {
  const apiKey = key || getApiKey()
  if (!apiKey) throw new Error('No API key set — add it in Settings.')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

export async function generateOutreachDraft({ contact, interactions, platform, productName, context }) {
  const recentInteractions = (interactions || [])
    .filter(i => i.contactId === contact.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .map(i => `- ${i.type}: ${i.notes}`)
    .join('\n')

  const daysSinceContact = contact.lastContact
    ? Math.floor((Date.now() - new Date(contact.lastContact)) / 86400000)
    : null

  const prompt = `You are helping Conan, a 1st Phorm fitness supplement affiliate, write a short personal message to a prospect.

CONTACT:
- Name: ${contact.name}
- Status: ${contact.status}
- Tags: ${(contact.tags || []).join(', ') || 'none'}
- Notes: ${contact.notes || 'none'}
- Days since last contact: ${daysSinceContact !== null ? daysSinceContact : 'never contacted'}

INTERACTION HISTORY (most recent first):
${recentInteractions || 'No interactions logged yet'}

PLATFORM: ${platform}
${productName ? `PRODUCT TO MENTION: ${productName}` : 'No specific product — general check-in'}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

Write a single short message (under 100 words) that:
1. Feels personal and genuine, not salesy
2. References something specific from their history if available
3. Has a soft, natural call-to-action (question, not command)
4. Matches the tone for ${platform} (${platform === 'Instagram DM' ? 'casual + emoji ok' : platform === 'Text/SMS' ? 'very brief, casual' : 'professional but warm'})
5. Does NOT mention commission, affiliate links, or "my link" — just be helpful

Output ONLY the message text, nothing else.`

  return callClaude(prompt, '', 200)
}

export async function generateFollowupSequence({ contact, productName }) {
  const prompt = `Write 3 short follow-up messages for Conan (1st Phorm affiliate) to send to ${contact.name} after sharing the ${productName} product link.

Day 3 (checking in), Day 7 (add value), Day 14 (final gentle nudge).

Each message:
- Under 60 words
- Casual, genuine, not pushy
- Different angle each time

Format as JSON array:
[
  {"day": 3, "message": "..."},
  {"day": 7, "message": "..."},
  {"day": 14, "message": "..."}
]

Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 400)
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return [
      { day: 3, message: `Hey ${contact.name}! Just checking in — did you get a chance to look at that ${productName} link? Happy to answer any questions!` },
      { day: 7, message: `Hey ${contact.name}! Wanted to share — ${productName} pairs really well with a good training routine. Let me know if you want my recommendation for your goals!` },
      { day: 14, message: `Hey ${contact.name}! Last check-in on ${productName} — no pressure at all, just want to make sure you have what you need to hit your goals. Here for you if you have questions!` },
    ]
  }
}

export async function generateProductRecommendation({ contact, interactions }) {
  const interactionSummary = (interactions || [])
    .filter(i => i.contactId === contact.id)
    .slice(-3)
    .map(i => i.notes)
    .join('; ')

  const prompt = `Conan is a 1st Phorm affiliate. Based on this contact's profile, suggest the 3 BEST 1st Phorm product categories to recommend and why.

Contact: ${contact.name}, ${contact.status}
Notes: ${contact.notes || 'none'}
Tags: ${(contact.tags || []).join(', ') || 'none'}
Recent context: ${interactionSummary || 'none'}

1st Phorm categories: Protein & Bars, Performance, Amino Acids, Foundation Series, Weight Loss, Energy, Most Recommended

Format as JSON:
[{"category": "...", "reason": "one sentence why this fits them"}]

Output ONLY valid JSON array.`

  const raw = await callClaude(prompt, '', 300)
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return []
  }
}
