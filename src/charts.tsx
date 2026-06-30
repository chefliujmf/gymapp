import { useId, useState } from 'react'

export type Series = { label: string; color: string; data: (number | null)[]; area?: boolean; dash?: boolean }

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
const range = (series: Series[]) => {
  const all = series.flatMap((s) => s.data.filter((v): v is number => v != null))
  if (!all.length) return null
  let min = Math.min(...all), max = Math.max(...all)
  if (min === max) { min -= 1; max += 1 }
  return { min, max }
}

/** Smooth multi-series line chart: gradient area, draw-in animation, and tap/hover
 * scrubbing with a tooltip. Responsive (stretches to width). */
export function TrendChart({ series, labels, height = 150, pad = 10, unit = '', fmt, axes = false, onHover, bands, cursor }: { series: Series[]; labels?: string[]; height?: number; pad?: number; unit?: string; fmt?: (v: number) => string; axes?: boolean; onHover?: (i: number | null) => void; bands?: { from: number; to: number; color: string }[]; cursor?: number | null }) {
  const uid = useId()
  const [hi_, setHi] = useState<number | null>(null)
  // `cursor` makes the chart CONTROLLED — used to sync several stacked charts to one
  // scrubber (#54). When omitted, the chart tracks its own hover.
  const ctrl = cursor !== undefined
  const hi = ctrl ? cursor : hi_
  const r = range(series)
  if (!r) return <div className="chart-empty">No data yet</div>
  const H = height
  const n = Math.max(...series.map((s) => s.data.length), 1)
  const nice = axes ? niceTicks(r.min, r.max) : null
  const dMin = nice ? nice.min : r.min, dMax = nice ? nice.max : r.max
  const P = axes ? 1 : pad
  const x = (i: number) => P + (i / Math.max(1, n - 1)) * (VW - 2 * P)
  const y = (v: number) => P + (1 - (v - dMin) / ((dMax - dMin) || 1)) * (H - 2 * P)
  const fv = (v: number) => (fmt ? fmt(v) : `${Math.round(v * 10) / 10}${unit}`)
  const setH = (i: number | null) => { if (!ctrl) setHi(i); onHover?.(i) }
  const onMove = (e: React.PointerEvent) => { const rect = e.currentTarget.getBoundingClientRect(); const fx = (e.clientX - rect.left) / rect.width; setH(Math.max(0, Math.min(n - 1, Math.round(fx * (n - 1))))) }
  const hx = hi != null ? (hi / Math.max(1, n - 1)) * 100 : 0
  const gridYs = nice ? nice.ticks.map((v) => y(v)) : [0, 0.5, 1].map((g) => P + g * (H - 2 * P))

  const plot = (
    <div className="trend-wrap chart2__plot" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setH(null)}>
      <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
        {bands?.map((b, bi) => {
          const top = y(Math.min(dMax, b.to)), bot = y(Math.max(dMin, b.from))
          const yy = Math.min(top, bot), hh = Math.abs(bot - top)
          return hh > 0 ? <rect key={bi} x={0} width={VW} y={yy} height={hh} fill={b.color} opacity={0.14} /> : null
        })}
        {gridYs.map((yy, gi) => <line key={gi} x1={0} x2={VW} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="0.5" opacity="0.4" />)}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => (v == null ? null : [x(i), y(v)] as [number, number])).filter(Boolean) as [number, number][]
          if (!pts.length) return null
          const path = smoothPath(pts)
          const last = pts[pts.length - 1]
          return (
            <g key={si}>
              {s.area && (
                <>
                  <defs><linearGradient id={`${uid}-${si}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity="0.3" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
                  <path d={`${path} L${last[0]},${H - P} L${pts[0][0]},${H - P} Z`} fill={`url(#${uid}-${si})`} />
                </>
              )}
              <path className={s.dash ? undefined : 'trend-line'} pathLength={1} d={path} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '4 4' : undefined} strokeOpacity={s.dash ? 0.75 : 1} vectorEffect="non-scaling-stroke" />
              {!s.dash && <circle cx={last[0]} cy={last[1]} r="3" fill={s.color} vectorEffect="non-scaling-stroke" />}
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
  const yTicks = nice ? nice.ticks.map((v) => ({ f: (dMax - v) / ((dMax - dMin) || 1), v })) : []
  const xTicks = labels ? [0, 0.25, 0.5, 0.75, 1].map((f) => labels[Math.round(f * (n - 1))] || '') : []
  return (
    <div className="chart2">
      <div className="chart2__y">{yTicks.map((t, i) => <span key={i} style={{ top: `${t.f * 100}%` }}>{fv(t.v)}</span>)}</div>
      {plot}
      {xTicks.length > 0 && <div className="chart2__x">{xTicks.map((d, i) => <span key={i}>{d}</span>)}</div>}
    </div>
  )
}

/** Fullscreen overlay to view a chart in detail. */
export function ChartModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="chart-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="chart-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal__head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  )
}

const DUR_TICKS: [number, string][] = [[1, '1s'], [5, '5s'], [15, '15s'], [60, '1m'], [300, '5m'], [1200, '20m'], [3600, '1h'], [10800, '3h']]
/** Mean-max curve on a LOG duration axis (power-duration curve). Tick labels render as
 * HTML below (avoids text distortion from the stretch-to-width SVG). */
export function PowerCurveChart({ secs, watts, color = 'var(--accent, #34e07d)', height = 200 }: { secs: number[]; watts: number[]; color?: string; height?: number }) {
  const pts0 = secs.map((s, i) => [s, watts[i]] as [number, number]).filter(([s, w]) => s > 0 && w != null)
  if (pts0.length < 2) return <div className="chart-empty">No power curve yet</div>
  const sMin = Math.min(...pts0.map((p) => p[0])), sMax = Math.max(...pts0.map((p) => p[0]))
  const vMax = Math.max(...pts0.map((p) => p[1]))
  const H = height, padT = 8, padB = 6, pad = 6
  const lx = (s: number) => pad + ((Math.log(s) - Math.log(sMin)) / (Math.log(sMax) - Math.log(sMin))) * (VW - 2 * pad)
  const y = (v: number) => padT + (1 - v / vMax) * (H - padT - padB)
  const ticks = DUR_TICKS.filter(([s]) => s >= sMin && s <= sMax)
  const d = 'M' + pts0.map((p) => `${lx(p[0])},${y(p[1])}`).join(' L')
  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
        {ticks.map(([s]) => <line key={s} x1={lx(s)} x2={lx(s)} y1={padT} y2={H - padB} stroke="var(--line)" strokeWidth="0.5" opacity="0.4" />)}
        <defs><linearGradient id="pc-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={`${d} L${lx(pts0[pts0.length - 1][0])},${H - padB} L${lx(pts0[0][0])},${H - padB} Z`} fill="url(#pc-fill)" />
        <path className="trend-line" pathLength={1} d={d} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="curve-axis">{ticks.map(([s, label]) => <span key={s} style={{ left: `${(lx(s) / VW) * 100}%` }}>{label}</span>)}</div>
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
