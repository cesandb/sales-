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

// ── Prospecting Strategy ──────────────────────────────────────────────────────
// Analyzes best customers and returns a platform-specific targeting strategy
export async function generateProspectingStrategy({ customers, allContacts }) {
  const customerProfiles = customers.slice(0, 8).map(c =>
    `- ${c.name} | Tags: ${(c.tags || []).join(', ') || 'none'} | Notes: ${c.notes || 'none'} | Source: ${c.source || 'unknown'}`
  ).join('\n')

  const sourceCounts = {}
  allContacts.forEach(c => { if (c.source) sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1 })
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s).join(', ')

  const prompt = `You are a growth strategist for Conan, a 1st Phorm fitness supplement affiliate who wants to continuously find new prospects.

BEST CURRENT CUSTOMERS:
${customerProfiles || 'No customers yet — suggest strategies for a brand-new affiliate'}

TOP LEAD SOURCES SO FAR: ${topSources || 'none yet'}

Generate a targeted prospecting strategy as JSON:
{
  "idealProspectProfile": "2-sentence description of the ideal prospect based on patterns above",
  "platforms": [
    {
      "platform": "Instagram",
      "hashtags": ["list", "of", "10", "specific", "hashtags", "to", "search"],
      "actions": ["specific daily action 1", "specific daily action 2", "specific daily action 3"],
      "engagementTip": "one specific tip for converting engagement to a conversation"
    },
    {
      "platform": "Facebook",
      "groups": ["type of group to join 1", "type of group to join 2"],
      "actions": ["specific daily action 1", "specific daily action 2"],
      "engagementTip": "one specific tip"
    },
    {
      "platform": "TikTok",
      "hashtags": ["list", "of", "5", "hashtags"],
      "actions": ["specific daily action 1", "specific daily action 2"],
      "engagementTip": "one specific tip"
    }
  ],
  "dailyRoutine": [
    {"minutes": 5, "task": "specific task description"},
    {"minutes": 5, "task": "specific task description"},
    {"minutes": 5, "task": "specific task description"},
    {"minutes": 5, "task": "specific task description"}
  ],
  "qualifyingSignals": ["signal that someone is a warm prospect", "signal 2", "signal 3"],
  "coldOpeningLine": "one natural conversation-starter message for cold outreach that doesn't mention supplements"
}

Make hashtags, groups, and actions VERY specific — not generic. Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 700)
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return null
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

// ── AI Lead Scorer ────────────────────────────────────────────────────────────
// Claude scores each contact 1-10 with a reason and suggested first message
// Returns [{contactId, name, score, reason, nextStep, openingLine}]
export async function generateAiLeadScores({ contacts, interactions }) {
  const contactDetails = contacts
    .filter(c => c.status !== 'Inactive')
    .slice(0, 20)
    .map(c => {
      const recentNotes = (interactions || [])
        .filter(i => i.contactId === c.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 2)
        .map(i => i.notes)
        .join('; ')
      const days = c.lastContact
        ? Math.floor((Date.now() - new Date(c.lastContact)) / 86400000)
        : null
      return `ID:${c.id} Name:${c.name} Status:${c.status} Tags:${(c.tags || []).join(',') || 'none'} Notes:${c.notes || 'none'} LastContact:${days !== null ? days + 'd ago' : 'never'} RecentInteractions:${recentNotes || 'none'}`
    }).join('\n')

  const prompt = `You are scoring fitness supplement prospects for Conan, a 1st Phorm affiliate targeting $10k/month.

Score each contact 1-10 on how likely they are to buy in the next 2 weeks, based on:
- Current status (Hot Lead = high, New Lead = low)
- Notes suggesting pain points, goals, or interest
- Recency of contact
- Tags indicating fitness activity
- Interaction history showing engagement

CONTACTS:
${contactDetails}

Return ONLY valid JSON array:
[{
  "contactId": "exact id",
  "name": "name",
  "score": 1-10,
  "reason": "one sentence why this score",
  "nextStep": "single most important action to take with this person right now",
  "openingLine": "a natural 1-2 sentence opener Conan can send this person today"
}]

Score all contacts. Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 1200)
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return []
  }
}

// ── Smart Reply Analyzer ──────────────────────────────────────────────────────
// Analyzes a received message and tells Conan exactly how to respond
// Returns { sentiment, buySignals, objections, nextAction, suggestedReply, urgency }
export async function analyzeReply({ contactName, contactStatus, message, recentContext }) {
  const prompt = `You are analyzing a message that Conan (1st Phorm affiliate) received from a prospect.

PROSPECT: ${contactName} (${contactStatus})
RECENT CONTEXT: ${recentContext || 'No prior context'}
MESSAGE RECEIVED: "${message}"

Analyze this message and return JSON:
{
  "sentiment": "positive|neutral|negative|objecting|buying",
  "buySignals": ["any phrases or signals indicating purchase intent"],
  "objections": ["any objections or hesitations expressed"],
  "urgency": "high|medium|low",
  "interpretation": "2 sentences: what this person is really saying and what they need",
  "nextAction": "the single best thing Conan should do right now (be specific)",
  "suggestedReply": "a ready-to-send response under 80 words that moves the conversation forward naturally",
  "doNotDo": "one thing Conan should avoid doing in this situation"
}

Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 500)
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return {
      sentiment: 'neutral',
      buySignals: [],
      objections: [],
      urgency: 'medium',
      interpretation: 'Could not analyze — try again.',
      nextAction: 'Follow up with a friendly check-in.',
      suggestedReply: `Hey ${contactName}! Thanks for reaching out. How can I help you today?`,
      doNotDo: 'Do not push for a sale immediately.',
    }
  }
}

// ── Objection Coach ───────────────────────────────────────────────────────────
// Takes an objection and product context, returns a full coaching script
// Returns { empathyLine, reframe, proof, cta, followup, doNotSay }
export async function generateObjectionCoach({ objection, productName, contactName, contactNotes }) {
  const psbContext = productName
    ? `Product: ${productName} (1st Phorm supplement)`
    : 'General 1st Phorm supplement'

  const prompt = `Coach Conan (1st Phorm affiliate) on handling this sales objection.

${psbContext}
Prospect: ${contactName || 'the prospect'}
Their background: ${contactNotes || 'no notes'}
Objection: "${objection}"

Return a coaching script as JSON:
{
  "empathyLine": "acknowledge their concern genuinely (under 20 words, no sycophancy)",
  "reframe": "reframe their objection into a reason to try — 2 sentences",
  "proof": "a specific social proof or logical argument for this product — 2 sentences",
  "cta": "a low-pressure call to action that fits where they are — 1 sentence",
  "followup": "what to say if they still hesitate — 1 sentence",
  "doNotSay": "one thing to avoid saying that would kill the conversation",
  "fullScript": "the complete 4-6 sentence response combining empathy + reframe + proof + cta in natural flowing language"
}

Keep everything conversational — this is DM/SMS/in-person, not email copy.
Output ONLY valid JSON.`

  const raw = await callClaude(prompt, '', 600)
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : raw)
  } catch {
    return null
  }
}
