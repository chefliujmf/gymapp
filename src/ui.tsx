import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { Dumbbell, Flame, Activity, Flower2, StretchHorizontal, Swords, Brain, Moon, Wind, Target, Bike, Footprints, Coffee, Sandwich, UtensilsCrossed, Apple, Home, Mountain, Check } from 'lucide-react'
import type { Discipline, Workout, Program, Recipe, Trainer, MindSession, MindKind, EnduranceWorkout } from './types'
import { isIndoorActivity, type IcuActivity } from './intervals'
import { localISO } from './date'
import { zoneColor, zoneName, segPower } from './zones'
export { zoneColor, zoneName } // one source of truth (#72) — re-export for other modules

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Mon–Sun strip for the current week, today highlighted. week header. */
export function WeekStrip({ selected, onSelect, marked }: { selected?: string; onSelect?: (iso: string) => void; marked?: Set<string> } = {}) {
  const now = new Date()
  const [offset, setOffset] = useState(0) // weeks from the current week (‹ ›)
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  const sunday = days[6]
  const todayKey = now.toDateString()
  const label = `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString(undefined, monday.getMonth() === sunday.getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`
  // Changing week moves the selection to the EDGE you scroll toward (next → that week's
  // Monday, prev → its Sunday) so it stays continuous. (#205)
  const mondayOf = (off: number) => { const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7) + off * 7); return m }
  const goWeek = (delta: number) => {
    const newOff = offset + delta
    setOffset(newOff)
    const m = mondayOf(newOff)
    onSelect?.(localISO(delta < 0 ? new Date(m.getFullYear(), m.getMonth(), m.getDate() + 6) : m))
  }
  // "Today" shows as soon as the selected date isn't today — even within this week. (#205)
  const away = offset !== 0 || (!!selected && selected !== localISO(now))
  return (
    <>
      <div className="weeknav">
        <button className="weeknav__a" onClick={() => goWeek(-1)} aria-label="Previous week">‹</button>
        <span className="weeknav__l">{offset === 0 ? 'This week' : label}</span>
        {away && <button className="weeknav__today" onClick={() => { setOffset(0); onSelect?.(localISO(now)) }}>Today</button>}
        <button className="weeknav__a" onClick={() => goWeek(1)} aria-label="Next week">›</button>
      </div>
      <div className="week">
        {days.map((d) => {
          const iso = localISO(d)
          const on = selected ? iso === selected : d.toDateString() === todayKey
          const isToday = d.toDateString() === todayKey // mark today even when another day is selected (#192)
          const hasContent = !!marked?.has(iso)
          return (
            <button key={iso} className={[on && 'on', isToday && 'today'].filter(Boolean).join(' ')} onClick={() => onSelect?.(iso)}>
              {DOW[d.getDay()]}
              <b>{d.getDate()}</b>
              <span className={'week__dot' + (hasContent ? ' week__dot--on' : '')} />
            </button>
          )
        })}
      </div>
    </>
  )
}

export const disciplineIcon: Record<Discipline, ReactNode> = {
  strength: <Dumbbell strokeWidth={1.75} />,
  hiit: <Flame strokeWidth={1.75} />,
  cardio: <Activity strokeWidth={1.75} />,
  yoga: <Flower2 strokeWidth={1.75} />,
  pilates: <StretchHorizontal strokeWidth={1.75} />,
  mobility: <StretchHorizontal strokeWidth={1.75} />,
  boxing: <Swords strokeWidth={1.75} />,
  meditation: <Brain strokeWidth={1.75} />,
}

const categoryIcon: Record<Recipe['category'], ReactNode> = {
  breakfast: <Coffee strokeWidth={1.75} />,
  lunch: <Sandwich strokeWidth={1.75} />,
  dinner: <UtensilsCrossed strokeWidth={1.75} />,
  snack: <Apple strokeWidth={1.75} />,
}

export function WorkoutCard({ w }: { w: Workout }) {
  return (
    <Link to={`/workouts/${w.id}`} className="card">
      <div className="card-row">
        <Thumb src={w.thumbnail} fallback={disciplineIcon[w.discipline]} />
        <div className="card-body">
          <h3>{w.title}</h3>
          <div className="meta">
            <span>{w.duration} min</span>
            <span className="dot">{w.discipline}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ProgramCard({ p }: { p: Program }) {
  return (
    <Link to={`/programs/${p.id}`} className="card">
      <div className="thumb thumb--wide">{disciplineIcon[p.discipline]}</div>
      <div className="card-row" style={{ paddingTop: 12 }}>
        <div className="card-body">
          <h3>{p.title}</h3>
          <div className="meta">
            <span>{p.weeks} weeks</span>
            <span className="dot">{p.daysPerWeek}×/week</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export const mindIcon: Record<MindKind, ReactNode> = {
  meditation: <Brain strokeWidth={1.75} />,
  breathwork: <Wind strokeWidth={1.75} />,
  sleep: <Moon strokeWidth={1.75} />,
  focus: <Target strokeWidth={1.75} />,
}

export function TrainerCard({ t }: { t: Trainer }) {
  return (
    <Link to={`/trainers/${t.id}`} className="card">
      <div className="card-row">
        <div className="thumb" style={{ borderRadius: 999 }}>{t.name.charAt(0)}</div>
        <div className="card-body">
          <h3>{t.name}</h3>
          <div className="meta">{t.specialty}</div>
        </div>
      </div>
    </Link>
  )
}

export function MindCard({ m }: { m: MindSession }) {
  return (
    <Link to={`/mind/${m.id}`} className="card">
      <div className="card-row">
        <div className="thumb">{mindIcon[m.kind]}</div>
        <div className="card-body">
          <h3>{m.title}</h3>
          <div className="meta">
            <span>{m.duration ? `${m.duration} min` : 'audio'}</span>
            <span className="dot">{m.kind}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function Thumb({ src, fallback, className = 'thumb' }: { src?: string; fallback: ReactNode; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <div className={className}>
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}
             style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'inherit' }} />
      </div>
    )
  }
  return <div className={className}>{fallback}</div>
}

export function RecipeCard({ r }: { r: Recipe }) {
  return (
    <Link to={`/recipes/${r.id}`} className="card">
      <div className="card-row">
        <Thumb src={r.thumbnail} fallback={categoryIcon[r.category]} />
        <div className="card-body">
          <h3>{r.title}</h3>
          <div className="meta">
            <span>{r.minutes} min</span>
            {r.kcal > 0 && <span className="dot">{r.kcal} kcal</span>}
            {r.protein > 0 && <span className="dot">{r.protein}g protein</span>}
            {r.kcal === 0 && r.diet?.[0] && <span className="dot">{r.diet[0]}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

// --- Endurance (cycling / running) ----------------------------------------

/** Power-zone colour for a % of FTP/threshold — mirrors JOIN's profile graph. */
// zoneColor / zoneName now live in ./zones (re-exported above) — ONE source of truth.

/** Flatten blocks (expanding numRepeats) into a single list of intervals. */
export function flattenIntervals(w: EnduranceWorkout) {
  const out: { duration: number; rawPower: number; power?: string; heartRate?: string }[] = []
  for (const b of w.blocks) {
    for (let r = 0; r < (b.numRepeats || 1); r++) {
      for (const iv of b.intervals) out.push(iv)
    }
  }
  return out
}

/** Training Stress Score, computed from the structured intervals.
 *  TSS = Σ(duration_s · IF²) / 3600 · 100, with IF = %FTP / 100 per segment.
 *  (JOIN's `stress` field is a 1–5 difficulty rating, not TSS.) */
export function computeTSS(w: EnduranceWorkout): number {
  let weighted = 0
  for (const iv of flattenIntervals(w)) {
    const intensityFactor = (iv.rawPower || 0) / 100
    weighted += (iv.duration || 0) * intensityFactor * intensityFactor
  }
  return Math.round((weighted / 3600) * 100)
}

/** join.cc-style interval profile rendered from the structured data. */
/** True power profile (mirrors intervals): each segment follows its real start→end, so
 *  ramps SLOPE and steady blocks are flat — not a flat bar at the peak (#217 follow-up). */
export function SegmentProfile({ segs, height = 110, ftp }: { segs: { duration: number; powerStart: number; powerEnd: number }[]; height?: number; ftp?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  if (!segs.length) return null
  const total = segs.reduce((s, i) => s + i.duration, 0) || 1
  const maxP = Math.max(120, ...segs.flatMap((s) => [s.powerStart, s.powerEnd]))
  const totalMin = total / 60
  // watts (or %) — a RANGE for a ramp, a single value for a steady block, like intervals.
  const w = (pct: number) => (ftp ? Math.round((pct / 100) * ftp) : pct)
  const unit = ftp ? ' W' : '%'
  const range = (a: number, b: number) => { const lo = Math.min(a, b), hi = Math.max(a, b); return lo === hi ? `${w(hi)}${unit}` : `${w(lo)}–${w(hi)}${unit}` }
  const fmt = (sec: number) => { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min` }
  const step = totalMin <= 20 ? 5 : totalMin <= 75 ? 15 : 30
  const ticks: number[] = []
  for (let m = 0; m <= totalMin + 0.01; m += step) ticks.push(m)
  let acc = 0
  const starts = segs.map((s) => { const st = acc; acc += s.duration; return st })
  const W = 1000 // viewBox width; SVG stretches to the container, preserveAspectRatio none
  const x = (t: number) => (t / total) * W
  const y = (pct: number) => height - (pct / maxP) * height
  const selSeg = sel != null ? segs[sel] : null
  return (
    <div>
      <div className="profile" style={{ height, position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <line x1={0} y1={y(100)} x2={W} y2={y(100)} stroke="rgba(255,255,255,.22)" strokeDasharray="6 4" />
          {segs.map((s, idx) => {
            const x0 = x(starts[idx]), x1 = x(starts[idx] + s.duration)
            const c = zoneColor(Math.max(s.powerStart, s.powerEnd))
            return (
              <polygon key={idx} points={`${x0},${height} ${x0},${y(s.powerStart)} ${x1},${y(s.powerEnd)} ${x1},${height}`}
                fill={c} fillOpacity={sel === idx ? 0.95 : 0.7} stroke={c} strokeWidth={sel === idx ? 2 : 1} strokeLinejoin="round" style={{ cursor: 'pointer' }}
                onClick={() => setSel(sel === idx ? null : idx)} />
            )
          })}
        </svg>
        <span style={{ position: 'absolute', right: 2, top: `${(1 - 100 / maxP) * 100}%`, transform: 'translateY(-100%)', fontSize: 9, color: 'rgba(255,255,255,.45)' }}>FTP{ftp ? ` ${ftp}W` : ''}</span>
        {/* watt-range labels at each segment's peak, when it changes from the previous block */}
        {segs.map((s, idx) => {
          const peak = Math.max(s.powerStart, s.powerEnd)
          const changed = idx === 0 || Math.max(segs[idx - 1].powerStart, segs[idx - 1].powerEnd) !== peak
          if (!changed || (s.duration / total) < 0.06) return null
          const midPct = ((starts[idx] + s.duration / 2) / total) * 100
          return <span key={idx} className="profile-lbl" style={{ position: 'absolute', left: `${midPct}%`, top: `${(1 - peak / maxP) * 100}%`, transform: 'translate(-50%,-115%)' }}>{range(s.powerStart, s.powerEnd)}</span>
        })}
      </div>
      <div style={{ position: 'relative', height: 13, marginTop: 3 }}>
        {ticks.map((m) => (
          <span key={m} style={{ position: 'absolute', left: `${Math.min(100, (m / totalMin) * 100)}%`, transform: m === 0 ? 'none' : 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,.4)' }}>{m}m</span>
        ))}
      </div>
      {selSeg ? (
        <p className="meta" style={{ whiteSpace: 'normal', marginTop: 6 }}>
          <b>{fmt(starts[sel!])}–{fmt(starts[sel!] + selSeg.duration)}</b> · {fmt(selSeg.duration)} · {range(selSeg.powerStart, selSeg.powerEnd)}{ftp ? ` · ${Math.min(selSeg.powerStart, selSeg.powerEnd)}–${Math.max(selSeg.powerStart, selSeg.powerEnd)}% FTP` : ''} · {zoneName(Math.max(selSeg.powerStart, selSeg.powerEnd))}
        </p>
      ) : (
        <p className="meta" style={{ marginTop: 6 }}>Tap a block for its target & timing.</p>
      )}
    </div>
  )
}

/** Completed-activity summary (clones intervals.icu's minimum info): indoor/outdoor
 * badge + duration · distance · avg HR · avg power · Load (TSS) · RPE. */
export function DoneStats({ a }: { a: IcuActivity }) {
  const isRideRun = /ride|run/i.test(a.type) && !/weight/i.test(a.type)
  // each chip carries a metric color (intervals-style) so it reads at a glance (#58)
  const parts: [string, string][] = [
    a.moving_time ? [`⏱ ${Math.round(a.moving_time / 60)} min`, 'time'] : null,
    a.distance ? [`📍 ${(a.distance / 1000).toFixed(1)} km`, 'dist'] : null,
    a.average_heartrate ? [`❤️ ${Math.round(a.average_heartrate)} bpm`, 'hr'] : null,
    a.icu_average_watts ? [`⚡ ${Math.round(a.icu_average_watts)} W`, 'pwr'] : null,
    a.icu_training_load ? [`🔥 ${a.icu_training_load} TSS`, 'load'] : null,
    a.icu_rpe ? [`😊 RPE ${a.icu_rpe}`, 'rpe'] : null,
  ].filter(Boolean) as [string, string][]
  return (
    <div className="done-stats">
      {/* Row 1: external links (left) + the Indoor/Outdoor label — keeps row 2 free for metrics (#60). */}
      <div className="done-row done-row--labels">
        {isRideRun && a.id && <Link className="done-link done-link--map" to={`/activity/${a.id}`} onClick={(e) => e.stopPropagation()}>🗺 Map & flyby →</Link>}
        {a.id && <span className="done-link" role="link" tabIndex={0} onClick={(e) => openExt(e, `https://intervals.icu/activities/${a.id}`)}>intervals ↗</span>}
        {a.strava_id && <span className="done-link" role="link" tabIndex={0} onClick={(e) => openExt(e, `https://www.strava.com/activities/${a.strava_id}`)}>Strava ↗</span>}
        <span className="done-badge">
          <Check size={11} />
          {isRideRun ? (isIndoorActivity(a) ? <><Home size={11} /> Indoor</> : <><Mountain size={11} /> Outdoor</>) : 'Done'}
        </span>
      </div>
      {/* Row 2: the metric chips, on their own line. */}
      <div className="done-row done-row--chips">
        {parts.map(([txt, kind], i) => <span key={i} className={`done-stat done-stat--${kind}`}>{txt}</span>)}
      </div>
    </div>
  )
}
// Open an external link from inside a clickable card without triggering the card.
function openExt(e: ReactMouseEvent, url: string) { e.preventDefault(); e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer') }

/** Tiny non-interactive workout profile for card thumbnails — true shape (ramps slope),
 *  zone-coloured, so the thumbnail matches the detail chart + intervals (#217 follow-up). */
export function MiniProfile({ segs }: { segs: { duration: number; powerStart: number; powerEnd: number }[] }) {
  if (!segs?.length) return null
  const total = segs.reduce((s, x) => s + x.duration, 0) || 1
  const maxP = Math.max(100, ...segs.flatMap((s) => [s.powerStart, s.powerEnd]))
  const H = 40, W = 100
  let acc = 0
  const starts = segs.map((s) => { const st = acc; acc += s.duration; return st })
  const x = (t: number) => (t / total) * W
  const y = (pct: number) => H - Math.max(0.14, pct / maxP) * H
  return (
    <svg className="thumb-profile" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {segs.map((s, i) => {
        const x0 = x(starts[i]), x1 = x(starts[i] + s.duration), c = zoneColor(segPower(s))
        return <polygon key={i} points={`${x0},${H} ${x0},${y(s.powerStart)} ${x1},${y(s.powerEnd)} ${x1},${H}`} fill={c} fillOpacity={0.85} />
      })}
    </svg>
  )
}

export function IntervalProfile({ w, height = 110 }: { w: EnduranceWorkout; height?: number }) {
  const ivs = flattenIntervals(w)
  const total = ivs.reduce((s, i) => s + (i.duration || 0), 0) || 1
  const maxP = Math.max(120, ...ivs.map((i) => i.rawPower || 0))
  const ftpY = (100 / maxP) * 100
  return (
    <div className="profile" style={{ height, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}>
      {/* FTP (100%) reference line */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${ftpY}%`, borderTop: '1px dashed rgba(255,255,255,.22)', pointerEvents: 'none' }} />
      <span style={{ position: 'absolute', right: 2, bottom: `calc(${ftpY}% + 2px)`, fontSize: 9, color: 'rgba(255,255,255,.45)' }}>FTP</span>
      {ivs.map((iv, idx) => {
        const showVal = idx === 0 || ivs[idx - 1].rawPower !== iv.rawPower
        return (
          <div key={idx} title={`${Math.round(iv.duration)}s @ ${iv.rawPower}%${iv.power ? ` (${iv.power}W)` : ''}`}
            style={{ position: 'relative', flexGrow: iv.duration / total, flexBasis: 0, height: `${Math.max(6, ((iv.rawPower || 0) / maxP) * 100)}%`, background: zoneColor(iv.rawPower || 0), borderRadius: '2px 2px 0 0' }}>
            {showVal && <span className="profile-lbl">{iv.rawPower}%</span>}
          </div>
        )
      })}
    </div>
  )
}

export const sportIcon: Record<string, ReactNode> = { cycling: <Bike size={16} style={{ verticalAlign: '-3px' }} />, running: <Footprints size={16} style={{ verticalAlign: '-3px' }} /> }

export function EnduranceCard({ w }: { w: EnduranceWorkout }) {
  return (
    <Link to={`/cycle/${w.id}`} className="card">
      <div className="card-row" style={{ alignItems: 'stretch' }}>
        <div className="card-body">
          <h3>{w.name}</h3>
          <div className="meta">
            <span>{sportIcon[w.sport]} {w.duration} min</span>
            <span className="dot">{w.category}</span>
            <span className="dot">{computeTSS(w)} TSS</span>
          </div>
          <div style={{ marginTop: 10 }}><IntervalProfile w={w} height={44} /></div>
        </div>
      </div>
    </Link>
  )
}
