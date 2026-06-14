// Global daily send cap — prevents multiple engines from messaging the same contact
// on the same day. MQAutoSender checks this before every automated send.
// Max 1 automated outreach per contact per day.

const CAP_KEY    = 'phorm_daily_cap_v1'
const MAX_PER_DAY = 1

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

function getCapStore() {
  try { return JSON.parse(localStorage.getItem(CAP_KEY) || '{}') }
  catch { return {} }
}

export function canSendToday(contactId) {
  const store = getCapStore()
  return (store[`${contactId}::${getTodayStr()}`] || 0) < MAX_PER_DAY
}

export function markSentToday(contactId) {
  const store = getCapStore()
  const today = getTodayStr()
  const key   = `${contactId}::${today}`
  store[key]  = (store[key] || 0) + 1

  // Prune entries older than 7 days
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  for (const k of Object.keys(store)) {
    const d = k.split('::')[1]
    if (d && d < cutoff) delete store[k]
  }
  localStorage.setItem(CAP_KEY, JSON.stringify(store))
}

// Returns count of contacts messaged today (for dashboard/analytics)
export function getDailySentCount() {
  const store = getCapStore()
  const today = getTodayStr()
  return Object.entries(store)
    .filter(([k]) => k.endsWith(`::${today}`))
    .reduce((sum, [, v]) => sum + v, 0)
}
