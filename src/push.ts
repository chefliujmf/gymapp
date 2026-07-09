// #457 — Web Push client helper. Subscribes THIS device to phone notifications and syncs the subscription
// to the server, which fans pushNotification() out to all a user's devices. iOS caveat: Web Push works ONLY
// for a PWA installed to the Home Screen (iOS 16.4+) — a Safari tab can't subscribe.

export type PushPrefs = { planChanges: boolean; reviews: boolean; reminders: boolean }
export type PushConfig = { supported: boolean; publicKey: string | null; subscribed: boolean; prefs: PushPrefs }

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports as Mac; detect touch
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

// Browser can do Web Push at all (SW + PushManager + Notification). On iOS this is only TRUE once installed.
export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// On iPhone/iPad, push additionally requires the app be installed to the Home Screen.
export const iosNeedsInstall = () => isIOS() && !isStandalone()

export const permission = (): NotificationPermission =>
  'Notification' in window ? Notification.permission : 'denied'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length)) // explicit ArrayBuffer → valid BufferSource
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch('/auth/push/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export const getPushConfig = () => api<PushConfig>('config')

// Is THIS device (this browser) currently subscribed? (server 'subscribed' is any-device.)
export async function isSubscribedHere(): Promise<boolean> {
  if (!pushSupported()) return false
  try { const reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()) } catch { return false }
}

// Ask permission (if needed), subscribe THIS device, and register it server-side. Returns true on success.
export async function enablePush(publicKey: string): Promise<boolean> {
  if (!pushSupported() || !publicKey) return false
  const perm = permission() === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription() ||
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource })
  await api('subscribe', { subscription: sub.toJSON() })
  return true
}

// Unsubscribe THIS device (drops the browser subscription + tells the server).
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) { await api('unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe() }
    else await api('unsubscribe', {})
  } catch { /* best effort */ }
}

export const savePushPrefs = (prefs: Partial<PushPrefs>) =>
  fetch('/auth/profile', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pushPrefs: prefs }) })
