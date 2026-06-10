const CACHE = 'phorm-crm-v1'

// Cache the app shell on install
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['./', './index.html']))
  )
})

// Remove old caches on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Network-first with cache fallback for navigation; cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
          return res
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }

  // Cache-first for same-origin assets (hashed JS/CSS)
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
      })
    )
  }
})

// Handle push notifications from a future backend
self.addEventListener('push', event => {
  const data = event.data?.json() ?? { title: 'Phorm CRM', body: 'You have pending follow-ups' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: data.tag ?? 'phorm-crm',
      data: data.url ?? './',
      requireInteraction: data.requireInteraction ?? false,
    })
  )
})

// Open the app when a notification is clicked
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const url = event.notification.data || './'
      const existing = list.find(c => c.focus)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// Daily digest background check via Periodic Background Sync (Chrome/Android)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-digest') {
    event.waitUntil(sendDailyDigest())
  }
})

async function sendDailyDigest() {
  try {
    const clients_list = await clients.matchAll()
    if (clients_list.length > 0) return // app is open, it will notify itself

    const raw = await getStorageValue('phorm_crm_v1')
    if (!raw) return
    const state = JSON.parse(raw)
    const now = new Date()

    const overdue = (state.followups || []).filter(f => {
      if (f.status !== 'pending') return false
      return new Date(f.date) < now
    })

    const coldLeads = (state.contacts || []).filter(c => {
      if (c.status !== 'Hot Lead' && c.status !== 'Warm Lead') return false
      if (!c.lastContact) return true
      const days = (now - new Date(c.lastContact)) / 86400000
      return days > 5
    })

    const total = overdue.length + coldLeads.length
    if (total === 0) return

    await self.registration.showNotification('Phorm CRM — Daily Digest', {
      body: `${overdue.length > 0 ? `${overdue.length} overdue follow-up${overdue.length > 1 ? 's' : ''}` : ''}${overdue.length > 0 && coldLeads.length > 0 ? ' · ' : ''}${coldLeads.length > 0 ? `${coldLeads.length} lead${coldLeads.length > 1 ? 's' : ''} going cold` : ''}`,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'daily-digest',
      requireInteraction: true,
    })
  } catch {}
}

// Read from localStorage via the IndexedDB bridge isn't available in SW
// so we use a MessageChannel from the main app to pass data if needed
async function getStorageValue(key) {
  const allClients = await clients.matchAll()
  if (allClients.length === 0) return null
  return new Promise(resolve => {
    const mc = new MessageChannel()
    mc.port1.onmessage = e => resolve(e.data)
    allClients[0].postMessage({ type: 'GET_STORAGE', key }, [mc.port2])
    setTimeout(() => resolve(null), 1000)
  })
}
