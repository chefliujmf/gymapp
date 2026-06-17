import { Link, useNavigate, useParams } from 'react-router-dom'
import { allEnduranceById } from '../data/catalog'
import { IntervalProfile, flattenIntervals, zoneColor, sportIcon, computeTSS } from '../ui'
import { setCurrentRide, segmentsFromEndurance } from '../ride'
import { getSetting } from '../db'

function fmtDur(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

/** Build a Zwift .zwo workout file from the structured intervals. */
function toZwo(name: string, description: string, intervals: { duration: number; rawPower: number }[]) {
  const steps = intervals
    .map((iv) => `    <SteadyState Duration="${Math.round(iv.duration)}" Power="${(iv.rawPower / 100).toFixed(3)}"/>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>JOIN (via gymapp)</author>
  <name>${name.replace(/[<&>]/g, '')}</name>
  <description>${description.replace(/[<&>]/g, '')}</description>
  <sportType>bike</sportType>
  <workout>
${steps}
  </workout>
</workout_file>`
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function CycleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const w = id ? allEnduranceById[id] : undefined
  if (!w) return <div className="page-head"><Link to="/cycle" className="back">← Ride</Link><h1>Not found</h1></div>

  const ivs = flattenIntervals(w)

  async function ride() {
    const ftp = Number(await getSetting('ftp')) || 260
    setCurrentRide({ title: w!.name, sport: w!.sport, segments: segmentsFromEndurance(w!), ftp, source: w!.id })
    navigate('/ride-player')
  }

  return (
    <div>
      <Link to="/cycle" className="back">← Ride</Link>
      <div className="page-head">
        <span className="eyebrow">{sportIcon[w.sport]} {w.sport} · {w.category}</span>
        <h1>{w.name}</h1>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <IntervalProfile w={w} height={110} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
        <div className="stat"><div className="v">{w.duration}</div><div className="k">minutes</div></div>
        <div className="stat"><div className="v">{computeTSS(w)}</div><div className="k">TSS</div></div>
        {w.intensity != null && <div className="stat"><div className="v">{Math.round(w.intensity)}/5</div><div className="k">difficulty</div></div>}
      </div>

      {w.description && <p className="meta" style={{ marginTop: 12 }}>{w.description}</p>}

      <button className="btn" style={{ marginTop: 14 }} onClick={ride}>▶ Ride now (indoor)</button>

      <div className="chips" style={{ marginTop: 12 }}>
        <button className="chip" onClick={() => download(`${w.id}.zwo`, toZwo(w.name, w.description || '', ivs), 'application/xml')}>
          ⬇ Export .zwo (Zwift)
        </button>
      </div>

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
