// DriveSync — background component that keeps CRM state in sync across
// devices via Google Drive AppData. Loads on mount (merges remote into local),
// then auto-saves every 15 min. Listens for 'drive-sync-now' to trigger
// an immediate save (e.g., from the Settings "Sync Now" button).

import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { getGoogleToken } from './GoogleSync'
import { saveToDrive, loadFromDrive, mergeStates } from '../utils/driveSync'

const SYNC_INTERVAL = 15 * 60 * 1000
const INITIAL_DELAY = 20 * 1000

const STORAGE_KEY = 'phorm_crm_v1'

function getRawState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

export default function DriveSync() {
  const store = useStore()
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    async function loadAndMerge() {
      const token = getGoogleToken()
      if (!token) return
      try {
        const remote = await loadFromDrive(token)
        if (!remote) return
        const local = getRawState()
        const merged = mergeStates(local, remote)
        if (!merged) return
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        window.location.reload()
      } catch { /* network/parse error — skip silently */ }
    }

    async function saveNow(silent = false) {
      const token = getGoogleToken()
      if (!token) return
      const state = getRawState()
      if (!state) return
      try {
        const ok = await saveToDrive(token, state)
        if (ok && !silent) {
          window.dispatchEvent(new CustomEvent('drive-sync-saved', {
            detail: { time: new Date().toISOString() }
          }))
        }
      } catch { /* silently ignore */ }
    }

    // On mount: load remote and merge into local (will reload page if data changed)
    const loadTimer = setTimeout(loadAndMerge, INITIAL_DELAY)

    // Auto-save every 15 min
    const saveInterval = setInterval(() => saveNow(true), SYNC_INTERVAL)

    // Manual "Sync Now" trigger
    const onSyncNow = () => saveNow(false)
    window.addEventListener('drive-sync-now', onSyncNow)

    return () => {
      clearTimeout(loadTimer)
      clearInterval(saveInterval)
      window.removeEventListener('drive-sync-now', onSyncNow)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
