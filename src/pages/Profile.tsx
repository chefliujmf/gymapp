import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'
import { authApi, type SportGroup, type SportStat, type IcuAthletePull } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { fetchAthleteSex } from '../intervals'
import { vdotFromThresholdPace, paceZones, racePredictions, marathonRealism, fmtPace, fmtTime, parsePace, type PaceZones, type RunVolume } from '../running-paces'

// #214 — spell each Daniels zone out (letter + what it's for) so the paces are legible, not cryptic.
const ZONE_META: { letter: string; name: string; purpose: string }[] = [
  { letter: 'E', name: 'Easy', purpose: 'recovery & long runs' },
  { letter: 'M', name: 'Marathon', purpose: 'steady race pace' },
  { letter: 'T', name: 'Threshold', purpose: 'tempo — comfortably hard, ~1 h effort' },
  { letter: 'I', name: 'Interval', purpose: 'VO₂max — 3–5 min hard reps' },
  { letter: 'R', name: 'Rep', purpose: 'speed & form — short, fast' },
]
const zonePaceStr = (z: PaceZones, letter: string): string =>
  letter === 'E' ? `${fmtPace(z.easy[0])}–${fmtPace(z.easy[1])}`
    : letter === 'M' ? fmtPace(z.marathon)
      : letter === 'T' ? fmtPace(z.threshold)
        : letter === 'I' ? fmtPace(z.interval) : fmtPace(z.rep)

const SPORTS: [string, string][] = [['cycling', 'Cycling'], ['running', 'Running'], ['strength', 'Strength'], ['yoga', 'Yoga'], ['pilates', 'Pilates'], ['meditation', 'Meditation']]
const DIETS: [string, string][] = [['vegetarian', 'vegetarian'], ['vegan', 'vegan'], ['no preference', 'no preference']]

const clampN = (n: number | null, lo: number, hi: number) => (n == null ? null : Math.min(hi, Math.max(lo, n)))

// source tag on a stat: synced-with-intervals (green), Platyplus-computed (violet), or not-set (amber)
function Tag({ label, kind }: { label: string; kind: 'icu' | 'pp' | 'unset' }) {
  return <span className={`stat-tag stat-tag--${kind}`}>{label}</span>
}

// One editable stat that autosaves on blur. `fmt`/`parse` handle number vs m:ss pace.
function StatCell({ label, tag, value, unit, placeholder, fmt, parse, onSave }: {
  label: string; tag?: ReactNode; value: number | null; unit?: string; placeholder?: string
  fmt: (n: number) => string; parse: (s: string) => number | null; onSave: (v: number | null) => void
}) {
  const [txt, setTxt] = useState(value != null ? fmt(value) : '')
  const [saved, setSaved] = useState(false)
  useEffect(() => { setTxt(value != null ? fmt(value) : '') }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const t = txt.trim()
    if (t === '') { if (value != null) { onSave(null); flash() } return }
    const v = parse(t)
    if (v == null) { setTxt(value != null ? fmt(value) : '') ; return } // junk → revert
    if (v !== value) { onSave(v); flash() }
  }
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1300) }
  return (
    <label className="stat-cell">
      <span className="stat-cell__l">{label}{tag}{saved && <span className="stat-cell__ok"> saved ✓</span>}</span>
      <span className="stat-cell__in">
        <input className="stat-cell__i" inputMode="decimal" value={txt} placeholder={placeholder || '—'}
          onChange={(e) => setTxt(e.target.value)} onBlur={commit} />
        {unit && <span className="stat-cell__u">{unit}</span>}
      </span>
    </label>
  )
}

export default function Profile() {
  const { user, refresh } = useAuth()
  const coachName = useLiveQuery(() => getSetting('coachName'))
  const [coachSaved, setCoachSaved] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)
  const [dietSaved, setDietSaved] = useState(false)
  const [pulled, setPulled] = useState<IcuAthletePull | null>(null)
  const [runEst, setRunEst] = useState<{ available: boolean; thresholdPace?: number } | null>(null)
  const [runVol, setRunVol] = useState<{ available: boolean; longestKm?: number; weeklyKm?: number } | null>(null)

  // #210: intervals is canonical for synced stats — pull to display + re-pull after each edit.
  const pull = () => { if (user?.hasIcuKey) authApi.pullIcuAthlete().then(setPulled).catch(() => {}) }
  useEffect(() => { pull() }, [user?.hasIcuKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // #215: estimate the running threshold pace from intervals' pace curve (Critical Speed).
  useEffect(() => {
    if (user?.hasIcuKey && (user?.sports || []).includes('running')) {
      authApi.runEstimate().then(setRunEst).catch(() => {})
      authApi.runVolume().then(setRunVol).catch(() => {}) // #216 marathon-realism durability base
    }
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [user?.hasIcuKey, (user?.sports || []).includes('running')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sex from intervals (gates the female-athlete coaching module) — optional.
  useEffect(() => {
    if (user && !user.sex && user.hasIcuKey) fetchAthleteSex().then((s) => { if (s) authApi.saveProfile({ sex: s }).then(() => refresh()).catch(() => {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sex, user?.hasIcuKey])

  const toggleSport = (v: string) => {
    const cur = user?.sports || []
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    authApi.saveProfile({ sports: next }).then(() => { refresh(); setSportSaved(true); setTimeout(() => setSportSaved(false), 1500) }).catch(() => {})
  }
  const diet = (user?.info as { diet?: string } | undefined)?.diet ?? 'no preference'
  const setDiet = (v: string) => { setSetting('diet', v); authApi.saveProfile({ diet: v }).then(() => refresh()).catch(() => {}); setDietSaved(true); setTimeout(() => setDietSaved(false), 1500) }

  const connected = !!user?.hasIcuKey
  const ss = user?.sportSettings || {}
  const pss = pulled?.sportSettings || {}
  // when connected, intervals is canonical → prefer the pulled value; offline → local mirror.
  const val = (g: SportGroup, f: keyof SportStat): number | null => connected ? (pss[g]?.[f] ?? ss[g]?.[f] ?? null) : (ss[g]?.[f] ?? null)
  // green "intervals" when we have a value to sync, amber "set it" when connected but blank, nothing when not connected
  const icuTag = (v: number | null): ReactNode => connected ? <Tag label={v != null ? 'intervals' : 'set it'} kind={v != null ? 'icu' : 'unset'} /> : undefined

  // save → push to intervals, then re-pull so the card shows what's actually in intervals now.
  const saveSport = (group: SportGroup, patch: Partial<SportStat> & { runVdot?: number | null }) =>
    authApi.saveSportStat({ group, ...patch }).then(() => { refresh(); pull() }).catch(() => {})
  const saveFtp = (v: number | null) => { saveSport('cycling', { ftp: clampN(v, 50, 600) }); setSetting('ftp', String(v ?? 260)) }
  const saveRunPace = (sec: number | null) => {
    const c = clampN(sec, 120, 900)
    saveSport('running', { thresholdPace: c, runVdot: c ? Math.round(vdotFromThresholdPace(c)) : null })
    setSetting('runThresholdPace', c ? String(c) : '') // mirror for RunPlayer pace targets (offline)
  }

  const num = (lo: number, hi: number) => (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? clampN(n, lo, hi) : null }
  const avatar = user?.avatar
    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
    : (user?.username || '?').slice(0, 2).toUpperCase()

  const does = (s: string) => (user?.sports || []).includes(s)
  // running derived (Daniels VDOT → zones + race predictions)
  const runPace = val('running', 'thresholdPace')
  const vdot = runPace ? Math.round(vdotFromThresholdPace(runPace)) : (user?.runVdot ?? null)
  const zones = vdot ? paceZones(vdot) : null
  const preds = vdot ? racePredictions(vdot) : null
  // #216 marathon realism — show the marathon as a potential→realistic range (durability-adjusted).
  const runVolume: RunVolume | undefined = runVol?.available ? { longestKm: runVol.longestKm || 0, weeklyKm: runVol.weeklyKm || 0 } : undefined
  const marathon = vdot ? marathonRealism(vdot, runVolume) : null
  // #215 estimate (Critical Speed → threshold pace); only suggest when it differs from what's set
  const estPace = runEst?.available && runEst.thresholdPace ? runEst.thresholdPace : null
  const estVdot = estPace ? Math.round(vdotFromThresholdPace(estPace)) : null
  const showEst = estPace != null && estPace !== runPace

  return (
    <div>
      <div className="page-head"><h1>Profile</h1><p>You & your coaching</p></div>

      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="card-row" style={{ gap: 12, alignItems: 'center' }}>
          <span className="acct__avatar acct__avatar--lg">{avatar}</span>
          <div style={{ flex: 1 }}><strong>{user?.username}</strong><div className="meta">{user?.email} · {user?.role}</div></div>
        </div>
      </div>

      <div className="section-title">Your coach {coachSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <input
        className="search" placeholder="e.g. Tadej" value={coachName ?? ''}
        onChange={(e) => { setSetting('coachName', e.target.value); setCoachSaved(false) }}
        onBlur={(e) => { authApi.saveProfile({ coachName: e.target.value.trim() }).then(() => { setCoachSaved(true); setTimeout(() => setCoachSaved(false), 2500) }).catch(() => {}) }}
      />
      <p className="meta" style={{ margin: '6px 2px 4px' }}>What your coach goes by in chat — saved when you tap away.</p>
      <Link to="/profile/athlete" className="btn btn--ghost" style={{ marginTop: 8 }}>🏷️ Athlete profile — what your coach knows about you ›</Link>

      <div className="section-title">Sports you do {sportSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {SPORTS.map(([v, label]) => (
          <button key={v} className={'chip' + (does(v) ? ' chip--active' : '')} onClick={() => toggleSport(v)}>{label}</button>
        ))}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Pick all that apply — tunes your nav & coach. Cycling/Running unlock the endurance method & Fitness page.</p>

      <div className="section-title">Diet {dietSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {DIETS.map(([v, label]) => <button key={v} className={'chip' + (diet === v ? ' chip--active' : '')} onClick={() => setDiet(v)}>{label}</button>)}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Your coach picks ONLY meals that match — vegetarian shows veg + vegan; vegan shows vegan only.</p>

      {/* #210/#209/#211 — per-sport stats, two-way synced with intervals */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Your stats {connected && <span className="sync-pill">⇄ intervals</span>}
      </div>
      <p className="meta" style={{ margin: '2px 2px 8px' }}>
        Personalises your readiness & coach. {connected ? <>Values tagged <Tag label="intervals" kind="icu" /> are pulled from your intervals profile and <strong>sync both ways</strong> — edit here, it writes back (your custom fields are untouched). </> : null}<Tag label="est." kind="pp" /> means Platyplus computes/you set it (intervals has no such field).
      </p>

      {does('cycling') && (
        <div className="sport-card">
          <div className="sport-card__h">🚴 Cycling</div>
          <div className="stat-cell-grid">
            <StatCell label="FTP" tag={icuTag(val('cycling', 'ftp'))} unit="W" value={val('cycling', 'ftp')} fmt={String} parse={num(50, 600)} onSave={saveFtp} />
            <StatCell label="Max HR" tag={icuTag(val('cycling', 'maxHr'))} unit="bpm" value={val('cycling', 'maxHr')} fmt={String} parse={num(120, 230)} onSave={(v) => saveSport('cycling', { maxHr: v })} />
            <StatCell label="Threshold HR" tag={icuTag(val('cycling', 'lthr'))} unit="bpm" value={val('cycling', 'lthr')} fmt={String} parse={num(90, 220)} onSave={(v) => saveSport('cycling', { lthr: v })} />
          </div>
        </div>
      )}

      {does('running') && (
        <div className="sport-card">
          <div className="sport-card__h">🏃 Running {vdot ? <span className="sport-card__vdot">VDOT {vdot}</span> : null}</div>
          <div className="stat-cell-grid">
            <StatCell label="Threshold pace" tag={icuTag(runPace)} unit="/km" value={runPace} placeholder="m:ss" fmt={fmtPace} parse={parsePace} onSave={saveRunPace} />
            <StatCell label="Max HR" tag={icuTag(val('running', 'maxHr'))} unit="bpm" value={val('running', 'maxHr')} fmt={String} parse={num(120, 230)} onSave={(v) => saveSport('running', { maxHr: v })} />
            <StatCell label="Threshold HR" tag={icuTag(val('running', 'lthr'))} unit="bpm" value={val('running', 'lthr')} fmt={String} parse={num(90, 220)} onSave={(v) => saveSport('running', { lthr: v })} />
          </div>
          {showEst && !runPace && (
            <div className="est">
              <span className="est__i">📈</span>
              <span className="est__t">Estimated from your recent runs: <b>{fmtPace(estPace!)}/km</b> · VDOT {estVdot}<span className="sub">intervals Critical Speed · you can change it anytime</span></span>
              <button className="est__use" onClick={() => saveRunPace(estPace!)}>Use this</button>
            </div>
          )}
          {showEst && runPace && (
            <div className="est est--mini">
              <span className="est__t">📈 Your runs suggest <b>{fmtPace(estPace!)}/km</b> (VDOT {estVdot})</span>
              <button className="est__use" onClick={() => saveRunPace(estPace!)}>Use</button>
            </div>
          )}
          {zones && (
            <>
              <div className="stat-sub">Training pace zones <span className="meta">· target min/km for each kind of run</span></div>
              <div className="zlist">
                {ZONE_META.map((z) => (
                  <div className="zrow" key={z.letter}>
                    <span className="zbadge">{z.letter}</span>
                    <span className="zname">{z.name}<span className="zpurpose">{z.purpose}</span></span>
                    <span className="zpace">{zonePaceStr(zones, z.letter)}<span className="zunit">/km</span></span>
                  </div>
                ))}
              </div>
            </>
          )}
          {preds && marathon && (
            <>
              <div className="stat-sub">Race predictions <span className="meta">· times your VDOT projects</span></div>
              <div className="zlist">
                {preds.filter((p) => p.label !== 'Marathon').map((p) => (
                  <div className="zrow" key={p.label}>
                    <span className="zname">{p.label}<span className="zpurpose">at {fmtPace(p.pace)}/km</span></span>
                    <span className="zpace">{fmtTime(p.sec)}</span>
                  </div>
                ))}
                {/* #216 — marathon as a potential→realistic range */}
                <div className="zrow zrow--mar">
                  <span className="zname"><span className="zname-top">Marathon <span className="range-badge">range</span></span><span className="zpurpose">potential → realistic</span></span>
                  <span className="zpace zpace--mar">{fmtTime(marathon.potentialSec)}–{fmtTime(marathon.realisticSec)}<span className="zsub">{fmtPace(marathon.potentialPace)}–{fmtPace(marathon.realisticPace)}/km</span></span>
                </div>
              </div>
              <p className="pred-note">
                Low end is your physiological <b>potential</b> (Daniels VDOT); the high end adds a <b>{Math.round(marathon.penalty * 100)}% durability penalty</b>{' '}
                {marathon.hasVolume
                  ? <>for your current base (longest run <b>{marathon.volume!.longestKm} km</b>, ~{Math.round(marathon.volume!.weeklyKm)} km/week) — it shrinks as your long runs grow toward 30 km+.</>
                  : <>by default — {connected ? 'no recent runs to read your base from yet' : 'connect intervals'} for a personal estimate from your long runs.</>}
                {' '}Reality lands in the band; most of any gap to Coros/Garmin is your threshold pace reading fast{estPace && estPace !== runPace ? <> — <b>use the estimate above</b></> : null}.
              </p>
            </>
          )}
          {!runPace && <p className="meta" style={{ margin: '6px 2px 0' }}>Set your threshold pace (the ~1 h race pace you can hold) → unlocks Daniels zones, VDOT & race predictions, and syncs to intervals.</p>}
        </div>
      )}

      {does('swimming') && (
        <div className="sport-card">
          <div className="sport-card__h">🏊 Swimming</div>
          <div className="stat-cell-grid">
            <StatCell label="Threshold pace" tag={icuTag(val('swimming', 'thresholdPace'))} unit="/100m" value={val('swimming', 'thresholdPace')} placeholder="m:ss" fmt={fmtPace} parse={parsePace} onSave={(v) => saveSport('swimming', { thresholdPace: clampN(v, 40, 300) })} />
            <StatCell label="Max HR" tag={icuTag(val('swimming', 'maxHr'))} unit="bpm" value={val('swimming', 'maxHr')} fmt={String} parse={num(120, 230)} onSave={(v) => saveSport('swimming', { maxHr: v })} />
            <StatCell label="Threshold HR" tag={icuTag(val('swimming', 'lthr'))} unit="bpm" value={val('swimming', 'lthr')} fmt={String} parse={num(90, 220)} onSave={(v) => saveSport('swimming', { lthr: v })} />
          </div>
        </div>
      )}

      <div className="sport-card">
        <div className="sport-card__h">🌙 General</div>
        <div className="stat-cell-grid">
          <StatCell label="Sleep need" tag={<Tag label="you" kind="pp" />} unit="h" value={user?.sleepNeed ?? null} fmt={String} parse={num(4, 12)} onSave={(v) => authApi.saveProfile({ sleepNeed: v }).then(() => refresh()).catch(() => {})} />
          <StatCell label="VO₂max" tag={<Tag label="est." kind="pp" />} value={user?.vo2max ?? null} fmt={String} parse={num(20, 95)} onSave={(v) => authApi.saveProfile({ vo2max: v }).then(() => refresh()).catch(() => {})} />
          {connected && pulled?.weight != null && (
            <div className="stat-cell">
              <span className="stat-cell__l">Weight <Tag label="intervals" kind="icu" /></span>
              <span className="stat-cell__in"><span className="stat-cell__ro">{pulled.weight}</span><span className="stat-cell__u">kg</span></span>
            </div>
          )}
        </div>
        <p className="meta" style={{ margin: '6px 2px 0' }}>VO₂max is Platyplus's estimate (intervals stores none). Weight syncs in from your device via intervals. Leave blank to use defaults.</p>
      </div>
    </div>
  )
}
