// Unified notification model for the top-bar bell. Each notification declares
// its KIND so the center can hold more than release notes over time (reminders,
// coach messages, system alerts…) and each item is clearly labelled.
import { releases } from './data/releases'

export type NotifKind = 'release' | 'reminder' | 'coach' | 'review' | 'report' | 'activity' | 'achievement' | 'missed' | 'system'

export interface Notification {
  id: string
  kind: NotifKind
  date: string // YYYY-MM-DD
  at?: string // ISO timestamp (coach notes) — finer-grained ordering than date
  title: string
  items?: string[] // bullet body (release notes / coach "what changed")
  body?: string // single-line body (reminders/alerts)
  link?: string // #233 in-app route to open on tap (activity/plan)
  score?: number // #233 coach-review execution score (shown as a chip)
  chips?: string[] // #233 small stat chips (new-activity: duration/distance/…)
}

export const KIND_META: Record<NotifKind, { label: string; icon: string; color: string }> = {
  release: { label: 'Release note', icon: '✨', color: '#22c55e' },
  reminder: { label: 'Reminder', icon: '⏰', color: '#3b82f6' },
  coach: { label: 'Coach update', icon: '🧑‍🏫', color: '#a855f7' },
  review: { label: 'Coach review', icon: '💬', color: '#a855f7' },
  report: { label: 'Your report', icon: '🐛', color: '#22c55e' }, // #5003 — a user's own bug/idea report update (NOT a coach note)
  activity: { label: 'New activity', icon: '🚴', color: '#39c2d7' },
  achievement: { label: 'Achievement', icon: '🏅', color: '#f6c445' }, // #733 — a PR / streak milestone
  missed: { label: 'Missed session', icon: '📌', color: '#e0555f' }, // #733 — a planned session went unlogged
  system: { label: 'System', icon: '⚙️', color: '#9aa3b2' },
}

// #5003 — map a server notification's `subkind` to a bell KIND. Report-status updates ('report') and
// coach reviews ('review') must NOT be labelled as generic "Coach update" — they get their own kind.
export function kindForSubkind(subkind?: string): NotifKind {
  if (subkind === 'review') return 'review'
  if (subkind === 'report') return 'report'
  return 'coach'
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
