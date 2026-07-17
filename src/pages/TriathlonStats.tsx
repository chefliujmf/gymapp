import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchSwimCurve, fetchActivities, sportOfActivity } from '../intervals'
import { fmtPace } from '../running-paces'
import { fmtPace100 } from '../swimming'
import { parseRaceType, triathlonSynthesis, RACE_DEMAND, RACE_LABEL, type Discipline, type RaceType } from '../triathlon'
import CyclingStats from './CyclingStats'
import RunningStats from './RunningStats'
import SwimmingStats from './SwimmingStats'

// #570 — Triathlon orchestration layer (JM pick: Option A + demand bar, own page). A THIN synthesis over the three
// sport engines: your LIMITER, the 3 benchmarks, and training balance vs the race. No new benchmark — it reads swim
// CSS / bike FTP / run threshold and the last-28-day load split.
const D: Record<Discipline, { icon: string; color: string; bg: string; name: string; unit: string }> = {
  swim: { icon: '🏊', color: '#38bdf8', bg: '#123047', name: 'Swim', unit: 'CSS' },
  bike: { icon: '🚴', color: '#f5b53d', bg: '#3a2f14', name: 'Bike', unit: 'FTP' },
  run: { icon: '🏃', color: '#ff8f5d', bg: '#3a221a', name: 'Run', unit: 'threshold' },
}

const DISC_PANEL: Record<Discipline, () => React.ReactElement> = {
  bike: () => <CyclingStats embedded />, swim: () => <SwimmingStats embedded />, run: () => <RunningStats embedded />,
}

export default function TriathlonStats({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isTri = (user?.sports || []).includes('triathlon')
  const [swimCss, setSwimCss] = useState<{ v: number; computed: boolean } | null>(null)
  const [load, setLoad] = useState<{ swim: number; bike: number; run: number } | null>(null)
  const [open, setOpen] = useState<Discipline | null>(null) // which discipline's full stats are expanded inline

  useEffect(() => {
    if (!isTri) return
    if (user?.hasIcuKey) fetchSwimCurve(365).then((c) => { if (c?.cs && c.cs > 0) setSwimCss({ v: Math.round(100 / c.cs), computed: true }) }).catch(() => {})
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
    fetchActivities(from, to).then((acts) => {
      const l = { swim: 0, bike: 0, run: 0 }
      for (const a of acts) { const sp = sportOfActivity(a); const key = sp === 'ride' ? 'bike' : sp === 'run' ? 'run' : sp === 'swim' ? 'swim' : null; if (key) l[key] += Number(a.icu_training_load) || 0 }
      setLoad(l)
    }).catch(() => setLoad({ swim: 0, bike: 0, run: 0 }))
  }, [isTri, user?.hasIcuKey])

  // resolve the 3 benchmarks (manual value ?? computed) + whether each is model-computed. A benchmark is "computed"
  // when it's model-derived: swim from the pace-curve; bike/run from intervals (eFTP / VDOT) when connected.
  const connected = !!user?.hasIcuKey
  const cssManual = user?.sportSettings?.swimming?.thresholdPace || null
  const cssVal = cssManual ?? swimCss?.v ?? null
  const ftpVal = user?.ftp ?? null
  const thrVal = user?.sportSettings?.running?.thresholdPace ?? user?.runThresholdPace ?? null
  const goalNotes = (user?.info as { goals?: { notes?: string } })?.goals?.notes
  const raceType: RaceType | null = parseRaceType(goalNotes)

  const syn = useMemo(() => triathlonSynthesis({
    raceType,
    swim: { has: cssVal != null, computed: cssManual == null && !!swimCss?.computed },
    bike: { has: ftpVal != null, computed: ftpVal != null && connected },
    run: { has: thrVal != null, computed: thrVal != null && (!!user?.runVdot || connected) },
    load: load || { swim: 0, bike: 0, run: 0 },
  }), [raceType, cssVal, cssManual, swimCss, ftpVal, thrVal, load, connected, user?.runVdot])

  const valOf = (d: Discipline) => d === 'swim' ? (cssVal != null ? `${fmtPace100(cssVal)}` : '—') : d === 'bike' ? (ftpVal != null ? `${Math.round(ftpVal)}` : '—') : (thrVal != null ? fmtPace(thrVal) : '—')
  const unitOf = (d: Discipline) => d === 'swim' ? '/100' : d === 'bike' ? 'W' : '/km'
  const demand = RACE_DEMAND[raceType || 'olympic']

  if (!isTri) return (
    <div>
      <div className="sub-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><div className="sub-head-t"><h1>Triathlon</h1></div></div>
      <p className="meta">Add <b>Triathlon</b> in <Link to="/profile" style={{ color: 'var(--accent)' }}>Profile</Link> to see your multi-sport synthesis.</p>
    </div>
  )

  const lim = syn.limiter ? syn.disciplines.find((x) => x.discipline === syn.limiter)! : null
  return (
    <div>
      {!embedded && <div className="sub-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button><div className="sub-head-t"><h1>Triathlon</h1><p>Limiter · balance · combined load</p></div></div>}

      <div className="eyebrow" style={{ margin: '2px 2px 0' }}>🏊🚴🏃 {raceType ? `Target: ${RACE_LABEL[raceType]}` : 'Set your race in your goals to tailor the balance'}</div>

      {/* LIMITER callout */}
      {lim ? (
        <div className="card" style={{ marginTop: 10, background: '#2a1d16', border: '1px solid #4a2f20' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div><span className="eyebrow" style={{ color: '#f0b145' }}>⚠ Your limiter</span><div style={{ fontSize: 22, fontWeight: 800, marginTop: 1 }}>{D[lim.discipline].name === 'Swim' ? 'Swimming' : D[lim.discipline].name === 'Bike' ? 'Cycling' : 'Running'}</div></div>
            <span className="tag" style={{ background: '#3a2a1c', color: '#f0b145', fontWeight: 800 }}>biggest opportunity</span>
          </div>
          <div className="meta" style={{ marginTop: 7, color: '#e6c9a8' }}>{syn.insight}</div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 10, background: '#12241a', border: '1px solid #1f3a2a' }}>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>✓ Balanced</span>
          <div className="meta" style={{ marginTop: 6 }}>{syn.insight}</div>
        </div>
      )}

      {/* 3-discipline strength row */}
      <div className="card" style={{ marginTop: 12, padding: '4px 15px' }}>
        {syn.disciplines.map((s) => {
          const strong = s.readiness >= 50
          return (
            <div key={s.discipline} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: s.discipline !== 'run' ? '1px solid #23272f' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: D[s.discipline].bg, color: D[s.discipline].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{D[s.discipline].icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{D[s.discipline].name}</b> <span className="meta" style={{ fontSize: 11.5 }}>{D[s.discipline].unit}</span>
                <div className="bar" style={{ height: 7, borderRadius: 5, background: '#2c313c', overflow: 'hidden', marginTop: 6 }}><i style={{ display: 'block', height: '100%', width: `${Math.max(4, s.readiness)}%`, background: D[s.discipline].color, borderRadius: 5 }} /></div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.hasBenchmark ? 'var(--text)' : '#f0b145', fontVariantNumeric: 'tabular-nums' }}>{valOf(s.discipline)}<span className="meta" style={{ fontSize: 10.5 }}> {s.hasBenchmark ? unitOf(s.discipline) : ''}</span></div>
                <div style={{ fontSize: 10.5, color: strong ? 'var(--accent)' : '#f0b145' }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Load share vs race demand */}
      <div className="card" style={{ marginTop: 12, padding: '13px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="eyebrow">Load share vs {RACE_LABEL[raceType || 'olympic']} demand</span><span className="meta">28-day{syn.loadTotal ? ` · ${syn.loadTotal} load` : ''}</span></div>
        <Seg parts={[[syn.disciplines[0].sharePct, '#38bdf8'], [syn.disciplines[1].sharePct, '#f5b53d'], [syn.disciplines[2].sharePct, '#ff8f5d']]} />
        <div className="meta" style={{ marginTop: 4 }}>you 🏊{syn.disciplines[0].sharePct} · 🚴{syn.disciplines[1].sharePct} · 🏃{syn.disciplines[2].sharePct}</div>
        <Seg parts={[[demand.swim, '#38bdf8'], [demand.bike, '#f5b53d'], [demand.run, '#ff8f5d']]} dim />
        <div className="meta" style={{ marginTop: 4 }}>race 🏊{demand.swim} · 🚴{demand.bike} · 🏃{demand.run}{lim && lim.sharePct < lim.demandPct * 0.6 ? <> — <b style={{ color: '#f0b145' }}>{D[lim.discipline].name.toLowerCase()} under-served</b></> : ''}</div>
      </div>

      {!user?.hasIcuKey && <p className="meta" style={{ margin: '10px 2px' }}>Connect intervals.icu to fill in your training-load balance.</p>}

      {/* Per-discipline — each expands INLINE to its full stats (the merged Triathlon tab, #570). */}
      <div className="eyebrow" style={{ margin: '16px 4px 2px' }}>Per discipline</div>
      <div className="stack" style={{ gap: 9 }}>
        {(['bike', 'swim', 'run'] as Discipline[]).map((d) => {
          const s = syn.disciplines.find((x) => x.discipline === d)!
          const isOpen = open === d
          const sub = d === 'bike' ? 'Power curve · eFTP · W/kg' : d === 'swim' ? 'CSS · D′ · TTE · SWOLF · zones' : 'Threshold · zones · VDOT'
          return (
            <div key={d} className="card" style={{ padding: 0, overflow: 'hidden', borderColor: isOpen ? D[d].color + '55' : undefined }}>
              <button onClick={() => setOpen(isOpen ? null : d)} style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: D[d].bg, color: D[d].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>{D[d].icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{D[d].name === 'Bike' ? 'Cycling' : D[d].name === 'Swim' ? 'Swimming' : 'Running'}</b> <span className="meta" style={{ fontSize: 12, color: s.hasBenchmark ? undefined : '#f0b145' }}>· {s.hasBenchmark ? `${valOf(d)}${unitOf(d) === 'W' ? ' W' : unitOf(d)}` : `${D[d].unit} not set`}</span>
                  {!isOpen && <div className="bar" style={{ height: 6, borderRadius: 5, background: '#2c313c', overflow: 'hidden', marginTop: 6 }}><i style={{ display: 'block', height: '100%', width: `${Math.max(4, s.readiness)}%`, background: D[d].color, borderRadius: 5 }} /></div>}
                  {!isOpen && <div className="meta" style={{ fontSize: 11, marginTop: 3 }}>{sub}</div>}
                </div>
                <span style={{ color: 'var(--text-dim)', fontSize: 18, flex: 'none' }}>{isOpen ? '⌄' : '›'}</span>
              </button>
              {isOpen && <div style={{ padding: '0 14px 12px', borderTop: '1px solid #23272f' }}>{DISC_PANEL[d]()}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Seg({ parts, dim }: { parts: [number, string][]; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', height: dim ? 8 : 11, borderRadius: 6, overflow: 'hidden', marginTop: dim ? 8 : 7, opacity: dim ? 0.55 : 1 }}>
      {parts.map(([w, c], i) => <span key={i} style={{ display: 'block', width: `${w}%`, background: c }} />)}
    </div>
  )
}
