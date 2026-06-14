// OutreachStallEngine — monitors whether automated outreach is actually firing.
// Alerts via toast if sends have stalled (queue backed up but nothing sending)
// or if the queue ran dry (no messages pending for active contacts).
// Runs 12 min after load, then every 2 hours.

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { getDailySentCount } from '../utils/dailyCap'
import { getMQ, getPendingMQ } from '../utils/messageQueue'

const INITIAL  = 12 * 60 * 1000
const INTERVAL = 2 * 60 * 60 * 1000

function checkOutreachHealth(store) {
  const { contacts } = store
  if (!contacts?.length) return

  const hour = new Date().getHours()
  // Only check during active hours (10am–9pm)
  if (hour < 10 || hour > 21) return

  const sentToday = getDailySentCount()
  const pending   = getPendingMQ()
  const allMQ     = getMQ()

  // Check for stall: queue has items but nothing sent today (sends are failing)
  if (sentToday === 0 && pending.length > 10) {
    const lastSent = allMQ
      .filter(i => i.sentAt)
      .sort((a, b) => (b.sentAt > a.sentAt ? 1 : -1))[0]?.sentAt

    const hoursSinceLastSend = lastSent
      ? (Date.now() - new Date(lastSent)) / 3600000
      : 999

    if (hoursSinceLastSend > 24) {
      window.dispatchEvent(new CustomEvent('outreach-stall-detected', {
        detail: { pending: pending.length, hoursSince: Math.round(hoursSinceLastSend) }
      }))
      return
    }
  }

  // Check for empty queue: active contacts exist but nothing queued
  const activeContacts = contacts.filter(c =>
    c.status !== 'Inactive' && c.status !== 'Customer' && c.status !== 'Repeat Customer'
  ).length

  if (pending.length === 0 && activeContacts > 5 && sentToday === 0) {
    window.dispatchEvent(new CustomEvent('outreach-queue-empty', {
      detail: { activeContacts }
    }))
  }
}

export default function OutreachStallEngine() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const t = setTimeout(() => checkOutreachHealth(storeRef.current), INITIAL)
    const interval = setInterval(() => checkOutreachHealth(storeRef.current), INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
