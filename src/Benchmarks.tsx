import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi, type IcuAthletePull } from './auth/api'
import { estimateVo2max, fmtPace, parsePace } from './running-paces'

// #228 — shared editable benchmark snapshot. Used at the TOP of Stats (global) AND in Profile, so
// the athlete's benchmarks lead the analytics and are editable in BOTH (JM 2026-06-30). Synced
// fields (FTP/maxHR/pace/weight) come from intervals; sleep need + VO₂max are Platyplus.
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function Cell({ label, tag, value, unit, fmt, parse, onSave, readOnly }: {
  label: string; tag?: { text: string; kind: 'you' | 'icu' | 'est' }; value: number | null; unit?: string
  fmt: (v: number) => string; parse?: (s: string) => number | null; onSave?: (v: number) => void; readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [txt, setTxt] = useState(value != null ? fmt(value) : '')
  useEffect(() => { setTxt(value != null ? fmt(value) : '') }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    setEditing(false)
    if (!parse || !onSave) return
    const v = parse(txt.trim())
    if (v != null && v !== value) onSave(v)
    else setTxt(value != null ? fmt(value) : '')
  }
  return (
    <div className="bm-cell">
      <div className="bm-cell__l">{label}{tag && <span className={`bm-tag bm-tag--${tag.kind}`}>{tag.text}</span>}</div>
      {editing && !readOnly ? (
        <input className="bm-cell__in" autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit() }} />
      ) : (
        <button className="bm-cell__v" disabled={readOnly} onClick={() => setEditing(true)}>{value != null ? fmt(value) : '—'}{value != null && unit ? <span className="bm-cell__u">{unit}</span> : null}</button>
      )}
    </div>
  )
}

export function BenchmarksCard({ showTrendsLink = false }: { showTrendsLink?: boolean }) {
  const { user, refresh } = useAuth()
  const [pull, setPull] = useState<IcuAthletePull | null>(null)
  const connected = !!user?.hasIcuKey
  useEffect(() => { if (connected) authApi.pullIcuAthlete().then(setPull).catch(() => {}) }, [connected])

  const ss = pull?.sportSettings || {}
  const ftp = ss.cycling?.ftp ?? user?.ftp ?? null
  const maxHr = ss.cycling?.maxHr ?? user?.maxHR ?? null
  const pace = ss.running?.thresholdPace ?? user?.runThresholdPace ?? null
  const weight = pull?.weight ?? null
  const vdot = user?.runVdot ?? null
  const vo2est = estimateVo2max({ ftp, weightKg: weight, vdot })
  const vo2 = user?.vo2max ?? (vo2est ? vo2est.value : null)
  const icuTag = (v: number | null) => connected ? (v != null ? { text: 'intervals', kind: 'icu' as const } : { text: 'set it', kind: 'you' as const }) : undefined

  const saveProfile = (patch: Record<string, number>) => authApi.saveProfile(patch).then(() => refresh()).catch(() => {})
  const saveSport = (group: 'cycling' | 'running', patch: Record<string, number>) => authApi.saveSportStat({ group, ...patch }).then(() => refresh()).catch(() => {})

  return (
    <div className="card bm-card">
      <div className="bm-card__h"><h3>Your benchmarks</h3>{connected && <span className="sync-pill">⇄ intervals</span>}</div>
      <div className="bm-grid">
        <Cell label="VO₂max" tag={{ text: user?.vo2max ? 'you' : 'est.', kind: user?.vo2max ? 'you' : 'est' }} value={vo2} fmt={String} parse={(s) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, 20, 95) : null }} onSave={(v) => saveProfile({ vo2max: v })} />
        <Cell label="FTP" unit="W" tag={icuTag(ftp)} value={ftp} fmt={String} parse={(s) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, 50, 600) : null }} onSave={(v) => saveSport('cycling', { ftp: v })} />
        <Cell label="Pace" unit="/km" tag={icuTag(pace)} value={pace} fmt={fmtPace} parse={parsePace} onSave={(v) => saveSport('running', { thresholdPace: v })} />
        <Cell label="Max HR" unit="bpm" tag={icuTag(maxHr)} value={maxHr} fmt={String} parse={(s) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, 120, 230) : null }} onSave={(v) => saveSport('cycling', { maxHr: v })} />
        <Cell label="Weight" unit="kg" tag={connected ? { text: 'intervals', kind: 'icu' } : undefined} value={weight} fmt={String} readOnly />
        <Cell label="Sleep need" unit="h" tag={{ text: user?.sleepNeed ? 'you' : 'default', kind: 'you' }} value={user?.sleepNeed ?? 8} fmt={String} parse={(s) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, 4, 12) : null }} onSave={(v) => saveProfile({ sleepNeed: v })} />
      </div>
      {showTrendsLink && <Link to="/stats" className="bm-trends">See trends &amp; race predictions in Stats ›</Link>}
    </div>
  )
}
