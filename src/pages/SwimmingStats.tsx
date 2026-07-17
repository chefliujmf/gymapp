import { type CSSProperties } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { swimZones, fmtPace100 } from '../swimming'
import { BenchmarksCard } from '../Benchmarks'

// #swim-tri — Swimming per-sport stats, built to the SAME shape as Running/Cycling (JM: "same learning format"):
// the CSS benchmark card (value + confidence + tap-to-edit, the ONE place to set it) then CSS-anchored zones.
// CSS = swim threshold pace (sec/100 m), stored server-side in sportSettings.swimming.thresholdPace.
const ZONE_COLORS = ['#5ec8ff', '#34e07d', '#f5b53d', '#ff8f3d', '#ff5d5d'] // cool → warm, matches the run zones

export default function SwimmingStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSwimmer = hasModule(user?.sports || [], 'swimming')
  const css = user?.sportSettings?.swimming?.thresholdPace || null // sec/100 m
  const zones = css ? swimZones(css) : []

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Swimming</h1><p>CSS · D′ · TTE · SWOLF · zones</p></div>
      </div>
      {!isSwimmer ? (
        <p className="meta">Add Swimming in <Link to="/profile" style={{ color: 'var(--accent)' }}>Profile</Link> to see your swim stats.</p>
      ) : (
        <>
          {/* The swim benchmark cards — the SAME card component + grid as Cycling (FTP/CP/W′/TTE) and Running
              (threshold/CS/D′/TTE): CSS (threshold anchor) · D′ (sprint reserve) · TTE (time at CSS) · SWOLF
              (stroke efficiency). Each shows value + confidence and taps to set / switch manual↔computed. */}
          <BenchmarksCard only={['css', 'dPrimeSwim', 'tteSwim', 'swolf']} />

          {zones.length > 0 && (
            <>
              <div className="stat-sub">Training pace zones <span className="meta">· target /100 m · cool → hard</span></div>
              <div className="zlist">
                {zones.map((z, i) => (
                  <div className="zrow zrow--pace" key={z.zone} style={{ '--zc': ZONE_COLORS[i] } as CSSProperties}>
                    <span className="zname"><span className="zname-top">Z{z.zone} {z.name}</span></span>
                    <span className="zpace" style={{ color: ZONE_COLORS[i] }}>{fmtPace100(Math.min(z.paceFast, z.paceSlow))}–{fmtPace100(Math.max(z.paceFast, z.paceSlow))}<span className="zunit">/100</span></span>
                  </div>
                ))}
              </div>
              <div className="act-ins" style={{ marginTop: 12 }}><span className="tag">💡</span>Z3 is CSS pace — the key session. Most weeks: mostly easy aerobic + drills, 1–2 CSS sets, a little speed.</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
