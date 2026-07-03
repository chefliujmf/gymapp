import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db, getSetting, syncLogsFromServer, type WorkoutLog, type SetEntry } from '../db'
import { allWorkoutsById } from '../data/catalog'
import { authApi, type Checkin } from '../auth/api'
import { e1rm } from '../strength'
import { fetchActivities, sportOfActivity, type IcuActivity } from '../intervals'
import { incompleteFeedback } from '../feedbackGaps'
import { DoneStats } from '../ui'
import { buildDayEntries } from '../logs-merge'
import { DateRangeFilter, type RangePreset } from '../DateRange'
import { localISO } from '../date'

// #226 — History filters. Normalise an entry to a filterable type + its title.
const HISTORY_PRESETS: RangePreset[] = [{ label: '7 d', days: 7 }, { label: '30 d', days: 30 }, { label: '3 mo', days: 90 }, { label: '1 yr', days: 365 }]
const TYPE_FILTERS: [string, string][] = [['all', 'All'], ['ride', '🚴 Ride'], ['run', '🏃 Run'], ['gym', '🏋️ Gym'], ['mind', '🧘 Mind']]
const normType = (d?: string) => { const s = String(d || '').toLowerCase(); return /ride|cycl/.test(s) ? 'ride' : /run/.test(s) ? 'run' : /gym|strength|weight/.test(s) ? 'gym' : /mind|yoga|pilates|medit/.test(s) ? 'mind' : 'other' }

// emoji for a discipline/sport so every History row reads at a glance
const SPORT_EMOJI: Record<string, string> = { cycling: '🚴', ride: '🚴', running: '🏃', run: '🏃', strength: '🏋️', gym: '🏋️', swimming: '🏊', swim: '🏊', walking: '🚶', walk: '🚶', yoga: '🧘', pilates: '🧘', meditation: '🧠' }
const emojiFor = (s?: string) => SPORT_EMOJI[String(s || '').toLowerCase()] || '✦'

// A Platyplus endurance/manual log (no sets) — compact stat line + source tag (#130).
function ActivityLogCard({ log }: { log: WorkoutLog }) {
  const bits = [
    log.duration ? `⏱ ${log.duration} min` : '',
    log.distanceKm ? `📍 ${log.distanceKm.toFixed(1)} km` : '',
    log.avgHr ? `❤️ ${Math.round(log.avgHr)} bpm` : '',
    log.avgPower ? `⚡ ${Math.round(log.avgPower)} W` : '',
    log.tss ? `🔥 ${log.tss} TSS` : '',
    log.rpe ? `RPE ${log.rpe}` : '',
  ].filter(Boolean).join(' · ')
  return (
    <div className="card hist-card">
      <div className="hist-row">
        <span className="hist-ic">{emojiFor(log.discipline)}</span>
        <div className="hist-body"><h3>{log.title}</h3>{bits && <div className="meta">{bits}</div>}</div>
        <span className="src-tag src-pp">Platyplus</span>
      </div>
    </div>
  )
}

// #340 — one banner rolling up sessions whose CORE feedback (feel + RPE) is still missing, then a
// knock-out list (oldest first so nothing goes stale). Each row deep-links to the activity's feedback.
function IncompleteFeedbackBanner({ acts }: { acts: IcuActivity[] }) {
  const gaps = incompleteFeedback(acts)
  if (!gaps.length) return null
  const show = gaps.slice(0, 6)
  const dayLabel = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) : '')
  return (
    <div className="fbgap">
      <div className="fbban">
        <div className="fbban__ic">📝</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fbban__t">{gaps.length} session{gaps.length > 1 ? 's' : ''} still need your feedback</div>
          <div className="fbban__s">Your coach reviews it and adapts your plan — a minute each. Oldest first so nothing goes stale.</div>
        </div>
      </div>
      {show.map(({ act, status }) => (
        <Link key={String(act.id)} to={`/activity/${act.id}`} className="fbrow">
          <div className="fbrow__th">{SPORT_EMOJI[sportOfActivity(act)] || '⏱️'}</div>
          <div className="fbrow__b">
            <div className="fbrow__t">{act.name || 'Activity'} · {dayLabel(act.start_date_local)}</div>
            <div className="fbrow__m">{status.missing.map((m) => <span key={m} className="fbmiss">{m}</span>)}</div>
            <div className="fbprog"><i style={{ width: `${Math.max(6, status.pct)}%` }} /></div>
          </div>
          <span className="fbrow__cta">Add →</span>
        </Link>
      ))}
      {gaps.length > show.length && <p className="meta" style={{ margin: '6px 2px 0' }}>+{gaps.length - show.length} more below.</p>}
    </div>
  )
}

// A device activity that lives in intervals (not done via Platyplus) — #130. Tap → analysis (#250).
function DeviceActivityCard({ a }: { a: IcuActivity }) {
  const inner = (
    <>
      <div className="hist-row">
        <span className="hist-ic">{emojiFor(sportOfActivity(a))}</span>
        <div className="hist-body"><h3>{a.name || 'Activity'}</h3></div>
        <span className="src-tag src-dev">from intervals</span>
        {a.id && <span className="hist-row__ch" aria-hidden="true">›</span>}
      </div>
      <DoneStats a={a} />
    </>
  )
  return a.id
    ? <Link to={`/activity/${a.id}`} className="card hist-card hist-card--device" style={{ display: 'block' }}>{inner}</Link>
    : <div className="card hist-card hist-card--device">{inner}</div>
}

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
  const [open, setOpen] = useState(false) // #227: gym sessions collapsed by default
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
      <div className="card-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div><strong>{log.title || 'Workout'}</strong><div className="meta">{log.duration} min · {exs.length} exercise{exs.length === 1 ? '' : 's'} · {vol(sets)} {unit} volume{log.tss ? ` · ${log.tss} TSS` : ''}</div></div>
        <div className="card-row" style={{ gap: 8, flex: 'none' }}>
          {saved && <span className="meta" style={{ color: 'var(--accent)' }}>Saved ✓</span>}
          <button className="icon-btn" aria-label="Delete session" title="Delete" onClick={(ev) => { ev.stopPropagation(); del() }} style={{ color: 'var(--danger,#ff6b6b)' }}><Trash2 size={16} /></button>
          <span className="meta" aria-hidden="true" style={{ fontSize: 16 }}>{open ? '⌄' : '›'}</span>
        </div>
      </div>
      {open && (
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
      )}
    </div>
  )
}

export default function Logs() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.logs.orderBy('date').reverse().toArray())
  const imp = (useLiveQuery(() => getSetting('units')) as string | undefined) === 'imperial'
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [acts, setActs] = useState<IcuActivity[]>([])
  // #226 filters: date range, type, title search, sort
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(localISO())
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [newest, setNewest] = useState(true)
  useEffect(() => {
    // Reconcile local logs to the server truth on open, so an orphaned local log
    // (e.g. a deleted plan's stale completion) can't show as a phantom session (#197).
    syncLogsFromServer()
    const [f, t] = from <= to ? [from, to] : [to, from]
    authApi.checkins(f, t).then(setCheckins).catch(() => setCheckins([]))
    // #130: surface activities recorded straight to intervals (e.g. a device run) — read hub.
    fetchActivities(f, t).then(setActs).catch(() => setActs([]))
  }, [from, to])

  // Group everything by DAY (#84), collapsed to ONE entry per (day, sport) so a stale
  // local log and the real device activity never double up (#197, logs-merge.test.ts).
  const [f, t] = from <= to ? [from, to] : [to, from]
  const logsInRange = (logs || []).filter((l) => l.date >= f && l.date <= t)
  const byDay = buildDayEntries(logsInRange, acts, checkins)
  // #226: filter each day's entries by type + title search; drop empty days unless there's a check-in.
  const ql = q.trim().toLowerCase()
  const matchEntry = (e: { kind: string; log?: WorkoutLog; act?: IcuActivity }) => {
    const ty = e.kind === 'gym' ? 'gym' : normType(e.kind === 'log' ? e.log?.discipline : sportOfActivity(e.act!))
    if (type !== 'all' && ty !== type) return false
    if (ql) { const title = (e.kind === 'device' ? e.act?.name : e.log?.title) || ''; if (!title.toLowerCase().includes(ql)) return false }
    return true
  }
  type DayVal = ReturnType<typeof buildDayEntries> extends Map<string, infer V> ? V : never
  const days: [string, DayVal][] = [...byDay.entries()]
    .map(([date, d]): [string, DayVal] => [date, { ...d, entries: d.entries.filter(matchEntry) }])
    .filter(([, d]) => d.entries.length || (type === 'all' && !ql && !!d.checkin))
    .sort((a, b) => (newest ? (a[0] < b[0] ? 1 : -1) : (a[0] > b[0] ? 1 : -1)))

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>History</h1><p>Each day's check-in & sessions — tap a number to fix it</p></div>
        <button className="btn btn-sm" onClick={() => navigate('/log-activity')} style={{ marginLeft: 'auto' }}>+ Log</button>
      </div>

      {/* #226 filter + sort bar */}
      <input className="search" placeholder="🔍 Search by title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div className="chips" style={{ marginBottom: 8 }}>
        {TYPE_FILTERS.map(([v, label]) => <button key={v} className={'chip' + (type === v ? ' chip--active' : '')} onClick={() => setType(v)}>{label}</button>)}
        <span style={{ flex: 1 }} />
        <button className="chip" onClick={() => setNewest((n) => !n)}>{newest ? '↓ Newest' : '↑ Oldest'}</button>
      </div>
      <DateRangeFilter presets={HISTORY_PRESETS} from={from} to={to} onChange={(nf, nt) => { setFrom(nf); setTo(nt) }} />

      <IncompleteFeedbackBanner acts={acts} />

      {logs === undefined ? <p className="meta">Loading…</p> : !days.length ? <p className="meta">{q || type !== 'all' ? 'No sessions match your filters.' : 'Nothing logged in this range — check-ins & workouts show here by day.'}</p> : (
        days.map(([date, d]) => (
          <div key={date} style={{ marginBottom: 18 }}>
            <div className="section-title">{fmtDate(date)}</div>
            {d.checkin && <CheckinChips c={d.checkin} />}
            <div className="stack">{d.entries.map((e, i) => (
              e.kind === 'gym' ? <SessionCard key={e.log.id ?? 'g' + i} log={e.log} imp={imp} />
                : e.kind === 'log' ? <ActivityLogCard key={e.log.id ?? 'l' + i} log={e.log} />
                  : <DeviceActivityCard key={'d' + (e.act.id ?? i)} a={e.act} />
            ))}</div>
            {!d.entries.length && d.checkin && <p className="meta" style={{ margin: '2px 2px 0' }}>Rest day — checked in, no session.</p>}
          </div>
        ))
      )}
    </div>
  )
}
