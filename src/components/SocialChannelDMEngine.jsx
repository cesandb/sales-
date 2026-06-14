// SocialChannelDMEngine — queues DM outreach for contacts on Instagram, LinkedIn,
// TikTok, Facebook, and Twitter/X. Since none of these have public send APIs,
// messages go into the MQ as 'dm' channel items with deep-link dmUrls so the
// Outreach page can show them as one-click manual sends. Runs every 6 hours.

import { useEffect, useRef } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { parseSocialHandle } from '../utils/platformLinks'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'

const INITIAL_MS  = 20 * 60 * 1000
const INTERVAL_MS = 6 * 60 * 60 * 1000
const SENT_KEY    = 'phorm_social_dm_v1'
const MAX_PER_RUN = 15

// Platforms we queue DMs for (Instagram is highest priority for fitness niche)
const DM_PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'Twitter/X']

const PLATFORM_TEMPLATES = {
  Instagram: [
    (name, productName, link) => `Hey ${name}! 👋 Love what you're putting out — I'm Conan from 1st Phorm. We make elite-level supplements for serious athletes. ${productName} has been huge for people with your goals. Want me to send over the link? 💪`,
    (name, productName, link) => `Hey ${name}! Saw your content and had to reach out 🔥 I rep 1st Phorm and think ${productName} would be perfect for you. Here's the link if you want to check it out → ${link}`,
    (name, productName, link) => `${name}! Quick question — are you currently using any supplements for your training? I'm with 1st Phorm and we have something that's been crushing it for athletes like you. ${link}`,
  ],
  LinkedIn: [
    (name, productName, link) => `Hi ${name}, I came across your profile and wanted to connect! I work with 1st Phorm helping fitness professionals access elite-grade supplements. ${productName} has been a game-changer for coaches and trainers. Happy to share more — ${link}`,
    (name, productName, link) => `Hey ${name}, I help fitness coaches and trainers through 1st Phorm's affiliate program. Thought ${productName} might be a great fit for your clients. Would love to chat! ${link}`,
  ],
  TikTok: [
    (name, productName, link) => `Hey ${name}! Loved your content 🙌 I'm Conan from 1st Phorm — we make legit supplements for serious athletes. Check out ${productName}: ${link}`,
    (name, productName, link) => `${name}! Quick one — I rep 1st Phorm and think ${productName} aligns perfectly with what you're doing. Here's the link → ${link} 🔥`,
  ],
  Facebook: [
    (name, productName, link) => `Hey ${name}! I'm Conan with 1st Phorm — we make high-quality supplements for athletes and fitness enthusiasts. ${productName} has been incredible for people with your goals. Would love to get you more info: ${link}`,
    (name, productName, link) => `Hi ${name}! Reaching out because I think you'd love 1st Phorm's ${productName}. Here's the link to check it out: ${link} — happy to answer any questions!`,
  ],
  'Twitter/X': [
    (name, productName, link) => `Hey ${name}! I'm Conan from 1st Phorm. Saw your content and think ${productName} would be perfect for you. ${link} 💪`,
    (name, productName, link) => `${name} great content! I rep @1stPhorm and think our ${productName} would crush it for your goals → ${link}`,
  ],
}

function getWeekKey() {
  const d = new Date()
  const week = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000)
  return `${d.getFullYear()}W${String(week).padStart(2, '0')}`
}

function getSentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]')) }
  catch { return new Set() }
}

function saveSentSet(set) {
  const arr = [...set]
  if (arr.length > 5000) arr.splice(0, arr.length - 5000)
  localStorage.setItem(SENT_KEY, JSON.stringify(arr))
}

function getTemplateIdx(seqKey) {
  // Cycle through templates deterministically based on contact ID hash
  let hash = 0
  for (let i = 0; i < seqKey.length; i++) hash = ((hash << 5) - hash) + seqKey.charCodeAt(i)
  return Math.abs(hash) % 3
}

async function runSocialDMEngine(s) {
  const { contacts, interactions, updateContact } = s
  if (!contacts?.length) return

  const hour = new Date().getHours()
  if (hour < 8 || hour > 21) return

  const iByC = new Map()
  for (const i of (interactions || [])) {
    const a = iByC.get(i.contactId) || []; a.push(i); iByC.set(i.contactId, a)
  }

  const sent    = getSentSet()
  const weekKey = getWeekKey()
  let count     = 0

  const SKIP_STATUSES = ['Inactive', 'Customer', 'Repeat Customer', 'Evangelist']

  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (SKIP_STATUSES.includes(contact.status)) continue
    if (!contact.social) continue

    const parsed = parseSocialHandle(contact.social)
    if (!parsed?.platform || !DM_PLATFORMS.includes(parsed.platform)) continue

    const platform = parsed.platform
    const handle   = parsed.handle

    // Only DM contacts that haven't been personally contacted in >7 days
    const lastDate = contact.lastContact ? parseISO(contact.lastContact) : parseISO(contact.createdAt)
    const daysSince = differenceInDays(new Date(), lastDate)
    if (daysSince < 5) continue

    // One DM per platform per contact per week
    const sentKey = `${contact.id}::${platform}::${weekKey}`
    if (sent.has(sentKey)) continue

    // Build the message
    const product  = matchProduct(contact)
    const utmLink  = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: `social-dm-${platform.toLowerCase()}` }
    )
    const firstName   = contact.name?.split(' ')[0] || contact.name
    const templates   = PLATFORM_TEMPLATES[platform] || PLATFORM_TEMPLATES.Instagram
    const tplIdx      = getTemplateIdx(`${contact.id}::${platform}`) % templates.length
    const message     = templates[tplIdx](firstName, product.name, utmLink)

    // Build platform DM URL
    let dmUrl = null
    if (platform === 'Instagram') dmUrl = `https://ig.me/m/${handle.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\//g, '')}`
    else if (platform === 'Facebook') dmUrl = `https://m.me/${handle.replace(/^@/, '').replace(/.*facebook\.com\//, '').replace(/\//g, '')}`
    else if (platform === 'Twitter/X') dmUrl = `https://twitter.com/messages/compose?recipient_id=${handle.replace(/^@/, '')}`
    else if (platform === 'LinkedIn') dmUrl = parsed.dmUrl || `https://www.linkedin.com/in/${handle}`
    else if (platform === 'TikTok') dmUrl = `https://www.tiktok.com/@${handle.replace(/^@/, '')}`

    addToMQ({
      contactId:     contact.id,
      contactName:   contact.name,
      contactHandle: contact.social,
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel:       'dm',
      platform,
      dmUrl,
      subject:       `${platform} DM — ${contact.name}`,
      message,
      seqId:         `social-${platform.toLowerCase().replace(/\//g, '-')}`,
      stepKey:       `dm-week-${weekKey}`,
      seqName:       `${platform} Outreach`,
      stepLabel:     'Weekly DM',
    })

    sent.add(sentKey)
    count++

    addPipelineLog({ type: 'social-dm-queued', contact: contact.name, platform })
  }

  saveSentSet(sent)

  if (count > 0) {
    window.dispatchEvent(new CustomEvent('social-dm-queued', { detail: { count } }))
  }
}

export default function SocialChannelDMEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runSocialDMEngine(storeRef.current)
    const t   = setTimeout(run, INITIAL_MS)
    const iv  = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
