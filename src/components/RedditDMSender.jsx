// Background component — automatically sends Reddit DMs to u/username contacts
// using the Reddit OAuth implicit grant (privatemessages scope).
// No server required — runs entirely in the browser.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getMQ, markMQItemStatus } from '../utils/messageQueue'
import { parseSocialHandle } from '../utils/platformLinks'
import { addPipelineLog } from './PipelineAutomationEngine'

export const REDDIT_DM_TOKEN_KEY  = 'phorm_reddit_dm_token'
export const REDDIT_DM_EXPIRY_KEY = 'phorm_reddit_dm_expiry'
export const REDDIT_DM_CLIENT_KEY = 'phorm_reddit_dm_client'
const REDDIT_DM_STATE_KEY = 'phorm_reddit_dm_state'
const DM_SENT_KEY         = 'phorm_reddit_dm_sent'
const RUN_INTERVAL        = 10 * 60 * 1000

export function getRedditDMToken() {
  const token  = localStorage.getItem(REDDIT_DM_TOKEN_KEY)
  const expiry = parseInt(localStorage.getItem(REDDIT_DM_EXPIRY_KEY) || '0')
  if (!token || Date.now() > expiry) return null
  return token
}

export function buildRedditDMAuthURL() {
  const clientId = localStorage.getItem(REDDIT_DM_CLIENT_KEY)
  if (!clientId) return null
  const redirectUri = `${window.location.origin}${import.meta.env.BASE_URL}settings`
    .replace(/([^:]\/)\/+/g, '$1')
  const state = Math.random().toString(36).slice(2, 10)
  localStorage.setItem(REDDIT_DM_STATE_KEY, state)
  return (
    `https://www.reddit.com/api/v1/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `response_type=token&` +
    `state=${state}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `duration=temporary&` +
    `scope=privatemessages`
  )
}

// Call on Settings page mount to catch the OAuth redirect hash
export function parseRedditDMCallback() {
  const hash = window.location.hash.slice(1)
  if (!hash.includes('access_token')) return false
  const params     = new URLSearchParams(hash)
  const token      = params.get('access_token')
  const expiresIn  = parseInt(params.get('expires_in') || '3600')
  const state      = params.get('state')
  const savedState = localStorage.getItem(REDDIT_DM_STATE_KEY)
  if (!token) return false
  // Validate state if present
  if (state && savedState && state !== savedState) return false
  localStorage.setItem(REDDIT_DM_TOKEN_KEY, token)
  localStorage.setItem(REDDIT_DM_EXPIRY_KEY, String(Date.now() + expiresIn * 1000))
  localStorage.removeItem(REDDIT_DM_STATE_KEY)
  window.history.replaceState({}, '', window.location.pathname + window.location.search)
  window.dispatchEvent(new CustomEvent('credential-reconnected', { detail: { key: 'reddit', name: 'Reddit DM' } }))
  return true
}

function getDMSentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(DM_SENT_KEY) || '[]')) }
  catch { return new Set() }
}

function saveDMSentSet(set) {
  const arr = [...set]
  if (arr.length > 3000) arr.splice(0, arr.length - 3000)
  localStorage.setItem(DM_SENT_KEY, JSON.stringify(arr))
}

async function sendRedditDM(token, username, subject, body) {
  try {
    const res = await fetch('https://oauth.reddit.com/api/compose', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PhormCRM/1.0 by Conan',
      },
      body: new URLSearchParams({
        api_type: 'json',
        to:       username,
        subject:  (subject || 'Hey from Conan!').slice(0, 100),
        text:     body,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return false
    const data = await res.json()
    // Reddit errors come back as 200 with json.errors array
    const errors = data?.json?.errors
    return !errors || errors.length === 0
  } catch { return false }
}

async function runRedditDMSender(store) {
  const token = getRedditDMToken()
  if (!token) return

  const { addInteraction } = store
  const sent  = getDMSentSet()
  // Get pending DM items from the message queue that belong to Reddit contacts
  const items = getMQ().filter(i => {
    if (i.status !== 'pending') return false
    const parsed = i.contactHandle ? parseSocialHandle(i.contactHandle) : null
    return parsed?.platform === 'Reddit'
  })

  if (items.length === 0) return

  let count = 0
  // Max 3 DMs per run — Reddit rate-limits aggressively on new accounts
  for (const item of items.slice(0, 3)) {
    if (sent.has(item.id)) continue
    const parsed = parseSocialHandle(item.contactHandle)
    if (!parsed?.handle) continue

    const ok = await sendRedditDM(token, parsed.handle, item.subject, item.message)
    if (ok) {
      markMQItemStatus(item.id, 'sent')
      addInteraction({
        contactId: item.contactId,
        type: 'DM',
        notes: `Reddit DM sent to u/${parsed.handle}: [${item.seqName}] ${item.stepLabel}`,
      })
      addPipelineLog({ type: 'reddit-dm', contact: item.contactName, handle: parsed.handle })
      sent.add(item.id)
      count++
      // Pause between DMs — Reddit flags rapid-fire sends
      await new Promise(r => setTimeout(r, 4000))
    }
  }

  if (count > 0) {
    saveDMSentSet(sent)
    window.dispatchEvent(new CustomEvent('reddit-dm-sent', { detail: { count } }))
  }
}

export default function RedditDMSender() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    // Catch OAuth redirect on mount
    parseRedditDMCallback()
    const t = setTimeout(() => runRedditDMSender(storeRef.current), 60000)
    const interval = setInterval(() => runRedditDMSender(storeRef.current), RUN_INTERVAL)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
