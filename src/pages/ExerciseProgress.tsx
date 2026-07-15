import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { allExercisesById } from '../data/catalog'
import { matchExercise } from '../plan'
import { TrendChart } from '../charts'
import { exerciseHistory } from '../strength'

const LB = 2.2046226
const REP_LABEL: Record<number, string> = { 1: '1', 3: '2–3', 5: '4–5', 8: '6–8', 12: '9–12', 15: '13+' }
const rel = (ms: number) => {
  const d = Math.round((Date.now() - ms) / 864e5)
  return d <= 0 ? 'today' : d < 7 ? `${d}d ago` : d < 60 ? `${Math.round(d / 7)}w ago` : `${Math.round(d / 30)}mo ago`
}

// #227 — a real per-exercise progress PAGE (was only a small modal). Est-1RM trend, best-set-by-rep-range,
// weekly volume, next progressive-overload target. Science: docs/strength-analytics.md.
export default function ExerciseProgress() {
  const navigate = useNavigate()
  const { name: raw } = useParams()
  const name = decodeURIComponent(raw || '')
  const logs = useLiveQuery(() => db.logs.orderBy('completedAt').toArray())
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const unit = imp ? 'lb' : 'kg'
  const conv = (kg: number) => (imp ? Math.round(kg * LB) : Math.round(kg))
  const muscle = useMemo(() => {
    const lib = matchExercise(name) || Object.values(allExercisesById).find((e) => e.name === name)
    return lib?.muscle
  }, [name])

  const h = useMemo(() => (logs ? exerciseHistory(logs, name, (kg) => `${conv(kg)} ${unit}`) : null), [logs, name, imp]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!logs) return null
  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head"><h1>{name}</h1><p>{[muscle, h ? `${h.sessions} session${h.sessions === 1 ? '' : 's'} in range` : ''].filter(Boolean).join(' · ')}</p></div>

      {!h ? <div className="empty"><div className="big">🏋️</div>No logged sets for {name} yet.<br />Complete a session with this exercise to see its progress.</div> : <>
        {/* next progressive-overload target */}
        {h.next && <div className="card" style={{ padding: 12, background: '#12180f', border: '1px solid #26421f', marginBottom: 11, fontSize: 13, lineHeight: 1.45 }}>
          🎯 <b style={{ color: 'var(--accent)' }}>Next target: {conv(h.next.weightKg)} {unit} × {h.next.reps}</b> <span className="meta">— double progression: own the top of the rep range, then add the smallest load.</span>
        </div>}

        {/* hero */}
        <div className="card" style={{ display: 'flex', gap: 10, padding: 15 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Est. 1-RM</div><div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.5px' }}>{conv(h.e1rm)}<small style={{ fontSize: 12, color: 'var(--text-dim)' }}> {unit}</small></div><div style={{ fontSize: 12, fontWeight: 700, color: h.deltaPct >= 0 ? 'var(--accent)' : '#ff6b6b' }}>{h.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(h.deltaPct)}% · {h.sessions}s</div></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Confidence</div>
            <div style={{ display: 'inline-flex', gap: 3, marginTop: 8 }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < Math.max(1, Math.min(4, Math.round(h.confidencePct / 25))) ? 'var(--accent)' : '#2f3742' }} />)}</div>
            <div className="meta" style={{ fontSize: 11, marginTop: 5 }}>{h.confidencePct >= 68 ? 'dependable' : 'rough guide'}</div></div>
        </div>

        {/* est-1RM trend */}
        <div className="section-title">Estimated 1-RM trend</div>
        <div className="card" style={{ padding: 14 }}>
          <TrendChart axes height={170} unit={` ${unit}`}
            series={[{ label: 'e1RM', data: h.pts.map((p) => conv(p.e1rm)), color: '#34e07d', area: true }]}
            labels={h.pts.map((p) => new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))} />
          {h.insight && <p className="meta" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.45 }}>{h.insight}</p>}
        </div>

        {/* best set by rep range */}
        {h.repBests.length > 0 && <>
          <div className="section-title">Best set by rep range</div>
          <div className="card" style={{ padding: '6px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Reps</th><th style={{ textAlign: 'right', padding: '8px 4px' }}>Best</th><th style={{ textAlign: 'right', padding: '8px 4px' }}>Est 1-RM</th><th style={{ textAlign: 'right', padding: '8px 4px' }}>When</th>
              </tr></thead>
              <tbody>{h.repBests.map((r) => (
                <tr key={r.reps} style={{ borderTop: '1px solid #21252f' }}>
                  <td style={{ textAlign: 'left', padding: '8px 4px' }}>{REP_LABEL[r.reps] || r.reps}</td>
                  <td style={{ textAlign: 'right', padding: '8px 4px' }}>{conv(r.weight)} {unit}</td>
                  <td style={{ textAlign: 'right', padding: '8px 4px' }}>{conv(r.e1rm)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--text-dim)' }}>{rel(r.date)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        {/* weekly volume (this lift) */}
        {h.weeklyVolume.length > 1 && <>
          <div className="section-title">Volume trend <span className="meta" style={{ fontWeight: 400 }}>· this lift</span></div>
          <div className="card" style={{ padding: 14 }}>
            {(() => {
              const mx = Math.max(1, ...h.weeklyVolume.map((w) => w.volume))
              const kfmt = (v: number) => { const c = conv(v); return c >= 1000 ? Math.round(c / 100) / 10 + 'k' : String(Math.round(c)) }
              return <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 88, width: 30, textAlign: 'right' }}>
                  {[mx, mx / 2, 0].map((t, i) => <span key={i} className="meta" style={{ fontSize: 9, lineHeight: 1 }}>{kfmt(t)}</span>)}
                </div>
                <div style={{ flex: 1, position: 'relative', height: 88 }}>
                  {[0, 50, 100].map((p) => <div key={p} style={{ position: 'absolute', left: 0, right: 0, top: `${p}%`, borderTop: '1px solid rgba(255,255,255,.06)' }} />)}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%' }}>
                    {h.weeklyVolume.map((w) => <div key={w.week} style={{ flex: 1, background: 'var(--accent-grad)', borderRadius: '4px 4px 0 0', height: `${Math.max(3, (w.volume / mx) * 100)}%` }} title={`${conv(w.volume).toLocaleString()} ${unit}`} />)}
                  </div>
                </div>
              </div>
            })()}
            <p className="meta" style={{ marginTop: 8, fontSize: 11 }}>Weekly tonnage ({unit}, weight × reps) for this lift · peak {conv(Math.max(1, ...h.weeklyVolume.map((w) => w.volume))).toLocaleString()} {unit}.</p>
          </div>
        </>}
      </>}
    </div>
  )
}
