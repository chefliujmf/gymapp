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
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of clientsArr) {
      // focus an already-open Platyplus tab and route it to the link
      if ('focus' in c) { try { await c.navigate(link) } catch (_e) { /* cross-origin nav guard */ } return c.focus() }
    }
    if (self.clients.openWindow) return self.clients.openWindow(link)
  })())
})
