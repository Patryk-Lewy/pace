// PACE AI Running Coach — Service Worker
const CACHE = 'pace-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Push event (from server — future feature)
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'PACE', {
      body: data.body ?? 'Czas na trening!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag ?? 'pace-notification',
      data: { url: data.url ?? '/' },
    })
  )
})

// Notification click — open app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
