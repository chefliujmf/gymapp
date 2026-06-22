import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { allNotifications, KIND_META } from './notifications'

const NOTES = allNotifications()
const LATEST = NOTES[0]?.date ?? ''

/** Top-bar notification center (not a popup). Holds typed notifications — release
 * notes today, reminders/coach/system later — each labelled with its kind. An
 * unread dot shows when the newest notification is more recent than last seen. */
export default function ReleaseBell() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem('notifsSeen') || '' } catch { return '' } })
  const ref = useRef<HTMLDivElement>(null)
  const unread = !!LATEST && LATEST > seen

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
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
