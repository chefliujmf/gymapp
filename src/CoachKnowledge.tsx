import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'

// #521/#522 (JM 2026-07-15) — "What your coach knows about you": ONE card grouping the USER-OWNED coach-facing
// inputs — the goal SELECTIONS (chips, info.goals.focus) + a plain "in your words" box (info.goals.notes) — plus
// the LEARNING toggle (learnReadiness) with a link to Stats. The coach's OWN working profile (coachProfile MD)
// is INTERNAL and deliberately NOT surfaced here: it carries system/method content (coach-memory upkeep, public
// activity-text voice, etc.) a user should never review or edit (JM #522). A user can ask the coach in chat if
// curious. Benchmarks stay on Stats (not moved). Layout = mock Option B (notes tucked behind a row).
const FOCUS: [string, string][] = [
  ['fitter', '💪 Get fitter'], ['consistency', '🔁 Be consistent'], ['weight', '⚖️ Lose weight'],
  ['muscle', '🏋️ Build muscle'], ['tone', '✨ Tone up (not bulk)'], ['race', '🏁 Race / event'],
  ['endurance', '🚴 Endurance'], ['health', '🧬 Health & longevity'], ['stress', '🧘 Stress & sleep'],
]
interface Goals { focus?: string[]; notes?: string }

const GRP: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--accent)', margin: '2px 0 8px' }

export default function CoachKnowledge() {
  const { user, refresh } = useAuth()
  const g = ((user?.info as { goals?: Goals } | undefined)?.goals) || {}
  const [focus, setFocus] = useState<string[]>(g.focus || [])
  const [notes, setNotes] = useState<string>(g.notes || '')
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  // Persist BOTH focus + notes together (they share info.goals); flash "Saved" on success.
  const save = (next: Partial<Goals>) => authApi.saveProfile({ goals: { focus, notes, ...next } })
    .then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500); refresh().catch(() => {}) }).catch(() => {})
  const toggle = (v: string) => { const nf = focus.includes(v) ? focus.filter((x) => x !== v) : [...focus, v]; setFocus(nf); save({ focus: nf }) }
  const preview = notes.trim().replace(/\s+/g, ' ')

  return (
    <div className="card" style={{ border: '1px solid #2f3b34', background: 'linear-gradient(#1c2620,#161c19)' }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>🧠 What your coach knows about you</div>

      {/* ── You told it (user-owned) ── */}
      <div style={GRP}>✍️ You told it {saved && <span className="meta" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· Saved ✓</span>}</div>
      <p className="meta" style={{ margin: '0 2px 8px' }}>What are you training for? Tap all that fit.</p>
      <div className="chips">
        {FOCUS.map(([v, label]) => <button key={v} className={'chip' + (focus.includes(v) ? ' chip--active' : '')} onClick={() => toggle(v)}>{label}</button>)}
      </div>

      {open ? (
        <div style={{ marginTop: 10 }}>
          <p className="meta" style={{ margin: '0 2px 6px' }}>In your words — what does success look like, and anything you DON'T want? Your coach reads this.</p>
          <textarea className="search" style={{ minHeight: 74, resize: 'vertical' }} value={notes}
            placeholder={'e.g. “stay consistent and raise my endurance — I don\'t want to bulk up”.'}
            onChange={(e) => setNotes(e.target.value)} onBlur={(e) => save({ notes: e.target.value.trim() })} />
          <div style={{ marginTop: 8 }}><button className="btn btn--ghost" onClick={() => setOpen(false)}>Done</button></div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          style={{ width: '100%', textAlign: 'left', marginTop: 10, background: '#12151c', border: '1px solid #2a2f3a', borderRadius: 11, padding: 11, color: 'var(--text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>In your words</b>
            <span className="meta" style={{ display: 'block', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview ? preview.slice(0, 120) + (preview.length > 120 ? '…' : '') : 'What success looks like, and anything you don\'t want…'}
            </span>
          </span>
          <span style={{ color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{notes.trim() ? 'Edit ›' : 'Add ›'}</span>
        </button>
      )}

      <div style={{ height: 1, background: '#2a2f3a', margin: '14px -14px 12px' }} />

      {/* ── It's learning ── */}
      <div style={GRP}>📈 It's learning <span className="meta" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>from your training</span></div>
      <label className="toggle-row">
        <span className="toggle-row__t"><b>Learn from my check-ins</b><span className="meta">Tunes your Sleep · Freshness · Energy toward how you actually rate them over time.</span></span>
        <input type="checkbox" className="toggle-row__cb" checked={user?.learnReadiness !== false} onChange={(e) => authApi.saveProfile({ learnReadiness: e.target.checked }).then(() => refresh()).catch(() => {})} />
      </label>
      <Link to="/stats" className="meta" style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-block', marginTop: 4 }}>See your full stats (FTP, VO₂, thresholds) ›</Link>
    </div>
  )
}
