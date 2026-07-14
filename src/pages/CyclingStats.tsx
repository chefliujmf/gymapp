import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { BenchmarksCard } from '../Benchmarks'
// #510 — ALL metric GRAPHS (eFTP/EF trends + power-duration/season curve) are PARKED for the roadmap (JM 2026-07-13);
// the chart components + SeasonCompare stay in the codebase, just not rendered on the Cycling stats page for now.

// #225 — Cycling per-sport stats: power curve · eFTP · VO₂max · W/kg. Split out of /fitness (which
// is now global Load & Form only).
export default function CyclingStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isCycling = hasModule(user?.sports || [], 'cycling')

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Cycling</h1><p>FTP · CP · W′ · VO₂max · Max HR</p></div>
      </div>
      {!isCycling ? (
        <p className="meta">Add Cycling in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your power stats.</p>
      ) : !user?.hasIcuKey ? (
        <p className="meta">Connect intervals.icu in <span style={{ color: 'var(--accent)' }}>Profile</span> to see your power curve & FTP.</p>
      ) : (
        <>
          {/* #385 — same polished benchmark cards as Global, filtered to cycling (FTP · VO₂max · Max HR). */}
          <BenchmarksCard only={['ftp', 'cp', 'wPrime', 'tteRide']} profile="cycling" />{/* #512 — VO₂max + Max HR are whole-body, NOT per-sport → they live in the overall Stats benchmarks, not here */}
          {/* #510 — ALL metric GRAPHS (eFTP trend, EF trend, power-duration + season-compare curve) PARKED for the
              roadmap (JM 2026-07-13: "remove the metric graphs, it's for the roadmap"). The benchmark CARDS above stay;
              the chart components stay in the codebase and return with the intervals-parity rebuild. */}
        </>
      )}
    </div>
  )
}
