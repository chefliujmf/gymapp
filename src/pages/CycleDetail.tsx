import { useNavigate, useParams } from 'react-router-dom'
import { allEnduranceById } from '../data/catalog'
import { IntervalProfile, zoneColor, sportIcon, computeTSS } from '../ui'
import { setCurrentRide, segmentsFromEndurance, canPlayHere } from '../ride'
import { useBle } from '../BleContext'
import { getSetting } from '../db'

function fmtDur(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

export default function CycleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ble = useBle()
  const w = id ? allEnduranceById[id] : undefined
  const isRun = w?.sport === 'running'
  if (!w) return <div className="page-head"><button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button><h1>Not found</h1></div>

  async function start() {
    const ftp = Number(await getSetting('ftp')) || 260
    setCurrentRide({ title: w!.name, sport: w!.sport, segments: segmentsFromEndurance(w!), ftp, source: w!.id })
    navigate(isRun ? '/run-player' : '/ride-player')
  }

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <span className="eyebrow">{sportIcon[w.sport]} {w.sport} · {w.category}</span>
        <h1>{w.name}</h1>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <IntervalProfile w={w} height={110} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginTop: 12 }}>
        <div className="stat"><div className="v">{w.duration}</div><div className="k">minutes</div></div>
        <div className="stat"><div className="v">{computeTSS(w)}</div><div className="k">TSS</div></div>
      </div>

      {w.description && <p className="meta" style={{ marginTop: 12 }}>{w.description}</p>}

      {canPlayHere(!!ble.bridge)
        ? <>
            <button className="btn" style={{ marginTop: 10 }} onClick={start}>▶ {isRun ? 'Start run (audio cues)' : 'Ride now'}</button>
            <p className="meta" style={{ marginTop: 8 }}>{isRun ? 'Spoken cues call out each interval & target — eyes up, treadmill or outdoor.' : 'Guided ERG workout on a smart trainer. Outdoor rides sync from your bike computer.'}</p>
          </>
        : <div className="phone-gate" style={{ marginTop: 10 }}>📱 Open Platyplus on your phone to {isRun ? 'run with audio cues' : 'ride'} — that's where your HR strap &amp; trainer connect.</div>}

      <div className="section-title" style={{ marginTop: 18 }}>Structure</div>
      <div className="stack">
        {w.blocks.map((b, bi) => (
          <div key={bi} className="card" style={{ padding: '12px 14px' }}>
            {(b.numRepeats || 1) > 1 && <div className="eyebrow" style={{ marginBottom: 6 }}>{b.numRepeats}× repeat</div>}
            {b.intervals.map((iv, ii) => (
              <div key={ii} className="card-row" style={{ padding: '4px 0', alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: zoneColor(iv.rawPower || 0), display: 'inline-block' }} />
                <div className="card-body" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <span>{fmtDur(iv.duration)}</span>
                  <span className="meta">
                    {iv.rawPower}% FTP{iv.power ? ` · ${iv.power}W` : ''}{iv.heartRate ? ` · ${iv.heartRate} bpm` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
