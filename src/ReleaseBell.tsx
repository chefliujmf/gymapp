import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Settings2 } from 'lucide-react'
import { allNotifications, KIND_META, kindForSubkind, type Notification } from './notifications'
import { authApi } from './auth/api'
import { syncActivityNotifs } from './activityNotifs'
import { showsInApp, dismissedIds, dismiss } from './notifPrefs' // #733

const STATIC = allNotifications()

// #360/#361 — a followable timestamp: TIME OF DAY, not just the date. For a coach review, show WHICH
// session it's about (the session date) + when it was reviewed, so a stack of reviews is easy to follow.
const fmtT = (iso: string) => { try { return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) } catch { return '' } }
const fmtD = (s: string) => { try { return new Date(/T/.test(s) ? s : s + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return s } }
function whenLine(n: Notification): string {
  if (n.kind === 'review' && n.date) return `${fmtD(n.date)}${n.at ? ` · reviewed ${fmtT(n.at)}` : ''}`
  if (n.at) return `${fmtD(n.at)} · ${fmtT(n.at)}`
  return n.date ? fmtD(n.date) : ''
}

/** Top-bar notification center. Merges release notes (static) + the user's COACH notes (server:
 * updates + reviews) + NEW-ACTIVITY notes (client-detected, #233). Tappable → the relevant screen.
 * An unread dot shows when the newest is more recent than last seen. */
export default function ReleaseBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem('notifsSeen') || '' } catch { return '' } })
  const [coach, setCoach] = useState<Notification[]>([])
  const [acts, setActs] = useState<Notification[]>([])
  const [dropped, setDropped] = useState<Set<string>>(() => dismissedIds()) // #733 — per-item ✕ / Clear all
  const ref = useRef<HTMLDivElement>(null)

  // #733 — filter by the athlete's in-app TYPE prefs + what they've dismissed, then sort newest-first.
  const NOTES = [...STATIC, ...coach, ...acts]
    .filter((n) => showsInApp(n.kind) && !dropped.has(n.id))
    .sort((a, b) => ((a.at || a.date) < (b.at || b.date) ? 1 : -1))
  const LATEST = NOTES[0]?.at || NOTES[0]?.date || ''
  const unread = !!LATEST && LATEST > seen
  const unreadNotes = NOTES.filter((n) => (n.at || n.date) > seen)
  const earlierNotes = NOTES.filter((n) => (n.at || n.date) <= seen)
  const drop = (id: string, e: React.MouseEvent) => { e.stopPropagation(); dismiss(id); setDropped(dismissedIds()) } // #733
  const clearAll = (e: React.MouseEvent) => { e.stopPropagation(); dismiss(NOTES.map((n) => n.id)); setDropped(dismissedIds()) } // #733

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    authApi.notifications().then((ns) => setCoach(ns.map((n) => ({
      id: n.id, kind: kindForSubkind(n.subkind), date: n.date, at: n.at,
      title: n.title, body: n.body, items: n.items, link: n.link, score: n.score,
    })))).catch(() => {})
    syncActivityNotifs().then(setActs).catch(() => {})
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggle() {
    setOpen((o) => !o)
    if (!open && unread) { try { localStorage.setItem('notifsSeen', LATEST) } catch { /* ignore */ } setSeen(LATEST) }
  }
  function goTo(link?: string) { if (!link) return; setOpen(false); navigate(link) }
  // #733 — one notification row: type chip, title/body, time, optional score/chips/bullets, and a ✕ to dismiss it.
  function renderRow(n: Notification, isUnread: boolean) {
    const meta = KIND_META[n.kind]
    const tappable = !!n.link
    return (
      <div key={n.id} className={'notif-row' + (isUnread ? ' notif-row--unread' : '')} onClick={tappable ? () => goTo(n.link) : undefined}
        style={{ cursor: tappable ? 'pointer' : 'default' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.color + '22', borderRadius: 999, padding: '2px 8px' }}>{meta.icon} {meta.label}</span>
            {n.score != null && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: '#34e07d22', border: '1px solid #34e07d55', borderRadius: 999, padding: '2px 9px' }}>{n.score}/10</span>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 2px' }}>{n.title}{tappable && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> ›</span>}</div>
          {n.body && <p className="meta" style={{ fontSize: 11.5, margin: '0 0 2px', color: 'var(--text-dim)' }}>{n.body}</p>}
          <div className="meta" style={{ fontSize: 11 }}>{whenLine(n)}</div>
          {n.chips && n.chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {n.chips.map((c, j) => <span key={j} style={{ fontSize: 11, background: '#ffffff12', border: '1px solid var(--line)', borderRadius: 7, padding: '2px 7px' }}>{c}</span>)}
            </div>
          )}
          {n.items && (
            <ul className="bullets" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {n.items.map((x, j) => <li key={j} style={{ fontSize: 13, lineHeight: 1.4 }}>{x}</li>)}
            </ul>
          )}
        </div>
        <button className="notif-x" onClick={(e) => drop(n.id, e)} aria-label="Dismiss" title="Dismiss">✕</button>
      </div>
    )
  }

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={toggle} aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell size={18} />
        {unread && <span className="bell-dot" />}
      </button>
      {open && (
        <div className="acct__menu notif-menu" role="menu">
          {/* #733 — center header: Clear all + a Settings gear (→ notification type prefs). */}
          <div className="acct__head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>Notifications</strong>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {NOTES.length > 0 && <button className="notif-act" onClick={clearAll}>Clear all</button>}
              <button className="notif-act notif-act--gear" onClick={(e) => { e.stopPropagation(); setOpen(false); navigate('/settings#ob-notifications') }} title="Notification settings"><Settings2 size={13} /> Settings</button>
            </div>
          </div>
          {NOTES.length === 0 && <div style={{ padding: '14px', color: 'var(--text-dim)', fontSize: 13 }}>You're all caught up.</div>}
          {unreadNotes.length > 0 && <div className="notif-sect">Unread</div>}
          {unreadNotes.map((n) => renderRow(n, true))}
          {earlierNotes.length > 0 && unreadNotes.length > 0 && <div className="notif-sect">Earlier</div>}
          {earlierNotes.map((n) => renderRow(n, false))}
        </div>
      )}
    </div>
  )
}
