export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    const reg = await navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })

    // Bridge localStorage reads for the service worker daily digest
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'GET_STORAGE') {
        const value = localStorage.getItem(event.data.key)
        event.ports[0].postMessage(value)
      }
    })

    // Register periodic background sync if supported
    if ('periodicSync' in reg) {
      try {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' })
        if (status.state === 'granted') {
          await reg.periodicSync.register('daily-digest', { minInterval: 24 * 60 * 60 * 1000 })
        }
      } catch {}
    }

    return reg
  } catch (err) {
    console.warn('SW registration failed:', err)
    return null
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function sendNotification(title, body, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    // Use service worker notification if available (supports actions + badges)
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon.svg`, ...options })
      })
    } else {
      new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icon.svg`, ...options })
    }
  } catch {}
}

export function checkAndNotifyDue(followups, contacts) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const overdue = followups.filter(f => {
    if (f.status !== 'pending') return false
    return f.date <= todayStr
  })

  if (overdue.length === 0) return

  const names = overdue
    .slice(0, 3)
    .map(f => contacts.find(c => c.id === f.contactId)?.name || 'Someone')
    .join(', ')

  const body = overdue.length === 1
    ? `Follow up with ${names} today`
    : `${overdue.length} follow-ups due: ${names}${overdue.length > 3 ? ` +${overdue.length - 3} more` : ''}`

  sendNotification('Phorm CRM — Action Needed', body, { tag: 'followups-due', requireInteraction: false })
}
