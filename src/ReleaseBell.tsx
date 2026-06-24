import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { allNotifications, KIND_META, type Notification } from './notifications'
import { authApi } from './auth/api'

const STATIC = allNotifications()

/** Top-bar notification center (not a popup). Holds typed notifications — release
 * notes (static) merged with per-user COACH activity notes fetched from the server.
 * An unread dot shows when the newest notification is more recent than last seen. */
export default function ReleaseBell() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem('notifsSeen') || '' } catch { return '' } })
  const [coach, setCoach] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  // newest-first merge of release notes + the user's coach-activity notes
  const NOTES = [...STATIC, ...coach].sort((a, b) => ((a.at || a.date) < (b.at || b.date) ? 1 : -1))
  const LATEST = NOTES[0]?.at || NOTES[0]?.date || ''
  const unread = !!LATEST && LATEST > seen

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    authApi.notifications().then((ns) => setCoach(ns.map((n) => ({ id: n.id, kind: 'coach', date: n.date, at: n.at, title: n.title, body: n.body, items: n.items })))).catch(() => {})
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggle() {
    setOpen((o) => !o)
    if (!open && unread) { try { localStorage.setItem('notifsSeen', LATEST) } catch { /* ignore */ } setSeen(LATEST) }
  }

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={toggle} aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell size={18} />
        {unread && <span className="bell-dot" />}
      </button>
      {open && (
        <div className="acct__menu" role="menu" style={{ width: 300, maxHeight: 420, overflowY: 'auto' }}>
          <div className="acct__head"><strong>Notifications</strong></div>
          {NOTES.length === 0 && <div style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 13 }}>Nothing yet.</div>}
          {NOTES.map((n) => {
            const meta = KIND_META[n.kind]
            return (
              <div key={n.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--line,#222)' }}>
                {/* clear type label so it's obvious what kind of notification this is */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.color + '22', borderRadius: 999, padding: '2px 8px' }}>
                  {meta.icon} {meta.label}
                </span>
                <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 2px' }}>{n.title}</div>
                <div className="meta" style={{ fontSize: 11 }}>{n.date}</div>
                {n.body && <p style={{ fontSize: 13, margin: '4px 0 0' }}>{n.body}</p>}
                {n.items && (
                  <ul className="bullets" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {n.items.map((x, j) => <li key={j} style={{ fontSize: 13, lineHeight: 1.4 }}>{x}</li>)}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
