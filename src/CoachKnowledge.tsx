import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'

// #521 (JM 2026-07-15) — "What your coach knows about you": ONE card grouping the coach-facing bits that used
// to be scattered across Profile — the goal SELECTIONS (chips, info.goals.focus) + the free-text NARRATIVE
// your coach reads every session (coachProfile, previously the separate /profile/athlete page, where the #519
// migration landed your goal + cottage rhythm) + the LEARNING toggle (learnReadiness) with a link to Stats.
// Layout = mock Option B (JM pick): notes tucked behind an Edit ›. Benchmarks stay on Stats (not moved here).
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
  const toggle = (v: string) => {
    const next = focus.includes(v) ? focus.filter((x) => x !== v) : [...focus, v]
    setFocus(next)
    authApi.saveProfile({ goals: { ...g, focus: next } }).then(() => refresh().catch(() => {})).catch(() => {})
  }

  // Coach notes = coachProfile (GET/PUT /auth/profile/athlete). Collapsed by default (Option B); tap Edit to open.
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => { authApi.getAthlete().then((r) => setNotes(r.profile || '')).catch(() => {}) }, [])
  const saveNotes = async () => {
    setSaving(true)
    try { const r = await authApi.saveAthlete(draft); setNotes(r.profile); setOpen(false) } catch { /* keep editing */ } finally { setSaving(false) }
  }
  const preview = notes.trim().replace(/[#*>_`-]+/g, ' ').replace(/\s+/g, ' ').trim()

  return (
    <div className="card" style={{ border: '1px solid #2f3b34', background: 'linear-gradient(#1c2620,#161c19)' }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>🧠 What your coach knows about you</div>

      {/* ── You told it ── */}
      <div style={GRP}>✍️ You told it</div>
      <p className="meta" style={{ margin: '0 2px 8px' }}>What are you training for? Tap all that fit.</p>
      <div className="chips">
        {FOCUS.map(([v, label]) => <button key={v} className={'chip' + (focus.includes(v) ? ' chip--active' : '')} onClick={() => toggle(v)}>{label}</button>)}
      </div>

      {open ? (
        <div style={{ marginTop: 10 }}>
          <p className="meta" style={{ margin: '0 2px 6px' }}>In your words — what your coach reads every session. Markdown ok (<code>#</code> headings, <code>-</code> bullets).</p>
          <textarea className="athlete-edit" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8}
            placeholder={'# Goals\n- e.g. highest sustainable FTP…\n\n# Training context\n- days/week, constraints, injuries, preferences'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={saveNotes} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn btn--ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setDraft(notes); setOpen(true) }}
          style={{ width: '100%', textAlign: 'left', marginTop: 10, background: '#12151c', border: '1px solid #2a2f3a', borderRadius: 11, padding: 11, color: 'var(--text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>Your coach notes</b>
            <span className="meta" style={{ display: 'block', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview ? preview.slice(0, 120) + (preview.length > 120 ? '…' : '') : 'Add goals, context, constraints your coach should know…'}
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
