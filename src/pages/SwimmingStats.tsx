import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { criticalSwimSpeed, swimZones, fmtPace100 } from '../swimming'

// #swim-tri — the per-sport Swimming stats page (peer to CyclingStats/RunningStats). CSS is the swim benchmark
// (device-local for now, like FTP): set it directly or compute from a 400/200 time-trial; zones derive from it.
const mmss = (s: string) => { const m = s.trim().match(/^(\d+):(\d{1,2})$/); return m ? +m[1] * 60 + +m[2] : (s.trim().match(/^\d+$/) ? +s : NaN) }

export default function SwimmingStats() {
  const nav = useNavigate()
  const { user, refresh } = useAuth()
  const css = user?.sportSettings?.swimming?.thresholdPace || null // CSS = swim threshold pace, s/100 (server-synced)
  const [t400, setT400] = useState('')
  const [t200, setT200] = useState('')
  const [manual, setManual] = useState('')
  const save = async (pace: number) => { await authApi.saveSportStat({ group: 'swimming', thresholdPace: Math.round(pace) }).catch(() => {}); await refresh() }
  const fromTest = () => { const a = mmss(t400), b = mmss(t200); if (!(a > 0) || !(b > 0)) return; const r = criticalSwimSpeed(a, b); if (r) save(r.cssPace100) }
  const fromManual = () => { const p = mmss(manual); if (p > 0) save(p) }
  const zones = css ? swimZones(css) : []

  return (
    <div>
      <button className="icon-btn" onClick={() => nav('/stats')} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head"><span className="eyebrow">🏊 Swimming</span><h1>CSS &amp; zones</h1></div>

      <div className="card" style={{ padding: 16 }}>
        <div className="section-title">Critical Swim Speed (CSS)</div>
        {css ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#38bdf8' }}>{fmtPace100(css)}</div>
            <div className="meta">per 100 m — your swim threshold (like FTP). All zones anchor to this.</div>
          </div>
        ) : <p className="meta" style={{ margin: '2px 0 8px' }}>Set your CSS to unlock zones + paced sets. It's your sustainable threshold pace per 100 m.</p>}

        <div className="section-title" style={{ marginTop: 14 }}>Compute from a 400 + 200 test</div>
        <p className="meta" style={{ margin: '-2px 0 8px' }}>Well warmed up, swim an all-out 400, rest fully, then an all-out 200 (same session). Enter the times (m:ss).</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="search" style={{ flex: 1 }} placeholder="400 time e.g. 6:00" value={t400} onChange={(e) => setT400(e.target.value)} />
          <input className="search" style={{ flex: 1 }} placeholder="200 time e.g. 2:52" value={t200} onChange={(e) => setT200(e.target.value)} />
        </div>
        <button className="btn" style={{ marginTop: 10 }} disabled={!(mmss(t400) > 0) || !(mmss(t200) > 0)} onClick={fromTest}>Compute &amp; save CSS</button>

        <div className="section-title" style={{ marginTop: 14 }}>Or enter it directly</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="search" style={{ flex: 1 }} placeholder="CSS pace /100 e.g. 1:34" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn" style={{ width: 'auto' }} disabled={!(mmss(manual) > 0)} onClick={fromManual}>Save</button>
        </div>
      </div>

      {css && (
        <>
          <div className="section-title" style={{ marginTop: 18 }}>Your zones (pace /100)</div>
          <div className="stack" style={{ gap: 8 }}>
            {zones.map((z) => (
              <div key={z.zone} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px' }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: '#38bdf8', color: '#06121b', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{z.zone}</div>
                <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 14 }}>{z.name}</strong></div>
                <div className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPace100(z.paceFast)}–{fmtPace100(z.paceSlow)}</div>
              </div>
            ))}
          </div>
          <div className="act-ins" style={{ marginTop: 12 }}><span className="tag">💡</span>Zone 3 is CSS pace — the key session. Most weeks: mostly easy aerobic + drills, 1–2 CSS sets, a little speed.</div>
        </>
      )}

      <div className="card" style={{ marginTop: 16, padding: 14, cursor: 'pointer' }} onClick={() => nav('/plan?add=1')}>
        <div className="card-row"><div className="thumb" style={{ color: '#38bdf8' }}>🏊</div><div className="card-body"><h3>Swim workout library</h3><div className="meta">CSS sets, endurance, technique, speed, open-water — add one to your plan ›</div></div></div>
      </div>
    </div>
  )
}
