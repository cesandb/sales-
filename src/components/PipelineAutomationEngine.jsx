import { useRef, useEffect } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { DEFAULT_SEQUENCES, STEP_MESSAGES, matchProduct, buildUTMLink } from '../utils/affiliateLinks'

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

async function trySendEmail(contact, seq, step) {
  const publicKey = localStorage.getItem(EMAILJS_KEY)
  const serviceId = localStorage.getItem(EMAILJS_SERVICE)
  const templateId = localStorage.getItem(EMAILJS_TEMPLATE)
  if (!publicKey || !serviceId || !templateId || !contact.email) return false

  const sentKey = `${contact.id}::${seq.id}::${step.stepKey}`
  const sent = (() => { try { return JSON.parse(localStorage.getItem(EMAIL_SENT_KEY) || '{}') } catch { return {} } })()
  if (sent[sentKey]) return false

  try {
    const product = matchProduct(contact)
    const link = buildUTMLink(
      `https://1stphorm.com/products/${product.id}/?a_aid=Conan`,
      { contactId: contact.id, stepKey: step.stepKey }
    )
    const msgFn = STEP_MESSAGES[step.stepKey]
    const message = msgFn
      ? msgFn(contact.name.split(' ')[0], product.name, link)
      : `Hey ${contact.name.split(' ')[0]}! Checking in from Conan at 1st Phorm — ${link}`

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: contact.email,
          to_name: contact.name,
          from_name: 'Conan (1st Phorm)',
          subject: `Hey ${contact.name.split(' ')[0]}!`,
          message,
          reply_to: '',
        },
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      sent[sentKey] = new Date().toISOString()
      localStorage.setItem(EMAIL_SENT_KEY, JSON.stringify(sent))
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
    const { contacts, interactions, enrollments, followups, linkShares,
            updateContact, addFollowup, addEnrollment } = s

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // ── 1. Status auto-advance ────────────────────────────────────────────────
    const BUYING_SIGNALS = ['bought', 'purchase', 'order', 'want to try', 'sign me up', 'how much', 'what\'s the price', 'interested in buying', 'ready to']
    for (const contact of contacts) {
      if (contact.status === 'Customer' || contact.status === 'Repeat Customer' || contact.status === 'Inactive') continue
      const ci = interactions.filter(i => i.contactId === contact.id)
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
      const alreadyEnrolled = enrollments.some(
        e => e.contactId === contact.id && e.sequenceId === 'seq-re-engage' && e.status === 'active'
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
      const alreadyQueued = followups.some(f => f.enrollmentKey === followupKey)
      if (alreadyQueued) continue

      const contact = contacts.find(c => c.id === enrollment.contactId)
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
      const alreadyQueued = followups.some(f => f.linkShareKey === ls.id)
      if (alreadyQueued) continue
      const contact = contacts.find(c => c.id === ls.contactId)
      if (!contact) continue
      addFollowup({
        contactId: ls.contactId,
        date: todayStr,
        notes: 'Link share follow-up — did they check it out?',
        linkShareKey: ls.id,
      })
      addPipelineLog({ type: 'link-followup', contact: contact.name })
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
