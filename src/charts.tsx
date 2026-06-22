import { useId, useState } from 'react'

export type Series = { label: string; color: string; data: (number | null)[]; area?: boolean }

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
const range = (series: Series[]) => {
  const all = series.flatMap((s) => s.data.filter((v): v is number => v != null))
  if (!all.length) return null
  let min = Math.min(...all), max = Math.max(...all)
  if (min === max) { min -= 1; max += 1 }
  return { min, max }
}

/** Smooth multi-series line chart: gradient area, draw-in animation, and tap/hover
 * scrubbing with a tooltip. Responsive (stretches to width). */
export function TrendChart({ series, labels, height = 150, pad = 10, unit = '', fmt, axes = false }: { series: Series[]; labels?: string[]; height?: number; pad?: number; unit?: string; fmt?: (v: number) => string; axes?: boolean }) {
  const uid = useId()
  const [hi, setHi] = useState<number | null>(null)
  const r = range(series)
  if (!r) return <div className="chart-empty">No data yet</div>
  const H = height
  const n = Math.max(...series.map((s) => s.data.length), 1)
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (VW - 2 * pad)
  const y = (v: number) => pad + (1 - (v - r.min) / (r.max - r.min)) * (H - 2 * pad)
  const fv = (v: number) => (fmt ? fmt(v) : `${Math.round(v * 10) / 10}${unit}`)
  const onMove = (e: React.PointerEvent) => { const rect = e.currentTarget.getBoundingClientRect(); const fx = (e.clientX - rect.left) / rect.width; setHi(Math.max(0, Math.min(n - 1, Math.round(fx * (n - 1))))) }
  const hx = hi != null ? (hi / Math.max(1, n - 1)) * 100 : 0
  return (
    <div className="trend-box">
    <div className="trend-wrap" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHi(null)}>
      {axes && <><span className="trend-y trend-y--max">{fv(r.max)}</span><span className="trend-y trend-y--min">{fv(r.min)}</span></>}
      <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
        {[0, 0.5, 1].map((g) => { const yy = pad + g * (H - 2 * pad); return <line key={g} x1={pad} x2={VW - pad} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="0.5" opacity="0.45" /> })}
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
                  <path d={`${path} L${last[0]},${H - pad} L${pts[0][0]},${H - pad} Z`} fill={`url(#${uid}-${si})`} />
                </>
              )}
              <path className="trend-line" pathLength={1} d={path} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle cx={last[0]} cy={last[1]} r="3" fill={s.color} vectorEffect="non-scaling-stroke" />
              {hi != null && s.data[hi] != null && <circle cx={x(hi)} cy={y(s.data[hi] as number)} r="3.5" fill={s.color} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
            </g>
          )
        })}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={pad} y2={H - pad} stroke="var(--text-dim)" strokeWidth="0.75" opacity="0.6" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hi != null && (
        <div className="chart-tip" style={{ left: `${Math.max(13, Math.min(87, hx))}%` }}>
          {labels?.[hi] && <span className="chart-tip__d">{labels[hi]}</span>}
          {series.map((s, si) => s.data[hi] == null ? null : (
            <span key={si} style={{ color: s.color }}>{s.label ? s.label + ' ' : ''}{fv(s.data[hi] as number)}</span>
          ))}
        </div>
      )}
    </div>
    {axes && labels && labels.length > 1 && <div className="trend-x"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>}
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
export function BarChart({ data, color = 'var(--accent, #34e07d)', height = 110, pad = 10 }: { data: (number | null)[]; color?: string; height?: number; pad?: number }) {
  const r = range([{ label: '', color, data }])
  if (!r) return <div className="chart-empty">No data yet</div>
  const lo = Math.min(0, r.min), H = height
  const n = data.length
  const bw = (VW - 2 * pad) / Math.max(1, n)
  const y = (v: number) => pad + (1 - (v - lo) / (r.max - lo)) * (H - 2 * pad)
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="none" width="100%" height={height} className="trend">
      {data.map((v, i) => v == null ? null : (
        <rect key={i} x={pad + i * bw + bw * 0.15} width={bw * 0.7} y={y(v)} height={Math.max(0, y(lo) - y(v))} rx="1.2" fill={color} opacity="0.85" />
      ))}
    </svg>
  )
}
