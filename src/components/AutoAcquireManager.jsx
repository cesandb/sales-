import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import {
  SOURCE_CONFIGS, getEngineConfig,
  runSourceWithDedup, addToLog,
} from '../utils/autoAcquire'

// Invisible background component mounted in Layout.
// Manages per-source polling intervals, deduplication, and auto-enrollment.
// Listens to:  'auto-acquire-config-changed' → re-setup intervals
//              'auto-acquire-run-now'         → immediate run for one source
// Dispatches:  'auto-acquire-update'          → { sourceId, added } after each run

export default function AutoAcquireManager() {
  const { contacts, addContact, addEnrollment } = useStore()

  // Keep a ref so timer callbacks always read the latest store values
  const storeRef = useRef({ contacts: [], addContact: null, addEnrollment: null })
  useEffect(() => {
    storeRef.current = { contacts, addContact, addEnrollment }
  })

  const timersRef = useRef({}) // sourceId → { t: timeoutId, i: intervalId }

  // Core run function stored in a ref so timers never have a stale closure
  const doRun = useRef(async (sourceId) => {
    const config = getEngineConfig()
    if (!config.enabled || !config.sources[sourceId]?.enabled) return

    const { contacts: cur, addContact: addC, addEnrollment: addE } = storeRef.current
    const existingSocials = new Set(cur.map(c => c.social).filter(Boolean))
    const existingEmails  = new Set(cur.map(c => c.email).filter(Boolean))

    try {
      const { added } = await runSourceWithDedup(sourceId, existingSocials, existingEmails, addC, addE)
      window.dispatchEvent(new CustomEvent('auto-acquire-update', { detail: { sourceId, added } }))
    } catch (e) {
      addToLog({ source: sourceId, count: 0, ok: false, error: e.message })
      window.dispatchEvent(new CustomEvent('auto-acquire-update', { detail: { sourceId, added: 0, error: e.message } }))
    }
  })

  useEffect(() => {
    function clearAll() {
      for (const { t, i } of Object.values(timersRef.current)) {
        if (t) clearTimeout(t)
        if (i) clearInterval(i)
      }
      timersRef.current = {}
    }

    function setup() {
      clearAll()
      const config = getEngineConfig()
      if (!config.enabled) return

      let stagger = 0
      for (const src of SOURCE_CONFIGS) {
        const srcCfg = config.sources[src.id]
        if (!srcCfg?.enabled) continue

        const intervalMs = (srcCfg.intervalMin || src.defaultIntervalMin) * 60 * 1000
        const lastRun = srcCfg.lastRun ? new Date(srcCfg.lastRun).getTime() : 0
        const elapsed = Date.now() - lastRun
        // If overdue, run shortly with a small stagger to avoid thundering herd
        const delay = elapsed >= intervalMs ? stagger : Math.max(0, intervalMs - elapsed)
        stagger += 2000

        const id = src.id
        const t = setTimeout(() => {
          doRun.current(id)
          const i = setInterval(() => doRun.current(id), intervalMs)
          if (timersRef.current[id]) timersRef.current[id].i = i
        }, delay)
        timersRef.current[id] = { t, i: null }
      }
    }

    function onRunNow(e) {
      if (e.detail?.sourceId) doRun.current(e.detail.sourceId)
    }

    setup()
    window.addEventListener('auto-acquire-config-changed', setup)
    window.addEventListener('auto-acquire-run-now', onRunNow)

    return () => {
      window.removeEventListener('auto-acquire-config-changed', setup)
      window.removeEventListener('auto-acquire-run-now', onRunNow)
      clearAll()
    }
  }, []) // intentionally empty — custom events handle re-setup

  return null
}
