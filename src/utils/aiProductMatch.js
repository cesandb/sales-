// aiProductMatch — Claude Haiku recommends the best 1st Phorm product for a contact.
// Uses tags, notes, status, and source to pick the most relevant match and pitch angle.
// Results cached in localStorage by contact profile fingerprint.

import { getApiKey } from './aiDraft'
import { PRODUCTS } from '../data/products'

const CACHE_KEY = 'phorm_product_match_v1'

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }
  catch { return {} }
}
function saveToCache(key, value) {
  const c = getCache()
  c[key] = value
  const keys = Object.keys(c)
  if (keys.length > 500) delete c[keys[0]]
  localStorage.setItem(CACHE_KEY, JSON.stringify(c))
}

export async function getProductMatch(contact) {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const cacheKey = `${contact.id}::${(contact.tags||[]).slice().sort().join(',')}::${(contact.notes||'').slice(0,80)}`
  const cached = getCache()[cacheKey]
  if (cached) return cached

  const productLines = PRODUCTS.slice(0, 20).map(p =>
    `${p.id}: "${p.name}" (${p.category}) — for: ${(p.targetAudience||[]).join(', ')}`
  ).join('\n')

  const prompt = `You are a 1st Phorm affiliate recommending the ideal supplement product.

Contact profile:
- Name: ${contact.name}
- Status: ${contact.status}
- Source: ${contact.source || 'unknown'}
- Tags: ${(contact.tags||[]).join(', ') || 'none'}
- Notes: ${(contact.notes||'').slice(0, 200) || 'none'}

Available products (id: name — ideal audience):
${productLines}

Pick the single best match. Return valid JSON only, nothing else:
{"productId":"<id>","productName":"<name>","pitch":"<one sentence personalized pitch, max 20 words>"}`

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
        max_tokens: 160,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) return null
    const result = JSON.parse(match[0])
    if (!result.productId || !result.pitch) return null
    saveToCache(cacheKey, result)
    return result
  } catch { return null }
}
