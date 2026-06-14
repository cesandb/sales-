// Credential health — unified status checker for all integrations.
// Validates token expiry for OAuth connections; confirms API keys are set
// for static credentials. Used by CredentialHealthMonitor and Settings.

import { GOOGLE_CLIENT_ID_KEY, GOOGLE_TOKEN_KEY, GOOGLE_TOKEN_EXPIRY, buildOAuthURL } from '../components/GoogleSync'
import { isTwilioReady, isWhatsAppReady } from './twilioSms'
import { getApiKey } from './aiDraft'
import { getHunterKey } from './contactEnrich'
import { getApolloKey } from './apolloEnrich'
import { getBitlyKey } from './bitlyTracker'

export const REDDIT_DM_TOKEN_KEY  = 'phorm_reddit_dm_token'
export const REDDIT_DM_EXPIRY_KEY = 'phorm_reddit_dm_expiry'
export const REDDIT_DM_CLIENT_KEY = 'phorm_reddit_dm_client'

const HEALTH_KEY = 'phorm_cred_health_v1'
export const WARN_BEFORE_EXPIRY_MS = 20 * 60 * 1000  // warn 20 min before expiry

export function checkAllCredentials() {
  const now = Date.now()

  // Google OAuth (implicit flow — token valid ~1h)
  const googleToken    = localStorage.getItem(GOOGLE_TOKEN_KEY)
  const googleExpiry   = parseInt(localStorage.getItem(GOOGLE_TOKEN_EXPIRY) || '0')
  const googleClientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY)
  const googleStatus = !googleClientId ? 'not-configured'
    : !googleToken           ? 'expired'
    : now > googleExpiry     ? 'expired'
    : now > googleExpiry - WARN_BEFORE_EXPIRY_MS ? 'expiring'
    : 'ok'

  // Reddit DM OAuth (implicit flow — token valid ~1h)
  const redditToken    = localStorage.getItem(REDDIT_DM_TOKEN_KEY)
  const redditExpiry   = parseInt(localStorage.getItem(REDDIT_DM_EXPIRY_KEY) || '0')
  const redditClientId = localStorage.getItem(REDDIT_DM_CLIENT_KEY)
  const redditStatus = !redditClientId ? 'not-configured'
    : !redditToken           ? 'expired'
    : now > redditExpiry     ? 'expired'
    : now > redditExpiry - WARN_BEFORE_EXPIRY_MS ? 'expiring'
    : 'ok'

  const health = {
    checkedAt: now,
    google:    { status: googleStatus, expiresAt: googleExpiry, hasClientId: !!googleClientId },
    reddit:    { status: redditStatus, expiresAt: redditExpiry, hasClientId: !!redditClientId },
    twilio:    { status: isTwilioReady() ? 'ok' : 'not-configured' },
    whatsapp:  { status: isWhatsAppReady() ? 'ok' : 'not-configured' },
    anthropic: { status: getApiKey() ? 'ok' : 'not-configured' },
    hunter:    { status: getHunterKey() ? 'ok' : 'not-configured' },
    apollo:    { status: getApolloKey() ? 'ok' : 'not-configured' },
    bitly:     { status: getBitlyKey() ? 'ok' : 'not-configured' },
  }

  localStorage.setItem(HEALTH_KEY, JSON.stringify(health))
  return health
}

export function getStoredHealth() {
  try { return JSON.parse(localStorage.getItem(HEALTH_KEY) || 'null') }
  catch { return null }
}

export function getExpiringConnections(health) {
  if (!health) return []
  return Object.entries(health)
    .filter(([k, v]) => k !== 'checkedAt' && v?.status === 'expiring')
    .map(([k]) => k)
}

export function getExpiredConnections(health) {
  if (!health) return []
  return Object.entries(health)
    .filter(([k, v]) => k !== 'checkedAt' && v?.status === 'expired')
    .map(([k]) => k)
}

export function minutesUntilExpiry(health, key) {
  const conn = health?.[key]
  if (!conn?.expiresAt || conn.status === 'not-configured') return null
  return Math.max(0, Math.round((conn.expiresAt - Date.now()) / 60000))
}

// Silently refreshes the Google token using prompt=none in a 1×1 invisible popup.
// No user interaction needed — works as long as the user is still signed into
// the same Google account in this browser. Returns Promise<boolean>.
export function tryGoogleSilentReauth() {
  return new Promise((resolve) => {
    const url = buildOAuthURL()
    if (!url) { resolve(false); return }

    const silentUrl = `${url}&prompt=none`
    const popup = window.open(silentUrl, 'google-silent-reauth', 'width=1,height=1,left=-200,top=-200')
    if (!popup) { resolve(false); return }

    const poll = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(poll); resolve(false); return }
        const hash = popup.location.hash
        if (hash && hash.includes('access_token')) {
          const params   = new URLSearchParams(hash.slice(1))
          const token     = params.get('access_token')
          const expiresIn = parseInt(params.get('expires_in') || '3600')
          if (token) {
            localStorage.setItem(GOOGLE_TOKEN_KEY, token)
            localStorage.setItem(GOOGLE_TOKEN_EXPIRY, String(Date.now() + expiresIn * 1000))
            popup.close()
            clearInterval(poll)
            checkAllCredentials()
            window.dispatchEvent(new CustomEvent('credential-reconnected', {
              detail: { key: 'google', name: 'Gmail / Google Drive', silent: true },
            }))
            window.dispatchEvent(new CustomEvent('credential-health-update'))
            resolve(true)
          }
        }
        // error= means Google needs user interaction — silent reauth failed
        if (hash && hash.includes('error=')) {
          popup.close(); clearInterval(poll); resolve(false)
        }
      } catch { /* cross-origin while popup is on Google's domain */ }
    }, 300)

    setTimeout(() => { clearInterval(poll); try { popup.close() } catch {}; resolve(false) }, 10000)
  })
}

// Opens a visible Google OAuth popup for user-driven reconnect. Falls back here
// after silent reauth fails (e.g. user signed out of Google).
export function triggerGoogleReauth() {
  const url = buildOAuthURL()
  if (!url) return false
  // Use a popup so the user doesn't leave the app
  const popup = window.open(url, 'google-reauth', 'width=500,height=600,left=200,top=100')
  if (popup) {
    // Poll the popup for the token in the hash (implicit flow redirects back to /settings)
    const poll = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(poll); return }
        const hash = popup.location.hash
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.slice(1))
          const token     = params.get('access_token')
          const expiresIn = parseInt(params.get('expires_in') || '3600')
          if (token) {
            localStorage.setItem(GOOGLE_TOKEN_KEY, token)
            localStorage.setItem(GOOGLE_TOKEN_EXPIRY, String(Date.now() + expiresIn * 1000))
            popup.close()
            clearInterval(poll)
            window.dispatchEvent(new CustomEvent('credential-reconnected', { detail: { key: 'google' } }))
            // Re-check health
            checkAllCredentials()
            window.dispatchEvent(new CustomEvent('credential-health-update'))
          }
        }
      } catch {} // cross-origin errors while popup is on Google's domain — expected
    }, 500)
    // Give up after 5 min
    setTimeout(() => { clearInterval(poll); try { popup.close() } catch {} }, 5 * 60 * 1000)
  }
  return true
}
