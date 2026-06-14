// CredentialHealthMonitor — background component that checks all API tokens
// and OAuth connections every 5 minutes. Fires toast events when credentials
// are about to expire or have already expired, and attempts auto-reconnect for
// Google OAuth when the token expires and a client ID is configured.

import { useEffect, useRef } from 'react'
import {
  checkAllCredentials,
  getExpiringConnections,
  getExpiredConnections,
  minutesUntilExpiry,
  triggerGoogleReauth,
  WARN_BEFORE_EXPIRY_MS,
} from '../utils/credentialHealth'

const INTERVAL_MS = 5 * 60 * 1000

const FRIENDLY_NAMES = {
  google:    'Gmail / Google Calendar',
  reddit:    'Reddit DM',
  twilio:    'Twilio SMS',
  whatsapp:  'WhatsApp',
  anthropic: 'Anthropic AI',
  hunter:    'Hunter.io',
  apollo:    'Apollo.io',
  bitly:     'Bitly',
}

// Track which warnings have been shown this session so we don't spam
const shownWarnings = new Set()

function runHealthCheck() {
  const health = checkAllCredentials()

  const expiring = getExpiringConnections(health)
  const expired  = getExpiredConnections(health)

  for (const key of expiring) {
    const warnKey = `expiring::${key}`
    if (shownWarnings.has(warnKey)) continue
    shownWarnings.add(warnKey)
    const mins = minutesUntilExpiry(health, key)
    window.dispatchEvent(new CustomEvent('credential-expiring', {
      detail: { key, name: FRIENDLY_NAMES[key] || key, minsLeft: mins },
    }))
  }

  for (const key of expired) {
    const warnKey = `expired::${key}`
    if (shownWarnings.has(warnKey)) continue
    shownWarnings.add(warnKey)
    window.dispatchEvent(new CustomEvent('credential-expired', {
      detail: { key, name: FRIENDLY_NAMES[key] || key },
    }))

    // Auto-reconnect Google silently if client ID is configured
    if (key === 'google' && health.google?.hasClientId) {
      setTimeout(() => {
        triggerGoogleReauth()
      }, 2000) // small delay so the toast fires first
    }
  }

  // When a connection is re-established (e.g. user reconnects), clear warning state
  window.dispatchEvent(new CustomEvent('credential-health-update', { detail: health }))
}

export default function CredentialHealthMonitor() {
  const timerRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    // Reset shown warnings when previously-expiring tokens get refreshed
    const onReconnected = (e) => {
      const key = e.detail?.key
      if (key) {
        shownWarnings.delete(`expiring::${key}`)
        shownWarnings.delete(`expired::${key}`)
      }
    }
    window.addEventListener('credential-reconnected', onReconnected)

    // First check: 10 seconds after load (let the app settle first)
    timerRef.current = setTimeout(runHealthCheck, 10000)
    // Then check every 5 minutes
    intervalRef.current = setInterval(runHealthCheck, INTERVAL_MS)

    return () => {
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
      window.removeEventListener('credential-reconnected', onReconnected)
    }
  }, [])

  return null
}
