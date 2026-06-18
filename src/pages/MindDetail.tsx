import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { allMindById } from '../data/catalog'
import { mindIcon } from '../ui'
import { useNow } from '../hooks'
import AddToCalendar from '../AddToCalendar'

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export default function MindDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const m = id ? allMindById[id] : undefined
  const now = useNow()
  // Absolute end-time, so the timer stays correct if the screen locks.
  const [endsAt, setEndsAt] = useState<number | null>(null)

  if (!m) return <div className="empty"><div className="big">🤷</div>Session not found.</div>

  const left = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : m.duration * 60
  const running = endsAt !== null && left > 0

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero" style={{ justifyContent: 'center', alignItems: 'center', fontSize: 80 }}>
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {mindIcon[m.kind]}
        </div>
      </div>

      <div className="detail-body" style={{ textAlign: 'center' }}>
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
          <button className="btn" disabled style={{ background: 'var(--bg-elev2)', color: 'var(--accent)' }}>✓ Complete</button>
        ) : running ? (
          <button className="btn btn--ghost" onClick={() => setEndsAt(null)}>Reset</button>
        ) : (
          <button className="btn" onClick={() => setEndsAt(Date.now() + m.duration * 60 * 1000)}>Begin {m.duration} min</button>
        )}
      </div>
    </div>
  )
}
