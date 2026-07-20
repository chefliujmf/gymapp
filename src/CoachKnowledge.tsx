import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'

// #521/#522/#526 (JM 2026-07-15) — "What your coach knows about you": the USER-OWNED coach-facing inputs. #526:
// dropped the goal-FOCUS CHIPS — the user just writes their objective in their OWN words (info.goals.notes) or
// tells the coach in chat, and the coach asks follow-ups when it needs more. Plus the LEARNING toggle
// (learnReadiness) with a link to Stats. The coach's OWN working profile (coachProfile MD) is INTERNAL and NOT
// surfaced here (JM #522). Benchmarks stay on Stats.
interface Goals { focus?: string[]; notes?: string }

const GRP: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--accent)', margin: '2px 0 8px' }

export default function CoachKnowledge() {
  const { user, refresh } = useAuth()
  const g = ((user?.info as { goals?: Goals } | undefined)?.goals) || {}
  const [notes, setNotes] = useState<string>(g.notes || '')
  const [saved, setSaved] = useState(false)
  // Persist notes (preserve any legacy focus so we don't drop it); flash "Saved" on success.
  const save = (next: string) => authApi.saveProfile({ goals: { ...(g.focus ? { focus: g.focus } : {}), notes: next } })
    .then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500); refresh().catch(() => {}) }).catch(() => {})

  return (
    <div className="card" style={{ padding: 16 }}>
      {/* #521 (JM 2026-07-15) — dropped the "What your coach knows about you" title; the user just enters their objective, the heading added nothing. */}
      {/* ── Your goal, in your own words (or just tell the coach in chat) ── */}
      <div style={GRP}>🎯 Your goal {saved && <span className="meta" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· Saved ✓</span>}</div>
      <p className="meta" style={{ margin: '0 2px 8px' }}>What are you training for? Write it in your own words — or just tell your coach in chat and it'll ask what it needs.</p>
      <textarea className="search" style={{ minHeight: 68, resize: 'vertical', width: '100%' }} value={notes}
        placeholder={'e.g. “stay consistent and raise my endurance — I don\'t want to bulk up.”'}
        onChange={(e) => setNotes(e.target.value)} onBlur={(e) => save(e.target.value.trim())} />

      <div style={{ height: 1, background: '#2a2f3a', margin: '16px -16px 14px' }} />

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
