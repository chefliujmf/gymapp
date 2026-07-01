import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { allMindById } from '../data/catalog'
import { mindIcon } from '../ui'
import { useNow } from '../hooks'
import { logWorkout } from '../db'
import { localISO } from '../date'
import { authApi } from '../auth/api'
import AddToCalendar from '../AddToCalendar'

// #285 — light after-session check for mind/yoga/pilates (no performance; calm/mobility + note).
function MindDone({ id, kind, date }: { id: string; kind: string; date: string }) {
  const [feel, setFeel] = useState<string | undefined>()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const mobility = /yoga|pilate|mobil|stretch/i.test(kind) // movement → ask about the body too
  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }))
  async function save() { await authApi.activityFeedback(`mind-${date}-${id}`, { feel, fields, note, sport: kind || 'meditation', date }).catch(() => {}); setSaved(true) }
  if (saved) return <div className="card pw-fbsum" style={{ justifyContent: 'center' }}><span>✅ Logged — consistency is the win. Keep the streak going.</span></div>
  return (
    <div className="card" style={{ padding: '10px 14px 16px', textAlign: 'left', marginTop: 12 }}>
      <div className="section-title">How do you feel now?</div>
      <p className="meta" style={{ margin: '-4px 0 8px' }}>Quick check — mind sessions are about calm &amp; consistency, not performance.</p>
      <div className="feelrow">{([['Calm', '😌'], ['Good', '🙂'], ['Neutral', '😐'], ['Rough', '😣']] as [string, string][]).map(([l, f]) => <button key={l} className={'feel' + (feel === l ? ' on' : '')} onClick={() => setFeel(l)}><span className="feel__f">{f}</span><span className="feel__l">{l}</span></button>)}</div>
      <div className="section-title">Stress vs before</div>
      <div className="chips">{['much lower', 'lower', 'same', 'higher'].map((o) => <button key={o} className={'chip' + (fields['Stress'] === o ? ' chip--active' : '')} onClick={() => set('Stress', o)}>{o}</button>)}</div>
      {mobility && <><div className="section-title">Body</div><div className="chips">{['looser', 'same', 'tight spots'].map((o) => <button key={o} className={'chip' + (fields['Body'] === o ? ' chip--active' : '')} onClick={() => set('Body', o)}>{o}</button>)}</div></>}
      <div className="section-title">Notes</div>
      <textarea className="fb-ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How the mind/body felt…" />
      <button className="btn" style={{ marginTop: 12 }} onClick={save} disabled={!feel}>Save</button>
    </div>
  )
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function MindDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const coachPick = (useLocation().state as { coachPick?: string } | null)?.coachPick
  const m = id ? allMindById[id] : undefined
  const now = useNow()
  // Absolute end-time, so the timer stays correct if the screen locks.
  const [endsAt, setEndsAt] = useState<number | null>(null)

  if (!m) return <div className="empty"><div className="big">🤷</div>Session not found.</div>

  const left = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : m.duration * 60
  const running = endsAt !== null && left > 0
  // #194c: log a completed session once it finishes → feeds the Mind stats page (minutes/sessions/streak).
  const logged = useRef(false)
  useEffect(() => {
    if (endsAt !== null && left === 0 && !logged.current && m) {
      logged.current = true
      logWorkout({ workoutId: m.id, title: m.title, discipline: 'mind', duration: m.duration, date: localISO() }).catch(() => {})
    }
  }, [endsAt, left, m])

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero" style={{ justifyContent: 'center', alignItems: 'center', fontSize: 80 }}>
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {mindIcon[m.kind]}
        </div>
      </div>

      <div className="detail-body" style={{ textAlign: 'center' }}>
        {coachPick && <div className="coachpick" style={{ textAlign: 'left' }}><b>Coach’s pick</b> — {coachPick}</div>}
        <span className="eyebrow">{m.kind}</span>
        <h1>{m.title}</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{m.summary}</p>
        {m.coach && <p className="meta" style={{ justifyContent: 'center' }}>with {m.coach}</p>}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AddToCalendar item={{ type: 'mind', title: m.title, refId: m.id, minutes: m.duration }} label="Assign to a day" />
        </div>


        <div style={{ fontSize: 64, fontWeight: 900, margin: '24px 0 8px', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(left)}
        </div>

        {m.audioUrl && (
          <audio controls src={m.audioUrl} style={{ width: '100%', margin: '12px 0' }} />
        )}

        {left === 0 ? (
          <>
            <button className="btn" disabled style={{ background: 'var(--bg-elev2)', color: 'var(--accent)' }}>✓ Complete</button>
            <MindDone id={m.id} kind={m.kind} date={localISO()} />
          </>
        ) : running ? (
          <button className="btn btn--ghost" onClick={() => setEndsAt(null)}>Reset</button>
        ) : (
          <button className="btn" onClick={() => setEndsAt(Date.now() + m.duration * 60 * 1000)}>Begin {m.duration} min</button>
        )}
      </div>
    </div>
  )
}
