import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'

export const GOOGLE_CLIENT_ID_KEY  = 'phorm_google_client_id'
export const GOOGLE_TOKEN_KEY      = 'phorm_google_token'
export const GOOGLE_TOKEN_EXPIRY   = 'phorm_google_token_expiry'

const GMAIL_SYNC_INTERVAL    = 15 * 60 * 1000
const CALENDAR_SYNC_INTERVAL = 30 * 60 * 1000

export function getGoogleToken() {
  const token  = localStorage.getItem(GOOGLE_TOKEN_KEY)
  const expiry = parseInt(localStorage.getItem(GOOGLE_TOKEN_EXPIRY) || '0')
  if (!token || Date.now() > expiry) return null
  return token
}

export function buildOAuthURL() {
  const clientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY)
  if (!clientId) return null
  const redirectUri = `${window.location.origin}${import.meta.env.BASE_URL}settings`
    .replace(/\/+/g, '/')
    .replace('https:/', 'https://')
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ')
  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `include_granted_scopes=true`
  )
}

async function syncGmail(store) {
  const token = getGoogleToken()
  if (!token) return
  const { contacts, addInteraction } = store
  const emailMap = new Map(
    contacts.filter(c => c.email).map(c => [c.email.toLowerCase(), c])
  )
  if (emailMap.size === 0) return
  const since = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000)
  try {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${since}&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
    )
    if (!listRes.ok) return
    const listData = await listRes.json()
    for (const msg of (listData.messages || []).slice(0, 20)) {
      const logKey = `phorm_gmail_${msg.id}`
      if (localStorage.getItem(logKey)) continue
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
      )
      if (!msgRes.ok) continue
      const msgData = await msgRes.json()
      const headers = msgData.payload?.headers || []
      const fromHeader = headers.find(h => h.name === 'From')?.value || ''
      const subject    = headers.find(h => h.name === 'Subject')?.value || ''
      const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/^([^\s]+@[^\s]+)$/)
      const fromEmail  = emailMatch?.[1]?.toLowerCase()
      if (!fromEmail) continue
      const contact = emailMap.get(fromEmail)
      if (!contact) continue
      addInteraction({
        contactId: contact.id,
        type: 'Reply',
        notes: `Gmail reply — "${subject.slice(0, 80)}"`,
      })
      localStorage.setItem(logKey, '1')
    }
  } catch { /* token expired or network error — handled silently */ }
  window.dispatchEvent(new CustomEvent('google-sync-ran', { detail: 'gmail' }))
}

async function syncCalendar(store) {
  const token = getGoogleToken()
  if (!token) return
  const { contacts, addInteraction, addFollowup } = store
  const emailMap = new Map(
    contacts.filter(c => c.email).map(c => [c.email.toLowerCase(), c])
  )
  if (emailMap.size === 0) return
  const timeMin = new Date(Date.now() - 7 * 86400000).toISOString()
  const timeMax = new Date(Date.now() + 14 * 86400000).toISOString()
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=50&singleEvents=true`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return
    const data = await res.json()
    const now = new Date()
    for (const event of (data.items || [])) {
      for (const attendee of (event.attendees || [])) {
        const email   = attendee.email?.toLowerCase()
        const contact = emailMap.get(email)
        if (!contact) continue
        const eventKey = `phorm_cal_${event.id}_${contact.id}`
        if (localStorage.getItem(eventKey)) continue
        const start    = event.start?.dateTime || event.start?.date
        const eventDate = start ? new Date(start) : null
        if (!eventDate) continue
        if (eventDate < now) {
          addInteraction({
            contactId: contact.id,
            type: 'Call',
            notes: `Meeting: "${(event.summary || 'Calendar event').slice(0, 80)}"`,
          })
        } else {
          addFollowup({
            contactId: contact.id,
            date: eventDate.toISOString().split('T')[0],
            notes: `📅 Meeting: "${(event.summary || 'Calendar event').slice(0, 80)}"`,
          })
        }
        localStorage.setItem(eventKey, '1')
      }
    }
  } catch { /* silently fail */ }
  window.dispatchEvent(new CustomEvent('google-sync-ran', { detail: 'calendar' }))
}

export default function GoogleSync() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => {
      const s = storeRef.current
      if (s) { syncGmail(s); syncCalendar(s) }
    }
    const t1 = setTimeout(() => syncGmail(storeRef.current), 6000)
    const t2 = setTimeout(() => syncCalendar(storeRef.current), 12000)
    const gi = setInterval(() => syncGmail(storeRef.current), GMAIL_SYNC_INTERVAL)
    const ci = setInterval(() => syncCalendar(storeRef.current), CALENDAR_SYNC_INTERVAL)
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(gi); clearInterval(ci) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
