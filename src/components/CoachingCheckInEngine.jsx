// CoachingCheckInEngine — sends weekly accountability check-ins to contacts
// tagged 'coaching-enrolled'. Fires every Sunday or Monday morning.
// Keeps the coaching relationship warm between purchases, driving repeat orders.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { addPipelineLog } from './PipelineAutomationEngine'

const CHECKIN_KEY  = 'phorm_coaching_checkin_v1'
const INTERVAL_MS  = 6 * 60 * 60 * 1000
const MAX_PER_RUN  = 15

function getWeekKey() {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

function getSentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(CHECKIN_KEY) || '[]')) }
  catch { return new Set() }
}

function saveSentSet(s) {
  localStorage.setItem(CHECKIN_KEY, JSON.stringify([...s].slice(-10000)))
}

const CHECKIN_ANGLES = [
  (name, product, link) =>
    `Hey ${name}! Quick accountability check-in 💪 How's your week going with your fitness goals? This is the week that separates those who say they will from those who do. If you haven't grabbed ${product.name} yet, now's a great time to dial in your nutrition → ${link}`,
  (name, product, link) =>
    `${name}! Checking in on you — how are you feeling this week? Small daily habits compound fast. Stay consistent with your routine, and if you need a nutritional edge, ${product.name} is exactly what I'd recommend → ${link}`,
  (name, product, link) =>
    `Hey ${name}! How's your progress this week? Remember: results come from showing up even when you don't feel like it. Let me know how things are going — I'm in your corner. And when you're ready to level up your nutrition: ${link}`,
]

function pickAngle(contactId, week) {
  const hash = [...(contactId + week)].reduce((a, c) => a + c.charCodeAt(0), 0)
  return CHECKIN_ANGLES[hash % CHECKIN_ANGLES.length]
}

async function runCoachingCheckIn(store) {
  const { contacts } = store
  if (!contacts?.length) return

  // Only run Sun (0) or Mon (1)
  const dow = new Date().getDay()
  if (dow !== 0 && dow !== 1) return
  const hour = new Date().getHours()
  if (hour < 8 || hour >= 11) return // 8-11am only for check-ins

  const week = getWeekKey()
  const sent = getSentSet()

  const enrolled = contacts.filter(c =>
    (c.tags || []).includes('coaching-enrolled') &&
    !['Inactive', 'Churned'].includes(c.status)
  )

  if (!enrolled.length) return

  let count = 0

  for (const contact of enrolled) {
    if (count >= MAX_PER_RUN) break
    const key = `${contact.id}::${week}`
    if (sent.has(key)) continue

    const channel = contact.email ? 'email' : contact.phone ? 'sms' : null
    if (!channel) continue

    const product = matchProduct(contact)
    const link = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: 'coaching-checkin' }
    )
    const firstName = contact.name.split(' ')[0]
    const angle = pickAngle(contact.id, week)

    addToMQ({
      contactId:     contact.id,
      contactName:   contact.name,
      contactHandle: contact.social || '',
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel,
      subject:   `${firstName} — weekly check-in 💪`,
      message:   angle(firstName, product, link),
      seqId:     `coaching-${week}`,
      stepKey:   `checkin-${week}`,
      seqName:   'Coaching Check-In',
      stepLabel: `Week ${week} accountability`,
    })

    sent.add(key)
    addPipelineLog({ type: 'coaching-checkin', contact: contact.name })
    count++
  }

  if (count > 0) {
    saveSentSet(sent)
    window.dispatchEvent(new CustomEvent('coaching-checkin-ran', { detail: { count } }))
  }
}

export default function CoachingCheckInEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runCoachingCheckIn(storeRef.current)
    const t = setTimeout(run, 14 * 60 * 1000) // 14 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
