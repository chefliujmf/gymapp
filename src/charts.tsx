import { useEffect, useId, useState } from 'react'
import { zoneColor, zoneName, segPower } from './zones'

export type Series = { label: string; color: string; data: (number | null)[]; area?: boolean; dash?: boolean; faint?: boolean }

/** #286 — a completed activity's shape as zone-coloured bars, binned from the REAL power
 *  stream (not the planned segments, which can be degenerate/0 W). Used for the card + detail
 *  thumbnail so a done ride always reads correctly. Falls back to null if there's no power. */
export function PowerBlocks({ watts, ftp = 260, bins = 9 }: { watts?: (number | null)[]; ftp?: number; bins?: number }) {
  const w = (watts || []).map((v) => (v == null ? 0 : Number(v)))
  const real = w.filter((v) => v > 0)
  if (real.length < bins) return null
  const per = Math.floor(w.length / bins)
  const avgs: number[] = []
  for (let b = 0; b < bins; b++) { let s = 0, c = 0; for (let i = b * per; i < (b + 1) * per && i < w.length; i++) { s += w[i]; c++ } avgs.push(c ? s / c : 0) }
  const mx = Math.max(...avgs) || 1
  return (
    <div className="pblocks">
      {avgs.map((v, i) => <i key={i} style={{ height: `${Math.max(10, (v / mx) * 100)}%`, background: zoneColor((v / ftp) * 100) }} />)}
    </div>
  )
}

/** A tappable ⓘ that reveals a short plain-language explanation (popover).
 * Tap to open, tap away / blur to dismiss (mobile-friendly, keyboard-focusable). */
export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="infodot-wrap">
      <button type="button" className="infodot" aria-label="What is this?" aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}>i</button>
      {open && <span className="infodot-pop" role="tooltip">{text}</span>}
    </span>
  )
}

// Catmull-Rom → cubic bezier, for smooth (not jagged) trend lines.
function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return ''
  if (pts.length < 3) return 'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L')
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

const VW = 320
/** Round-minute x-axis marks (0m · 10m · … · h:mm) for a time-based chart of `totalSec`. #286/#280 */
export function minuteTicks(totalSec: number): { frac: number; label: string }[] {
  if (!(totalSec > 0)) return []
  const totMin = totalSec / 60, step = totMin > 60 ? 10 : totMin > 30 ? 5 : totMin > 10 ? 2 : 1, out: { frac: number; label: string }[] = []
  for (let m = 0; m <= totMin + 0.01; m += step) out.push({ frac: Math.min(1, (m * 60) / totalSec), label: m >= 60 ? `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}` : `${m}m` })
  return out
}
/** Round axis bounds + ticks (1/2/5/10 ×10ⁿ steps) — clean numbers like 0,25,50. */
function niceTicks(min: number, max: number, count = 5): { min: number; max: number; ticks: number[] } {
  if (!isFinite(min) || !isFinite(max) || min === max) { const m = isFinite(min) ? min : 0; return { min: m - 1, max: m + 1, ticks: [m - 1, m, m + 1] } }
  const rawStep = (max - min) / (count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const nMin = Math.floor(min / step) * step
  const nMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = nMin; v <= nMax + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { min: nMin, max: nMax, ticks }
}
const range = (series: Series[], minSpan?: number) => {
  const all = series.flatMap((s) => s.data.filter((v): v is number => v != null))
  if (!all.length) return null
  let min = Math.min(...all), max = Math.max(...all)
  if (min === max) { min -= 1; max += 1 }
  // #344 — enforce a MINIMUM data span so a near-flat series (e.g. a recovery run at 73–75%) isn't
  // stretched to fill the whole height (which made a 2% spread look like a cliff + collapsed the axis
  // labels). Expand symmetrically around the centre; a genuinely varied workout keeps its real range.
  if (minSpan && max - min < minSpan) { const c = (min + max) / 2; min = c - minSpan / 2; max = c + minSpan / 2 }
  return { min, max }
}

/** Smooth multi-series line chart: gradient area, draw-in animation, and tap/hover
 * scrubbing with a tooltip. Responsive (stretches to width). */
export function TrendChart({ series, labels, height = 150, pad = 10, unit = '', fmt, axes = false, onHover, bands, cursor, xTicks, straight = false, minSpan, invert = false, today }: { series: Series[]; labels?: string[]; height?: number; pad?: number; unit?: string; fmt?: (v: number) => string; axes?: boolean; onHover?: (i: number | null) => void; bands?: { from: number; to: number; color: string }[]; cursor?: number | null; xTicks?: { frac: number; label: string }[]; straight?: boolean; minSpan?: number; invert?: boolean; today?: number }) {
  const uid = useId()
  const [hi_, setHi] = useState<number | null>(null)
  // `cursor` makes the chart CONTROLLED — used to sync several stacked charts to one
  // scrubber (#54). When omitted, the chart tracks its own hover.
  const ctrl = cursor !== undefined
  const hi = ctrl ? cursor : hi_
  const r = range(series, minSpan)
  if (!r) return <div className="chart-empty">No data yet</div>
  const H = height
  const n = Math.max(...series.map((s) => s.data.length), 1)
  // #286: tick DENSITY scales with height — a tall chart gets ~8-9 gridlines (readable
  // precision), a small sparkline stays clean. Fixes "not enough Y ticks" across the app.
  const yCount = Math.max(3, Math.min(10, Math.round(H / 22)))
  const nice = axes ? niceTicks(r.min, r.max, yCount) : null
  const dMin = nice ? nice.min : r.min, dMax = nice ? nice.max : r.max
  const P = axes ? 1 : pad
  const x = (i: number) => P + (i / Math.max(1, n - 1)) * (VW - 2 * P)
  // invert (#333): put the SMALLEST value at the top — for pace (min/km), faster = up, matching the pace curve.
  const y = (v: number) => P + (invert ? (v - dMin) / ((dMax - dMin) || 1) : 1 - (v - dMin) / ((dMax - dMin) || 1)) * (H - 2 * P)
  const fv = (v: number) => (fmt ? fmt(v) : `${Math.round(v * 10) / 10}${unit}`)
  const setH = (i: number | null) => { if (!ctrl) setHi(i); onHover?.(i) }
  const onMove = (e: React.PointerEvent) => { const rect = e.currentTarget.getBoundingClientRect(); const fx = (e.clientX - rect.left) / rect.width; setH(Math.max(0, Math.min(n - 1, Math.round(fx * (n - 1))))) }
  const hx = hi != null ? (hi / Math.max(1, n - 1)) * 100 : 0
  const gridYs = nice ? nice.ticks.map((v) => y(v)) : [0, 0.5, 1].map((g) => P + g * (H - 2 * P))
  // explicit x-ticks (e.g. round-minute time marks) → vertical gridlines + labels; else derive from labels
  const xt: { frac: number; label: string }[] = xTicks
    ? xTicks
    : labels ? [0, 0.25, 0.5, 0.75, 1].map((f) => ({ frac: f, label: labels[Math.round(f * (n - 1))] || '' })) : []
  const xAt = (f: number) => P + f * (VW - 2 * P)

  const plot = (
    <div className="trend-wrap chart2__plot" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setH(null)}>
      <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
        {bands?.map((b, bi) => {
          const top = y(Math.min(dMax, b.to)), bot = y(Math.max(dMin, b.from))
          const yy = Math.min(top, bot), hh = Math.abs(bot - top)
          return hh > 0 ? <rect key={bi} x={0} width={VW} y={yy} height={hh} fill={b.color} opacity={0.14} /> : null
        })}
        {gridYs.map((yy, gi) => <line key={gi} x1={0} x2={VW} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="0.5" opacity="0.4" />)}
        {axes && xt.map((t, ti) => <line key={'v' + ti} x1={xAt(t.frac)} x2={xAt(t.frac)} y1={P} y2={H - P} stroke="var(--line)" strokeWidth="0.5" opacity="0.22" />)}
        {/* #376 — a "today" divider + faint shading over the projected region, so the future is unmistakable
            even when a line (e.g. slow-moving Fitness/CTL) is nearly flat there. */}
        {today != null && today > 0 && today < 1 && <>
          <rect x={xAt(today)} width={VW - xAt(today)} y={0} height={H} fill="var(--text-dim)" opacity={0.06} />
          <line x1={xAt(today)} x2={xAt(today)} y1={P} y2={H - P} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 3" opacity={0.55} vectorEffect="non-scaling-stroke" />
        </>}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => (v == null ? null : [x(i), y(v)] as [number, number])).filter(Boolean) as [number, number][]
          if (!pts.length) return null
          // #344 — a PLANNED workout is piecewise-linear (steady blocks + ramps): draw straight segments,
          // NOT a Catmull-Rom curve, which overshoots at the step boundaries (the "needle"). Real time-series
          // (fitness/pace trends) keep smoothing.
          const path = straight ? 'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L') : smoothPath(pts)
          const last = pts[pts.length - 1]
          return (
            <g key={si}>
              {s.area && (
                <>
                  <defs><linearGradient id={`${uid}-${si}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity="0.3" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
                  <path d={`${path} L${last[0]},${H - P} L${pts[0][0]},${H - P} Z`} fill={`url(#${uid}-${si})`} />
                </>
              )}
              {/* #376/#355 — NO draw-in animation: the dash/pathLength reveal strands the line mid-draw under
                  the non-uniform SVG stretch (looked like Form/Fatigue "stopped" partway, each at a different x). Static. */}
              <path d={path} fill="none" stroke={s.color} strokeWidth={s.faint ? '1.25' : '2.25'} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '4 4' : undefined} strokeOpacity={s.dash ? 0.75 : s.faint ? 0.38 : 1} vectorEffect="non-scaling-stroke" />
              {!s.dash && !s.faint && <circle cx={last[0]} cy={last[1]} r="3" fill={s.color} vectorEffect="non-scaling-stroke" />}
              {hi != null && s.data[hi] != null && <circle cx={x(hi)} cy={y(s.data[hi] as number)} r="3.5" fill={s.color} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
            </g>
          )
        })}
        {axes && hi != null && <line x1={x(hi)} x2={x(hi)} y1={0} y2={H} stroke="var(--text-dim)" strokeWidth="0.75" opacity="0.6" vectorEffect="non-scaling-stroke" />}
      </svg>
      {axes && hi != null && (
        <div className="chart-tip" style={{ left: `${Math.max(13, Math.min(87, hx))}%` }}>
          {labels?.[hi] && <span className="chart-tip__d">{labels[hi]}</span>}
          {series.map((s, si) => s.data[hi] == null ? null : (
            <span key={si} style={{ color: s.color }}>{s.label ? s.label + ' ' : ''}{fv(s.data[hi] as number)}</span>
          ))}
        </div>
      )}
    </div>
  )
  if (!axes) return plot
  const yTicks = nice ? nice.ticks.map((v) => ({ f: (invert ? v - dMin : dMax - v) / ((dMax - dMin) || 1), v })) : []
  return (
    <div className="chart2">
      <div className="chart2__y">{yTicks.map((t, i) => <span key={i} style={{ top: `${t.f * 100}%` }}>{fv(t.v)}</span>)}</div>
      {plot}
      {xt.length > 0 && <div className="chart2__x chart2__x--abs">{xt.map((t, i) => <span key={i} style={{ left: `${t.frac * 100}%` }} className={i === 0 ? 'is-first' : i === xt.length - 1 ? 'is-last' : ''}>{t.label}</span>)}</div>}
    </div>
  )
}

/** #357 — a PLANNED ride as zone-coloured COLUMNS (intervals.icu style), NOT a single-colour ramped
 *  line. Each segment is a solid bar at its target watts, coloured by its %FTP zone (Z1 recovery →
 *  Z6). x = time (proportional to duration), y = watts. Tap a block for its target. "No ramp thing." */
export function PlannedPowerBars({ segments, ftp = 260, height = 150 }: { segments: { duration: number; powerStart: number; powerEnd: number; label?: string }[]; ftp?: number; height?: number }) {
  const [hi, setHi] = useState<number | null>(null)
  const segs = (segments || []).filter((s) => s && s.duration > 0)
  if (!segs.length) return <div className="chart-empty">No workout shape</div>
  const total = segs.reduce((a, s) => a + s.duration, 0)
  // Colour + height by the segment's PEAK % (segPower) — the same zone the thumbnails/PowerBlocks use,
  // so a segment reads the same everywhere (#72). Flat block per segment = "no ramp" (JM #357).
  const pctOf = (s: { powerStart: number; powerEnd: number }) => segPower(s)
  const wOf = (s: { powerStart: number; powerEnd: number }) => Math.round((pctOf(s) / 100) * ftp)
  const H = height, P = 1
  const nice = niceTicks(0, Math.max(...segs.map(wOf), Math.round(ftp * 1.1)), Math.max(3, Math.min(9, Math.round(H / 22))))
  const dMax = nice.max || 1
  const y = (w: number) => P + (1 - w / dMax) * (H - 2 * P)
  const xAt = (f: number) => P + f * (VW - 2 * P)
  const ticks = minuteTicks(total)
  const fmtD = (s: number) => (s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`)
  let cum = 0
  const bars = segs.map((s) => { const f0 = cum / total; cum += s.duration; return { f0, f1: cum / total, w: wOf(s), pct: Math.round(pctOf(s)), c: zoneColor(pctOf(s)), label: s.label, dur: s.duration } })
  const onMove = (e: React.PointerEvent) => { const rect = e.currentTarget.getBoundingClientRect(); const fx = (e.clientX - rect.left) / rect.width; const i = bars.findIndex((b) => fx >= b.f0 && fx <= b.f1); setHi(i >= 0 ? i : null) }
  return (
    <div className="chart2">
      <div className="chart2__y">{nice.ticks.map((v, i) => <span key={i} style={{ top: `${((dMax - v) / dMax) * 100}%` }}>{Math.round(v)} W</span>)}</div>
      <div className="trend-wrap chart2__plot" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
          {nice.ticks.map((v, i) => <line key={'h' + i} x1={0} x2={VW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="0.5" opacity="0.4" />)}
          {bars.map((b, i) => {
            const x0 = xAt(b.f0), x1 = xAt(b.f1), yt = y(b.w), w = Math.max(0.4, x1 - x0)
            return (
              <g key={i}>
                <rect x={x0} y={yt} width={w} height={Math.max(0, (H - P) - yt)} fill={b.c} fillOpacity={hi == null || hi === i ? 0.9 : 0.55} />
                <rect x={x0} y={yt} width={w} height="2.2" fill={b.c} />
              </g>
            )
          })}
        </svg>
        {hi != null && bars[hi] && (
          <div className="chart-tip" style={{ left: `${Math.max(13, Math.min(87, ((bars[hi].f0 + bars[hi].f1) / 2) * 100))}%` }}>
            <span className="chart-tip__d">{bars[hi].label || zoneName(bars[hi].pct)} · {fmtD(bars[hi].dur)}</span>
            <span style={{ color: bars[hi].c }}>{bars[hi].w} W · {bars[hi].pct}%</span>
          </div>
        )}
      </div>
      {ticks.length > 0 && <div className="chart2__x chart2__x--abs">{ticks.map((t, i) => <span key={i} style={{ left: `${t.frac * 100}%` }} className={i === 0 ? 'is-first' : i === ticks.length - 1 ? 'is-last' : ''}>{t.label}</span>)}</div>}
    </div>
  )
}

/** Fullscreen overlay to view a chart in detail. Close via ✕, tap-outside, or Escape.
 * Body scroll is locked while open so the page behind doesn't move (mobile). */
export function ChartModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="chart-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="chart-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal__head"><h3>{title}</h3><button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  )
}

const DUR_TICKS: [number, string][] = [[1, '1s'], [5, '5s'], [15, '15s'], [60, '1m'], [300, '5m'], [1200, '20m'], [3600, '1h'], [10800, '3h']]
const MAX_DUR = DUR_TICKS[DUR_TICKS.length - 1][0] // #292 — power/pace curves cap at the last axis tick (3h) so the domain matches the ticks (no 5h hover past a 3h axis)
/** Mean-max curve on a LOG duration axis (power-duration curve). Tick labels render as
 * HTML below (avoids text distortion from the stretch-to-width SVG). */
export function PowerCurveChart({ secs, watts, color = 'var(--accent, #34e07d)', height = 200, overlay }: { secs: number[]; watts: number[]; color?: string; height?: number; overlay?: { secs: number[]; watts: number[]; color?: string } | null }) {
  const [hi, setHi] = useState<number | null>(null) // #292: hover scrubber, consistent with the timeline
  const pts0 = secs.map((s, i) => [s, watts[i]] as [number, number]).filter(([s, w]) => s > 0 && s <= MAX_DUR && w != null)
  if (pts0.length < 2) return <div className="chart-empty">No power curve yet</div>
  // #407 — optional 2nd-season OVERLAY (drawn behind the main line). Axes fit both curves.
  const ov0 = overlay ? overlay.secs.map((s, i) => [s, overlay.watts[i]] as [number, number]).filter(([s, w]) => s > 0 && s <= MAX_DUR && w != null) : []
  const allPts = ov0.length ? pts0.concat(ov0) : pts0
  const sMin = Math.min(...allPts.map((p) => p[0])), sMax = Math.max(...allPts.map((p) => p[0]))
  const vMax = Math.max(...allPts.map((p) => p[1]))
  const H = height, padT = 8, padB = 6, pad = 6
  const fmtS = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`)
  // chart-standard Y axis, dense (#286): ~6 clean watt gridlines; scale the path to the nice top.
  const yt = niceTicks(0, vMax, Math.max(4, Math.min(8, Math.round(H / 26))))
  const vTop = Math.max(vMax, yt.max)
  const yLabels = yt.ticks.filter((v) => v <= vTop)
  const lx = (s: number) => pad + ((Math.log(s) - Math.log(sMin)) / (Math.log(sMax) - Math.log(sMin))) * (VW - 2 * pad)
  const y = (v: number) => padT + (1 - v / vTop) * (H - padT - padB)
  const ticks = DUR_TICKS.filter(([s]) => s >= sMin && s <= sMax)
  const d = 'M' + pts0.map((p) => `${lx(p[0])},${y(p[1])}`).join(' L')
  // #292: snap to the nearest curve point under the pointer (consistent with the timeline scrubber)
  const onMove = (ev: React.PointerEvent) => {
    const rect = ev.currentTarget.getBoundingClientRect()
    const xPx = ((ev.clientX - rect.left) / rect.width) * VW
    let bi = 0, bd = Infinity
    for (let i = 0; i < pts0.length; i++) { const dd = Math.abs(lx(pts0[i][0]) - xPx); if (dd < bd) { bd = dd; bi = i } }
    setHi(bi)
  }
  const hpx = hi != null ? (lx(pts0[hi][0]) / VW) * 100 : 0
  // #292 — the compared-season (overlay) value at the hovered duration, so the tooltip shows BOTH curves' values.
  const ovColor = overlay?.color || 'var(--blue, #5aa9ff)'
  const ovHiR = (hi != null && ov0.length) ? ov0.reduce((b, p) => Math.abs(Math.log(p[0]) - Math.log(pts0[hi][0])) < Math.abs(Math.log(b[0]) - Math.log(pts0[hi][0])) ? p : b, ov0[0]) : null
  const ovHi = (ovHiR && hi != null && Math.abs(Math.log(ovHiR[0]) - Math.log(pts0[hi][0])) < Math.log(1.3)) ? ovHiR : null
  return (
    <div className="chart2">
      <div className="chart2__y">{yLabels.map((v, i) => <span key={i} style={{ top: `${(1 - v / vTop) * 100}%` }}>{Math.round(v)} W</span>)}</div>
      <div className="chart2__plot" style={{ position: 'relative' }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
          {yLabels.map((v, i) => <line key={'h' + i} x1={0} x2={VW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="0.5" opacity="0.35" />)}
          {ticks.map(([s]) => <line key={s} x1={lx(s)} x2={lx(s)} y1={padT} y2={H - padB} stroke="var(--line)" strokeWidth="0.5" opacity="0.4" />)}
          <defs><linearGradient id="pc-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${d} L${lx(pts0[pts0.length - 1][0])},${H - padB} L${lx(pts0[0][0])},${H - padB} Z`} fill="url(#pc-fill)" />
          {/* #407 — 2nd-season overlay line, drawn BEHIND the main (This-season) line */}
          {ov0.length ? <path d={'M' + ov0.map((p) => `${lx(p[0])},${y(p[1])}`).join(' L')} fill="none" stroke={overlay?.color || 'var(--blue, #5aa9ff)'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.9" /> : null}
          {/* #355 — static full line (no draw-in animation): a dash/pathLength reveal could leave the tail
              undrawn, making the curve look like it "stops" partway. Always render the whole curve to 1h. */}
          <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hi != null && <>
            <line x1={lx(pts0[hi][0])} x2={lx(pts0[hi][0])} y1={0} y2={H} stroke="var(--text-dim)" strokeWidth="0.75" opacity="0.6" vectorEffect="non-scaling-stroke" />
            <circle cx={lx(pts0[hi][0])} cy={y(pts0[hi][1])} r="3.5" fill={color} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {ovHi && <circle cx={lx(pts0[hi][0])} cy={y(ovHi[1])} r="3.5" fill={ovColor} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
          </>}
        </svg>
        {hi != null && (
          <div className="chart-tip" style={{ left: `${Math.max(13, Math.min(87, hpx))}%` }}>
            <span className="chart-tip__d">{fmtS(pts0[hi][0])}</span>
            <span style={{ color }}>{Math.round(pts0[hi][1])} W</span>
            {ovHi && <span style={{ color: ovColor }}>{Math.round(ovHi[1])} W</span>}
          </div>
        )}
      </div>
      <div className="chart2__x">{ticks.map(([s, label]) => <span key={s}>{label}</span>)}</div>
    </div>
  )
}
/** #333 — Best-PACE curve (running's power curve): fastest average pace sustained for each duration,
 * on a LOG duration axis. Pace is inverted (faster = higher) so the curve reads like the power curve:
 * short bursts fast at the left, easing to the right. `pace` in sec/km. */
export function PaceCurveChart({ secs, pace, color = 'var(--accent, #34e07d)', height = 200, overlay }: { secs: number[]; pace: number[]; color?: string; height?: number; overlay?: { secs: number[]; pace: number[]; color?: string } | null }) {
  const [hi, setHi] = useState<number | null>(null)
  const pts0 = secs.map((s, i) => [s, pace[i]] as [number, number]).filter(([s, p]) => s > 0 && s <= MAX_DUR && p != null && p > 0)
  if (pts0.length < 2) return <div className="chart-empty">No pace curve yet</div>
  const ov0 = overlay ? overlay.secs.map((s, i) => [s, overlay.pace[i]] as [number, number]).filter(([s, p]) => s > 0 && s <= MAX_DUR && p != null && p > 0) : [] // #407 overlay
  const allPts = ov0.length ? pts0.concat(ov0) : pts0
  const sMin = Math.min(...allPts.map((p) => p[0])), sMax = Math.max(...allPts.map((p) => p[0]))
  const pMin = Math.min(...allPts.map((p) => p[1])), pMax = Math.max(...allPts.map((p) => p[1])) // sec/km: min = fastest
  const H = height, padT = 8, padB = 6, pad = 6
  const span = Math.max(pMax - pMin, 20) // avoid a collapsed axis on a steady run
  const lo = pMin - span * 0.08, range2 = span * 1.16
  const fmtP = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const lx = (s: number) => pad + ((Math.log(s) - Math.log(sMin)) / (Math.log(sMax) - Math.log(sMin) || 1)) * (VW - 2 * pad)
  const y = (p: number) => padT + ((p - lo) / (range2 || 1)) * (H - padT - padB) // faster (smaller sec/km) → TOP
  const ticks = DUR_TICKS.filter(([s]) => s >= sMin && s <= sMax)
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * range2)
  const d = 'M' + pts0.map((p) => `${lx(p[0])},${y(p[1])}`).join(' L')
  const onMove = (ev: React.PointerEvent) => {
    const rect = ev.currentTarget.getBoundingClientRect(); const xPx = ((ev.clientX - rect.left) / rect.width) * VW
    let bi = 0, bd = Infinity
    for (let i = 0; i < pts0.length; i++) { const dd = Math.abs(lx(pts0[i][0]) - xPx); if (dd < bd) { bd = dd; bi = i } }
    setHi(bi)
  }
  const hpx = hi != null ? (lx(pts0[hi][0]) / VW) * 100 : 0
  // #292 — compared-season (overlay) value at the hovered duration, so the tooltip shows BOTH curves.
  const ovColor = overlay?.color || 'var(--blue, #5aa9ff)'
  const ovHiR = (hi != null && ov0.length) ? ov0.reduce((b, p) => Math.abs(Math.log(p[0]) - Math.log(pts0[hi][0])) < Math.abs(Math.log(b[0]) - Math.log(pts0[hi][0])) ? p : b, ov0[0]) : null
  const ovHi = (ovHiR && hi != null && Math.abs(Math.log(ovHiR[0]) - Math.log(pts0[hi][0])) < Math.log(1.3)) ? ovHiR : null
  const fmtS = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`)
  return (
    <div className="chart2">
      <div className="chart2__y">{yLabels.map((p, i) => <span key={i} style={{ top: `${((p - lo) / range2) * 100}%` }}>{fmtP(p)}</span>)}</div>
      <div className="chart2__plot" style={{ position: 'relative' }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
          {yLabels.map((p, i) => <line key={'h' + i} x1={0} x2={VW} y1={y(p)} y2={y(p)} stroke="var(--line)" strokeWidth="0.5" opacity="0.35" />)}
          {ticks.map(([s]) => <line key={s} x1={lx(s)} x2={lx(s)} y1={padT} y2={H - padB} stroke="var(--line)" strokeWidth="0.5" opacity="0.4" />)}
          <defs><linearGradient id="pace-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${d} L${lx(pts0[pts0.length - 1][0])},${H - padB} L${lx(pts0[0][0])},${H - padB} Z`} fill="url(#pace-fill)" />
          {/* #407 — 2nd-season overlay line, behind the main (This-season) pace line */}
          {ov0.length ? <path d={'M' + ov0.map((p) => `${lx(p[0])},${y(p[1])}`).join(' L')} fill="none" stroke={overlay?.color || 'var(--blue, #5aa9ff)'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.9" /> : null}
          {/* #355 — static full line (no draw-in animation): a dash/pathLength reveal could leave the tail
              undrawn, making the curve look like it "stops" partway. Always render the whole curve to 1h. */}
          <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hi != null && <>
            <line x1={lx(pts0[hi][0])} x2={lx(pts0[hi][0])} y1={0} y2={H} stroke="var(--text-dim)" strokeWidth="0.75" opacity="0.6" vectorEffect="non-scaling-stroke" />
            <circle cx={lx(pts0[hi][0])} cy={y(pts0[hi][1])} r="3.5" fill={color} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {ovHi && <circle cx={lx(pts0[hi][0])} cy={y(ovHi[1])} r="3.5" fill={ovColor} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
          </>}
        </svg>
        {hi != null && (
          <div className="chart-tip" style={{ left: `${Math.max(13, Math.min(87, hpx))}%` }}>
            <span className="chart-tip__d">{fmtS(pts0[hi][0])}</span>
            <span style={{ color }}>{fmtP(pts0[hi][1])}/km</span>
            {ovHi && <span style={{ color: ovColor }}>{fmtP(ovHi[1])}/km</span>}
          </div>
        )}
      </div>
      <div className="chart2__x">{ticks.map(([s, label]) => <span key={s}>{label}</span>)}</div>
    </div>
  )
}

/** Best watts at a target duration (nearest available sec) from a mean-max curve. */
export function bestAt(secs: number[], watts: number[], target: number): number | null {
  let bi = -1, bd = Infinity
  for (let i = 0; i < secs.length; i++) { const dd = Math.abs(secs[i] - target); if (dd < bd) { bd = dd; bi = i } }
  return bi >= 0 ? watts[bi] ?? null : null
}

/** Simple bar trend (sleep, load). */
export function BarChart({ data, color = 'var(--accent, #34e07d)', height = 110, pad = 10, onHover }: { data: (number | null)[]; color?: string; height?: number; pad?: number; onHover?: (i: number | null) => void }) {
  const [hi, setHi] = useState<number | null>(null)
  const r = range([{ label: '', color, data }])
  if (!r) return <div className="chart-empty">No data yet</div>
  const lo = Math.min(0, r.min), H = height
  const n = data.length
  const bw = (VW - 2 * pad) / Math.max(1, n)
  const y = (v: number) => pad + (1 - (v - lo) / (r.max - lo)) * (H - 2 * pad)
  const setH = (i: number | null) => { setHi(i); onHover?.(i) }
  const onMove = (e: React.PointerEvent) => { const rect = e.currentTarget.getBoundingClientRect(); const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) / rect.width) * n))); setH(i) }
  return (
    <div className="trend-wrap" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setH(null)}>
      <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
        {data.map((v, i) => v == null ? null : (
          <rect key={i} x={pad + i * bw + bw * 0.15} width={bw * 0.7} y={y(v)} height={Math.max(0, y(lo) - y(v))} rx="1.2" fill={color} opacity={hi == null || hi === i ? 0.9 : 0.38} />
        ))}
      </svg>
    </div>
  )
}
