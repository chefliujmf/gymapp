import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSetting, saveRideTemplate, getRideTemplate, type RideSegment } from '../db'
import { calApi, newId } from '../calendar'
import { localISO } from '../date'
import { Bike, Footprints, Trash2, Plus, X } from 'lucide-react'

// Zone colour for a % of FTP (ride) or threshold pace (run) — mirrors the player.
const zoneColor = (p: number) =>
  p < 56 ? '#7fd1ff' : p < 76 ? '#34e07d' : p < 91 ? '#b6e34e' : p < 106 ? '#ffd23d' : p < 121 ? '#ffb13d' : '#ff6b6b'

type Preset = { label: string; seg: RideSegment }
const presets = (sport: 'ride' | 'run'): Preset[] => [
  { label: 'Warm-up', seg: { duration: 600, powerStart: 50, powerEnd: 65, label: 'warm-up' } },
  { label: 'Endurance', seg: { duration: 1200, powerStart: 65, powerEnd: 65, label: 'endurance' } },
  { label: 'Tempo', seg: { duration: 600, powerStart: 85, powerEnd: 85, label: 'tempo' } },
  { label: 'Threshold', seg: { duration: 480, powerStart: 100, powerEnd: 100, label: 'threshold' } },
  { label: sport === 'ride' ? 'VO₂' : 'Hard', seg: { duration: 180, powerStart: 115, powerEnd: 115, label: 'hard' } },
  { label: 'Recovery', seg: { duration: 300, powerStart: 50, powerEnd: 50, label: 'recovery' } },
  { label: 'Cool-down', seg: { duration: 600, powerStart: 65, powerEnd: 45, label: 'cool-down' } },
]

const unit = (sport: 'ride' | 'run') => (sport === 'ride' ? '% FTP' : '% thr')

export default function RideBuilder({ sport }: { sport: 'ride' | 'run' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') ? Number(params.get('id')) : undefined

  const [name, setName] = useState(sport === 'ride' ? 'My ride' : 'My run')
  const [segs, setSegs] = useState<RideSegment[]>([{ duration: 600, powerStart: 50, powerEnd: 65, label: 'warm-up' }])
  const [ftp, setFtp] = useState(260)
  const [date, setDate] = useState(localISO())
  const [showAdd, setShowAdd] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { getSetting('ftp').then((v) => v && setFtp(Number(v))) }, [])
  useEffect(() => {
    if (editId == null) return
    getRideTemplate(editId).then((t) => { if (t) { setName(t.name); setSegs(t.segments) } })
  }, [editId])

  const total = useMemo(() => segs.reduce((s, x) => s + x.duration, 0), [segs])
  const Icon = sport === 'ride' ? Bike : Footprints

  const set = (i: number, patch: Partial<RideSegment>) => setSegs((arr) => arr.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const del = (i: number) => setSegs((arr) => arr.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => setSegs((arr) => {
    const j = i + dir; if (j < 0 || j >= arr.length) return arr
    const next = [...arr];[next[i], next[j]] = [next[j], next[i]]; return next
  })

  async function save(): Promise<number | undefined> {
    if (!segs.length) { setMsg('Add at least one segment'); return }
    const id = await saveRideTemplate({ id: editId, name: name.trim() || 'Untitled', sport, segments: segs })
    return Number(id)
  }
  async function saveAndClose() { if (await save()) navigate(sport === 'ride' ? '/cycle' : '/run') }
  async function addToDay() {
    await save()
    await calApi.savePlan({ id: newId(), date, sport, title: name.trim() || 'Untitled', ftp, segments: segs })
    setMsg(`✓ Saved and added to ${date}`); setShowAdd(false)
  }

  return (
    <div className="rp">
      <div className="rp-top">
        <button className="rp-x" onClick={() => navigate(-1)}><X size={20} /></button>
        <div className="rp-title"><Icon size={18} /> Build a {sport}</div>
        <button className="rp-fin" onClick={saveAndClose}>Save</button>
      </div>

      <div style={{ padding: '4px 16px 24px', maxWidth: 640, margin: '0 auto' }}>
        <input className="search" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />

        {/* profile preview */}
        <div className="rp-profile" style={{ marginTop: 8 }}>
          {segs.map((s, i) => (
            <div key={i} className="rp-bar" style={{
              flexGrow: Math.max(0.04, s.duration / Math.max(total, 1)),
              height: `${Math.max(10, Math.min(100, (Math.max(s.powerStart, s.powerEnd) / 150) * 100))}%`,
              background: zoneColor(Math.max(s.powerStart, s.powerEnd)),
            }} />
          ))}
        </div>
        <p className="meta" style={{ margin: '8px 2px 14px' }}>{Math.round(total / 60)} min · {segs.length} segment{segs.length === 1 ? '' : 's'} · targets are {unit(sport)}</p>

        {/* segment editor */}
        <div className="stack" style={{ gap: 8 }}>
          {segs.map((s, i) => {
            const ramp = s.powerStart !== s.powerEnd
            return (
              <div key={i} className="card" style={{ display: 'block', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="cal-chip" style={{ background: zoneColor(Math.max(s.powerStart, s.powerEnd)) + '22', color: zoneColor(Math.max(s.powerStart, s.powerEnd)), width: 26, height: 26, borderRadius: 7, fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                  <input className="search" style={{ margin: 0, flex: 1 }} placeholder="label" value={s.label ?? ''} onChange={(e) => set(i, { label: e.target.value })} />
                  <button className="entry-kebab" onClick={() => move(i, -1)} disabled={i === 0} title="Up">↑</button>
                  <button className="entry-kebab" onClick={() => move(i, 1)} disabled={i === segs.length - 1} title="Down">↓</button>
                  <button className="entry-kebab entry-act--del" onClick={() => del(i)} title="Remove"><Trash2 size={15} /></button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="meta">min <input type="number" min={1} value={Math.round(s.duration / 60)} onChange={(e) => set(i, { duration: Math.max(1, Number(e.target.value)) * 60 })} style={numStyle} /></label>
                  <label className="meta">{ramp ? 'from ' : ''}{unit(sport)} <input type="number" min={0} value={s.powerStart} onChange={(e) => set(i, { powerStart: Number(e.target.value) })} style={numStyle} /></label>
                  <label className="meta">to <input type="number" min={0} value={s.powerEnd} onChange={(e) => set(i, { powerEnd: Number(e.target.value) })} style={numStyle} /></label>
                  {!ramp && <button className="chip" onClick={() => set(i, { powerEnd: s.powerStart + 10 })}>make ramp</button>}
                  {ramp && <button className="chip" onClick={() => set(i, { powerEnd: s.powerStart })}>flat</button>}
                </div>
              </div>
            )
          })}
        </div>

        {/* add segment via preset */}
        <div className="chips" style={{ marginTop: 12 }}>
          {presets(sport).map((p) => (
            <button key={p.label} className="chip" onClick={() => setSegs((arr) => [...arr, { ...p.seg }])}><Plus size={13} /> {p.label}</button>
          ))}
        </div>

        {/* actions */}
        {!showAdd ? (
          <button className="btn" style={{ marginTop: 18 }} onClick={() => { setShowAdd(true); setMsg('') }}>📅 Save & add to a day</button>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 10, borderRadius: 8, background: '#0f0f12', color: '#fff', border: '1px solid #2c2c34', fontSize: 16 }} />
            <button className="btn" style={{ width: 'auto', padding: '10px 16px' }} onClick={addToDay}>Add</button>
            <button className="btn btn--ghost" style={{ width: 'auto', padding: '10px 16px' }} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        )}
        <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={saveAndClose}>Save to my {sport === 'ride' ? 'rides' : 'runs'}</button>
        {msg && <p className="auth-note">{msg}</p>}
      </div>
    </div>
  )
}

const numStyle: React.CSSProperties = { width: 64, padding: '8px 10px', borderRadius: 8, background: '#0f0f12', color: '#fff', border: '1px solid #2c2c34', fontSize: 16, marginLeft: 6 }
