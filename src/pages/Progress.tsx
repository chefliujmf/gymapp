import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { authApi, type CoachReview } from '../auth/api'
import { db, getSetting } from '../db'
import { localISO } from '../date'
import { allWorkoutsById, allExercisesById } from '../data/catalog'
import { matchExercise } from '../plan'
import { e1rm } from '../strength'
import { rangeSummary, weeklySetsPerMuscle, mainLifts, strengthDigest, SETS_LOW, SETS_HIGH, type MuscleOf, type VolStatus, type MainLift } from '../strength'
import { DateRangeFilter, TRAINING_PRESETS } from '../DateRange'

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
// Resolve an exercise (id first, then fuzzy name) → its muscle GROUP. Shared by all the engine calls.
const muscleOf: MuscleOf = (name, exId) => {
  const lib = (exId && allExercisesById[exId]) || matchExercise(name || '')
  return lib?.muscle ? GROUP[String(lib.muscle)] : undefined
}

function startOfWeek(offset = 0) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); d.setHours(0, 0, 0, 0); return d.getTime() }
function weekKey(t: number) { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return localISO(d) }

function Spark({ pts, color = '#34e07d', w = 60, h = 26 }: { pts: number[]; color?: string; w?: number; h?: number }) {
  if (pts.length < 2) return <svg width={w} height={h} />
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1
  const X = (i: number) => 2 + (i / (pts.length - 1)) * (w - 4)
  const Y = (v: number) => h - 3 - ((v - min) / span) * (h - 6)
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>
}
// Confidence as 4 dots (like the mock) — filled = round(pct/25), min 1.
function ConfDots({ pct }: { pct: number }) {
  const on = Math.max(1, Math.min(4, Math.round(pct / 25)))
  return <span style={{ display: 'inline-flex', gap: 3 }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < on ? 'var(--accent)' : '#2f3742' }} />)}</span>
}
const STATUS_COLOR: Record<VolStatus, string> = { ok: 'linear-gradient(90deg,#1f8f52,#34e07d)', low: 'linear-gradient(90deg,#7a5a1a,#ffb13d)', high: 'linear-gradient(90deg,#2a6f8f,#7fd1ff)' }
const STATUS_LABEL: Record<VolStatus, string> = { ok: 'ok', low: 'low', high: 'high' }

const statV: CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: '-.5px' }
const statK: CSSProperties = { fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 2 }

// Inline-styled action card (avoids editing the shared styles.css). Warm = needs-attention, green = win.
function ActCard({ icon, title, detail, tone, onClick }: { icon: string; title: string; detail: string; tone: 'warn' | 'good'; onClick?: () => void }) {
  const c = tone === 'warn' ? { bg: '#241d10', bd: '#5a4620' } : { bg: '#12180f', bd: '#26421f' }
  return (
    <button onClick={onClick} disabled={!onClick} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left', padding: 11, marginBottom: 8, borderRadius: 12, background: c.bg, border: `1px solid ${c.bd}`, color: 'var(--text)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 16, lineHeight: 1.2 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45 }}><b style={{ color: tone === 'warn' ? 'var(--warn,#ffb13d)' : 'var(--accent)' }}>{title}</b> <span className="meta" style={{ display: 'block', marginTop: 2 }}>{detail}</span></span>
      {onClick && <span style={{ color: 'var(--text-dim)', fontSize: 16, alignSelf: 'center' }}>›</span>}
    </button>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.orderBy('completedAt').toArray())
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const [q, setQ] = useState('')
  const [facet, setFacet] = useState('Needs attention')
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 56 * 86400000))) // #252 date filter (default 8 wk)
  const [to, setTo] = useState(localISO())
  const [review, setReview] = useState<CoachReview | undefined>()
  // Only a STRENGTH/gym review belongs on this page — not the latest cycling/running one (JM #526).
  useEffect(() => { authApi.coachReviews().then((r) => setReview(r.find((x) => /gym|strength|lift|weight/i.test(x.sport || '')))).catch(() => {}) }, [])
  const goExercise = (name: string) => navigate(`/exercise/${encodeURIComponent(name)}`)

  const data = useMemo(() => {
    const all = logs || []
    const since = Date.parse(from + 'T00:00:00'), until = Date.parse(to + 'T00:00:00') + 86400000
    const days = Math.max(1, Math.round((until - since) / 86400000))
    const L = all.filter((l) => l.completedAt >= since && l.completedAt < until) // #252: scope to the chosen range
    const unit = imp ? 'lb' : 'kg', conv = (kg: number) => (imp ? Math.round(kg * LB) : Math.round(kg))
    const fmt = (kg: number) => `${conv(kg)} ${unit}`
    // #251 — summary follows the filter (sessions · time · consistency), not vanity "this week" volume.
    const summary = rangeSummary(L, days)
    const vols = weeklySetsPerMuscle(L, muscleOf, days)
    const mains = mainLifts(L, muscleOf, 4)
    const digest = strengthDigest(L, muscleOf, days, GROUPS, fmt)
    // Per-exercise dated e1RM series for the searchable "all exercises" list (tap → per-exercise page).
    type Pt = { date: number; e1rm: number }
    const exMap = new Map<string, { name: string; group?: string; pts: Pt[] }>()
    const wkVol = new Map<string, number>()
    for (const l of L) {
      if (l.volume) wkVol.set(weekKey(l.completedAt), (wkVol.get(weekKey(l.completedAt)) || 0) + l.volume)
      if (!l.sets || !l.exNames) continue
      for (const [exi, arr] of Object.entries(l.sets)) {
        const name = l.exNames[Number(exi)] || allWorkoutsById[l.workoutId]?.exercises?.[Number(exi)]?.name
        if (!name || !Array.isArray(arr)) continue
        const best = Math.max(0, ...arr.map((s) => (s.done && s.weight && s.reps ? e1rm(s.weight, s.reps) : 0)))
        if (best <= 0) continue
        const e = exMap.get(name) || { name, group: muscleOf(name, l.exIds?.[Number(exi)]), pts: [] }
        e.pts.push({ date: l.completedAt, e1rm: best }); exMap.set(name, e)
      }
    }
    const lifts = [...exMap.values()].map((e) => {
      e.pts.sort((a, b) => a.date - b.date)
      const series = e.pts.map((p) => p.e1rm), first = series[0], last = series[series.length - 1]
      const improve = first ? Math.round(((last - first) / first) * 100) : 0
      const prThisWeek = e.pts.some((p, i) => i > 0 && p.date >= startOfWeek(0) && p.e1rm >= Math.max(...series.slice(0, i + 1)))
      const stalled = digest.needsAttention.some((d) => d.kind === 'stall' && d.name === e.name)
      return { name: e.name, group: e.group, series, improve, peak: conv(Math.max(...series)), n: e.pts.length, prThisWeek, stalled, lastDate: e.pts[e.pts.length - 1].date }
    })
    // weekly volume bars across the selected range (Monday-aligned)
    const monday = (t: number) => { const x = new Date(t); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x }
    const weeks: { w: string; v: number }[] = []
    for (let m = monday(since); m.getTime() < until; m.setDate(m.getDate() + 7)) { const w = localISO(m); weeks.push({ w, v: wkVol.get(w) || 0 }) }
    if (!weeks.length) weeks.push({ w: weekKey(Date.now()), v: 0 })
    return { unit, conv, summary, vols, mains, digest, lifts, weeks, count: L.length }
  }, [logs, imp, from, to])

  if (!logs) return null
  const { unit, conv, summary, vols, mains, digest, lifts, weeks, count } = data
  const maxWeek = Math.max(1, ...weeks.map((b) => b.v))
  const volScale = Math.max(SETS_HIGH + 4, ...vols.map((v) => v.perWeek))
  const hm = totalMinFmt(summary.totalMin)

  // "all exercises" list: filter by search + facet
  let shown = lifts.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()))
  if (GROUPS.includes(facet)) shown = shown.filter((l) => l.group === facet)
  else if (facet === 'PRs') shown = shown.filter((l) => l.prThisWeek)
  else if (facet === 'Recent') shown = [...shown].sort((a, b) => b.lastDate - a.lastDate)
  else if (facet === 'A–Z') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name))
  else shown = [...shown].sort((a, b) => Number(b.stalled) - Number(a.stalled) || b.improve - a.improve) // Needs attention
  const list = shown.slice(0, 8)

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head"><h1>Strength</h1><p>What to push, what's stalling, what's balanced</p></div>

      <DateRangeFilter presets={TRAINING_PRESETS} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />

      {count === 0 ? <div className="empty"><div className="big">🏋️</div>No sessions in this range.<br />Widen the dates or complete a session.</div> : <>
        {/* #251 — summary follows the filter: sessions · time · consistency */}
        <div className="card" style={{ display: 'flex', gap: 10, padding: 15 }}>
          <div style={{ flex: 1 }}><div style={statV}>{summary.sessions}</div><div style={statK}>sessions</div></div>
          <div style={{ flex: 1 }}><div style={statV}>{hm}</div><div style={statK}>on the bar</div></div>
          <div style={{ flex: 1 }}><div style={statV}>{summary.perWeek}<small style={{ fontSize: 12, color: 'var(--text-dim)' }}>/wk</small></div><div style={statK}>consistency</div></div>
        </div>

        {/* Empty-state: no SET-level data yet (e.g. intervals-imported gym = duration/load only, no weight×reps) */}
        {lifts.length === 0 && (
          <div className="card" style={{ padding: 14, marginTop: 11 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>📊 Your strength analytics build as you log sets</div>
            <p className="meta" style={{ lineHeight: 1.5 }}>Log a gym session <b>in the app</b> with <b>weight × reps</b> per exercise (an intervals-imported gym only carries duration &amp; load — no set detail). Then this page unlocks: working <b>1-RM per lift</b> with confidence, weekly <b>sets per muscle</b> vs the 10–20 growth target, <b>stall alerts &amp; PRs</b>, and a tap-through <b>progress page</b> for every exercise.</p>
          </div>
        )}

        {/* Option Ⓐ — compact action cluster: the few things worth acting on (needs-attention first, then a win) */}
        {(digest.needsAttention.length > 0 || digest.wins.length > 0) && (
          <div className="card" style={{ padding: '12px 12px 4px' }}>
            {digest.needsAttention.slice(0, 3).map((d, i) => (
              <ActCard key={'n' + i} tone="warn" icon={d.kind === 'stall' ? '📉' : d.kind === 'missing' ? '🕳️' : '⚖️'} title={d.title} detail={d.detail} onClick={d.name ? () => goExercise(d.name!) : undefined} />
            ))}
            {digest.wins.slice(0, digest.needsAttention.length >= 3 ? 1 : 2).map((d, i) => (
              <ActCard key={'w' + i} tone="good" icon={d.kind === 'pr' ? '🔥' : '📈'} title={d.title} detail={d.detail} onClick={d.name ? () => goExercise(d.name!) : undefined} />
            ))}
          </div>
        )}

        {/* Weekly sets per muscle — the actionable volume metric (Schoenfeld 10–20) */}
        {vols.length > 0 && <>
          <div className="section-title">Weekly sets per muscle <span className="meta" style={{ fontWeight: 400 }}>· target {SETS_LOW}–{SETS_HIGH}</span></div>
          <div className="card" style={{ padding: 14 }}>
            {vols.map((v) => (
              <div key={v.muscle} style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '8px 0', fontSize: 12 }}>
                <span style={{ width: 62 }}>{v.muscle}</span>
                <span style={{ flex: 1, height: 15, borderRadius: 5, background: '#12151c', position: 'relative', overflow: 'hidden' }}>
                  <i style={{ position: 'absolute', top: 0, bottom: 0, left: `${(SETS_LOW / volScale) * 100}%`, right: `${Math.max(0, 100 - (SETS_HIGH / volScale) * 100)}%`, background: 'rgba(52,224,125,.13)', borderLeft: '1px dashed #34e07d55', borderRight: '1px dashed #34e07d55' }} />
                  <i style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${(v.perWeek / volScale) * 100}%`, borderRadius: 5, background: STATUS_COLOR[v.status] }} />
                </span>
                <span className="meta" style={{ width: 66, textAlign: 'right' }}><b style={{ color: 'var(--text)' }}>{v.perWeek}</b> {STATUS_LABEL[v.status]}</span>
              </div>
            ))}
            <p className="meta" style={{ marginTop: 8, fontSize: 11 }}>Completed working sets/week per primary muscle. Shaded band = the {SETS_LOW}–{SETS_HIGH} growth range (Schoenfeld).</p>
          </div>
        </>}

        {/* Main lifts — your most-trained, working 1-RM + confidence (bounded, scales) */}
        {mains.length > 0 && <>
          <div className="section-title">Main lifts <span className="meta" style={{ fontWeight: 400 }}>· your {mains.length} most-trained</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            {mains.map((m: MainLift) => (
              <button key={m.name} onClick={() => goExercise(m.name)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', padding: 11, borderRadius: 13, background: '#12151c', border: '1px solid var(--line,#2a2f3a)', color: 'var(--text)', cursor: 'pointer' }}>
                {m.tone === 'stall' && <span style={{ position: 'absolute', top: 9, right: 9, fontSize: 9, fontWeight: 700, color: 'var(--warn,#ffb13d)' }}>stalled</span>}
                <div className="meta" style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.4px' }}>{conv(m.e1rm)}<small style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}> {unit}</small></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.deltaPct >= 0 ? 'var(--accent)' : '#ff6b6b' }}>{m.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(m.deltaPct)}% · {m.sessions}s</div>
                <div style={{ marginTop: 3 }}><ConfDots pct={m.confidencePct} /></div>
              </button>
            ))}
          </div>
        </>}

        {/* Weekly volume trend */}
        <div className="section-title">Weekly volume <span className="meta" style={{ fontWeight: 400 }}>· {weeks.length} wk</span></div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 96 }}>
            {weeks.map((b) => (
              <div key={b.w} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }} title={`${conv(b.v).toLocaleString()} ${unit}`}>
                <div style={{ width: '100%', height: `${Math.max(2, (b.v / maxWeek) * 100)}%`, background: b.v ? 'var(--accent-grad)' : 'var(--bg-soft)', borderRadius: '5px 5px 0 0', minHeight: 2 }} />
                <span className="meta" style={{ fontSize: 10 }}>{new Date(b.w + 'T00:00').toLocaleDateString(undefined, { day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* All exercises — searchable / faceted, scales to hundreds (tap → per-exercise page) */}
        {lifts.length > 0 && <>
          <div className="section-title">All exercises <span className="meta" style={{ fontWeight: 400 }}>· {lifts.length} logged</span></div>
          <div className="card" style={{ padding: 14 }}>
            <input className="search" placeholder={`🔍 Search ${lifts.length} exercises…`} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="chips" style={{ marginTop: 9 }}>
              {['Needs attention', 'PRs', 'Recent', 'A–Z', ...GROUPS].map((f) => <button key={f} className={'chip' + (facet === f ? ' chip--active' : '')} onClick={() => setFacet(f)}>{f}</button>)}
            </div>
            <div style={{ marginTop: 6 }}>
              {list.length === 0 ? <p className="meta" style={{ margin: '10px 2px' }}>No lifts match.</p> : list.map((l) => (
                <button key={l.name} className="prog-lift" onClick={() => goExercise(l.name)} aria-label={`Open ${l.name}`}>
                  <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{l.name}</b>
                    {l.prThisWeek && <span className="pill pill--pr" style={{ marginLeft: 6 }}>PR</span>}
                    {l.stalled && <span className="pill" style={{ marginLeft: 6, background: '#2a1d10', color: 'var(--warn,#ffb13d)', borderColor: '#5a4620' }}>stalled</span>}
                    <div className="meta" style={{ fontSize: 11 }}>{l.peak} {unit} e1RM · {l.n} session{l.n === 1 ? '' : 's'}</div></div>
                  <Spark pts={l.series} color={l.stalled ? '#ffb13d' : l.improve > 1 ? '#34e07d' : 'var(--text-dim)'} />
                  <div className={'prog-lift__d ' + (l.improve > 0 ? 'up' : l.improve < 0 ? 'down' : '')}>{l.improve > 0 ? '+' : ''}{l.improve}%</div>
                  <span className="prog-lift__chev">›</span>
                </button>
              ))}
              {shown.length > list.length && <p className="meta" style={{ textAlign: 'center', marginTop: 8 }}>Showing {list.length} of {shown.length} — refine with search</p>}
            </div>
          </div>
        </>}

        {/* coach takeaways — REAL cyclingcoach review if present */}
        {review && (review.takeaways?.length || review.verdict || review.execution?.length || review.next) && <>
          <div className="section-title">Coach takeaways<span className="meta"> · {new Date(review.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
          <div className="card" style={{ padding: '12px 14px' }}>
            {review.score != null && <div className="gp2-hl">⭐ <span><b>Score {review.score}/10.</b> {review.verdict}</span></div>}
            {review.score == null && review.verdict && <div className="gp2-hl">🧑‍🏫 <span>{review.verdict}</span></div>}
            {(review.takeaways || review.execution || []).map((t, i) => <div key={i} className="gp2-hl">• <span>{t}</span></div>)}
            {review.next && <div className="gp2-hl">➡️ <span><b>Next:</b> {review.next}</span></div>}
          </div>
        </>}
        {/* Ⓐ bottom insight — synthesized when the coach hasn't written a review yet */}
        {!(review && (review.takeaways?.length || review.verdict || review.execution?.length || review.next)) && (digest.wins[0] || digest.needsAttention[0]) && (
          <div className="card" style={{ padding: 12, marginTop: 11, background: '#12180f', border: '1px solid #26421f', fontSize: 13, lineHeight: 1.5 }}>
            💡 {digest.wins[0] && <><b style={{ color: 'var(--accent)' }}>{digest.wins[0].title}</b> — {digest.wins[0].detail} </>}
            {digest.needsAttention[0] && <><b style={{ color: 'var(--warn,#ffb13d)' }}>{digest.needsAttention[0].title}</b>: {digest.needsAttention[0].detail}</>}
          </div>
        )}
      </>}
    </div>
  )
}

function totalMinFmt(min: number): string { return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}` }
