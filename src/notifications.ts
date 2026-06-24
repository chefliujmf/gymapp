// Unified notification model for the top-bar bell. Each notification declares
// its KIND so the center can hold more than release notes over time (reminders,
// coach messages, system alerts…) and each item is clearly labelled.
import { releases } from './data/releases'

export type NotifKind = 'release' | 'reminder' | 'coach' | 'system'

export interface Notification {
  id: string
  kind: NotifKind
  date: string // YYYY-MM-DD
  at?: string // ISO timestamp (coach notes) — finer-grained ordering than date
  title: string
  items?: string[] // bullet body (release notes)
  body?: string // single-line body (reminders/alerts)
}

export const KIND_META: Record<NotifKind, { label: string; icon: string; color: string }> = {
  release: { label: 'Release note', icon: '✨', color: '#22c55e' },
  reminder: { label: 'Reminder', icon: '⏰', color: '#3b82f6' },
  coach: { label: 'From your coach', icon: '🧑‍🏫', color: '#a855f7' },
  system: { label: 'System', icon: '⚙️', color: '#9aa3b2' },
}

/** All notifications, newest first. Release notes today; other kinds plug in here. */
export function allNotifications(): Notification[] {
  const fromReleases: Notification[] = releases.map((r) => ({
    id: `rel-${r.date}-${r.title}`,
    kind: 'release',
    date: r.date,
    title: r.title,
    items: r.items,
  }))
  // future sources (reminders, coach, system) get merged in here.
  return [...fromReleases].sort((a, b) => (a.date < b.date ? 1 : -1))
}
