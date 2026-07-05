import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi, type IcuAthletePull } from './auth/api'
import { fmtPace, parsePace } from './running-paces'
import { fetchWellness } from './intervals'
import { estimateSleepNeed } from './sleep'
import { headlineVo2max, runningVo2max, cyclingVo2max, confLabel } from './vo2max-submax'

// #236 — benchmarks = MANUAL vs COMPUTED. Tiles show the in-use value; tap → a sheet with BOTH values,
// an input (editable only in Manual), and a Manual|Computed toggle. A per-stat preference (user.statPrefs)
// decides which drives; the computed value keeps updating regardless. Used in Stats + Profile.
type Pref = 'manual' | 'computed' | 'auto' // #277 auto = use computed once it's ready, manual until then
type Key = 'vo2max' | 'ftp' | 'thresholdPace' | 'maxHr' | 'sleepNeed' // #337 sleep joins the picker
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const numParse = (lo: number, hi: number) => (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, lo, hi) : null }

interface StatDef {
  key: Key; label: string; unit?: string
  computed: number | null; computedSrc: string
  manual: number | null
  pending?: string // #337 — when computed ISN'T ready yet: what/when it needs to land (our theory gates)
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
          <div className={'bsheet__opt' + (p === 'computed' ? ' on' : '')}><div className="bsheet__ol">Computed</div><div className="bsheet__ov" style={{ color: '#5ec8ff' }}>{def.computed != null ? def.fmt(def.computed) : '—'}</div><div className="bsheet__os">{def.computed != null ? def.computedSrc : (def.pending ? `⏳ ${def.pending}` : 'not available yet')}</div></div>
          <div className={'bsheet__opt' + (p === 'manual' ? ' on' : '')}><div className="bsheet__ol">Manual</div><div className="bsheet__ov" style={{ color: '#9b8cff' }}>{def.manual != null ? def.fmt(def.manual) : '—'}</div><div className="bsheet__os">your value</div></div>
        </div>
        <div className="bsheet__lbl">Your value</div>
        <input className="bsheet__in" value={txt} placeholder={def.computed != null ? def.fmt(def.computed) : 'enter a value'} onChange={(e) => setTxt(e.target.value)} />
        <div className="bsheet__lbl">Use which?</div>
        <div className="bseg bseg--3">
          <button className={p === 'manual' ? 'on' : ''} onClick={() => setP('manual')}>Manual</button>
          <button className={p === 'auto' ? 'on' : ''} onClick={() => setP('auto')}>Auto</button>
          <button className={p === 'computed' ? 'on' : ''} onClick={() => setP('computed')} disabled={def.computed == null}>Computed</button>
        </div>
        <div className="bsheet__hint">
          {p === 'auto' ? (def.computed != null ? 'Auto: using the computed estimate now that it’s ready — your manual value is the fallback.' : 'Auto: using your manual value until the computed estimate is ready, then it switches automatically.')
            : p === 'computed' ? 'Always use the computed estimate (falls back to manual if it’s ever unavailable).'
            : 'Always use the value you typed.'}
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
  const [map5, setMap5] = useState<number | null>(null) // #337 best 5-min power (MAP)
  const [pbWeight, setPbWeight] = useState<number | null>(null)
  const [runsRecent, setRunsRecent] = useState<number | null>(null)
  const [compMaxHr, setCompMaxHr] = useState<number | null>(null) // #337c computed Max HR (observed peak ∨ intervals ceiling)
  const [maxHrSamples, setMaxHrSamples] = useState<number>(0)
  const [maxHrFrom, setMaxHrFrom] = useState<string>('')
  const [sleepEst, setSleepEst] = useState<number | null>(null) // computed sleep need (null until learned)
  const [sleepMore, setSleepMore] = useState<number | null>(null) // nights still needed
  const [open, setOpen] = useState<Key | null>(null)
  const connected = !!user?.hasIcuKey

  useEffect(() => {
    if (!connected) return
    authApi.pullIcuAthlete().then(setPull).catch(() => {})
    authApi.runEstimate().then((r) => { if (r.available && r.thresholdPace) setPaceEst(r.thresholdPace) }).catch(() => {})
    authApi.powerBenchmarks().then((p) => { if (p.available) { setMap5(p.map5min ?? null); setPbWeight(p.weight ?? null) } setRunsRecent(p.runsRecent ?? null); setCompMaxHr(p.computedMaxHr ?? null); setMaxHrSamples(p.maxHrSamples ?? 0); setMaxHrFrom(p.maxHrFrom ?? '') }).catch(() => {}) // #337
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    fetchWellness(from, to).then((rows) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { setHrRest(rows[i].restingHR); break }
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].eftp != null) { setEftp(rows[i].eftp as number); break }
      const se = estimateSleepNeed(rows); setSleepEst(se.suggested); setSleepMore(se.needMore || null) // #337 sleep learning state
    }).catch(() => {})
  }, [connected])

  const ss = pull?.sportSettings || {}
  const ftpManual = ss.cycling?.ftp ?? user?.ftp ?? null
  const maxHr = ss.cycling?.maxHr ?? user?.maxHR ?? null
  const paceManual = ss.running?.thresholdPace ?? user?.runThresholdPace ?? null
  const weight = pbWeight ?? pull?.weight ?? null
  const vdot = user?.runVdot ?? null
  // #337 computed VO₂max — cycling from 5-min MAP (not FTP), running suppressed when run volume is thin,
  // ordered by the sport the athlete actually does (so a cyclist's number comes from cycling).
  const estBySport: Record<'running' | 'cycling', ReturnType<typeof cyclingVo2max>> = {
    running: runningVo2max({ vdot, hrMax: maxHr, hrRest, runsRecent }),
    cycling: cyclingVo2max({ ftp: ftpManual, weightKg: weight, hrMax: maxHr, hrRest, map5min: map5 }),
  }
  const vo2Order = [...(user?.sports || []).filter((s): s is 'running' | 'cycling' => s === 'running' || s === 'cycling'), 'cycling', 'running'].filter((s, i, a) => a.indexOf(s) === i) as ('running' | 'cycling')[]
  const vo2head = headlineVo2max(null, vo2Order.map((sport) => ({ sport, est: estBySport[sport] })))

  const saveSport = (group: 'cycling' | 'running', patch: Record<string, number | null>) => authApi.saveSportStat({ group, ...patch }).then(() => refresh())
  // #337 — "when will the computed estimate land?" straight from our theory gates, so nothing just says
  // "not available yet". Runs gate (pace): ≥4 runs + ≥25 km / 6 wks. Sleep: 21 nights. VO₂max cycling:
  // a hard ~5-min effort. maxHR: no safe estimate exists — it needs a real max.
  const runsShort = runsRecent != null ? Math.max(1, 4 - runsRecent) : null
  const runsWord = runsShort === 1 ? '' : 's'
  const paceGate = paceEst ? undefined : (runsRecent != null ? `after ~${runsShort} more run${runsWord} — needs ≥4 runs + ~25 km in 6 weeks incl. a hard effort (Critical-Speed model)` : 'after a few runs incl. one hard effort (Critical-Speed model)')
  const doesCycle = (user?.sports || []).includes('cycling')
  // #362 — every learned stat answers "when will Computed land?" consistently: a COUNT where we can
  // count it (runs/nights), else the exact trigger event. VO₂max: cycling = a hard 5-min effort (MAP);
  // running = the same run gate as pace (count-based).
  const vo2Gate = (vo2head && vo2head.value != null) ? undefined
    : (doesCycle ? 'after your next hard ~5-min bike effort (a near-max 5 min) — that’s your MAP → VO₂max'
      : (runsRecent != null ? `after ~${runsShort} more run${runsWord} — your pace VDOT firms up over ≥4 runs` : 'after ~4 runs so your pace VDOT is reliable'))
  const defs: StatDef[] = [
    { key: 'vo2max', label: 'VO₂max', computed: vo2head ? vo2head.value : null, computedSrc: vo2head ? `${confLabel(vo2head.confidence)} · ${vo2head.source}` : '', pending: vo2Gate, manual: user?.vo2max ?? null, fmt: String, parse: numParse(20, 95), save: (v) => authApi.saveProfile({ vo2max: v }).then(() => refresh()) },
    // #362 — FTP is event-based (intervals reads eFTP from a hard effort), so give the concrete trigger, not a vague "as it sees efforts".
    { key: 'ftp', label: 'FTP', unit: 'W', computed: eftp, computedSrc: 'eFTP from your power', pending: eftp ? undefined : (map5 != null ? 'after your next hard ride — a ~5–20 min near-max effort; intervals reads eFTP from it (no formal FTP test)' : 'after your first hard ride — intervals reads eFTP from a ~5–20 min effort (no formal test needed)'), manual: ftpManual, fmt: String, parse: numParse(50, 600), save: (v) => saveSport('cycling', { ftp: v }) },
    { key: 'thresholdPace', label: 'Threshold pace', unit: '/km', computed: paceEst, computedSrc: 'from your recent runs (Critical Speed)', pending: paceGate, manual: paceManual, fmt: fmtPace, parse: parsePace, save: (v) => saveSport('running', { thresholdPace: v }) },
    { key: 'maxHr', label: 'Max HR', unit: 'bpm', computed: compMaxHr, computedSrc: maxHrFrom === 'observed' ? `observed peak — highest HR in your last 180 days${maxHrSamples > 1 ? ` (hit ${maxHrSamples}×)` : ''}` : 'your zone ceiling from intervals — beat it in an all-out effort to raise it', pending: 'after your next all-out effort with a HR strap/watch — we read your true peak, not an age formula', manual: maxHr, fmt: String, parse: numParse(120, 230), save: (v) => saveSport('cycling', { maxHr: v }) },
    // #337 — sleep need joins the SAME picker (was a bespoke card). Learned from best-recovery nights.
    { key: 'sleepNeed', label: 'Sleep need', unit: 'h', computed: sleepEst, computedSrc: 'from your best-recovery nights', pending: sleepMore ? `in ~${sleepMore} more nights — needs 21 nights of sleep + HRV to learn your ideal` : undefined, manual: user?.sleepNeed ?? null, fmt: String, parse: numParse(4, 12), save: (v) => authApi.saveProfile({ sleepNeed: v }).then(() => refresh()) },
  ]
  // #277: default is AUTO — prefer the computed estimate once it's ready, manual until then.
  const prefOf = (d: StatDef): Pref => user?.statPrefs?.[d.key] ?? 'auto'
  const inUse = (d: StatDef): number | null => { const p = prefOf(d); return p === 'manual' ? (d.manual ?? d.computed) : (d.computed ?? d.manual) } // computed/auto prefer computed, fall back to manual
  // what's ACTUALLY driving right now (for the tag): auto resolves to computed-or-manual.
  const activeSrc = (d: StatDef): 'manual' | 'computed' => { const p = prefOf(d); if (p === 'manual') return 'manual'; if (p === 'computed') return 'computed'; return d.computed != null ? 'computed' : 'manual' }
  const openDef = defs.find((d) => d.key === open)

  return (
    <div className="card bm-card">
      <div className="bm-card__h"><h3>Your benchmarks</h3>{connected && <span className="sync-pill">⇄ intervals</span>}</div>
      <div className="bm-grid">
        {defs.map((d) => {
          const v = inUse(d), p = prefOf(d), src = activeSrc(d)
          const tag = p === 'auto' ? `auto · ${src}` : p
          return (
            <button key={d.key} className="bm-cell bm-cell--tap" onClick={() => setOpen(d.key)}>
              <div className="bm-cell__l">{d.label}<span className={`bm-tag bm-tag--${src === 'manual' ? 'you' : 'icu'}`}>{tag}</span></div>
              <div className="bm-cell__v">{v != null ? d.fmt(v) : '—'}{v != null && d.unit ? <span className="bm-cell__u">{d.unit}</span> : null}</div>
              {/* #337 — show the LEARNING state when the estimate isn't ready yet (e.g. "learning · N more
                  nights"); otherwise the tap affordance. Makes "what's estimated / still learning" visible. */}
              <div className="bm-cell__alt">{d.computed == null ? (d.pending ? `⏳ ${d.pending}` : d.computedSrc || 'tap to switch') : 'tap to switch'}</div>
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
