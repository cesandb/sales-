import Anthropic from '@anthropic-ai/sdk'
import { buildPsbContext } from '../data/productPsb'

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

function getClient(key) {
  const apiKey = key || getApiKey()
  if (!apiKey) throw new Error('No API key set — add it in Settings.')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

async function callClaude(prompt, key, maxTokens = 400) {
  const client = getClient(key)
  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })
  return msg.content.find(b => b.type === 'text')?.text || ''
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

  const psbContext = productName ? buildPsbContext(productName.toLowerCase().replace(/\s+/g, '-')) : ''

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
${psbContext ? `\n${psbContext}\n` : ''}${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

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

// ── Daily AI Brief ────────────────────────────────────────────────────────────
// Returns { greeting, topTargets: [{contactId, reason, urgency, suggestedAction}], advice, goal }
export async function generateDailyBrief({ contacts, interactions, followups, pipeline, goals, stats }) {
  const now = new Date()

  const overdueCount = followups.filter(f => f.status === 'pending' && new Date(f.date) < now).length
  const hotLeads = contacts.filter(c => c.status === 'Hot Lead').length
  const customers = contacts.filter(c => c.status === 'Customer' || c.status === 'Repeat Customer').length

  // Build a concise contact list for AI (top 20 most relevant)
  const scored = contacts.map(c => {
    let score = 0
    if (c.status === 'Hot Lead') score += 50
    if (c.status === 'Warm Lead') score += 30
    if (c.status === 'Customer') score += 20
    const daysSince = c.lastContact
      ? Math.floor((Date.now() - new Date(c.lastContact)) / 86400000)
      : 999
    if (daysSince > 7) score += 20
    if (daysSince > 14) score += 10
    const hasPendingFollowup = followups.some(f => f.contactId === c.id && f.status === 'pending' && new Date(f.date) <= now)
    if (hasPendingFollowup) score += 40
    return { ...c, score, daysSince }
  }).sort((a, b) => b.score - a.score).slice(0, 20)

  const contactList = scored.map(c =>
    `- ${c.name} (${c.status}, last contact: ${c.daysSince === 999 ? 'never' : c.daysSince + 'd ago'}, notes: ${c.notes || 'none'})`
  ).join('\n')

  const currentGoal = goals.find(g => g.year === now.getFullYear() && g.month === now.getMonth())

  const prompt = `You are an AI sales coach for Conan, a 1st Phorm fitness supplement affiliate trying to reach $10,000/month in commissions.

TODAY'S SNAPSHOT:
- Total contacts: ${contacts.length}
- Hot leads: ${hotLeads}
- Customers: ${customers}
- Overdue follow-ups: ${overdueCount}
- Month goal: ${currentGoal ? `$${currentGoal.revenue} revenue, ${currentGoal.newCustomers} new customers` : 'not set'}
- Month commission so far: $${(stats?.monthCommission || 0).toFixed(2)}

TOP CONTACTS NEEDING ATTENTION:
${contactList || 'No contacts yet'}

Generate a daily brief as JSON:
{
  "greeting": "one energetic motivational sentence for the day (under 20 words)",
  "topTargets": [
    {
      "contactId": "exact id from list",
      "name": "contact name",
      "reason": "1 sentence why they're priority today",
      "urgency": "high|medium|low",
      "suggestedAction": "exact action to take (e.g. 'Send a check-in DM', 'Follow up on protein order')"
    }
  ],
  "advice": "2-3 sentences of specific sales coaching advice for today based on the data",
  "focusArea": "one of: new_leads | follow_ups | customers | pipeline"
}

Pick the top 5 contacts for topTargets. Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 600)
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return {
      greeting: "Let's make today count — every message is a step toward your goal!",
      topTargets: [],
      advice: "Focus on your hottest leads first. A quick personal check-in converts better than a product pitch.",
      focusArea: 'follow_ups',
    }
  }
}

// ── Batch Draft Generator ─────────────────────────────────────────────────────
// Generates AI messages for a list of contacts at once
// Returns [{contactId, message}]
export async function generateBatchDrafts({ contacts, interactions, platform = 'Instagram DM' }) {
  const contactDetails = contacts.slice(0, 10).map(c => {
    const recent = (interactions || [])
      .filter(i => i.contactId === c.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2)
      .map(i => i.notes)
      .join('; ')
    const days = c.lastContact
      ? Math.floor((Date.now() - new Date(c.lastContact)) / 86400000)
      : null
    return `ID:${c.id} Name:${c.name} Status:${c.status} LastContact:${days !== null ? days + 'd' : 'never'} Notes:${c.notes || 'none'} Recent:${recent || 'none'}`
  }).join('\n')

  const prompt = `Conan is a 1st Phorm affiliate. Write a short personal outreach message for each contact below.

PLATFORM: ${platform}
Each message:
- Under 80 words
- Personal and genuine (reference their context when possible)
- No affiliate links, no commission mention
- Ends with a question

Contacts:
${contactDetails}

Output ONLY valid JSON array:
[{"contactId": "exact id", "message": "the message text"}]`

  const raw = await callClaude(prompt, '', 800)
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return []
  }
}

// ── Sales Coaching Analysis ───────────────────────────────────────────────────
// Analyzes performance data and returns actionable coaching advice
export async function generateSalesCoaching({ contacts, interactions, followups, pipeline, contactProducts, linkShares, goals }) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalContacts = contacts.length
  const customers = contacts.filter(c => c.status === 'Customer' || c.status === 'Repeat Customer').length
  const hotLeads = contacts.filter(c => c.status === 'Hot Lead').length
  const warmLeads = contacts.filter(c => c.status === 'Warm Lead').length
  const convRate = totalContacts > 0 ? ((customers / totalContacts) * 100).toFixed(1) : 0
  const monthInteractions = interactions.filter(i => new Date(i.date) >= monthStart).length
  const monthLinks = (linkShares || []).filter(ls => new Date(ls.date) >= monthStart).length
  const monthRevenue = (contactProducts || [])
    .filter(cp => new Date(cp.purchaseDate) >= monthStart)
    .reduce((s, cp) => s + cp.orderValue * cp.commissionRate, 0)
  const overdueCount = followups.filter(f => f.status === 'pending' && new Date(f.date) < now).length
  const currentGoal = goals.find(g => g.year === now.getFullYear() && g.month === now.getMonth())

  const prompt = `You are a high-performance sales coach analyzing Conan's 1st Phorm affiliate business. He wants to hit $10,000/month in commissions.

PERFORMANCE DATA (this month):
- Total contacts in CRM: ${totalContacts}
- Hot leads: ${hotLeads}, Warm leads: ${warmLeads}, Customers: ${customers}
- Conversion rate: ${convRate}%
- Outreach interactions: ${monthInteractions}
- Product links shared: ${monthLinks}
- Commission earned: $${monthRevenue.toFixed(2)}
- Overdue follow-ups: ${overdueCount}
- Monthly goal: ${currentGoal ? `$${currentGoal.revenue} commission` : 'not set'}

Analyze the data and return a coaching report as JSON:
{
  "headline": "one bold assessment of where he stands (under 15 words)",
  "monthlyProjection": number (projected monthly commission based on current pace),
  "gapToGoal": number (how much more needed to hit $10k),
  "strengths": ["up to 2 specific things going well"],
  "gaps": ["up to 3 specific bottlenecks preventing $10k/month"],
  "actions": [
    {"priority": 1, "action": "specific daily action", "impact": "why this moves the needle"},
    {"priority": 2, "action": "specific daily action", "impact": "why this moves the needle"},
    {"priority": 3, "action": "specific daily action", "impact": "why this moves the needle"}
  ],
  "weeklyTarget": {
    "newContacts": number,
    "outreachMessages": number,
    "followUps": number,
    "linksShared": number
  }
}

Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 700)
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return null
  }
}
