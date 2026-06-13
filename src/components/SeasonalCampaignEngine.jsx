// SeasonalCampaignEngine — auto-broadcasts personalized affiliate messages to
// tagged contacts when a seasonal fitness campaign window is active.
// Runs every 4 hours, max 20 sends per run. Each contact gets one send per
// campaign per year (deduped in localStorage).

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'

const SEASONAL_KEY = 'phorm_seasonal_v1'
const INTERVAL_MS  = 4 * 60 * 60 * 1000
const MAX_PER_RUN  = 20

// monthStart/dayStart/monthEnd/dayEnd are 1-indexed calendar values
const CAMPAIGNS = [
  {
    id: 'new-year-goals',
    name: 'New Year Goals',
    monthStart: 1, dayStart: 1, monthEnd: 1, dayEnd: 20,
    tags: ['weightloss', 'weight-loss', 'health', 'nutrition', 'diet'],
    subject: n => `${n} — new year, new goals 🎯`,
    message: (n, p, l) =>
      `Hey ${n}! New year is the perfect time to lock in your nutrition. I've been recommending ${p.name} to people working on exactly what you're after — it's a great starting point. Check it out!\n\n${l}`,
  },
  {
    id: 'crossfit-open',
    name: 'CrossFit Open',
    monthStart: 2, dayStart: 20, monthEnd: 3, dayEnd: 25,
    tags: ['crossfit', 'crossfit-open', 'wod', 'athlete', 'functional-fitness'],
    subject: n => `${n} — Open season is here 🏋️`,
    message: (n, p, l) =>
      `Hey ${n}! CrossFit Open is the best time to dial in recovery and fuel. ${p.name} is what I'd reach for — helps you hit those workouts hard and bounce back faster.\n\n${l}`,
  },
  {
    id: 'spring-marathon',
    name: 'Spring Marathon Season',
    monthStart: 3, dayStart: 1, monthEnd: 5, dayEnd: 31,
    tags: ['runner', 'running', 'marathon', 'endurance', 'triathlon', 'cyclist'],
    subject: n => `${n} — race season fuel 🏃`,
    message: (n, p, l) =>
      `Hey ${n}! Race season is here. ${p.name} is perfect for endurance athletes — energy, recovery, the works. Worth checking out before your next event!\n\n${l}`,
  },
  {
    id: 'summer-shred',
    name: 'Summer Shred',
    monthStart: 6, dayStart: 1, monthEnd: 8, dayEnd: 31,
    tags: ['weightloss', 'weight-loss', 'cutting', 'shred', 'lean', 'fat-loss'],
    subject: n => `${n} — summer shred season 🌞`,
    message: (n, p, l) =>
      `Hey ${n}! Summer is the best motivation to get lean. ${p.name} is what a lot of people in my network are using right now for the shred. Take a look!\n\n${l}`,
  },
  {
    id: 'fall-bulk',
    name: 'Fall Bulk',
    monthStart: 9, dayStart: 1, monthEnd: 11, dayEnd: 30,
    tags: ['bulking', 'muscle', 'gaining', 'gainit', 'mass', 'strength', 'powerlifting'],
    subject: n => `${n} — bulk season is on 💪`,
    message: (n, p, l) =>
      `Hey ${n}! Fall is bulk season and ${p.name} is dialed in for putting on quality size. If you're in a gaining phase right now this is worth a look.\n\n${l}`,
  },
  {
    id: 'holiday-gift',
    name: 'Holiday Gift Guide',
    monthStart: 11, dayStart: 20, monthEnd: 12, dayEnd: 31,
    tags: [],
    requiresEmail: true,
    subject: n => `${n} — perfect fitness gift idea 🎁`,
    message: (n, p, l) =>
      `Hey ${n}! Looking for a gift that actually makes a difference? ${p.name} is what I'd recommend for anyone serious about their health. Great self-gift or stocking stuffer!\n\n${l}`,
  },
]

const SKIP_STATUSES = new Set(['Inactive'])

function getSeasonalSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SEASONAL_KEY) || '[]')) }
  catch { return new Set() }
}

function saveSeasonalSet(set) {
  const arr = [...set]
  if (arr.length > 50000) arr.splice(0, arr.length - 50000)
  localStorage.setItem(SEASONAL_KEY, JSON.stringify(arr))
}

function getActiveCampaigns() {
  const now   = new Date()
  const month = now.getMonth() + 1
  const day   = now.getDate()
  return CAMPAIGNS.filter(c => {
    const afterStart = month > c.monthStart || (month === c.monthStart && day >= c.dayStart)
    const beforeEnd  = month < c.monthEnd   || (month === c.monthEnd   && day <= c.dayEnd)
    return afterStart && beforeEnd
  })
}

function contactMatches(contact, campaign) {
  if (SKIP_STATUSES.has(contact.status)) return false
  if (campaign.requiresEmail) return !!contact.email
  if (!campaign.tags.length) return true
  const ctags = new Set((contact.tags || []).map(t => t.toLowerCase()))
  return campaign.tags.some(t => ctags.has(t.toLowerCase()))
}

function runSeasonal(store) {
  const { contacts } = store
  if (!contacts.length) return

  const active = getActiveCampaigns()
  if (!active.length) return

  const done  = getSeasonalSet()
  const year  = new Date().getFullYear()
  let total   = 0

  for (const campaign of active) {
    if (total >= MAX_PER_RUN) break
    for (const contact of contacts) {
      if (total >= MAX_PER_RUN) break
      const key = `${contact.id}::${campaign.id}::${year}`
      if (done.has(key)) continue
      if (!contactMatches(contact, campaign)) continue

      const product = matchProduct(contact)
      const link    = buildUTMLink(
        `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
        { contactId: contact.id, stepKey: `seasonal-${campaign.id}` }
      )
      const firstName = contact.name.split(' ')[0]
      const channel   = campaign.requiresEmail
        ? 'email'
        : contact.email ? 'email' : contact.phone ? 'sms' : 'dm'

      addToMQ({
        contactId: contact.id,
        contactName: contact.name,
        contactHandle: contact.social || '',
        contactEmail: contact.email || '',
        contactPhone: contact.phone || '',
        channel,
        subject: campaign.subject(firstName),
        message: campaign.message(firstName, product, link),
        seqId: `seasonal-${campaign.id}`,
        stepKey: `${year}`,
        seqName: `Seasonal: ${campaign.name}`,
        stepLabel: campaign.name,
      })

      addPipelineLog({ type: 'seasonal', contact: contact.name, campaign: campaign.name })
      done.add(key)
      total++
    }
  }

  if (total > 0) {
    saveSeasonalSet(done)
    window.dispatchEvent(new CustomEvent('seasonal-campaign-ran', {
      detail: { count: total, campaigns: active.map(c => c.name) },
    }))
  }
}

export default function SeasonalCampaignEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runSeasonal(storeRef.current)
    const t = setTimeout(run, 13 * 60 * 1000)
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
