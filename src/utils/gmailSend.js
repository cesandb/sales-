// Send emails via Gmail API using the existing Google OAuth token.
// Requires gmail.send scope — users must re-authorize after scope update.

import { getGoogleToken, getGmailAddress } from '../components/GoogleSync'

const GMAIL_SENT_KEY = 'phorm_gmail_sent_v1'

export function isGmailSendReady() {
  return !!getGoogleToken()
}

export function getGmailSent() {
  try { return JSON.parse(localStorage.getItem(GMAIL_SENT_KEY) || '{}') }
  catch { return {} }
}

function markGmailSent(sentKey) {
  const sent = getGmailSent()
  sent[sentKey] = new Date().toISOString()
  const keys = Object.keys(sent)
  if (keys.length > 3000) {
    // prune oldest 1000
    const sorted = keys.sort((a, b) => sent[a].localeCompare(sent[b]))
    sorted.slice(0, 1000).forEach(k => delete sent[k])
  }
  localStorage.setItem(GMAIL_SENT_KEY, JSON.stringify(sent))
}

// Build a base64url-encoded RFC 2822 MIME message
function buildMimeRaw(to, toName, subject, body) {
  const toHeader = toName ? `"${toName.replace(/"/g, '')}" <${to}>` : to
  const fromAddr = getGmailAddress()
  const lines = [
    ...(fromAddr ? [`From: ${fromAddr}`] : []),
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    body,
  ]
  const raw = lines.join('\r\n')
  // Encode: TextEncoder → Uint8Array → binary string → btoa → base64url
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Send a single email via Gmail API.
// sentKey — dedup key (contactId::seqId::stepKey); pass null to skip dedup.
// Returns true on success.
export async function sendViaGmail(to, toName, subject, body, sentKey = null) {
  if (!to) return false
  const token = getGoogleToken()
  if (!token) return false

  if (sentKey) {
    const sent = getGmailSent()
    if (sent[sentKey]) return false
  }

  try {
    const raw = buildMimeRaw(to, toName, subject, body)
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      if (sentKey) markGmailSent(sentKey)
      return true
    }
    // 401 = token expired; 403 = missing gmail.send scope
    if (res.status === 401 || res.status === 403) {
      // Token is invalid/insufficient — clear it so we don't keep trying
      localStorage.removeItem('phorm_google_token')
      localStorage.removeItem('phorm_google_token_expiry')
    }
  } catch {}
  return false
}
