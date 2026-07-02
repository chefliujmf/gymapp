import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { allNotifications, KIND_META, type Notification } from './notifications'
import { authApi } from './auth/api'
import { syncActivityNotifs } from './activityNotifs'

const STATIC = allNotifications()

/** Top-bar notification center. Merges release notes (static) + the user's COACH notes (server:
 * updates + reviews) + NEW-ACTIVITY notes (client-detected, #233). Tappable → the relevant screen.
 * An unread dot shows when the newest is more recent than last seen. */
export default function ReleaseBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem('notifsSeen') || '' } catch { return '' } })
  const [coach, setCoach] = useState<Notification[]>([])
  const [acts, setActs] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const NOTES = [...STATIC, ...coach, ...acts].sort((a, b) => ((a.at || a.date) < (b.at || b.date) ? 1 : -1))
  const LATEST = NOTES[0]?.at || NOTES[0]?.date || ''
  const unread = !!LATEST && LATEST > seen

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    authApi.notifications().then((ns) => setCoach(ns.map((n) => ({
      id: n.id, kind: n.subkind === 'review' ? 'review' : 'coach', date: n.date, at: n.at,
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

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={toggle} aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell size={18} />
        {unread && <span className="bell-dot" />}
      </button>
      {open && (
        <div className="acct__menu" role="menu" style={{ width: 320, maxHeight: 440, overflowY: 'auto' }}>
          <div className="acct__head"><strong>Notifications</strong></div>
          {NOTES.length === 0 && <div style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 13 }}>Nothing yet.</div>}
          {NOTES.map((n) => {
            const meta = KIND_META[n.kind]
            const tappable = !!n.link
            return (
              <div key={n.id} onClick={tappable ? () => goTo(n.link) : undefined}
                style={{ padding: '10px 14px', borderTop: '1px solid var(--line,#222)', cursor: tappable ? 'pointer' : 'default', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.color + '22', borderRadius: 999, padding: '2px 8px' }}>{meta.icon} {meta.label}</span>
                  {n.score != null && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: '#34e07d22', border: '1px solid #34e07d55', borderRadius: 999, padding: '2px 9px' }}>{n.score}/10</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 2px' }}>{n.title}{tappable && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> ›</span>}</div>
                {n.body && <p className="meta" style={{ fontSize: 11.5, margin: '0 0 2px', color: 'var(--text-dim)' }}>{n.body}</p>}
                <div className="meta" style={{ fontSize: 11 }}>{n.date}</div>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
