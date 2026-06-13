import { useRef, useEffect } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { DEFAULT_SEQUENCES, STEP_MESSAGES, matchProduct, buildUTMLink } from '../utils/affiliateLinks'
import { addToMQ, markMQStatus } from '../utils/messageQueue'

export const EMAILJS_KEY      = 'phorm_emailjs_key'
export const EMAILJS_SERVICE  = 'phorm_emailjs_service'
export const EMAILJS_TEMPLATE = 'phorm_emailjs_template'
const PIPELINE_LOG_KEY  = 'phorm_pipeline_log'
const EMAIL_SENT_KEY    = 'phorm_emails_sent'
const RUN_INTERVAL      = 5 * 60 * 1000

export function addPipelineLog(entry) {
  try {
    const log = JSON.parse(localStorage.getItem(PIPELINE_LOG_KEY) || '[]')
    log.unshift({ ...entry, ts: new Date().toISOString() })
    localStorage.setItem(PIPELINE_LOG_KEY, JSON.stringify(log.slice(0, 100)))
  } catch {}
}

export function getPipelineLog() {
  try { return JSON.parse(localStorage.getItem(PIPELINE_LOG_KEY) || '[]') }
  catch { return [] }
}

export async function trySendEmail(contact, seq, step) {
  const sentKey = `${contact.id}::${seq.id}::${step.stepKey}`
  const sent = (() => { try { return JSON.parse(localStorage.getItem(EMAIL_SENT_KEY) || '{}') } catch { return {} } })()
  if (sent[sentKey]) return false

  // Always build the message and add to queue for manual DM fallback
  const product  = matchProduct(contact)
  const link     = buildUTMLink(
    `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
    { contactId: contact.id, stepKey: step.stepKey }
  )
  const firstName = contact.name.split(' ')[0]
  const msgFn     = STEP_MESSAGES[step.stepKey]
  const message   = msgFn
    ? msgFn(firstName, product.name, link)
    : `Hey ${firstName}! Checking in from Conan at 1st Phorm — ${link}`

  const channel = contact.email ? 'email' : contact.phone ? 'sms' : 'dm'
  addToMQ({
    contactId:     contact.id,
    contactName:   contact.name,
    contactHandle: contact.social || contact.email || '',
    contactEmail:  contact.email  || '',
    contactPhone:  contact.phone  || '',
    channel, subject: `Hey ${firstName}!`, message,
    seqId: seq.id, stepKey: step.stepKey,
    seqName: seq.name, stepLabel: step.label,
  })

  // Attempt actual email send if credentials + email present
  const publicKey  = localStorage.getItem(EMAILJS_KEY)
  const serviceId  = localStorage.getItem(EMAILJS_SERVICE)
  const templateId = localStorage.getItem(EMAILJS_TEMPLATE)
  if (!publicKey || !serviceId || !templateId || !contact.email) return false

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: contact.email, to_name: contact.name,
          from_name: 'Conan (1st Phorm)',
          subject: `Hey ${firstName}!`, message, reply_to: '',
        },
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      sent[sentKey] = new Date().toISOString()
      localStorage.setItem(EMAIL_SENT_KEY, JSON.stringify(sent))
      markMQStatus(contact.id, seq.id, step.stepKey, 'sent')
      addPipelineLog({ type: 'email-sent', contact: contact.name, seq: seq.name, step: step.label })
      return true
    }
  } catch {}
  return false
}

export default function PipelineAutomationEngine() {
  const storeRef = useRef(null)
  const store = useStore()
  storeRef.current = store

  async function runAutomations() {
    const s = storeRef.current
    if (!s) return
    const { contacts, interactions, enrollments, followups, linkShares, contactProducts, deals,
            updateContact, addFollowup, addEnrollment } = s

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Build index Maps once — eliminates O(n²) in every section below
    const contactMap = new Map(contacts.map(c => [c.id, c]))
    const iByC   = new Map()
    const fuByC  = new Map()
    const enrByC = new Map()
    const cpByC  = new Map()
    for (const i  of interactions)           { const a = iByC.get(i.contactId)   || []; a.push(i);  iByC.set(i.contactId, a) }
    for (const f  of followups)              { const a = fuByC.get(f.contactId)  || []; a.push(f);  fuByC.set(f.contactId, a) }
    for (const e  of enrollments)            { const a = enrByC.get(e.contactId) || []; a.push(e);  enrByC.set(e.contactId, a) }
    for (const cp of (contactProducts || [])) { const a = cpByC.get(cp.contactId) || []; a.push(cp); cpByC.set(cp.contactId, a) }

    // ── 1. Status auto-advance ────────────────────────────────────────────────
    const BUYING_SIGNALS = ['bought', 'purchase', 'order', 'want to try', 'sign me up', 'how much', 'what\'s the price', 'interested in buying', 'ready to']
    for (const contact of contacts) {
      if (contact.status === 'Customer' || contact.status === 'Repeat Customer' || contact.status === 'Inactive') continue
      const ci = iByC.get(contact.id) || []
      const hasBuyingSignal = ci.some(i =>
        BUYING_SIGNALS.some(kw => (i.notes || '').toLowerCase().includes(kw))
      )
      let newStatus = contact.status
      if (hasBuyingSignal && contact.status !== 'Hot Lead') {
        newStatus = 'Hot Lead'
      } else if (ci.length >= 3 && contact.status === 'Warm Lead') {
        newStatus = 'Hot Lead'
      } else if (ci.length >= 1 && contact.status === 'New Lead') {
        newStatus = 'Warm Lead'
      }
      if (newStatus !== contact.status) {
        updateContact(contact.id, { status: newStatus })
        addPipelineLog({ type: 'status', contact: contact.name, from: contact.status, to: newStatus })
      }
    }

    // ── 2. Dead lead revival ──────────────────────────────────────────────────
    for (const contact of contacts) {
      if (contact.status !== 'New Lead' && contact.status !== 'Warm Lead') continue
      const lastDate = contact.lastContact ? parseISO(contact.lastContact) : parseISO(contact.createdAt)
      const days = differenceInDays(now, lastDate)
      if (days < 60) continue
      const alreadyEnrolled = (enrByC.get(contact.id) || []).some(
        e => e.sequenceId === 'seq-re-engage' && e.status === 'active'
      )
      if (!alreadyEnrolled) {
        addEnrollment({ contactId: contact.id, sequenceId: 'seq-re-engage' })
        addPipelineLog({ type: 'revival', contact: contact.name, days })
      }
    }

    // ── 3. Sequence step queueing ─────────────────────────────────────────────
    for (const enrollment of enrollments) {
      if (enrollment.status !== 'active') continue
      const seq = DEFAULT_SEQUENCES.find(q => q.id === enrollment.sequenceId)
      if (!seq) continue
      const step = seq.steps[enrollment.currentStep]
      if (!step) continue
      const daysSince = differenceInDays(now, parseISO(enrollment.enrolledAt))
      if (daysSince < step.day) continue

      const followupKey = `enr-${enrollment.id}-step-${enrollment.currentStep}`
      const alreadyQueued = (fuByC.get(enrollment.contactId) || []).some(f => f.enrollmentKey === followupKey)
      if (alreadyQueued) continue

      const contact = contactMap.get(enrollment.contactId)
      if (!contact) continue

      addFollowup({
        contactId: enrollment.contactId,
        date: todayStr,
        notes: `[${seq.name}] ${step.label}`,
        enrollmentKey: followupKey,
        enrollmentId: enrollment.id,
      })
      addPipelineLog({ type: 'seq-queued', contact: contact.name, seq: seq.name, step: step.label })
      await trySendEmail(contact, seq, step)
    }

    // ── 4. Link-share follow-up reminders ─────────────────────────────────────
    for (const ls of linkShares) {
      if (ls.followedUp) continue
      const days = differenceInDays(now, parseISO(ls.date))
      if (days < 2) continue
      const alreadyQueued = (fuByC.get(ls.contactId) || []).some(f => f.linkShareKey === ls.id)
      if (alreadyQueued) continue
      const contact = contactMap.get(ls.contactId)
      if (!contact) continue
      addFollowup({
        contactId: ls.contactId,
        date: todayStr,
        notes: 'Link share follow-up — did they check it out?',
        linkShareKey: ls.id,
      })
      addPipelineLog({ type: 'link-followup', contact: contact.name })
    }

    // ── 5. Post-purchase sequence enrollment ──────────────────────────────────
    for (const cp of (contactProducts || [])) {
      const contact = contactMap.get(cp.contactId)
      if (!contact) continue
      const daysSincePurchase = differenceInDays(now, parseISO(cp.purchaseDate))
      const cEnr = enrByC.get(cp.contactId) || []

      const hasReferral = cEnr.some(e => e.sequenceId === 'seq-referral' && e.status === 'active')
      if (!hasReferral) {
        addEnrollment({ contactId: cp.contactId, sequenceId: 'seq-referral' })
        addPipelineLog({ type: 'seq-enroll', contact: contact.name, seq: 'Referral Ask' })
      }

      if (daysSincePurchase >= 28) {
        const hasReorder = cEnr.some(e => e.sequenceId === 'seq-reorder' && e.status === 'active')
        if (!hasReorder) {
          addEnrollment({ contactId: cp.contactId, sequenceId: 'seq-reorder' })
          addPipelineLog({ type: 'seq-enroll', contact: contact.name, seq: 'Reorder', days: daysSincePurchase })
        }
      }
    }

    // ── 6. Conversion detection from interaction notes ────────────────────────
    const CONVERSION_SIGNALS = [
      'just ordered', 'they bought', 'placed an order', 'made a purchase',
      'bought it', 'ordered it', 'completed purchase', 'confirmed order',
      'already ordered', 'went ahead and ordered', 'went ahead and bought',
    ]
    for (const contact of contacts) {
      if (contact.status === 'Customer' || contact.status === 'Repeat Customer') continue
      const ci = iByC.get(contact.id) || []
      const hasConversionSignal = ci.some(i =>
        CONVERSION_SIGNALS.some(kw => (i.notes || '').toLowerCase().includes(kw))
      )
      if (!hasConversionSignal) continue

      updateContact(contact.id, { status: 'Customer' })
      addPipelineLog({ type: 'conversion', contact: contact.name })

      const logKey = `conv-detect-${contact.id}`
      const alreadyCreated = (fuByC.get(contact.id) || []).some(f => f.enrollmentKey === logKey)
      if (!alreadyCreated) {
        addFollowup({
          contactId: contact.id,
          date: todayStr,
          notes: '🎉 Conversion detected — log actual order details in Commissions',
          enrollmentKey: logKey,
        })
      }
    }

    // ── 7. Evangelist detection ───────────────────────────────────────────────
    const EVANGELIST_SIGNALS = [
      'referred', 'told my friend', 'shared with', 'posted about', 'left a review',
      'told someone', 'recommended to', 'their friend', 'tagged you', 'sent to a friend',
    ]
    for (const contact of contacts) {
      if (contact.status === 'Evangelist') continue
      if (contact.status !== 'Customer' && contact.status !== 'Repeat Customer') continue
      const ci = iByC.get(contact.id) || []
      const hasEvangelistSignal = ci.some(i =>
        EVANGELIST_SIGNALS.some(kw => (i.notes || '').toLowerCase().includes(kw))
      )
      if (hasEvangelistSignal) {
        updateContact(contact.id, { status: 'Evangelist' })
        addPipelineLog({ type: 'evangelist', contact: contact.name })
      }
    }

    // ── 8. Churn risk detection ───────────────────────────────────────────────
    for (const contact of contacts) {
      if (contact.status !== 'Customer' && contact.status !== 'Repeat Customer') continue
      let score = 0
      const lastDate = contact.lastContact ? parseISO(contact.lastContact) : parseISO(contact.createdAt)
      const daysSince = differenceInDays(now, lastDate)
      if (daysSince >= 45) score += 20
      if (daysSince >= 90) score += 30
      const hasActiveEnrollment = (enrByC.get(contact.id) || []).some(e => e.status === 'active')
      if (!hasActiveEnrollment) score += 15
      const purchases = cpByC.get(contact.id) || []
      if (purchases.length > 0) {
        const lastPurchase = purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))[0]
        if (differenceInDays(now, parseISO(lastPurchase.purchaseDate)) >= 60) score += 25
      }
      if (score >= 60 && contact.status !== 'At Risk') {
        updateContact(contact.id, { status: 'At Risk' })
        addPipelineLog({ type: 'churn-risk', contact: contact.name, score })
        const churnKey = `churn-risk-${contact.id}`
        const alreadyCreated = (fuByC.get(contact.id) || []).some(f => f.enrollmentKey === churnKey)
        if (!alreadyCreated) {
          addFollowup({
            contactId: contact.id,
            date: todayStr,
            notes: `⚠️ Churn risk (score: ${score}) — re-engage now`,
            enrollmentKey: churnKey,
          })
        }
      }
    }

    // ── 9. Deal renewal monitoring ────────────────────────────────────────────
    for (const deal of (deals || [])) {
      if (!deal.renewalDate || deal.stage === 'closed_lost') continue
      const daysToRenewal = differenceInDays(parseISO(deal.renewalDate), now)
      if (daysToRenewal > 90 || daysToRenewal < 0) continue
      const contact = contactMap.get(deal.contactId)
      if (!contact) continue
      const renewalKey = `renewal-${deal.id}`
      const alreadyCreated = (fuByC.get(deal.contactId) || []).some(f => f.enrollmentKey === renewalKey)
      if (!alreadyCreated) {
        addFollowup({
          contactId: deal.contactId,
          date: todayStr,
          notes: `🔄 Renewal in ${daysToRenewal}d — ${deal.title || 'Deal'}`,
          enrollmentKey: renewalKey,
        })
        addPipelineLog({ type: 'renewal-due', contact: contact.name, days: daysToRenewal })
        const hasReorder = (enrByC.get(deal.contactId) || []).some(
          e => e.sequenceId === 'seq-reorder' && e.status === 'active'
        )
        if (!hasReorder) addEnrollment({ contactId: deal.contactId, sequenceId: 'seq-reorder' })
      }
    }

    // ── 10. Hot Lead → Fast Close auto-enrollment ─────────────────────────────
    for (const contact of contacts) {
      if (contact.status !== 'Hot Lead') continue
      const alreadyEnrolled = (enrByC.get(contact.id) || []).some(
        e => e.sequenceId === 'seq-hot-close' && (e.status === 'active' || e.status === 'completed')
      )
      if (!alreadyEnrolled) {
        addEnrollment({ contactId: contact.id, sequenceId: 'seq-hot-close' })
        addPipelineLog({ type: 'seq-enroll', contact: contact.name, seq: 'Hot Lead Fast Close' })
      }
    }

    // ── 11. At Risk → Win-Back auto-enrollment ────────────────────────────────
    for (const contact of contacts) {
      if (contact.status !== 'At Risk') continue
      const alreadyEnrolled = (enrByC.get(contact.id) || []).some(
        e => e.sequenceId === 'seq-win-back' && e.status === 'active'
      )
      if (!alreadyEnrolled) {
        addEnrollment({ contactId: contact.id, sequenceId: 'seq-win-back' })
        addPipelineLog({ type: 'seq-enroll', contact: contact.name, seq: 'At Risk Win-Back' })
      }
    }

    // ── 12. New Customer → Welcome sequence ───────────────────────────────────
    for (const contact of contacts) {
      if (contact.status !== 'Customer' && contact.status !== 'Repeat Customer') continue
      const alreadyEnrolled = (enrByC.get(contact.id) || []).some(
        e => e.sequenceId === 'seq-welcome' && (e.status === 'active' || e.status === 'completed')
      )
      if (!alreadyEnrolled) {
        addEnrollment({ contactId: contact.id, sequenceId: 'seq-welcome' })
        addPipelineLog({ type: 'seq-enroll', contact: contact.name, seq: 'New Customer Welcome' })
      }
    }

    // ── 13. New contacts (< 24h) auto-enroll in Cold Intro ───────────────────
    const dayAgo = new Date(Date.now() - 86400000)
    for (const contact of contacts) {
      if (contact.status !== 'New Lead') continue
      if (new Date(contact.createdAt) < dayAgo) continue
      const hasAnyEnrollment = (enrByC.get(contact.id) || []).length > 0
      if (!hasAnyEnrollment) {
        addEnrollment({ contactId: contact.id, sequenceId: 'seq-cold-intro' })
        addPipelineLog({ type: 'seq-enroll', contact: contact.name, seq: '5-Touch Cold Intro' })
      }
    }

    window.dispatchEvent(new CustomEvent('pipeline-automation-ran'))
  }

  useEffect(() => {
    const t = setTimeout(runAutomations, 4000)
    const interval = setInterval(runAutomations, RUN_INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
