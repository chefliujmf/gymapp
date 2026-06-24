import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db, getSetting, type WorkoutLog, type SetEntry } from '../db'
import { allWorkoutsById } from '../data/catalog'
import { authApi, type Checkin } from '../auth/api'
import { e1rm } from '../strength'

const CHK_FACES = ['💀', '😩', '😐', '😀', '🤩']
const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
function vol(sets: Record<number, SetEntry[]>) { let v = 0; for (const arr of Object.values(sets || {})) for (const s of arr || []) v += (s.weight || 0) * (s.reps || 0); return Math.round(v) }

// Weights are stored in kg; show/edit in the user's unit (#80).
const LB = 2.2046226
const toDisp = (kg: number | undefined, imp: boolean) => (kg == null ? '' : imp ? Math.round(kg * LB * 10) / 10 : kg)
const fromDisp = (v: number, imp: boolean) => (imp ? Math.round((v / LB) * 10) / 10 : v)

/** One day's check-in, shown as the colored chips that match Today (#84). */
function CheckinChips({ c }: { c: Checkin }) {
  const fresh = c.soreness == null ? undefined : 6 - c.soreness
  const chip = (label: string, v: number | undefined, cls: string) => v == null ? null
    : <span className={`mchip mchip--${cls}`}>{CHK_FACES[v - 1]} {label} {v}</span>
  if (c.energy == null && c.sleep == null && fresh == null) return null
  return (
    <div className="checkin__chips" style={{ marginBottom: 10 }}>
      {chip('Energy', c.energy, 'energy')}
      {chip('Sleep', c.sleep, 'sleep')}
      {chip('Freshness', fresh, 'soreness')}
    </div>
  )
}

function SessionCard({ log, imp }: { log: WorkoutLog; imp: boolean }) {
  const sets = log.sets || {}
  const [saved, setSaved] = useState(false)
  const unit = imp ? 'lb' : 'kg'
  const catEx = log.workoutId ? allWorkoutsById[log.workoutId]?.exercises : undefined

  const save = async (exIdx: number, setIdx: number, patch: Partial<SetEntry>) => {
    const next: Record<number, SetEntry[]> = { ...sets }
    const arr = (next[exIdx] || []).slice()
    arr[setIdx] = { ...arr[setIdx], ...patch }
    next[exIdx] = arr
    const volume = vol(next)
    await db.logs.update(log.id!, { sets: next, volume })
    if (log.sid) fetch(`/auth/logs/${log.sid}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ sets: next, volume }) }).catch(() => {})
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }
  const del = async () => {
    if (!confirm(`Delete this ${log.title || 'session'} from your history?`)) return
    await db.logs.delete(log.id!)
    if (log.sid) fetch(`/auth/logs/${log.sid}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})
  }
  const exs = Object.entries(sets)
    .map(([idx, arr]) => ({ idx: Number(idx), name: log.exNames?.[Number(idx)] || catEx?.[Number(idx)]?.name || `Exercise ${Number(idx) + 1}`, arr: (arr || []).filter((s) => s.weight || s.reps) }))
    .filter((e) => e.arr.length)
  if (!exs.length) return null
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="card-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><strong>{log.title || 'Workout'}</strong><div className="meta">{log.duration} min · {vol(sets)} {unit} volume{log.tss ? ` · ${log.tss} TSS` : ''}</div></div>
        <div className="card-row" style={{ gap: 8, flex: 'none' }}>
          {saved && <span className="meta" style={{ color: 'var(--accent)' }}>Saved ✓</span>}
          <button className="icon-btn" aria-label="Delete session" title="Delete" onClick={del} style={{ color: 'var(--danger,#ff6b6b)' }}><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="stack" style={{ gap: 12, marginTop: 8 }}>
        {exs.map((e) => {
          const best = Math.max(0, ...e.arr.map((s) => (s.weight && s.reps ? e1rm(s.weight, s.reps) : 0)))
          return (
            <div key={e.idx} className="log-ex">
              <div className="log-ex__name">{e.name}</div>
              {e.arr.map((s, si) => (
                <div key={si} className="log-set">
                  <span className="log-set__n">Set {si + 1}</span>
                  <input type="number" inputMode="decimal" value={toDisp(s.weight, imp)} onChange={(ev) => save(e.idx, si, { weight: ev.target.value === '' ? undefined : fromDisp(Number(ev.target.value), imp) })} /> {unit}
                  <span className="log-set__x">×</span>
                  <input type="number" inputMode="numeric" value={s.reps ?? ''} onChange={(ev) => save(e.idx, si, { reps: ev.target.value === '' ? undefined : Number(ev.target.value) })} /> reps
                </div>
              ))}
              {best > 0 && <div className="log-best">Best 1RM: {toDisp(Math.round(best), imp)} {unit}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Logs() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.orderBy('date').reverse().toArray())
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const [checkins, setCheckins] = useState<Checkin[]>([])
  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    authApi.checkins(from, to).then(setCheckins).catch(() => setCheckins([]))
  }, [])

  // Group everything by DAY (#84): each day = its check-in + workout session(s).
  const gym = (logs || []).filter((l) => l.sets && Object.keys(l.sets).length)
  const byDay = new Map<string, { checkin?: Checkin; sessions: WorkoutLog[] }>()
  for (const l of gym) { const d = byDay.get(l.date) || { sessions: [] }; d.sessions.push(l); byDay.set(l.date, d) }
  for (const c of checkins) { const d = byDay.get(c.date) || { sessions: [] }; d.checkin = c; byDay.set(c.date, d) }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>History</h1><p>Each day's check-in & sessions — tap a number to fix it</p></div>
      </div>
      {logs === undefined ? <p className="meta">Loading…</p> : !days.length ? <p className="meta">Nothing logged yet — your check-ins and workouts will show here by day.</p> : (
        days.map(([date, d]) => (
          <div key={date} style={{ marginBottom: 18 }}>
            <div className="section-title">{fmtDate(date)}</div>
            {d.checkin && <CheckinChips c={d.checkin} />}
            <div className="stack">{d.sessions.map((l) => <SessionCard key={l.id} log={l} imp={imp} />)}</div>
            {!d.sessions.length && d.checkin && <p className="meta" style={{ margin: '2px 2px 0' }}>Rest day — checked in, no session.</p>}
          </div>
        ))
      )}
    </div>
  )
}
