// AI icebreaker personalizer — prepends a unique opening line to each outreach message.
// Uses Claude API (same key as AI drafting) to generate a single personalized sentence
// based on the contact's name, notes, tags, and social platform.
// Results are cached per contact to avoid burning tokens on re-sends.

import { getApiKey } from './aiDraft'

const CACHE_KEY  = 'phorm_icebreaker_cache'
const CACHE_MAX  = 1000

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }
  catch { return {} }
}

function saveCache(cache) {
  const keys = Object.keys(cache)
  if (keys.length > CACHE_MAX) {
    // Drop oldest half
    keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
    keys.slice(0, CACHE_MAX / 2).forEach(k => delete cache[k])
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

function getCacheKey(contact) {
  return `${contact.id}::${(contact.notes || '').slice(0, 40)}::${(contact.tags || []).join(',').slice(0, 40)}`
}

// Generate a personalized icebreaker sentence for a contact.
// Returns a string like "Saw your marathon PR post — seriously impressive." or null on failure.
export async function generateIcebreaker(contact) {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const cacheKey = getCacheKey(contact)
  const cache = getCache()
  if (cache[cacheKey]?.line) return cache[cacheKey].line

  const platform = contact.social
    ? contact.social.startsWith('u/')    ? 'Reddit'
    : contact.social.startsWith('hn:')   ? 'Hacker News'
    : contact.social.startsWith('github:') ? 'GitHub'
    : contact.social.startsWith('youtube:') ? 'YouTube'
    : contact.social.startsWith('medium:') ? 'Medium'
    : contact.social.includes('@') ? 'social media'
    : 'online'
    : 'online'

  const context = [
    contact.notes && `Notes: ${contact.notes.slice(0, 200)}`,
    contact.tags?.length && `Tags: ${contact.tags.slice(0, 8).join(', ')}`,
    contact.status && `Status: ${contact.status}`,
    platform !== 'online' && `Platform: ${platform}`,
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `Write ONE short personalized icebreaker sentence (15-25 words) for a fitness supplement outreach message to ${contact.name}.

Context:
${context}

Rules:
- Reference something specific from their notes or interests (marathon, crossfit, nutrition, etc.)
- Sound natural and authentic, like a real person noticed their work
- Do NOT mention 1st Phorm, supplements, or sales in this sentence
- Do NOT start with "I" — use "Saw", "Noticed", "Love", "Amazing", etc.
- Output ONLY the sentence, no quotes, no extra text

Example outputs:
"Saw your marathon PR — that kind of dedication is rare."
"Your meal prep content has been super inspiring to follow."
"Love the detail in your supplement review posts."`,
        }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) return null
    const data = await res.json()
    const line = data.content?.[0]?.text?.trim().replace(/^["']|["']$/g, '').trim()
    if (!line || line.length < 10) return null

    cache[cacheKey] = { line, ts: Date.now() }
    saveCache(cache)
    return line
  } catch { return null }
}

// Prepend icebreaker to a message if API key is available.
// Falls back to original message if generation fails or takes too long.
export async function personalizeMessage(contact, message) {
  const line = await generateIcebreaker(contact)
  if (!line) return message
  return `${line}\n\n${message}`
}
