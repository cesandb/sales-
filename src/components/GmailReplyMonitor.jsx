// GmailReplyMonitor — polls Gmail inbox every 5 min for replies from known contacts.
// When a reply is detected: logs an Email Reply interaction and advances contact status.
// Requires an active Google OAuth token with gmail.readonly or gmail.modify scope.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getGoogleToken } from './GoogleSync'
import { addPipelineLog } from './PipelineAutomationEngine'

const SEEN_KEY    = 'phorm_gmail_seen_v1'
const INTERVAL_MS = 5 * 60 * 1000

function getSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) }
  catch { return new Set() }
}
function saveSeen(seen) {
  // Cap at 5000 message IDs to avoid unbounded storage growth
  const arr = [...seen].slice(-5000)
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
}

async function checkReplies(store) {
  const token = getGoogleToken()
  if (!token) return

  const { contacts, addInteraction, updateContact } = store
  if (!contacts.length) return

  // Build email → contact index
  const emailMap = new Map()
  for (const c of contacts) {
    if (c.email) emailMap.set(c.email.toLowerCase(), c)
  }
  if (!emailMap.size) return

  const seen = getSeen()

  try {
    // Fetch recent unread inbox messages (last 3 days)
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:inbox+newer_than:3d&maxResults=50',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!res.ok) return
    const data = await res.json()
    const messages = data.messages || []

    for (const { id } of messages) {
      if (seen.has(id)) { continue }
      seen.add(id)

      // Fetch just the From header (minimal payload)
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        }
      )
      if (!msgRes.ok) continue

      const msg = await msgRes.json()
      const fromHeader = msg.payload?.headers?.find(h => h.name === 'From')?.value || ''
      const emailMatch = fromHeader.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)
      if (!emailMatch) continue

      const contact = emailMap.get(emailMatch[0].toLowerCase())
      if (!contact) continue

      // Log interaction
      addInteraction({
        contactId: contact.id,
        type: 'Email Reply',
        notes: 'Email reply auto-detected via Gmail inbox scan',
        date: new Date().toISOString().split('T')[0],
      })

      // Advance status if not already engaged
      if (contact.status === 'New Lead') {
        updateContact(contact.id, { status: 'Warm Lead' })
        addPipelineLog({ type: 'reply-detected', contact: contact.name, note: 'New Lead → Warm Lead' })
      } else if (contact.status === 'Warm Lead') {
        updateContact(contact.id, { status: 'Hot Lead' })
        addPipelineLog({ type: 'reply-detected', contact: contact.name, note: 'Warm Lead → Hot Lead' })
      }

      window.dispatchEvent(new CustomEvent('gmail-reply-detected', { detail: { contactName: contact.name } }))
    }

    saveSeen(seen)
  } catch { /* token expired or network failure — retry next interval */ }
}

export default function GmailReplyMonitor() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => checkReplies(storeRef.current)
    run()
    const t = setInterval(run, INTERVAL_MS)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
