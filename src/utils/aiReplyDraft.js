// aiReplyDraft — Claude Haiku generates a reply to an incoming message from a contact.
// Used by AutoReplyDrafter to produce contextual responses queued for human review.

import { getApiKey } from './aiDraft'

const CACHE_KEY = 'phorm_reply_draft_v1'

function getCache() {
  try { return new Set(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')) }
  catch { return new Set() }
}
function markDrafted(interactionId) {
  const s = getCache(); s.add(interactionId)
  localStorage.setItem(CACHE_KEY, JSON.stringify([...s].slice(-2000)))
}
export function isDrafted(interactionId) { return getCache().has(interactionId) }

export async function draftReply(contact, replyText, priorMessages = []) {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const history = priorMessages
    .slice(-4)
    .map(m => `${m.type}: "${(m.notes || '').slice(0, 80)}"`)
    .join('\n')

  const prompt = `You are Conan, a 1st Phorm fitness supplement affiliate. A contact just replied to your outreach.

Contact: ${contact.name} | Status: ${contact.status} | Tags: ${(contact.tags||[]).join(', ')||'none'}
${history ? `Prior messages:\n${history}\n` : ''}
Their reply: "${replyText.slice(0, 300)}"

Write a warm, natural follow-up reply (2–3 sentences). Be conversational, personal, and steer toward their interest in supplements. Do NOT mention you are AI. End with a soft call-to-action.`

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
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text?.trim() || null
  } catch { return null }
}

export { markDrafted }
