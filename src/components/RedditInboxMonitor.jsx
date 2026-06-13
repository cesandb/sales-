// RedditInboxMonitor — polls Reddit inbox every 5 min for replies to DMs we sent.
// Uses the same OAuth token as RedditDMSender (privatemessages scope required).
// When a reply is detected: logs a Reddit Reply interaction and advances status.
// Opt-out keywords in the reply body auto-mark the contact as Inactive.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getRedditDMToken } from './RedditDMSender'
import { addPipelineLog } from './PipelineAutomationEngine'

const SEEN_KEY    = 'phorm_reddit_seen_v1'
const INTERVAL_MS = 5 * 60 * 1000

const OPTOUT_KWS = ['unsubscribe', 'stop messaging', 'stop contacting', 'not interested',
  'remove me', 'leave me alone', 'do not contact', "don't contact", 'opt out', 'opt-out',
  'no thanks', 'please stop', 'take me off']

function getSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) }
  catch { return new Set() }
}
function saveSeen(seen) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-5000)))
}

async function checkRedditInbox(store) {
  const token = getRedditDMToken()
  if (!token) return

  const { contacts, addInteraction, updateContact } = store
  if (!contacts.length) return

  // Build Reddit handle → contact map
  const redditMap = new Map()
  for (const c of contacts) {
    const s = (c.social || '').trim()
    if (!s) continue
    const handle = s.replace(/^\/?u\//, '').toLowerCase()
    if (/^[\w-]+$/.test(handle)) redditMap.set(handle, c)
  }
  if (!redditMap.size) return

  const seen = getSeen()

  try {
    const res = await fetch(
      'https://oauth.reddit.com/message/inbox?limit=25&mark=false',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'PhormCRM/1.0',
        },
        signal: AbortSignal.timeout(12000),
      }
    )
    if (!res.ok) return
    const data = await res.json()
    const items = data?.data?.children || []

    for (const { data: msg } of items) {
      if (msg.was_comment) continue
      if (seen.has(msg.id)) continue
      seen.add(msg.id)

      const author = (msg.author || '').toLowerCase()
      const contact = redditMap.get(author)
      if (!contact) continue

      const bodyText = (msg.subject || msg.body || '').toLowerCase()

      // Opt-out detection — mark Inactive and skip normal reply flow
      if (OPTOUT_KWS.some(kw => bodyText.includes(kw))) {
        updateContact(contact.id, { status: 'Inactive' })
        addInteraction({
          contactId: contact.id,
          type: 'Opt-Out',
          notes: `Opt-out detected in Reddit DM: "${bodyText.slice(0, 80)}"`,
          date: new Date().toISOString().split('T')[0],
        })
        addPipelineLog({ type: 'opt-out', contact: contact.name, channel: 'Reddit' })
        window.dispatchEvent(new CustomEvent('contact-opted-out', { detail: { contactName: contact.name } }))
        continue
      }

      addInteraction({
        contactId: contact.id,
        type: 'Reddit Reply',
        notes: `Reddit DM reply: "${(msg.subject || msg.body || '').slice(0, 100)}"`,
        date: new Date().toISOString().split('T')[0],
      })

      if (contact.status === 'New Lead') {
        updateContact(contact.id, { status: 'Warm Lead' })
        addPipelineLog({ type: 'reply-detected', contact: contact.name, note: 'Reddit reply → Warm Lead' })
      } else if (contact.status === 'Warm Lead') {
        updateContact(contact.id, { status: 'Hot Lead' })
        addPipelineLog({ type: 'reply-detected', contact: contact.name, note: 'Reddit reply → Hot Lead' })
      }

      window.dispatchEvent(new CustomEvent('reddit-reply-detected', { detail: { contactName: contact.name } }))
    }

    saveSeen(seen)
  } catch { /* token expired or rate limited — retry next interval */ }
}

export default function RedditInboxMonitor() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => checkRedditInbox(storeRef.current)
    run()
    const t = setInterval(run, INTERVAL_MS)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
