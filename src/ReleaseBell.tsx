import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { releases } from './data/releases'

const LATEST = releases[0]?.date ?? ''

/** Top-bar bell: a "What's new" notification center (not a popup). An unread dot
 * shows when the newest release is more recent than what you've seen. */
export default function ReleaseBell() {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem('releasesSeen') || '' } catch { return '' } })
  const ref = useRef<HTMLDivElement>(null)
  const unread = !!LATEST && LATEST > seen

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggle() {
    setOpen((o) => !o)
    if (!open && unread) { try { localStorage.setItem('releasesSeen', LATEST) } catch { /* ignore */ } setSeen(LATEST) }
  }

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={toggle} aria-label="What's new" style={{ position: 'relative' }}>
        <Bell size={18} />
        {unread && <span className="bell-dot" />}
      </button>
      {open && (
        <div className="acct__menu" role="menu" style={{ width: 290, maxHeight: 400, overflowY: 'auto' }}>
          <div className="acct__head"><strong>What's new</strong></div>
          {releases.map((r, i) => (
            <div key={i} style={{ padding: '8px 14px 10px' }}>
              <div className="eyebrow">{r.date} · {r.title}</div>
              <ul className="bullets" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {r.items.map((x, j) => <li key={j} style={{ fontSize: 13, lineHeight: 1.4 }}>{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
