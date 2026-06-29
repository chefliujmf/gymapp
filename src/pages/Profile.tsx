import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'
import { authApi, type SportGroup, type SportStat, type IcuAthletePull } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { fetchAthleteSex } from '../intervals'
import { vdotFromThresholdPace, paceZones, racePredictions, fmtPace, fmtTime, parsePace } from '../running-paces'

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

  // #210: pull the athlete's intervals sport settings to PREFILL + show what's synced.
  useEffect(() => {
    if (user?.hasIcuKey) authApi.pullIcuAthlete().then(setPulled).catch(() => {})
  }, [user?.hasIcuKey])

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
  const val = (g: SportGroup, f: keyof SportStat): number | null => (ss[g]?.[f] ?? pss[g]?.[f] ?? null)
  // green "intervals" when we have a value to sync, amber "set it" when connected but blank, nothing when not connected
  const icuTag = (v: number | null): ReactNode => connected ? <Tag label={v != null ? 'intervals' : 'set it'} kind={v != null ? 'icu' : 'unset'} /> : undefined

  const saveSport = (group: SportGroup, patch: Partial<SportStat> & { runVdot?: number | null }) =>
    authApi.saveSportStat({ group, ...patch }).then(() => refresh()).catch(() => {})
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
          {zones && (
            <>
              <div className="stat-sub">Daniels pace zones <span className="meta">(min/km)</span></div>
              <div className="zone-row">
                <span className="zone"><b>E</b> {fmtPace(zones.easy[0])}–{fmtPace(zones.easy[1])}</span>
                <span className="zone"><b>M</b> {fmtPace(zones.marathon)}</span>
                <span className="zone"><b>T</b> {fmtPace(zones.threshold)}</span>
                <span className="zone"><b>I</b> {fmtPace(zones.interval)}</span>
                <span className="zone"><b>R</b> {fmtPace(zones.rep)}</span>
              </div>
            </>
          )}
          {preds && (
            <>
              <div className="stat-sub">Race predictions <span className="meta">(from your VDOT)</span></div>
              <div className="zone-row">
                {preds.map((p) => <span key={p.label} className="pred"><b>{p.label}</b> {fmtTime(p.sec)} <span className="meta">{fmtPace(p.pace)}/km</span></span>)}
              </div>
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
