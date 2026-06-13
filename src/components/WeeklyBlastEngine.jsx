// WeeklyBlastEngine — sends a personalized affiliate message to every active
// contact on Mon / Wed / Fri between 8am and 8pm. One message per contact
// per campaign day per ISO week. MQAutoSender delivers them.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { createBitlyLink, getBitlyKey } from '../utils/bitlyTracker'
import { addPipelineLog } from './PipelineAutomationEngine'

const BLAST_KEY   = 'phorm_weekly_blast_v1'
const INTERVAL_MS = 4 * 60 * 60 * 1000
const MAX_PER_RUN = 30

const SKIP_STATUSES = new Set(['Inactive'])

// 1=Mon, 3=Wed, 5=Fri
const DAY_ANGLES = {
  1: {
    subject: n => `${n} — new week, let's go 💪`,
    message: (n, p, l) =>
      `Hey ${n}! New week is the perfect reset. If dialing in your nutrition has been on your list, ${p.name} is what I'd start with — a lot of people I know are seeing real results with it.\n\n${l}`,
  },
  3: {
    subject: n => `${n} — mid-week check-in`,
    message: (n, p, l) =>
      `Hey ${n}! Mid-week is a great time to reassess. Are you fueling your workouts right? ${p.name} is what I keep coming back to for consistent results — worth a look if you haven't tried it.\n\n${l}`,
  },
  5: {
    subject: n => `${n} — weekend warrior fuel 🔥`,
    message: (n, p, l) =>
      `Hey ${n}! Weekend is prime time to put in extra work. ${p.name} is what I'd grab before your sessions — makes a real difference in energy and recovery. Check it out!\n\n${l}`,
  },
}

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}

function getBlastSet() {
  try { return new Set(JSON.parse(localStorage.getItem(BLAST_KEY) || '[]')) }
  catch { return new Set() }
}

function saveBlastSet(set) {
  const arr = [...set]
  if (arr.length > 50000) arr.splice(0, arr.length - 50000)
  localStorage.setItem(BLAST_KEY, JSON.stringify(arr))
}

async function runWeeklyBlast(store) {
  const { contacts } = store
  if (!contacts.length) return

  const now   = new Date()
  const hour  = now.getHours()
  const dow   = now.getDay()
  const angle = DAY_ANGLES[dow]
  if (!angle || hour < 8 || hour >= 20) return

  const year     = now.getFullYear()
  const week     = getISOWeek(now)
  const blastSet = getBlastSet()
  let count = 0

  for (const contact of contacts) {
    if (count >= MAX_PER_RUN) break
    if (SKIP_STATUSES.has(contact.status)) continue

    const key = `${contact.id}::${year}-W${week}-D${dow}`
    if (blastSet.has(key)) continue

    const product = matchProduct(contact)
    let link = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: `blast-d${dow}` }
    )
    if (getBitlyKey()) {
      try {
        const b = await createBitlyLink(link, contact.id)
        if (b?.shortUrl) link = b.shortUrl
      } catch {}
    }

    const firstName = contact.name.split(' ')[0]
    const channel   = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'

    addToMQ({
      contactId: contact.id,
      contactName: contact.name,
      contactHandle: contact.social || '',
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel,
      subject: angle.subject(firstName),
      message: angle.message(firstName, product, link),
      seqId:     `weekly-blast-w${week}`,
      stepKey:   `d${dow}`,
      seqName:   'Weekly Blast',
      stepLabel: `Week ${week} ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}`,
    })

    addPipelineLog({ type: 'weekly-blast', contact: contact.name, channel })
    blastSet.add(key)
    count++
  }

  if (count > 0) {
    saveBlastSet(blastSet)
    window.dispatchEvent(new CustomEvent('weekly-blast-ran', { detail: { count } }))
  }
}

export default function WeeklyBlastEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => runWeeklyBlast(storeRef.current)
    const t = setTimeout(run, 15 * 60 * 1000)
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
