// #457 — Web Push handlers, imported into the generated service worker (vite-plugin-pwa
// workbox.importScripts). Runs even when the app is CLOSED. Payload = { title, body, link, tag }.
/* eslint-disable no-undef */
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (_e) { d = { body: event.data && event.data.text() } }
  const title = d.title || 'Platyplus'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: d.tag || 'coach',
      renotify: true,
      data: { link: d.link || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  const url = new URL(link, self.location.origin).href // absolute — openWindow needs it, relative is flaky
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // App already open → FOCUS it and tell the SPA to client-side route (client.navigate() throws on an
    // uncontrolled window, which just left the user on the current page — the bug).
    for (const c of wins) {
      try { if (new URL(c.url).origin === self.location.origin) { await c.focus(); c.postMessage({ type: 'notif-nav', link }); return } } catch (_e) { /* skip */ }
    }
    // App closed → open a fresh window at the absolute deep link (SPA renders /activity/:id etc).
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})
