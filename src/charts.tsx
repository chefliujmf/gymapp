import { useId } from 'react'

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

/** Smooth multi-series line chart with optional gradient area fill. Responsive (stretches to width). */
export function TrendChart({ series, height = 150, pad = 10 }: { series: Series[]; height?: number; pad?: number }) {
  const uid = useId()
  const r = range(series)
  if (!r) return <div className="chart-empty">No data yet</div>
  const H = height
  const n = Math.max(...series.map((s) => s.data.length), 1)
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (VW - 2 * pad)
  const y = (v: number) => pad + (1 - (v - r.min) / (r.max - r.min)) * (H - 2 * pad)
  return (
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
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={last[0]} cy={last[1]} r="3" fill={s.color} vectorEffect="non-scaling-stroke" />
          </g>
        )
      })}
    </svg>
  )
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
