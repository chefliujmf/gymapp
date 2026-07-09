import { useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useAuth } from './auth/AuthContext'
import { authApi, type BacklogType, type MyReport } from './auth/api'

// #467 — user-facing status labels for a reporter's own reports (so a non-admin knows if their bug was fixed).
const R_STATUS: Record<string, { label: string; color: string }> = {
  review: { label: 'Under review', color: '#9298a6' },
  todo: { label: 'Planned', color: '#5b9dff' },
  totest: { label: 'In testing', color: '#e0a334' },
  pass: { label: 'In testing', color: '#e0a334' },
  done: { label: 'Fixed ✓', color: '#34e07d' },
  fail: { label: 'Looking again', color: '#e0a334' },
  discarded: { label: "Won't do", color: '#7a8290' },
}

// #440 — a "Report a bug or idea" button in the top bar (left of the notification bell) for ALL signed-in
// users (a quick-jot; admins ALSO have the full Admin → Backlog for triage). A report lands in the shared
// backlog as "under review", stamped with the reporter + time, and pings the admins.
export default function ReportButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<BacklogType>('bug')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [mine, setMine] = useState<MyReport[]>([]) // #467 — the caller's own reports + status
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  // #467 — load "your reports" whenever the sheet opens so the reporter can see their statuses.
  const loadMine = () => authApi.myReports().then((r) => setMine(r.reports || [])).catch(() => {})
  useEffect(() => { if (open) loadMine() }, [open])

  if (!user) return null // shown to every signed-in user (admins too — JM 2026-07-08)

  async function send() {
    if (!title.trim()) return
    setState('sending')
    try {
      await authApi.reportBug({ title: title.trim(), type, summary: note.trim() || undefined })
      setState('sent'); setTitle(''); setNote(''); loadMine() // refresh the list to include the just-sent report
      setTimeout(() => setState('idle'), 1600) // keep the sheet OPEN so they see it land in "Your reports"
    } catch { setState('idle') }
  }

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={() => setOpen((o) => !o)} aria-label="Report a bug or idea" title="Report a bug or idea">
        <Megaphone size={18} />
      </button>
      {open && (
        <div className="acct__menu report-menu" role="menu">
          {state === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}><div style={{ fontSize: 26 }}>🙌</div><strong>Thanks!</strong><p className="meta" style={{ marginTop: 4 }}>Sent to the team.</p></div>
          ) : (
            <>
              <strong style={{ fontSize: 14 }}>Report a bug or idea</strong>
              <div className="chips" style={{ margin: '10px 0 8px' }}>
                <button className={'chip' + (type === 'bug' ? ' chip--active' : '')} onClick={() => setType('bug')}>🐛 Bug</button>
                <button className={'chip' + (type === 'idea' ? ' chip--active' : '')} onClick={() => setType('idea')}>💡 Idea</button>
              </div>
              <input className="search" placeholder={type === 'bug' ? "What's broken?" : "What's your idea?"} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
              <textarea className="search" placeholder="Any detail? (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              <button className="btn" style={{ marginTop: 4 }} onClick={send} disabled={!title.trim() || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
              <p className="meta" style={{ fontSize: 11, marginTop: 8 }}>Goes straight to the team as “{user.username}”.</p>
            </>
          )}
          {mine.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid #2a2f3a', paddingTop: 10 }}>
              <strong style={{ fontSize: 12, color: '#c4cad4' }}>Your reports</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 7 }}>
                {mine.map((r) => {
                  const st = R_STATUS[r.status] || R_STATUS.review
                  return (
                    <div key={r.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.type === 'idea' ? '💡' : '🐛'} {r.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: st.color, background: st.color + '22', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
