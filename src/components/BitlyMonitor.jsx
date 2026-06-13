// BitlyMonitor — polls Bitly every 30 min for new clicks on tracked affiliate links.
// On new click detected: logs a "Link Click" interaction and schedules a follow-up.

import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { refreshBitlyClicks, getBitlyKey } from '../utils/bitlyTracker'
import { addPipelineLog } from './PipelineAutomationEngine'

const INTERVAL_MS = 30 * 60 * 1000

async function checkBitlyClicks(store) {
  if (!getBitlyKey()) return
  const { contacts, addInteraction, addFollowup } = store

  const updated = await refreshBitlyClicks()
  if (!updated.length) return

  const contactMap = new Map(contacts.map(c => [c.id, c]))
  const today = new Date().toISOString().split('T')[0]

  for (const { contactId, prev, clicks } of updated) {
    const contact = contactMap.get(contactId)
    if (!contact) continue
    const newClicks = clicks - prev

    addInteraction({
      contactId,
      type: 'Link Click',
      notes: `${newClicks} new affiliate link click${newClicks !== 1 ? 's' : ''} via Bitly (total: ${clicks})`,
      date: today,
    })

    addFollowup({
      contactId,
      date: today,
      notes: `Clicked your affiliate link ${newClicks}x — great time to follow up!`,
      type: 'Email',
    })

    addPipelineLog({ type: 'link-click', contact: contact.name, clicks: newClicks })
    window.dispatchEvent(new CustomEvent('bitly-click-detected', {
      detail: { contactName: contact.name, clicks: newClicks },
    }))
  }
}

export default function BitlyMonitor() {
  const storeRef = useRef(null)
  const store    = useStore()
  storeRef.current = store

  useEffect(() => {
    const run = () => checkBitlyClicks(storeRef.current)
    const t = setTimeout(run, 5 * 60 * 1000) // first run 5 min after load
    const interval = setInterval(run, INTERVAL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
