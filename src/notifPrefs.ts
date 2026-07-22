// #733 — the notification CENTER's per-TYPE settings + the dismissed/read state.
// In-app prefs + the dismissed set are PER-DEVICE (localStorage) — like the existing 'notifsSeen' — because what shows
// in the bell is a per-device view. PHONE (push) prefs stay server-side (src/push.ts) so a subscription travels. Each
// user-facing TYPE maps to one or more notification KINDS.
import type { NotifKind } from './notifications'

export type NotifTypeKey = 'reviews' | 'planChanges' | 'reminders' | 'releases' | 'activity' | 'achievements' | 'missed'

export const NOTIF_TYPES: { key: NotifTypeKey; label: string; hint: string; kinds: NotifKind[]; isNew?: boolean; hasPhone: boolean }[] = [
  { key: 'reviews', label: 'Coach reviews', hint: 'A completed workout gets reviewed', kinds: ['review'], hasPhone: true },
  { key: 'planChanges', label: 'Plan changes', hint: 'Your coach adapts your plan', kinds: ['coach'], hasPhone: true },
  { key: 'reminders', label: 'Daily reminder', hint: 'A nudge to check in + see today', kinds: ['reminder'], hasPhone: true },
  { key: 'releases', label: 'New releases', hint: "What's new — new features only", kinds: ['release'], isNew: true, hasPhone: false },
  { key: 'activity', label: 'New activity', hint: 'A watch/device session synced', kinds: ['activity'], isNew: true, hasPhone: false },
  { key: 'achievements', label: 'Achievements & PRs', hint: 'A personal best or a streak', kinds: ['achievement'], isNew: true, hasPhone: false },
  { key: 'missed', label: 'Missed session', hint: 'A planned session went unlogged', kinds: ['missed', 'report'], isNew: true, hasPhone: false },
]

const kindToType = (k: NotifKind): NotifTypeKey | null => NOTIF_TYPES.find((t) => t.kinds.includes(k))?.key ?? null

// ---- In-app type prefs (per-device; default ALL on) ----
const IN_APP_KEY = 'notifInApp'
export function inAppPrefs(): Record<NotifTypeKey, boolean> {
  const base = Object.fromEntries(NOTIF_TYPES.map((t) => [t.key, true])) as Record<NotifTypeKey, boolean>
  try { return { ...base, ...JSON.parse(localStorage.getItem(IN_APP_KEY) || '{}') } } catch { return base }
}
export function setInAppPref(key: NotifTypeKey, on: boolean) {
  const p = inAppPrefs(); p[key] = on
  try { localStorage.setItem(IN_APP_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}
export function showsInApp(kind: NotifKind): boolean {
  const t = kindToType(kind); return !t || inAppPrefs()[t] !== false // unmapped kinds (system) always show
}

// ---- Dismissed set (per-device; a ✕ or Clear-all hides an item for good) ----
const DISMISS_KEY = 'notifDismissed'
export function dismissedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')) } catch { return new Set() }
}
export function dismiss(ids: string | string[]) {
  const set = dismissedIds(); (Array.isArray(ids) ? ids : [ids]).forEach((i) => set.add(i))
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set].slice(-500))) } catch { /* ignore */ }
}
