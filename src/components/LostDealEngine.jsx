// LostDealEngine — scans closed_lost deals 30+ days old and auto-enrolls
// the contact in the seq-win-back sequence for a second-chance recovery attempt.
// Runs every 4 hours, max 5 recoveries per run.

import { useRef, useEffect } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { addPipelineLog } from './PipelineAutomationEngine'
import { addToMQ } from '../utils/messageQueue'
import { matchProduct, buildUTMLink } from '../utils/affiliateLinks'

const INTERVAL     = 4 * 60 * 60 * 1000
const INITIAL      = 11 * 60 * 1000
const MAX_PER_RUN  = 5
const RECOVERY_DAYS = 30
const RECOVERY_KEY = 'phorm_lost_deal_recovery_v1'

function getRecovered() {
  try { return new Set(JSON.parse(localStorage.getItem(RECOVERY_KEY) || '[]')) }
  catch { return new Set() }
}
function saveRecovered(set) {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify([...set].slice(-3000)))
}

function runLostDealRecovery(store) {
  const { deals, contacts, enrollments, addEnrollment } = store
  if (!deals?.length) return

  const recovered = getRecovered()
  const now = new Date()

  const contactMap = new Map(contacts.map(c => [c.id, c]))
  const enrByC = new Map()
  for (const e of (enrollments || [])) {
    const a = enrByC.get(e.contactId) || []; a.push(e); enrByC.set(e.contactId, a)
  }

  let count = 0
  for (const deal of deals) {
    if (count >= MAX_PER_RUN) break
    if (deal.stage !== 'closed_lost') continue
    if (recovered.has(deal.id)) continue

    const daysSinceClosed = differenceInDays(now, parseISO(deal.updatedAt || deal.createdAt))
    if (daysSinceClosed < RECOVERY_DAYS) continue

    const contact = contactMap.get(deal.contactId)
    if (!contact || contact.status === 'Inactive') continue

    const alreadyEnrolled = (enrByC.get(deal.contactId) || []).some(
      e => e.sequenceId === 'seq-win-back' && e.status === 'active'
    )
    if (!alreadyEnrolled) {
      addEnrollment({ contactId: deal.contactId, sequenceId: 'seq-win-back' })
      addPipelineLog({ type: 'lost-deal-recovery', contact: contact.name, deal: deal.title || 'Deal' })
    }

    // Queue a personalized re-engagement message
    const product  = matchProduct(contact)
    const link     = buildUTMLink(`https://1stphorm.com/products/${product.id}/?a_aid=Conan`, { contactId: contact.id, stepKey: 'deal-recovery' })
    const firstName = contact.name.split(' ')[0]
    addToMQ({
      contactId:     contact.id,
      contactName:   contact.name,
      contactHandle: contact.social || contact.email || '',
      contactEmail:  contact.email  || '',
      contactPhone:  contact.phone  || '',
      channel:       contact.email ? 'email' : contact.phone ? 'sms' : 'dm',
      subject:       `Hey ${firstName} — still thinking about it?`,
      message:       `Hey ${firstName}! I know the timing wasn't right before, but I wanted to check back in. A lot has changed and I think ${product.name} could still be a game-changer for you. No pressure at all — just here if you want to revisit it. ${link}`,
      seqId:         'seq-win-back',
      stepKey:       `deal-recovery-${deal.id}`,
      seqName:       'Win-Back',
      stepLabel:     'Lost Deal Re-Engagement',
    })

    recovered.add(deal.id)
    count++
  }

  saveRecovered(recovered)
  if (count > 0) {
    window.dispatchEvent(new CustomEvent('lost-deal-recovery-ran', { detail: { count } }))
  }
}

export default function LostDealEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const t = setTimeout(() => runLostDealRecovery(storeRef.current), INITIAL)
    const interval = setInterval(() => runLostDealRecovery(storeRef.current), INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
