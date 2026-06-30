import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { localISO } from '../date'
import { TrendChart } from '../charts'
import { mindStats, isMindDiscipline } from '../mind-stats'

// #194c — Mind stats page: minutes / sessions / streak + weekly-minutes trend from logged sessions.
export default function MindStats() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? null
  const mind = (logs ?? []).filter((l) => isMindDiscipline(l.discipline)).sort((a, b) => (a.date < b.date ? 1 : -1))
  const s = mindStats(mind.map((l) => ({ date: l.date, duration: l.duration })), localISO())

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Mind</h1><p>Meditation · yoga · pilates — minutes, sessions, streak</p></div>
      </div>

      {logs === null ? <p className="meta">Loading…</p> : !mind.length ? (
        <p className="meta">No mind sessions logged yet. Finish a session in <span style={{ color: 'var(--accent)' }}>Mind</span> and it'll show here.</p>
      ) : (
        <>
          <div className="mind-stat3">
            <div><b>{s.minutesMonth}</b><span>min this month</span></div>
            <div><b>{s.sessionsMonth}</b><span>sessions</span></div>
            <div><b>{s.streak}{s.streak ? ' 🔥' : ''}</b><span>day streak</span></div>
          </div>

          <div className="section-title">Minutes per week <span className="meta" style={{ fontWeight: 400 }}>· last 8 weeks</span></div>
          <div className="card chart-card" style={{ padding: '12px 14px' }}>
            <TrendChart series={[{ label: 'min', data: s.weeklyMinutes, color: '#9b8cff', area: true }]} height={110} axes unit=" min" labels={['7w', '6w', '5w', '4w', '3w', '2w', '1w', 'now']} />
            <p className="fit-insight">{(() => { const v = s.weeklyMinutes.filter((x) => x > 0); if (!v.length) return 'No sessions in the last 8 weeks.'; return `🧘 ~${Math.round(v.reduce((a, b) => a + b, 0) / v.length)} min/week on average.` })()}</p>
          </div>

          <div className="section-title">Recent sessions</div>
          <div className="stack">
            {mind.slice(0, 8).map((l, i) => (
              <div key={l.id ?? i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px' }}>
                <span style={{ fontSize: 22 }}>🧘</span>
                <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 14 }}>{l.title}</strong><div className="meta">{new Date(l.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>
                <span className="meta">{l.duration} min</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
