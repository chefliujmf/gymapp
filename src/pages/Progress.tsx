import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, type WorkoutLog, type SetEntry } from '../db'
import { localISO } from '../date'
import { allWorkoutsById, allExercisesById } from '../data/catalog'
import { matchExercise } from '../plan'
import { e1rm } from '../strength'

const LB = 2.2046226
// Anatomical muscle → muscle GROUP (JM: facet by muscle groups, not push/pull/legs).
const GROUP: Record<string, string> = {
  Chest: 'Chest',
  Lats: 'Back', Traps: 'Back', 'Lower back': 'Back', Neck: 'Back',
  Shoulders: 'Shoulders',
  Biceps: 'Arms', Triceps: 'Arms', Forearms: 'Arms',
  Quads: 'Legs', Hamstrings: 'Legs', Glutes: 'Legs', Calves: 'Legs', Adductors: 'Legs', Abductors: 'Legs', Feet: 'Legs',
  Abs: 'Core', Obliques: 'Core',
}
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']

function exMeta(l: WorkoutLog, exi: number) {
  const exId = l.exIds?.[exi]
  const lib = (exId && allExercisesById[exId]) || matchExercise(l.exNames?.[exi] || allWorkoutsById[l.workoutId]?.exercises?.[exi]?.name || '')
  const name = l.exNames?.[exi] || allWorkoutsById[l.workoutId]?.exercises?.[exi]?.name || lib?.name || `Exercise ${exi + 1}`
  const group = lib?.muscle ? GROUP[String(lib.muscle)] : undefined
  return { name, group }
}
function startOfWeek(offset = 0) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); d.setHours(0, 0, 0, 0); return d.getTime() }
function weekKey(t: number) { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return localISO(d) }
function dayStreak(times: number[]): number {
  const days = new Set(times.map((t) => localISO(new Date(t)))); const d = new Date(); d.setHours(0, 0, 0, 0)
  if (!days.has(localISO(d))) d.setDate(d.getDate() - 1)
  let s = 0; while (days.has(localISO(d))) { s++; d.setDate(d.getDate() - 1) }; return s
}

function Spark({ pts, color = '#34e07d', w = 70, h = 30 }: { pts: number[]; color?: string; w?: number; h?: number }) {
  if (pts.length < 2) return <svg width={w} height={h} />
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1
  const X = (i: number) => 2 + (i / (pts.length - 1)) * (w - 4)
  const Y = (v: number) => h - 3 - ((v - min) / span) * (h - 6)
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>
}

export default function Progress() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.orderBy('completedAt').toArray())
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const [q, setQ] = useState('')
  const [facet, setFacet] = useState('Top movers')

  const data = useMemo(() => {
    const L = logs || []
    const unit = imp ? 'lb' : 'kg', conv = (kg: number) => (imp ? Math.round(kg * LB) : Math.round(kg))
    const wkVol = new Map<string, number>()
    const groupVol = new Map<string, number>()
    const since28 = Date.now() - 28 * 86400000
    type Pt = { date: number; e1rm: number }
    const exMap = new Map<string, { name: string; group?: string; pts: Pt[] }>()
    for (const l of L) {
      if (l.volume) wkVol.set(weekKey(l.completedAt), (wkVol.get(weekKey(l.completedAt)) || 0) + l.volume)
      if (!l.sets) continue
      for (const [exi, arr] of Object.entries(l.sets)) {
        const best = Math.max(0, ...(arr || []).map((s: SetEntry) => (s.weight && s.reps ? e1rm(s.weight, s.reps) : 0)))
        const setVol = (arr || []).reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0)
        const { name, group } = exMeta(l, Number(exi))
        if (group && l.completedAt >= since28) groupVol.set(group, (groupVol.get(group) || 0) + setVol)
        if (best <= 0) continue
        const e = exMap.get(name) || { name, group, pts: [] }; e.pts.push({ date: l.completedAt, e1rm: best }); exMap.set(name, e)
      }
    }
    // weekly bars (8 wk)
    const weeks: { w: string; v: number }[] = []
    for (let i = 7; i >= 0; i--) { const w = weekKey(startOfWeek(-i)); weeks.push({ w, v: wkVol.get(w) || 0 }) }
    const thisWk = wkVol.get(weekKey(startOfWeek(0))) || 0, lastWk = wkVol.get(weekKey(startOfWeek(-1))) || 0
    const wow = lastWk ? Math.round(((thisWk - lastWk) / lastWk) * 100) : 0
    // per-exercise improvement + PRs
    const lifts = [...exMap.values()].map((e) => {
      e.pts.sort((a, b) => a.date - b.date)
      const series = e.pts.map((p) => p.e1rm), first = series[0], last = series[series.length - 1]
      const improve = first ? Math.round(((last - first) / first) * 100) : 0
      const peak = Math.max(...series)
      const prThisWeek = e.pts.some((p, i) => p.date >= startOfWeek(0) && p.e1rm >= Math.max(...series.slice(0, i + 1)) && i > 0)
      const lastDate = e.pts[e.pts.length - 1].date
      return { name: e.name, group: e.group, series, improve, peak: conv(peak), n: e.pts.length, prThisWeek, lastDate }
    })
    const prCount = lifts.filter((x) => x.prThisWeek).length
    const totalGroup = [...groupVol.values()].reduce((a, b) => a + b, 0) || 1
    const balance = GROUPS.map((g) => ({ g, pct: Math.round(((groupVol.get(g) || 0) / totalGroup) * 100) })).sort((a, b) => b.pct - a.pct)
    return { unit, conv, weeks, thisWk, wow, lifts, prCount, balance, streak: dayStreak(L.map((l) => l.completedAt)), count: L.length, totalMin: L.reduce((s, l) => s + l.duration, 0), thisWeekN: L.filter((l) => l.completedAt >= startOfWeek(0)).length }
  }, [logs, imp])

  if (!logs) return null
  const { unit, conv, weeks, thisWk, wow, lifts, prCount, balance, streak, count, totalMin, thisWeekN } = data
  const maxWeek = Math.max(1, ...weeks.map((b) => b.v))

  // strength list: filter by search + facet, sort sensibly
  let shown = lifts.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()))
  if (GROUPS.includes(facet)) shown = shown.filter((l) => l.group === facet)
  else if (facet === 'PRs') shown = shown.filter((l) => l.prThisWeek)
  else if (facet === 'Recent') shown = shown.sort((a, b) => b.lastDate - a.lastDate)
  if (facet === 'Top movers') shown = shown.sort((a, b) => b.improve - a.improve)
  const list = shown.slice(0, 8)

  const under = balance[balance.length - 1]
  const topMover = [...lifts].sort((a, b) => b.improve - a.improve)[0]
  const bestWeek = weeks[weeks.length - 1].v >= maxWeek && maxWeek > 1

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head"><h1>Progress</h1><p>How you're trending — History lives in its own tab</p></div>

      {count === 0 ? <div className="empty"><div className="big">📈</div>No workouts logged yet.<br />Complete a session to see your trends.</div> : <>
        {/* hero */}
        <div className="prog-hero">
          <div className="prog-hero__big"><div className="v">{conv(thisWk).toLocaleString()} {wow !== 0 && <span className={'delta ' + (wow > 0 ? 'up' : 'down')}>{wow > 0 ? '▲' : '▼'} {Math.abs(wow)}%</span>}</div><div className="k">Volume · this week</div></div>
          <div className="prog-hero__big"><div className="v">🔥 {streak}</div><div className="k">day streak</div></div>
        </div>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="chips">
            {prCount > 0 && <span className="pill pill--pr">🏆 {prCount} PR{prCount > 1 ? 's' : ''} this week</span>}
            {topMover && topMover.improve > 0 && <span className="pill">📈 {topMover.name} +{topMover.improve}%</span>}
            <span className="pill">🎯 {count} sessions · {Math.round(totalMin / 60)}h</span>
            <span className="pill">{thisWeekN} this week</span>
          </div>
        </div>

        {/* weekly volume */}
        <div className="section-title">Weekly volume · 8 wk</div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
            {weeks.map((b) => (
              <div key={b.w} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }} title={`${conv(b.v).toLocaleString()} ${unit}`}>
                <div style={{ width: '100%', height: `${Math.max(2, (b.v / maxWeek) * 100)}%`, background: b.v ? 'var(--accent-grad)' : 'var(--bg-soft)', borderRadius: '5px 5px 0 0', minHeight: 2 }} />
                <span className="meta" style={{ fontSize: 10 }}>{new Date(b.w + 'T00:00').toLocaleDateString(undefined, { day: 'numeric' })}</span>
              </div>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 8 }}>Peak {conv(maxWeek).toLocaleString()} {unit}{bestWeek ? ' · best week yet 🔥' : ''}</p>
        </div>

        {/* strength trends — searchable + faceted (scales to many lifts) */}
        {lifts.length > 0 && <>
          <div className="section-title">Strength trends <span className="meta">· {lifts.length} lifts</span></div>
          <div className="card" style={{ padding: 14 }}>
            <input className="search" placeholder="🔍 Search a lift…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="chips" style={{ marginTop: 9 }}>
              {['Top movers', 'PRs', 'Recent', ...GROUPS].map((f) => <button key={f} className={'chip' + (facet === f ? ' chip--active' : '')} onClick={() => setFacet(f)}>{f}</button>)}
            </div>
            <div style={{ marginTop: 6 }}>
              {list.length === 0 ? <p className="meta" style={{ margin: '10px 2px' }}>No lifts match.</p> : list.map((l) => (
                <div key={l.name} className="prog-lift">
                  <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{l.name}</b>{l.prThisWeek && <span className="pill pill--pr" style={{ marginLeft: 6 }}>PR</span>}<div className="meta" style={{ fontSize: 11 }}>{l.peak} {unit} e1RM · {l.n} sessions</div></div>
                  <Spark pts={l.series} color={l.improve > 1 ? '#34e07d' : 'var(--text-dim)'} />
                  <div className={'prog-lift__d ' + (l.improve > 0 ? 'up' : l.improve < 0 ? 'down' : '')}>{l.improve > 0 ? '+' : ''}{l.improve}%</div>
                </div>
              ))}
              {shown.length > list.length && <p className="meta" style={{ textAlign: 'center', marginTop: 8 }}>Showing {list.length} of {shown.length} — refine with search</p>}
            </div>
          </div>
        </>}

        {/* muscle balance */}
        {balance.some((b) => b.pct > 0) && <>
          <div className="section-title">Muscle balance · 4 wk</div>
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {balance.map((b) => (
              <div key={b.g} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span className="meta" style={{ width: 78 }}>{b.g}</span>
                <span style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 999, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${b.pct}%`, background: 'linear-gradient(90deg,#b388ff,#7c4dff)' }} /></span>
                <span style={{ width: 32, textAlign: 'right' }}>{b.pct}%</span>
              </div>
            ))}
          </div>
        </>}

        {/* coach takeaways */}
        <div className="section-title">Coach takeaways</div>
        <div className="card" style={{ padding: '12px 14px' }}>
          {topMover && topMover.improve > 0 && <div className="gp2-hl">📈 <span><b>{topMover.name} is climbing</b> (+{topMover.improve}%) — progressive overload is working.</span></div>}
          {under && under.pct < 12 && <div className="gp2-hl">⚠️ <span><b>{under.g} is under-trained</b> ({under.pct}% of volume) — add a set or a dedicated day.</span></div>}
          {bestWeek && <div className="gp2-hl">🔥 <span><b>Best volume week yet.</b> Keep an eye on recovery in your check-ins.</span></div>}
          {!topMover?.improve && !bestWeek && <div className="gp2-hl">💪 <span>Keep logging — a few more sessions and I'll surface trends & PRs here.</span></div>}
        </div>
      </>}
    </div>
  )
}
