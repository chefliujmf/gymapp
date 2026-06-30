import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi, type IcuAthletePull } from './auth/api'
import { fmtPace, parsePace } from './running-paces'
import { fetchWellness } from './intervals'
import { headlineVo2max, runningVo2max, cyclingVo2max, confLabel } from './vo2max-submax'

// #236 — benchmarks = MANUAL vs COMPUTED. Tiles show the in-use value; tap → a sheet with BOTH values,
// an input (editable only in Manual), and a Manual|Computed toggle. A per-stat preference (user.statPrefs)
// decides which drives; the computed value keeps updating regardless. Used in Stats + Profile.
type Pref = 'manual' | 'computed'
type Key = 'vo2max' | 'ftp' | 'thresholdPace' | 'maxHr'
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const numParse = (lo: number, hi: number) => (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, lo, hi) : null }

interface StatDef {
  key: Key; label: string; unit?: string
  computed: number | null; computedSrc: string
  manual: number | null
  fmt: (n: number) => string; parse: (s: string) => number | null
  save: (v: number) => Promise<unknown>
}

function Sheet({ def, prefer, onPref, onSaveManual, onClose }: { def: StatDef; prefer: Pref; onPref: (p: Pref) => void; onSaveManual: (v: number | null) => void; onClose: () => void }) {
  const [p, setP] = useState<Pref>(prefer)
  const [txt, setTxt] = useState(def.manual != null ? def.fmt(def.manual) : '')
  const commit = () => {
    // #247: the input is always editable — typing saves your manual value regardless of mode; the
    // toggle just picks which one DRIVES. (Was locked on Computed — JM wanted to type a value anytime.)
    const v = txt.trim() ? def.parse(txt.trim()) : null
    if (v !== def.manual) onSaveManual(v)
    onPref(p)
    onClose()
  }
  return (
    <div className="bsheet__scrim" onClick={onClose}>
      <div className="bsheet" onClick={(e) => e.stopPropagation()}>
        <div className="bsheet__h"><h3>{def.label}</h3><button className="bsheet__x" onClick={onClose}>✕</button></div>
        <div className="bsheet__two">
          <div className={'bsheet__opt' + (p === 'computed' ? ' on' : '')}><div className="bsheet__ol">Computed</div><div className="bsheet__ov" style={{ color: '#5ec8ff' }}>{def.computed != null ? def.fmt(def.computed) : '—'}</div><div className="bsheet__os">{def.computed != null ? def.computedSrc : 'not available yet'}</div></div>
          <div className={'bsheet__opt' + (p === 'manual' ? ' on' : '')}><div className="bsheet__ol">Manual</div><div className="bsheet__ov" style={{ color: '#9b8cff' }}>{def.manual != null ? def.fmt(def.manual) : '—'}</div><div className="bsheet__os">your value</div></div>
        </div>
        <div className="bsheet__lbl">Set your value{p === 'computed' ? ' (saved; switch to Manual to use it)' : ''}</div>
        <input className="bsheet__in" value={txt} placeholder={def.computed != null ? def.fmt(def.computed) : 'enter a value'} onChange={(e) => setTxt(e.target.value)} />
        <div className="bsheet__lbl">Use which?</div>
        <div className="bseg">
          <button className={p === 'manual' ? 'on' : ''} onClick={() => setP('manual')} disabled={false}>Manual</button>
          <button className={p === 'computed' ? 'on' : ''} onClick={() => setP('computed')} disabled={def.computed == null}>Computed</button>
        </div>
        <button className="bsheet__save" onClick={commit}>Done</button>
      </div>
    </div>
  )
}

export function BenchmarksCard({ showTrendsLink = false }: { showTrendsLink?: boolean }) {
  const { user, refresh } = useAuth()
  const [pull, setPull] = useState<IcuAthletePull | null>(null)
  const [hrRest, setHrRest] = useState<number | null>(null)
  const [eftp, setEftp] = useState<number | null>(null)
  const [paceEst, setPaceEst] = useState<number | null>(null)
  const [open, setOpen] = useState<Key | null>(null)
  const connected = !!user?.hasIcuKey

  useEffect(() => {
    if (!connected) return
    authApi.pullIcuAthlete().then(setPull).catch(() => {})
    authApi.runEstimate().then((r) => { if (r.available && r.thresholdPace) setPaceEst(r.thresholdPace) }).catch(() => {})
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    fetchWellness(from, to).then((rows) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { setHrRest(rows[i].restingHR); break }
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].eftp != null) { setEftp(rows[i].eftp as number); break }
    }).catch(() => {})
  }, [connected])

  const ss = pull?.sportSettings || {}
  const ftpManual = ss.cycling?.ftp ?? user?.ftp ?? null
  const maxHr = ss.cycling?.maxHr ?? user?.maxHR ?? null
  const paceManual = ss.running?.thresholdPace ?? user?.runThresholdPace ?? null
  const weight = pull?.weight ?? null
  const vdot = user?.runVdot ?? null
  // computed VO₂max (best per-sport submax estimate; pass null manual so we get the pure estimate)
  const vo2head = headlineVo2max(null, [
    { sport: 'running', est: runningVo2max({ vdot, hrMax: maxHr, hrRest }) },
    { sport: 'cycling', est: cyclingVo2max({ ftp: ftpManual, weightKg: weight, hrMax: maxHr, hrRest }) },
  ])

  const saveSport = (group: 'cycling' | 'running', patch: Record<string, number | null>) => authApi.saveSportStat({ group, ...patch }).then(() => refresh())
  const defs: StatDef[] = [
    { key: 'vo2max', label: 'VO₂max', computed: vo2head ? vo2head.value : null, computedSrc: vo2head ? `${confLabel(vo2head.confidence)} · ${vo2head.source}` : '', manual: user?.vo2max ?? null, fmt: String, parse: numParse(20, 95), save: (v) => authApi.saveProfile({ vo2max: v }).then(() => refresh()) },
    { key: 'ftp', label: 'FTP', unit: 'W', computed: eftp, computedSrc: 'eFTP from your power', manual: ftpManual, fmt: String, parse: numParse(50, 600), save: (v) => saveSport('cycling', { ftp: v }) },
    { key: 'thresholdPace', label: 'Threshold pace', unit: '/km', computed: paceEst, computedSrc: 'from your recent runs', manual: paceManual, fmt: fmtPace, parse: parsePace, save: (v) => saveSport('running', { thresholdPace: v }) },
    { key: 'maxHr', label: 'Max HR', unit: 'bpm', computed: null, computedSrc: '', manual: maxHr, fmt: String, parse: numParse(120, 230), save: (v) => saveSport('cycling', { maxHr: v }) },
  ]
  const prefOf = (d: StatDef): Pref => user?.statPrefs?.[d.key] ?? (d.manual != null ? 'manual' : 'computed')
  const inUse = (d: StatDef): number | null => { const p = prefOf(d); return (p === 'computed' && d.computed != null) ? d.computed : d.manual ?? d.computed }
  const openDef = defs.find((d) => d.key === open)

  return (
    <div className="card bm-card">
      <div className="bm-card__h"><h3>Your benchmarks</h3>{connected && <span className="sync-pill">⇄ intervals</span>}</div>
      <div className="bm-grid">
        {defs.map((d) => {
          const v = inUse(d), p = prefOf(d)
          return (
            <button key={d.key} className="bm-cell bm-cell--tap" onClick={() => setOpen(d.key)}>
              <div className="bm-cell__l">{d.label}<span className={`bm-tag bm-tag--${p === 'manual' ? 'you' : 'icu'}`}>{p === 'manual' ? 'manual' : 'computed'}</span></div>
              <div className="bm-cell__v">{v != null ? d.fmt(v) : '—'}{v != null && d.unit ? <span className="bm-cell__u">{d.unit}</span> : null}</div>
              <div className="bm-cell__alt">tap to switch</div>
            </button>
          )
        })}
      </div>
      <p className="bm-note">Each shows your <b>chosen</b> value; tap to see both (manual vs computed) and switch. The computed estimate keeps updating — no max test needed. FTP's eFTP trend is on the <Link to="/cycling-stats">Cycling</Link> page.</p>
      {showTrendsLink && <Link to="/stats" className="bm-trends">See trends &amp; race predictions in Stats ›</Link>}
      {openDef && <Sheet def={openDef} prefer={prefOf(openDef)} onPref={(p) => authApi.saveProfile({ statPrefs: { [openDef.key]: p } }).then(() => refresh()).catch(() => {})} onSaveManual={(v) => { if (v != null) openDef.save(v) }} onClose={() => setOpen(null)} />}
    </div>
  )
}
