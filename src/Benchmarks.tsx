import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { authApi, type IcuAthletePull, type SportStat } from './auth/api'
import { fmtPace, parsePace } from './running-paces'
import { fetchWellness, fetchPowerCurve, fetchPaceCurve, fetchEfTrend, type PowerCurve, type PaceCurve, type EfTrend } from './intervals'
import { estimateSleepNeed } from './sleep'
import { tteFromPower, tteFromPace, tteModelPower, tteModelPace, pickTte, fmtTte } from './tte'
import { athleteProfile } from './athlete-profile'
import { headlineVo2max, runningVo2max, cyclingVo2max, hrRatioVo2max, vo2ScienceRows, confLabel } from './vo2max-submax'
import { vo2maxConfidence, thresholdPaceConfidence, maxHrConfidence, sleepNeedConfidence, tteConfidence, modelFitConfidence, type Confidence } from './benchmark-confidence'
import { ftpEstimate, thresholdPaceFromHrPace, maxHrFromAge } from './benchmark-estimate' // #5007 — honest multi-source estimate + confidence · #497 HR-pace threshold · #507 age max-HR
import { decouplingCheck, aerobicFloor, type RideSignal } from './threshold-signals' // #508 — multi-signal engine: cardiac-drift + aerobic-efficiency floor confirm/flag the FTP

// #236 — benchmarks = MANUAL vs COMPUTED. Tiles show the in-use value; tap → a sheet with BOTH values,
// an input (editable only in Manual), and a Manual|Computed toggle. A per-stat preference (user.statPrefs)
// decides which drives; the computed value keeps updating regardless. Used in Stats + Profile.
// #374 — each card now also carries a METHOD CHIP + a colorful CONFIDENCE/LEARNING bar (like Sleep, on
// every stat), and the detail sheet gains a confidence bar, a plain-language narrative, "The science ·
// N methods" (computed live for VO₂max), and a "Sharpen it" callout. See mockups/benchmark-cards.html.
type Pref = 'manual' | 'computed' | 'auto' // #277 auto = use computed once it's ready, manual until then
// #385 — exported so per-sport Stats pages can pass `only` to show the same polished cards, filtered.
export type Key = 'vo2max' | 'ftp' | 'thresholdPace' | 'maxHr' | 'sleepNeed' | 'tteRide' | 'tteRun' | 'cp' | 'wPrime' | 'cs' | 'dPrime' // #337 sleep · #401 TTE · #403 CP/W′/CS/D′
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const numParse = (lo: number, hi: number) => (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clamp(n, lo, hi) : null }
// #401 — a manual TTE typed as m:ss / h:mm:ss (or bare minutes) → seconds.
const parseTte = (s: string): number | null => {
  const m = /^(\d+):(\d{1,2})(?::(\d{2}))?$/.exec(s.trim())
  if (m) return m[3] ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2])
  const n = Number(s); return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null
}

// #374 — one science-method row in the detail sheet.
interface SciRow { name: string; formula: string; value: string; inUse?: boolean }

interface StatDef {
  key: Key; label: string; unit?: string
  computed: number | null; computedSrc: string
  manual: number | null
  pending?: string // #337 — when computed ISN'T ready yet: what/when it needs to land (our theory gates)
  fmt: (n: number) => string; parse: (s: string) => number | null
  save: (v: number) => Promise<unknown>
  chip: string // #374 method chip (MAP / eFTP / Critical Speed / Observed / Learning …)
  conf: Confidence // #374 confidence/learning bar data
  narr: ReactNode // #374 plain-language "how it's computed" paragraph
  sci: SciRow[] // #374 the methods list ("The science")
  sharpen?: string // #374 concrete trigger to raise confidence (only shown when not already 'strong')
}

function ConfBar({ conf, big = false }: { conf: Confidence; big?: boolean }) {
  return (
    <div className={big ? 'bm-conf2' : 'bm-conf'}>
      <div className={`bm-bar bm-g-${conf.cls}`}><i style={{ width: `${conf.pct}%` }} /></div>
      <div className={`bm-lt bm-lt--${conf.cls}`}>{conf.label}</div>
    </div>
  )
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
  // #508 — CLEAN layout for EVERY benchmark, all sports (JM: "same clean-up for running, all metrics for all
  // sports"). One number + confidence + a short paragraph; NO dual tiles, NO "The science" method wall. The number
  // tracks the toggle live so switching Manual/Auto previews the value that will drive. Edit controls below UNCHANGED.
  const inUse = p === 'manual' ? def.manual : (def.computed ?? def.manual) // the value actually driving, per the toggle
  const sharpenEl = def.conf.cls !== 'strong' && def.sharpen ? <div className="bm-sharpen">💪 <b>Sharpen it:</b> {def.sharpen}</div> : null
  return (
    <div className="bsheet__scrim" onClick={onClose}>
      <div className="bsheet" onClick={(e) => e.stopPropagation()}>
        <div className="bsheet__h"><h3>{def.label}</h3><button className="bsheet__x" onClick={onClose}>✕</button></div>
        {/* #374 — confidence bar up top (same data as the card). */}
        <ConfBar conf={def.conf} big />
        {/* #508 — ONE number (tracks the toggle) + a source line; replaces the dual Computed/Manual tiles. */}
        <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
          <div style={{ fontSize: 50, fontWeight: 750, letterSpacing: '-.02em', lineHeight: 1 }}>{inUse != null ? def.fmt(inUse) : '—'}{def.unit && <span style={{ fontSize: 21, color: 'var(--text-dim)', fontWeight: 600, marginLeft: 3 }}>{def.unit}</span>}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 7 }}>{p === 'manual' ? 'your value' : (inUse != null ? def.computedSrc : (def.pending ? `⏳ ${def.pending}` : ''))}</div>
        </div>
        {/* #374 — plain-language explanation of how this stat is computed. */}
        <div className="bm-narr">{def.narr}</div>
        {/* #508 (JM: "not all that crap") — NO method wall; the narrative carries the one honest read. Only the
            sharpen tip stays, when it's not already strong. */}
        {sharpenEl}
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

// #385 — `only` filters the cards to the given keys (in that order); undefined = all 5 (unchanged).
export function BenchmarksCard({ showTrendsLink = false, only, profile }: { showTrendsLink?: boolean; only?: Key[]; profile?: 'cycling' | 'running' }) {
  const { user, refresh } = useAuth()
  const [pull, setPull] = useState<IcuAthletePull | null>(null)
  const [hrRest, setHrRest] = useState<number | null>(null)
  const [eftp, setEftp] = useState<number | null>(null)
  const [eftpAgeDays, setEftpAgeDays] = useState<number | null>(null) // #5007 recency of the eFTP (it decays between hard rides)
  const [ftp20, setFtp20] = useState<number | null>(null) // #5007 best 20-min power → FTP ≈ ×0.95
  const [hrPower, setHrPower] = useState<{ watts: number; hr: number }[]>([]) // #497 (power,HR) points → infer FTP from the HR cost of rides
  const [hrPace, setHrPace] = useState<{ paceSecKm: number; hr: number }[]>([]) // #497 (pace,HR) points → infer threshold pace from the HR cost of runs
  const [rideSignals, setRideSignals] = useState<RideSignal[]>([]) // #508 per-ride NP/decoupling/EF → confirm/flag the FTP
  const [paceEst, setPaceEst] = useState<number | null>(null)
  const [map5, setMap5] = useState<number | null>(null) // #337 best 5-min power (MAP)
  const [pbWeight, setPbWeight] = useState<number | null>(null)
  const [runsRecent, setRunsRecent] = useState<number | null>(null)
  const [compMaxHr, setCompMaxHr] = useState<number | null>(null) // #337c computed Max HR (observed peak ∨ intervals ceiling)
  const [maxHrSamples, setMaxHrSamples] = useState<number>(0)
  const [maxHrFrom, setMaxHrFrom] = useState<string>('')
  const [observedMaxHr, setObservedMaxHr] = useState<number | null>(null) // #507 raw observed peak — shown as its own method even when the zone ceiling is the headline
  const [icuMaxHr, setIcuMaxHr] = useState<number | null>(null) // #507 intervals zone ceiling — its own method row
  const [sleepEst, setSleepEst] = useState<number | null>(null) // computed sleep need (null until learned)
  const [sleepMore, setSleepMore] = useState<number | null>(null) // nights still needed
  const [sleepRaw, setSleepRaw] = useState<number | null>(null) // unrounded best-nights avg (h) — shown in the sheet
  const [sleepTop, setSleepTop] = useState<number>(0) // # best-recovery nights averaged
  const [powerCurve, setPowerCurve] = useState<PowerCurve | null>(null) // #401 cycling TTE
  const [paceCurve, setPaceCurve] = useState<PaceCurve | null>(null) // #401 running TTE
  const [efTrend, setEfTrend] = useState<EfTrend | null>(null) // #403 efficiency-factor trend (for the profile)
  const [open, setOpen] = useState<Key | null>(null)
  const connected = !!user?.hasIcuKey

  useEffect(() => {
    if (!connected) return
    authApi.pullIcuAthlete().then(setPull).catch(() => {})
    authApi.runEstimate().then((r) => { if (r.available && r.thresholdPace) setPaceEst(r.thresholdPace) }).catch(() => {})
    authApi.powerBenchmarks().then((p) => { if (p.available) { setMap5(p.map5min ?? null); setPbWeight(p.weight ?? null); setFtp20(p.ftp20 ?? null) } setRunsRecent(p.runsRecent ?? null); setCompMaxHr(p.computedMaxHr ?? null); setMaxHrSamples(p.maxHrSamples ?? 0); setMaxHrFrom(p.maxHrFrom ?? ''); setObservedMaxHr((p as { observedMaxHr?: number | null }).observedMaxHr ?? null); setIcuMaxHr((p as { icuMaxHr?: number | null }).icuMaxHr ?? null); setHrPower((p as { hrPower?: { watts: number; hr: number }[] }).hrPower ?? []); setHrPace((p as { hrPace?: { paceSecKm: number; hr: number }[] }).hrPace ?? []); setRideSignals((p as { rideSignals?: RideSignal[] }).rideSignals ?? []) }).catch(() => {}) // #337 · #5007 ftp20 · #497 hrPower/hrPace · #508 rideSignals
    fetchPowerCurve(365).then(setPowerCurve).catch(() => {}) // #401 TTE — a year of efforts for a stable CP/W′ + CS/D′ model fit
    fetchPaceCurve(365).then(setPaceCurve).catch(() => {}) // #401 running TTE
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10) // #501 — 180d (was 60d): Garmin often has far more than 21 nights synced; fetch enough to actually clear the sleep-need window
    fetchWellness(from, to).then((rows) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { setHrRest(rows[i].restingHR); break }
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].eftp != null) { const r = rows[i] as { eftp?: number | null; id?: string; date?: string }; setEftp(Math.round(r.eftp as number)); const d = r.date || r.id; if (d) setEftpAgeDays(Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86400000))); break } // #464 whole watts · #5007 capture the eFTP date for recency
      const se = estimateSleepNeed(rows); setSleepEst(se.suggested); setSleepMore(se.needMore || null); setSleepRaw(se.suggestedRaw); setSleepTop(se.topNights) // #337 sleep learning state
    }).catch(() => {})
  }, [connected])
  useEffect(() => { if (connected && profile) fetchEfTrend(profile === 'cycling' ? 'Ride' : 'Run').then(setEfTrend).catch(() => {}) }, [connected, profile]) // #403 EF for the profile

  // #508 (JM: "entering a value in CP does not save") — CP/W′/TTE/CS/D′ are OUR local benchmark fields, saved to the
  // DB (user.sportSettings), NOT to intervals — so the intervals pull never carries them and they read back empty
  // ("won't save"). Merge: user (DB, has the local fields) as base, the fresh intervals pull overlaid for
  // ftp/maxHr/thresholdPace. Now every manual value round-trips after save+refresh.
  const mss = (g: 'cycling' | 'running'): SportStat => ({ ...(user?.sportSettings?.[g] || {}), ...(pull?.sportSettings?.[g] || {}) })
  const ss = { cycling: mss('cycling'), running: mss('running') }
  const ftpManual = ss.cycling?.ftp ?? user?.ftp ?? null
  const maxHr = ss.cycling?.maxHr ?? user?.maxHR ?? null
  const ageMaxHr = maxHrFromAge(user?.info?.dob ? Math.floor((Date.now() - new Date(user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null, user?.sex) // #507/#508 — sex-specific age max HR (Gulati/Tanaka)
  const paceManual = ss.running?.thresholdPace ?? user?.runThresholdPace ?? null
  const weight = pbWeight ?? pull?.weight ?? null
  const vdot = user?.runVdot ?? null
  // #403 — CP/W′ (cycling) + CS/D′ (running) from the power/pace-duration model fit. CS shown as a pace (sec/km).
  const cp = powerCurve?.cp ?? null // #508 — the INDEPENDENT power-duration fit. NEVER derive it from FTP (that's circular); it measures the SAME threshold FTP does, so they should sit CLOSE (not 10–15 W apart — that "rule" produces nonsense vs real training).
  const wPrimeKj = powerCurve?.wPrime != null ? Math.round(powerCurve.wPrime / 100) / 10 : null // kJ, 0.1 precision
  // #508 (JM: "CP is to see the STRENGTH of a rider") — CP (engine size) + W′ (anaerobic kick) = the rider profile.
  // Normalise W′ per kg: <250 J/kg diesel (big aerobic base, modest top-end) · 250–360 balanced · >360 puncheur.
  const wPerKg = wPrimeKj != null && weight ? Math.round((wPrimeKj * 1000) / weight) : null
  const riderType = wPerKg == null ? null : wPerKg < 250 ? 'a diesel — big aerobic engine, modest top-end kick' : wPerKg > 360 ? 'a puncheur — strong anaerobic kick over your aerobic base' : 'a balanced rider — steady engine with a real kick'
  const csPace = paceCurve?.cs != null && paceCurve.cs > 0 ? Math.round(1000 / paceCurve.cs) : null // sec/km
  const dPrimeM = paceCurve?.dPrime != null ? Math.round(paceCurve.dPrime) : null // metres
  // #5007 — honest FTP: blend eFTP (weighted by recency) + CP-derived + best-20min×0.95; confidence from real
  // signals so a stale eFTP that disagrees with CP can't read "Strong". toConf maps the engine's 'good' onto the
  // existing bar classes (learn) so the CSS keeps working.
  // #508 (JM: "I see 260 as computed and not 253") — the REAL current eFTP is the power-model one (from the 365-day
  // curve, ~253), not the wellness/sportInfo eFTP the card was reading (~240, it lags). Prefer the power-model value.
  const eftpVal = powerCurve?.eftp ?? eftp
  const ftpEst = ftpEstimate({ eftp: eftpVal, eftpAgeDays, cp, best20: ftp20, manual: ftpManual, hrPower, maxHr: maxHr ?? compMaxHr }) // #497 — HR-power method now fed real ride data
  // #508 (JM) — the honest computed threshold, eFTP-anchored (intervals' standard read), CP as the corroborator. This
  // is the ONE number the FTP card explains — no wall of 6 conflicting methods. eftpAndCpAgree → "it's solid".
  const ftpThreshold = eftpVal ?? ftpEst.best ?? ftpManual
  const eftpCpAgree = eftpVal != null && cp != null && Math.abs(eftpVal - cp) <= 12
  // #497 running analog — threshold pace inferred from the HR cost of steady runs. Used as a FALLBACK: when the
  // Critical-Speed model isn't ready (few/no hard runs) but there's HR-paired running, we still show a real number
  // instead of "needs 4 runs" — so a runner's analysis is done off history, and it shows as its own method below.
  const paceHr = thresholdPaceFromHrPace(hrPace, maxHr ?? compMaxHr)
  const paceHrBest = paceHr ? paceHr.best : null
  // #508 (JM: "running is weird — CS/threshold should be better") — the Critical-Speed pace-model UNDER-reads when
  // every run is easy: with no fast points to anchor the curve it fits SLOWER than the HR cost of those same easy
  // runs (impossible — a CS slower than an easy run). When HR-pace reads meaningfully faster (>12 s/km, higher =
  // slower), the curve is under-constrained → trust HR-pace, the way eFTP anchors cycling. (JM: CS 5:21 vs a 5:06 run.)
  const csUnderReads = paceEst != null && paceHrBest != null && paceEst - paceHrBest > 12
  const paceFromHr = csUnderReads || paceEst == null
  const paceComputed = csUnderReads ? paceHrBest : (paceEst ?? paceHrBest)
  const toConf = (c: { pct: number; cls: string; label: string }): Confidence => ({ pct: c.pct, cls: (c.cls === 'good' ? 'learn' : c.cls) as Confidence['cls'], label: c.label })
  // #403 — athlete-profile synthesis (rendered when a per-sport page passes `profile`). EF wires in Phase 2.
  // #464 — the insight must anchor on the CHOSEN FTP/pace (same `inUse` logic as the benchmark card), not the
  // raw MANUAL value — else the FTP card showed 241 W (computed) while the insight said 260 W (manual): a
  // confusing on-page discrepancy. computed/auto → prefer the computed estimate; manual → the set value.
  const prefFor = (k: string) => (user?.statPrefs as Partial<Record<string, string>> | undefined)?.[k] ?? 'auto'
  // #508 (JM: "text says 260 while FTP is auto at 253") — chosenFtp MUST equal the card tile's in-use value so the
  // profile/insights/TTE/VO₂max all agree with the number on the card. The tile uses def.computed = eftpVal (253) on
  // auto, so mirror that here (was ftpEst.best = 260, anchored to the manual — the source of the mismatch).
  const chosenFtp = prefFor('ftp') === 'manual' ? (ftpManual ?? eftpVal ?? ftpEst.best) : (eftpVal ?? ftpEst.best ?? ftpManual)
  const decoupCheck = decouplingCheck(rideSignals, chosenFtp) // #508 — does your near-FTP riding hold steady (confirms) or drift (FTP too high)?
  const aeroFloor = aerobicFloor(rideSignals, maxHr ?? compMaxHr) // #508 — your Z2 efficiency proves FTP is AT LEAST this (JM: 170 W steady in Z2 ⇒ not 220)
  // #508 (JM: "CP and FTP measure the same thing — CP+15 makes no sense vs my training") — CP stays the INDEPENDENT
  // curve read, but it estimates the SAME threshold as FTP, so the honest check is whether they CLUSTER (they should).
  // cpAgrees: CP within ~15 W of the trained FTP → threshold is solid; we stop implying one is "wrong".
  const cpAgrees = cp != null && chosenFtp != null && Math.abs(cp - chosenFtp) <= 15
  const chosenPace = prefFor('thresholdPace') === 'manual' ? (paceManual ?? paceComputed) : (paceComputed ?? paceManual)
  // #506e — CONSISTENCY (JM): dependent stats must move WITH the anchor. VO₂max now reads the CHOSEN FTP + max-HR
  // (what the picker has in use), NOT the raw manual — so switching FTP to Auto moves VO₂max the same way it moves
  // TTE. Computed here (after chosenFtp/chosenPace) so it can feed on them. Cycling from 5-min MAP (not FTP) when
  // available; running suppressed on thin volume; ordered by the sport the athlete actually does.
  const chosenMaxHr = prefFor('maxHr') === 'manual' ? (maxHr ?? compMaxHr) : (compMaxHr ?? maxHr)
  const estBySport: Record<'running' | 'cycling', ReturnType<typeof cyclingVo2max>> = {
    running: runningVo2max({ vdot, hrMax: chosenMaxHr, hrRest, runsRecent }),
    cycling: cyclingVo2max({ ftp: chosenFtp, weightKg: weight, hrMax: chosenMaxHr, hrRest, map5min: map5 }),
  }
  const vo2Order = [...(user?.sports || []).filter((s): s is 'running' | 'cycling' => s === 'running' || s === 'cycling'), 'cycling', 'running'].filter((s, i, a) => a.indexOf(s) === i) as ('running' | 'cycling')[]
  const vo2head = headlineVo2max(null, vo2Order.map((sport) => ({ sport, est: estBySport[sport] })))
  // #401/#506/#508 — TTE reads at the FTP/pace ACTUALLY IN USE (chosenFtp/chosenPace), so it MOVES when you switch the
  // picker. It's INFERRED from the CP/CS model (W′/CP · D′/CS) — we never ask for a test. The curve's "longest you
  // actually held it" only wins when it's LONGER than the model (a real longer hold beats the prediction); a short
  // observed hold under-states you (you rarely ride to exhaustion), so it must NOT drag TTE down to 12 min + beg for
  // an effort (JM: "I don't see you inferring TTE, you ask again for a test"). Model uses the RAW CP so FTP>CP gives a
  // finite time (the floored display-CP would make FTP<CP → falsely "unbounded").
  const tteRideObs = powerCurve ? tteFromPower(powerCurve.secs, powerCurve.watts, chosenFtp ?? eftpVal) : null
  const tteRideEst = powerCurve ? tteModelPower(chosenFtp ?? eftpVal, powerCurve.cp, powerCurve.wPrime) : null
  const tteRidePick = pickTte(tteRideObs, tteRideEst), tteRide = tteRidePick.sec, tteRideEstimated = tteRidePick.estimated
  const tteRunObs = paceCurve ? tteFromPace(paceCurve.dist, paceCurve.secs, chosenPace ?? paceComputed) : null
  const tteRunEst = paceCurve ? tteModelPace(chosenPace ?? paceComputed, paceCurve.cs, paceCurve.dPrime) : null
  const tteRunPick = pickTte(tteRunObs, tteRunEst), tteRun = tteRunPick.sec, tteRunEstimated = tteRunPick.estimated
  // #508 (JM: "how will the insight AND coach focus update when I change a value?") — the profile must read the IN-USE
  // value per metric (a Manual override wins in Manual mode, exactly like chosenFtp), so editing TTE/CP/W′/CS/D′ flows
  // into the reads AND the coach focus (athleteProfile derives BOTH from these inputs). Manual → the saved value; else computed.
  const pickChosen = (key: string, manual: number | null, computed: number | null) => (prefFor(key) === 'manual' ? (manual ?? computed) : (computed ?? manual))
  const chosenTteRide = pickChosen('tteRide', (ss.cycling as { tte?: number })?.tte ?? null, tteRide)
  const chosenCp = pickChosen('cp', (ss.cycling as { cp?: number })?.cp ?? null, cp)
  const chosenWprime = pickChosen('wPrime', (ss.cycling as { wPrime?: number })?.wPrime ?? null, wPrimeKj)
  const chosenTteRun = pickChosen('tteRun', (ss.running as { tte?: number })?.tte ?? null, tteRun)
  const chosenCs = pickChosen('cs', (ss.running as { cs?: number })?.cs ?? null, csPace)
  const chosenDprime = pickChosen('dPrime', (ss.running as { dPrime?: number })?.dPrime ?? null, dPrimeM)
  const prof = profile ? athleteProfile(profile === 'cycling'
    ? { sport: 'cycling', threshold: chosenFtp, eftp: eftpVal, tte: chosenTteRide, cp: chosenCp, reserveKj: chosenWprime, reserveBig: 20, ef: efTrend?.latest ?? null, efTrend: efTrend?.trend ?? null }
    : { sport: 'running', threshold: chosenPace, eftp: paceEst, tte: chosenTteRun, cp: chosenCs, reserveKj: chosenDprime, reserveBig: 200, ef: efTrend?.latest ?? null, efTrend: efTrend?.trend ?? null }) : null

  const saveSport = (group: 'cycling' | 'running', patch: Record<string, number | null>) => authApi.saveSportStat({ group, ...patch }).then(() => refresh())
  // #337 — "when will the computed estimate land?" straight from our theory gates, so nothing just says
  // "not available yet". Runs gate (pace): ≥4 runs + ≥25 km / 6 wks. Sleep: 21 nights. VO₂max cycling:
  // a hard ~5-min effort. maxHR: no safe estimate exists — it needs a real max.
  const runsShort = runsRecent != null ? Math.max(1, 4 - runsRecent) : null
  const runsWord = runsShort === 1 ? '' : 's'
  const paceGate = paceComputed ? undefined : (runsRecent != null ? `after ~${runsShort} more run${runsWord} — needs ≥4 runs + ~25 km in 6 weeks incl. a hard effort (Critical-Speed model)` : 'after a few runs incl. one hard effort (Critical-Speed model)')
  const doesCycle = (user?.sports || []).includes('cycling')
  // #362 — every learned stat answers "when will Computed land?" consistently: a COUNT where we can
  // count it (runs/nights), else the exact trigger event. VO₂max: cycling = a hard 5-min effort (MAP);
  // running = the same run gate as pace (count-based).
  const vo2Gate = (vo2head && vo2head.value != null) ? undefined
    : (doesCycle ? 'after your next hard ~5-min bike effort (a near-max 5 min) — that’s your MAP → VO₂max'
      : (runsRecent != null ? `after ~${runsShort} more run${runsWord} — your pace VDOT firms up over ≥4 runs` : 'after ~4 runs so your pace VDOT is reliable'))

  // #374 — method chip on the VO₂max card, from the headline source (MAP / VDOT / HR).
  const vo2Chip = (): string => {
    const s = vo2head?.source || ''
    if (/\bFTP\b/i.test(s)) return 'FTP→MAP' // #5 — FTP scaled to MAP, NOT a real 5-min effort — check this BEFORE the MAP regex ('est. MAP' contains MAP)
    if (/5-?min|max power|MAP/i.test(s)) return 'MAP'
    if (/pace|VDOT/i.test(s)) return 'VDOT'
    if (/HR|heart/i.test(s)) return 'HR'
    return doesCycle ? 'MAP' : 'VDOT'
  }

  // #374 — VO₂max "The science" — up to 3 methods computed live; the one whose .source == headline is IN USE.
  const vo2Sci = ((): SciRow[] => {
    const cyc = cyclingVo2max({ ftp: ftpManual, weightKg: weight, hrMax: maxHr, hrRest, map5min: map5 })
    const run = runningVo2max({ vdot, hrMax: maxHr, hrRest, runsRecent })
    const hr = hrRatioVo2max(maxHr, hrRest)
    // #506 — sport-aware + honest: only the methods this athlete's sport & data support (a runner never sees a bike
    // number, and the crude HR-ratio isn't shown next to a real VDOT/MAP as a co-equal figure).
    return vo2ScienceRows({ doesCycle, cyc, run, hr, headSource: vo2head?.source })
      .map((m) => ({ name: m.name, formula: m.formula, value: m.value != null ? String(m.value) : '—', inUse: m.inUse }))
  })()
  // Name the method ACTUALLY driving the number (headline source — same signal as the IN USE badge), not just
  // the sport: a non-cyclist, or an HR-only estimate, must never falsely read "bike power" (JM 2026-07-07).
  const vo2Narr = ((): ReactNode => {
    const s = vo2head?.source || ''
    const tail = ' It re-computes automatically — no lab or ramp test needed.'
    if (/\bFTP\b/i.test(s)) return <>Estimated from your <b>FTP</b>, scaled up to an estimated MAP — a real hard <b>5-min</b> effort would sharpen it (that's your true MAP).{tail}</>
    if (/5-?min|max power|MAP/i.test(s)) return <>Estimated from your <b>best 5-minute bike power</b> (your MAP), cross-checked against your heart-rate profile.{tail}</>
    if (/pace|VDOT/i.test(s)) return <>Estimated from your <b>running pace</b> (VDOT), cross-checked against your heart-rate profile.{tail}</>
    if (/HR|heart/i.test(s)) return <>Estimated from your <b>heart-rate profile</b> (max vs resting HR) — a submax proxy until you log a hard ~5-min ride or a few runs.{tail}</>
    return <>Estimated from your <b>best efforts</b>, cross-checked against your heart-rate profile.{tail}</>
  })()

  const defs: StatDef[] = [
    {
      key: 'vo2max', label: 'VO₂max', computed: vo2head ? vo2head.value : null, computedSrc: vo2head ? `${confLabel(vo2head.confidence)} · ${vo2head.source}` : '', pending: vo2Gate, manual: user?.vo2max ?? null, fmt: (v: number) => String(Math.round(v)), parse: numParse(20, 95), save: (v) => authApi.saveProfile({ vo2max: v }).then(() => refresh()),
      chip: vo2Chip(),
      conf: vo2maxConfidence({ value: vo2head ? vo2head.value : null, confidence: vo2head?.confidence, gate: vo2Gate }),
      narr: vo2Narr,
      sci: vo2Sci,
      sharpen: doesCycle ? 'a hard ~5-min near-max effort refreshes your MAP → the estimate tightens.' : 'log a few more runs incl. a hard effort → your pace VDOT (and this number) firm up.',
    },
    // #362 — FTP is event-based (intervals reads eFTP from a hard effort), so give the concrete trigger, not a vague "as it sees efforts".
    {
      key: 'ftp', label: 'FTP', unit: 'W', computed: eftpVal ?? ftpEst.best, computedSrc: 'your threshold from your power (eFTP · no test)', pending: (eftpVal ?? ftpEst.best) ? undefined : (map5 != null ? 'after your next hard effort — a ~5–20 min near-max or a 2×8; Platyplus reads your threshold from it (no formal test)' : 'after your first hard effort — a ~5–20 min or 2×8; Platyplus reads your threshold from it (no formal test)'), manual: ftpManual, fmt: (v: number) => String(Math.round(v)), parse: numParse(50, 600), save: (v) => saveSport('cycling', { ftp: v }),
      chip: 'eFTP',
      conf: toConf(ftpEst.conf), // #5007 — blended estimate + honest confidence (recency · agreement · test-backed)
      // #508 (JM: "the card has to have all info relevant accurate, not a wall of crap") — ONE honest read, no method
      // list: threshold ~eFTP, CP as the corroborator, and where the value you train by sits vs it.
      narr: <>Your threshold reads <b>~{ftpThreshold != null ? ftpThreshold : '—'} W</b>{eftpCpAgree ? <> — your eFTP ({eftpVal}) and Critical Power ({cp}) agree, so it's solid</> : null}.{ftpManual != null && ftpThreshold != null && prefFor('ftp') === 'manual' ? <> You train at <b>{ftpManual} W</b>{ftpManual - ftpThreshold >= 5 ? ', a touch generous but well within range' : ftpManual - ftpThreshold <= -5 ? ', a little conservative — you likely have more' : ' — right in line'}.</> : null} Easy weeks pull the estimate down a little; one hard 20–40 min effort tightens it.</>,
      sci: (() => { // #506e — show what each source IS (the numbers already show higher/lower — no repeated "reads lower than X", JM). IN USE follows the PICKER: the blend when Auto/Computed, your value when Manual.
        // #508 (JM: "260 low-confidence but all reads below — inconsistent") — the number in use is your TRAINED value
        // (kept as the anchor, since the low reads are under-reads, not proof it's wrong). Only show a separate
        // "Platyplus estimate" row when there's a GENUINE computed blend that DIFFERS from your value — else 260 was
        // being mislabeled as "the blend" while every source read lower. When anchored, "you train by" is IN USE.
        const anchored = ftpManual != null && ftpEst.best != null && Math.abs((ftpEst.best as number) - ftpManual) <= 2
        const showBlend = prefFor('ftp') !== 'manual' && ftpEst.best != null && !anchored
        const DESC: Record<string, string> = { 'you train by': 'the value you train by', 'intervals eFTP': 'from your power · no formal test', 'from CP': 'your power-duration ceiling', 'best 20-min ×0.95': 'your best recent 20-min', 'HR vs power': 'rough — extrapolated from easy rides, under-reads' }
        const rows: SciRow[] = ftpEst.sources.map((s) => ({
          name: s.name,
          formula: s.tag === 'stale' ? 'stale — refresh with a hard effort' : s.tag === 'off' ? 'not available' : (DESC[s.name] || ''),
          value: s.value != null ? `${s.value} W` : '—',
          inUse: !showBlend && s.tag === 'primary', // your trained value is in use unless a distinct computed blend is
        }))
        if (showBlend) rows.unshift({ name: 'Platyplus estimate', formula: 'the computed blend', value: `${ftpEst.best} W`, inUse: true })
        // #508 — cardiac-drift confirmation is KEY info → place it right UNDER the value in use, not at the bottom.
        rows.splice(1, 0, { name: 'Cardiac drift', formula: decoupCheck.note, value: decoupCheck.avgDrift != null ? `${decoupCheck.avgDrift}%` : (decoupCheck.verdict === 'confirms' ? '✓' : decoupCheck.verdict === 'too-high' ? '⚠︎' : '—'), inUse: false })
        // #508 — aerobic-efficiency FLOOR: your Z2 riding proves FTP is AT LEAST this (JM's argument, refutes a low read).
        if (aeroFloor) rows.splice(2, 0, { name: 'Aerobic efficiency', formula: aeroFloor.note, value: `≥ ${aeroFloor.floor} W`, inUse: false })
        return rows
      })(),
      sharpen: 'a ~5–20 min hard ride gives intervals a fresh, harder point on your best efforts → tighter eFTP.',
    },
    {
      key: 'thresholdPace', label: 'Threshold pace', unit: '/km', computed: paceComputed, computedSrc: paceFromHr ? 'from the HR cost of your runs' : 'from your recent runs (Critical Speed)', pending: paceGate, manual: paceManual, fmt: fmtPace, parse: parsePace, save: (v) => saveSport('running', { thresholdPace: v }),
      chip: paceFromHr ? 'HR vs pace' : 'Critical Speed',
      conf: thresholdPaceConfidence({ paceEst: paceComputed, runsRecent }),
      narr: !paceFromHr
        ? <>Modelled from your <b>recent runs</b> using the Critical-Speed method — the pace you could hold for ~an hour. It sharpens as you log more runs, especially harder efforts.</>
        : csUnderReads
          ? <>Read from the <b>heart-rate cost</b> of your runs. Your Critical-Speed curve fits slow ({csPace != null ? fmtPace(csPace) : '—'}) because <b>every recent run is easy</b> — with no hard efforts, the model has no fast points and under-reads. Your HR cost says your true threshold is nearer this. One hard 20-min run would set it properly.</>
          : <>Inferred from the <b>heart-rate cost</b> of your steady runs — projecting your pace out to threshold HR — because there aren't enough hard efforts yet for the Critical-Speed model. A hard 20-min run gives a firmer read.</>,
      sci: [
        { name: 'Critical Speed', formula: 'from your recent runs · ~1 h pace', value: paceEst != null ? fmtPace(paceEst) : '—', inUse: paceEst != null },
        { name: 'HR vs pace', formula: 'the HR cost of your steady runs → threshold HR', value: paceHr ? fmtPace(paceHr.best) : '—', inUse: paceEst == null && paceHr != null }, // #497
      ],
      sharpen: 'log a few more runs incl. a hard effort → the Critical-Speed fit tightens.',
    },
    // #401 — TTE (time to exhaustion at threshold), a LEARNED benchmark per sport, read off the mean-max curve.
    {
      key: 'tteRide', label: 'TTE', computed: tteRide, computedSrc: tteRideEstimated ? 'estimated from your power model (W′/CP)' : 'longest you held your FTP', pending: tteRide == null ? (powerCurve ? 'after a sustained near-FTP effort (10–40 min)' : 'after your next ride — read from your best efforts') : undefined, manual: (ss.cycling as { tte?: number })?.tte ?? null, fmt: fmtTte, parse: parseTte, save: (v) => saveSport('cycling', { tte: v }),
      chip: tteRideEstimated ? 'CP model' : 'Curve',
      conf: tteConfidence({ tte: tteRide, estimated: tteRideEstimated }),
      narr: <>How long you can hold your <b>FTP</b> before fatigue — normally <b>30–70 min</b>. Read off your best efforts once you've held it that long, else estimated from your power-duration model. A short TTE is a <b>training target</b>: extend it with sustained threshold work (3×15–20 min @ 90–95%), not more watts. Far below 30 min? Your FTP may be set higher than your true threshold — check it against your CP.</>,
      sci: [{ name: 'From your best efforts', formula: 'longest time ≥ your FTP', value: tteRideObs != null ? fmtTte(tteRideObs) : '—', inUse: !tteRideEstimated && tteRide != null }, { name: 'Modeled', formula: 'from your power-duration fit', value: tteRideEst != null ? fmtTte(tteRideEst) : '—', inUse: tteRideEstimated }],
      sharpen: 'extensive threshold work — 3×15–20 min @ 90–95% FTP — extends your TTE (longer durations, not more power).',
    },
    {
      key: 'tteRun', label: 'TTE', computed: tteRun, computedSrc: tteRunEstimated ? 'estimated from your Critical-Speed model' : 'longest you held threshold pace', pending: tteRun == null ? (paceCurve ? 'after a sustained threshold run (15–40 min)' : 'after a few runs — read from your best runs') : undefined, manual: (ss.running as { tte?: number })?.tte ?? null, fmt: fmtTte, parse: parseTte, save: (v) => saveSport('running', { tte: v }),
      chip: tteRunEstimated ? 'CS model' : 'Curve',
      conf: tteConfidence({ tte: tteRun, estimated: tteRunEstimated }),
      narr: <>How long you can hold your <b>threshold pace</b> before fatigue — normally <b>30–70 min</b>. Read off your best runs once you've held it that long, else estimated from your pace-duration model. A short one usually means your threshold pace is set too fast — or extend it with sustained threshold runs (3×15–20 min @ threshold).</>,
      sci: [{ name: 'From your best runs', formula: 'longest time ≤ threshold', value: tteRunObs != null ? fmtTte(tteRunObs) : '—', inUse: !tteRunEstimated && tteRun != null }, { name: 'Modeled', formula: 'from your pace-duration fit', value: tteRunEst != null ? fmtTte(tteRunEst) : '—', inUse: tteRunEstimated }],
      sharpen: 'sustained threshold runs (15–40 min, ~5 k–10 k effort) extend your TTE — or ease your threshold pace toward your critical speed.',
    },
    // #403 — CP · W′ (cycling) and CS · D′ (running): the power/pace-duration model. Modelled from the curve (no
    // test); manual override persists via the sport-stat whitelist. Per-sport pages only.
    {
      key: 'cp', label: 'Critical Power', unit: 'W', computed: cp, computedSrc: 'independent read from your best efforts', pending: cp == null ? 'after a few hard efforts across durations — the model needs points to fit' : undefined, manual: (ss.cycling as { cp?: number })?.cp ?? null, fmt: String, parse: numParse(60, 500), save: (v) => saveSport('cycling', { cp: v }),
      chip: 'Curve', conf: modelFitConfidence({ value: cp, r2: powerCurve?.r2 }),
      narr: <>Your <b>Critical Power</b> — the top of your aerobic engine, modelled independently from your best efforts. It measures the same threshold your FTP does, so they sit close{cpAgrees && eftpVal != null ? <> — yours ({cp} W) lines up with your eFTP ({eftpVal} W)</> : null}. Its real value is paired with <b>W′ ({wPrimeKj != null ? wPrimeKj : '—'} kJ)</b>: CP is your engine size, W′ your anaerobic kick — together {riderType ? <>they read as <b>{riderType}</b></> : <>they profile your rider type</>}.</>,
      sci: [{ name: 'Power-duration model', formula: '2-param CP/W′ fit · independent of FTP', value: cp != null ? `${cp} W` : '—', inUse: cp != null }],
      sharpen: 'hard efforts of varied length (1–20 min) sharpen the CP/W′ fit.',
    },
    {
      key: 'wPrime', label: 'W′', unit: 'kJ', computed: wPrimeKj, computedSrc: 'anaerobic work capacity above CP', pending: wPrimeKj == null ? 'after some short max efforts — the model needs sprint points' : undefined, manual: (ss.cycling as { wPrime?: number })?.wPrime ?? null, fmt: String, parse: numParse(2, 60), save: (v) => saveSport('cycling', { wPrime: v }),
      chip: 'Curve', conf: modelFitConfidence({ value: wPrimeKj, r2: powerCurve?.r2 }),
      narr: <>Your <b>W′</b> ("W-prime") — the finite work you can do ABOVE Critical Power before you're cooked: your anaerobic "battery" for attacks, surges and sprints. A big W′ = puncheur; a small one = diesel. Short hard repeats grow it.</>,
      sci: [{ name: 'Power-duration model', formula: 'work above CP (kJ)', value: wPrimeKj != null ? `${wPrimeKj} kJ` : '—', inUse: wPrimeKj != null }],
      sharpen: 'short near-max repeats (30 s–3 min) build W′.',
    },
    {
      key: 'cs', label: 'Critical Speed', unit: '/km', computed: csPace, computedSrc: 'your sustainable running ceiling', pending: csPace == null ? 'after a few hard runs across distances — the model needs points' : undefined, manual: (ss.running as { cs?: number })?.cs ?? null, fmt: fmtPace, parse: parsePace, save: (v) => saveSport('running', { cs: v }),
      chip: 'Curve', conf: modelFitConfidence({ value: csPace, r2: paceCurve?.r2 }),
      narr: <>Your <b>Critical Speed</b> — the running analogue of Critical Power: the fastest pace you can hold near-indefinitely, modelled independently from your best runs.{csUnderReads ? <><br /><br />Right now it fits <b>slow</b> — every recent run is easy, so the curve has no fast points and under-reads (it even lands slower than your easy-run pace). A couple of hard efforts across distances (1 k–5 k) let it read true; until then your threshold pace is the better guide.</> : null}</>,
      sci: [{ name: 'Pace-duration model', formula: '2-param CS/D′ fit', value: csPace != null ? `${fmtPace(csPace)}/km` : '—', inUse: csPace != null }],
      sharpen: 'hard runs of varied distance (1 k–5 k) sharpen the CS/D′ fit.',
    },
    {
      key: 'dPrime', label: 'D′', unit: 'm', computed: dPrimeM, computedSrc: 'anaerobic distance reserve above CS', pending: dPrimeM == null ? 'after some short fast reps — the model needs sprint points' : undefined, manual: (ss.running as { dPrime?: number })?.dPrime ?? null, fmt: String, parse: numParse(50, 400), save: (v) => saveSport('running', { dPrime: v }),
      chip: 'Curve', conf: modelFitConfidence({ value: dPrimeM, r2: paceCurve?.r2 }),
      narr: <>Your <b>D′</b> ("D-prime") — the finite distance you can cover ABOVE Critical Speed before fatigue: your anaerobic reserve for kicks and surges. Short fast reps grow it.</>,
      sci: [{ name: 'Pace-duration model', formula: 'distance above CS (m)', value: dPrimeM != null ? `${dPrimeM} m` : '—', inUse: dPrimeM != null }],
      sharpen: 'short fast reps (200–600 m) build D′.',
    },
    {
      key: 'maxHr', label: 'Max HR', unit: 'bpm', computed: compMaxHr, computedSrc: maxHrFrom === 'observed' ? `observed peak — highest HR in the last 12 months${maxHrSamples > 1 ? ` (hit ${maxHrSamples}×)` : ''}` : maxHrFrom === 'age' ? 'age estimate (Tanaka) until we catch a real peak' : 'your zone ceiling from intervals — beat it in an all-out effort to raise it', pending: 'after your next all-out effort with a HR strap/watch — we read your true peak, not an age formula', manual: maxHr, fmt: String, parse: numParse(120, 230), save: (v) => saveSport('cycling', { maxHr: v }),
      chip: maxHrFrom === 'observed' ? 'Observed' : 'Ceiling',
      conf: maxHrConfidence({ computed: compMaxHr, from: maxHrFrom }),
      narr: maxHrFrom === 'observed'
        ? <>Your <b>true observed peak</b> — the highest heart rate seen in your recent efforts, not an age formula. Beat it in an all-out effort and it moves up.</>
        : <>We use your <b>zone ceiling</b> from intervals until we catch a real peak — no age formula. An all-out effort with a strap reveals your true max HR.</>,
      sci: [ // #507 — each row shows its OWN real value (observed peak was empty because it read the headline, not the raw peak)
        { name: 'Observed peak', formula: `highest HR · last 12 months${maxHrSamples > 1 ? ` · hit ${maxHrSamples}×` : ''}`, value: observedMaxHr != null ? String(observedMaxHr) : '—', inUse: maxHrFrom === 'observed' },
        { name: 'Zone ceiling', formula: 'from intervals zones', value: icuMaxHr != null ? String(icuMaxHr) : '—', inUse: maxHrFrom === 'intervals' },
        { name: 'Age estimate', formula: 'Tanaka · 208 − 0.7 × age', value: ageMaxHr != null ? String(ageMaxHr) : '—', inUse: maxHrFrom === 'age' }, // #507 — the age formula, visible as a method (used only when no real peak/ceiling)
      ],
      sharpen: 'an all-out effort with a HR strap/watch reveals your true peak → we read it, not an age formula.',
    },
    // #337 — sleep need joins the SAME picker (was a bespoke card). Learned from best-recovery nights.
    {
      key: 'sleepNeed', label: 'Sleep need', unit: 'h', computed: sleepEst, computedSrc: 'from your best-recovery nights', pending: sleepMore ? `in ~${sleepMore} more nights — needs 21 nights of sleep + HRV to learn your ideal` : undefined, manual: user?.sleepNeed ?? null, fmt: String, parse: numParse(4, 12), save: (v) => authApi.saveProfile({ sleepNeed: v }).then(() => refresh()),
      chip: (sleepEst != null && !sleepMore) ? 'Best nights' : 'Learning',
      conf: sleepNeedConfidence({ est: sleepEst, needMore: sleepMore }),
      narr: <>Learned from your <b>best-recovery nights</b> — how much sleep precedes your strongest HRV.{sleepEst != null && sleepRaw != null && sleepTop > 0
        ? <> Your {sleepTop} best-recovery nights averaged <b>{sleepRaw} h</b> — rounded to a {String(sleepEst)} h target you can actually aim for.</>
        : <> It needs ~21 nights of sleep + HRV data to dial in your personal number.</>}</>,
      sci: [{ name: 'Best-recovery nights', formula: sleepTop > 0 ? `avg of your ${sleepTop} top-HRV nights` : 'sleep before your top-HRV days', value: sleepEst != null ? String(sleepEst) : '—', inUse: sleepEst != null }],
      sharpen: 'wear your tracker to sleep a few more nights → we learn the duration your body recovers best on.',
    },
  ]
  // #385/#401/#403/#413 — when `only` is passed, keep just those keys, in the requested order. Else the GLOBAL grid
  // shows ONLY cross-sport benchmarks: VO₂max · Max HR · Sleep. Everything SPORT-SPECIFIC lives on its per-sport page
  // (via `only`), never in the global mix (JM directive: nothing activity-specific in global): FTP (cycling) +
  // threshold pace (running), and the advanced curve metrics TTE · CP · W′ · CS · D′.
  const SPORT_ONLY: Key[] = ['ftp', 'thresholdPace', 'tteRide', 'tteRun', 'cp', 'wPrime', 'cs', 'dPrime']
  const shown = only ? only.map((k) => defs.find((d) => d.key === k)).filter((d): d is StatDef => !!d) : defs.filter((d) => !SPORT_ONLY.includes(d.key))
  const showsFtp = shown.some((d) => d.key === 'ftp')
  // #277: default is AUTO — prefer the computed estimate once it's ready, manual until then.
  const prefOf = (d: StatDef): Pref => (user?.statPrefs as Partial<Record<Key, Pref>> | undefined)?.[d.key] ?? 'auto'
  const inUse = (d: StatDef): number | null => { const p = prefOf(d); return p === 'manual' ? (d.manual ?? d.computed) : (d.computed ?? d.manual) } // computed/auto prefer computed, fall back to manual
  // what's ACTUALLY driving right now (for the tag): auto resolves to computed-or-manual.
  const activeSrc = (d: StatDef): 'manual' | 'computed' => { const p = prefOf(d); if (p === 'manual') return 'manual'; if (p === 'computed') return 'computed'; return d.computed != null ? 'computed' : 'manual' }
  const openDef = defs.find((d) => d.key === open)

  return (
    <div className="card bm-card">
      <div className="bm-card__h"><h3>Your benchmarks</h3>{connected && <span className="sync-pill">⇄ intervals</span>}</div>
      <div className="bm-grid">
        {shown.map((d) => {
          const v = inUse(d), p = prefOf(d), src = activeSrc(d)
          const tag = p === 'auto' ? `auto · ${src}` : p
          return (
            <button key={d.key} className="bm-cell bm-cell--tap" onClick={() => setOpen(d.key)}>
              <div className="bm-cell__l">{d.label}<span className={`bm-tag bm-tag--${src === 'manual' ? 'you' : 'icu'}`}>{tag}</span></div>
              <div className="bm-cell__v">{v != null ? d.fmt(v) : '—'}{v != null && d.unit ? <span className="bm-cell__u">{d.unit}</span> : null}</div>
              {/* #374 — method chip + colorful confidence/learning bar on EVERY stat (like Sleep). */}
              <span className="bm-chip">{d.chip}</span>
              <ConfBar conf={d.conf} />
            </button>
          )
        })}
      </div>
      <p className="bm-note">Each shows your <b>chosen</b> value + how confident the estimate is. Tap for the science behind it, and to switch manual ↔ computed.{showsFtp && <> FTP's eFTP trend is on the <Link to="/cycling-stats">Cycling</Link> page.</>}</p>
      {prof && (
        <div className="prof">
          <div className="prof__type">{prof.emoji} {prof.type} <span className="prof__badge">{prof.badge}</span></div>
          <div className="prof__say">{prof.summary}</div>
          {/* #508 — explicit STRENGTH + TO-IMPROVE (JM approved). What the coach reads to know you. */}
          <div style={{ background: '#12151b', border: '1px solid #242a34', borderRadius: 12, padding: '2px 13px', margin: '4px 0 14px' }}>
            {([{ ic: '💪', lb: 'Your strength', c: 'var(--accent)', d: prof.strength }, { ic: '🎯', lb: 'To improve', c: '#f5b53d', d: prof.weakness }] as const).map((row, i) => (
              <div key={row.lb} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 0', borderTop: i ? '1px solid #21252e' : undefined }}>
                <span style={{ fontSize: 17, lineHeight: 1.3 }}>{row.ic}</span>
                <div><div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 800, color: row.c, marginBottom: 2 }}>{row.lb}</div><div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}><b style={{ color: 'var(--text)' }}>{row.d.lead}.</b> {row.d.body}</div></div>
              </div>
            ))}
          </div>
          {prof.reads.map((m) => <div key={m.k} className="prof__m"><div className="prof__mk"><span className="k">{m.k}</span><b>{m.v}</b></div><div className="r">{m.r}</div></div>)}
          <div className="prof__foc"><h4>🎯 What your coach will work on</h4><ul>{prof.focus.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        </div>
      )}
      {showTrendsLink && <Link to="/stats" className="bm-trends">See trends &amp; race predictions in Stats ›</Link>}
      {openDef && <Sheet def={openDef} prefer={prefOf(openDef)} onPref={(p) => authApi.saveProfile({ statPrefs: { [openDef.key]: p } }).then(() => refresh()).catch(() => {})} onSaveManual={(v) => { if (v != null) openDef.save(v) }} onClose={() => setOpen(null)} />}
    </div>
  )
}
