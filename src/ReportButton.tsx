import { useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useAuth } from './auth/AuthContext'
import { authApi, type BacklogType } from './auth/api'

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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!user) return null // shown to every signed-in user (admins too — JM 2026-07-08)

  async function send() {
    if (!title.trim()) return
    setState('sending')
    try {
      await authApi.reportBug({ title: title.trim(), type, summary: note.trim() || undefined })
      setState('sent'); setTitle(''); setNote('')
      setTimeout(() => { setOpen(false); setState('idle') }, 1600)
    } catch { setState('idle') }
  }

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={() => setOpen((o) => !o)} aria-label="Report a bug or idea" title="Report a bug or idea">
        <Megaphone size={18} />
      </button>
      {open && (
        <div className="acct__menu" role="menu" style={{ width: 260, padding: 14 }}>
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
        </div>
      )}
    </div>
  )
}
