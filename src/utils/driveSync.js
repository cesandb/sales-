// Google Drive AppData sync — saves/loads the full CRM state to a hidden
// file in the user's Google Drive AppData folder. Invisible to the user in
// their Drive UI. Enables cross-device sync between mobile and desktop.
//
// Requires: https://www.googleapis.com/auth/drive.appdata scope (added to
// buildOAuthURL — users re-authorizing will be prompted for this scope).

const DRIVE_FILE_NAME = 'phorm-crm-state.json'
const APPDATA_BASE    = 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE     = 'https://www.googleapis.com/upload/drive/v3'
const SYNC_META_KEY   = 'phorm_drive_sync_meta'

function getSyncMeta() {
  try { return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}') }
  catch { return {} }
}

function saveSyncMeta(meta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ...getSyncMeta(), ...meta }))
}

export function getLastSyncTime() {
  return getSyncMeta().lastSynced || null
}

// Find the phorm-crm-state.json file in the App Data folder
async function findFile(token) {
  try {
    const res = await fetch(
      `${APPDATA_BASE}/files?spaces=appDataFolder&q=name%3D%27${DRIVE_FILE_NAME}%27&fields=files(id,modifiedTime)`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.files?.[0] || null
  } catch { return null }
}

// Upload / update the CRM state file in Drive
export async function saveToDrive(token, storeState) {
  if (!token) return false
  try {
    const body = JSON.stringify({ ...storeState, _syncedAt: new Date().toISOString() })
    const existing = await findFile(token)

    let res
    if (existing) {
      // Update existing file (PATCH)
      res = await fetch(
        `${UPLOAD_BASE}/files/${existing.id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(15000),
        }
      )
    } else {
      // Create new file in App Data folder (multipart)
      const boundary = 'phorm_sync_boundary'
      const meta = JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] })
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        meta,
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        body,
        `--${boundary}--`,
      ].join('\r\n')

      res = await fetch(
        `${UPLOAD_BASE}/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipart,
          signal: AbortSignal.timeout(15000),
        }
      )
    }

    if (res.ok) {
      saveSyncMeta({ lastSynced: new Date().toISOString(), direction: 'upload' })
      return true
    }
    return false
  } catch { return false }
}

// Download the CRM state from Drive
export async function loadFromDrive(token) {
  if (!token) return null
  try {
    const file = await findFile(token)
    if (!file) return null

    const res = await fetch(
      `${APPDATA_BASE}/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    saveSyncMeta({ lastSynced: new Date().toISOString(), direction: 'download', driveModified: file.modifiedTime })
    return data
  } catch { return null }
}

// Merge two store states — union of all entities, newest version wins per entity.
// Local data always wins over remote for same-ID entities with matching timestamps.
export function mergeStates(local, remote) {
  if (!remote) return local
  if (!local)  return remote

  function mergeArr(lArr = [], rArr = []) {
    const map = new Map()
    for (const item of rArr) if (item?.id) map.set(item.id, item)
    for (const item of lArr) {
      if (!item?.id) continue
      const existing = map.get(item.id)
      if (!existing) { map.set(item.id, item); continue }
      // Keep whichever was updated more recently; local wins on ties
      const lDate = new Date(item.updatedAt || item.date || item.createdAt || 0).getTime()
      const rDate = new Date(existing.updatedAt || existing.date || existing.createdAt || 0).getTime()
      if (lDate >= rDate) map.set(item.id, item)
    }
    return [...map.values()]
  }

  return {
    ...remote,
    ...local,
    // Merge all entity arrays by ID
    contacts:        mergeArr(local.contacts,        remote.contacts),
    pipeline:        mergeArr(local.pipeline,        remote.pipeline),
    followups:       mergeArr(local.followups,       remote.followups),
    interactions:    mergeArr(local.interactions,    remote.interactions),
    goals:           mergeArr(local.goals,           remote.goals),
    campaigns:       mergeArr(local.campaigns,       remote.campaigns),
    linkShares:      mergeArr(local.linkShares,      remote.linkShares),
    contactProducts: mergeArr(local.contactProducts, remote.contactProducts),
    enrollments:     mergeArr(local.enrollments,     remote.enrollments),
    deals:           mergeArr(local.deals,           remote.deals),
    templates:       mergeArr(local.templates,       remote.templates),
    // Merge object fields shallowly — local wins per key
    settings:        { ...remote.settings,      ...local.settings },
    productClicks:   { ...remote.productClicks, ...local.productClicks },
  }
}
