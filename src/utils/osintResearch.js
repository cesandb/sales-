// OSINT research — fetches Reddit activity for a contact, then calls Claude Haiku
// to extract their fitness goals. Results stored on the contact as goalSummary + tags.
// Key stored: phorm_anthropic_key (shared with aiDraft.js)

import { getApiKey } from './aiDraft'

const OSINT_KEY = 'phorm_osint_v1'

function getStore() {
  try { return JSON.parse(localStorage.getItem(OSINT_KEY) || '{}') }
  catch { return {} }
}

export function hasBeenAnalyzed(contactId) {
  return !!getStore()[contactId]
}

export function resetContactAnalysis(contactId) {
  const s = getStore()
  delete s[contactId]
  localStorage.setItem(OSINT_KEY, JSON.stringify(s))
}

function markAnalyzed(contactId) {
  const s = getStore()
  s[contactId] = new Date().toISOString()
  localStorage.setItem(OSINT_KEY, JSON.stringify(s))
}

const REDDIT_JSON = (path) =>
  `https://www.reddit.com${path}.json?limit=5&raw_json=1`

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function fetchRedditUserActivity(username) {
  const [postsData, commentsData] = await Promise.all([
    fetchJson(REDDIT_JSON(`/user/${encodeURIComponent(username)}/submitted`)),
    fetchJson(REDDIT_JSON(`/user/${encodeURIComponent(username)}/comments`)),
  ])

  const posts = (postsData?.data?.children || [])
    .slice(0, 5)
    .map(c => `r/${c.data.subreddit}: "${c.data.title}"`)

  const comments = (commentsData?.data?.children || [])
    .slice(0, 5)
    .map(c => `r/${c.data.subreddit}: "${(c.data.body || '').slice(0, 120)}"`)

  return { posts, comments }
}

export async function analyzeContactGoals(contact) {
  const apiKey = getApiKey()
  if (!apiKey) return null
  if (hasBeenAnalyzed(contact.id)) return null

  // Build activity string — from Reddit handle or just use existing tags/notes
  let activityText = ''
  const redditMatch = (contact.social || '').match(/^reddit:(?:u\/)?(.+)/i)
  const username = redditMatch?.[1]

  if (username) {
    const { posts, comments } = await fetchRedditUserActivity(username)
    const lines = [...posts, ...comments]
    if (lines.length) activityText = lines.join('\n')
  }

  const profileText = [
    contact.notes ? `Notes: ${contact.notes.slice(0, 300)}` : '',
    contact.tags?.length ? `Tags: ${contact.tags.join(', ')}` : '',
    activityText ? `Reddit activity:\n${activityText}` : '',
  ].filter(Boolean).join('\n\n')

  if (!profileText.trim()) return null

  const prompt = `You are analyzing a fitness supplement prospect for a 1st Phorm affiliate.

Contact: ${contact.name}
${profileText}

In JSON (no markdown fences), respond with:
{
  "goalSummary": "1-2 sentence plain English summary of their fitness goals",
  "osintTags": ["tag1", "tag2"]  // 2-5 lowercase fitness goal tags like: weight-loss, muscle-gain, endurance, keto, marathon-runner, crossfitter, busy-parent, beginner, etc.
}`

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
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.[0]?.text?.trim() || ''
    const parsed = JSON.parse(text)
    if (!parsed.goalSummary) return null
    markAnalyzed(contact.id)
    return {
      goalSummary: parsed.goalSummary,
      osintTags: Array.isArray(parsed.osintTags) ? parsed.osintTags : [],
    }
  } catch { return null }
}
