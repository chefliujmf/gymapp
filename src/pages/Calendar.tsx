import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEvents, sportOf, type IcuEvent } from '../intervals'
import { fetchGymPlans, gymSessionFromPlan, setGymSession, type CoachPlan } from '../plan'
import { setCurrentRide, segmentsFromEndurance } from '../ride'
import { calApi, newId, type CalItem } from '../calendar'
import { recipes, mindSessions, endurance } from '../data/catalog'
import { listTemplates, getSetting, type WorkoutTemplate } from '../db'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Salad, Brain, StickyNote, Plus, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function monthGrid(y: number, m: number): string[] {
  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7
  const start = new Date(y, m, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return localISO(d) })
}
const colorFor = (s: string) => (s === 'cycling' || s === 'ride' ? '#34e07d' : s === 'running' || s === 'run' ? '#ffb13d' : s === 'gym' ? '#7fd1ff' : s === 'meal' ? '#ff8fb1' : s === 'mind' ? '#b98cff' : '#9aa3b2')
const iconFor = (s: string, sz = 15) => (s === 'cycling' || s === 'ride' ? <Bike size={sz} /> : s === 'running' || s === 'run' ? <Footprints size={sz} /> : s === 'gym' ? <Dumbbell size={sz} /> : s === 'meal' ? <Salad size={sz} /> : s === 'mind' ? <Brain size={sz} /> : <StickyNote size={sz} />)
const titleOf = (e: Entry) => (e.k === 'plan' ? e.plan.title : e.k === 'event' ? e.ev.name : e.item.title)

type Entry = { k: 'plan'; plan: CoachPlan } | { k: 'event'; ev: IcuEvent } | { k: 'item'; item: CalItem }

export default function Calendar() {
  const navigate = useNavigate()
  const now = new Date()
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [sel, setSel] = useState(localISO())
  const [events, setEvents] = useState<IcuEvent[]>([])
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [ftp, setFtp] = useState(260)
  const [adding, setAdding] = useState(false)

  const cells = useMemo(() => monthGrid(cur.y, cur.m), [cur])
  const range = useMemo(() => [cells[0], cells[41]] as const, [cells])

  const reload = useCallback(async () => {
    const [a, b] = range
    fetchEvents(a, b).then(setEvents).catch(() => setEvents([]))
    fetchGymPlans(a, b).then(setPlans).catch(() => setPlans([]))
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
  }, [range])

  useEffect(() => { reload() }, [reload])
  useEffect(() => { listTemplates().then(setTemplates); getSetting('ftp').then((v) => v && setFtp(Number(v))) }, [])

  // Entries per day, merged-by-id (a plan that mirrors an event shows once, as the plan).
  const entriesFor = (day: string): Entry[] => {
    const out: Entry[] = []
    plans.filter((p) => p.date === day).forEach((plan) => out.push({ k: 'plan', plan }))
    events.filter((e) => e.start_date_local.slice(0, 10) === day && !(e.external_id && plans.some((p) => p.id === e.external_id))).forEach((ev) => out.push({ k: 'event', ev }))
    items.filter((it) => it.date === day).forEach((item) => out.push({ k: 'item', item }))
    return out
  }
  const kindOf = (e: Entry) => (e.k === 'plan' ? e.plan.sport : e.k === 'event' ? sportOf(e.ev) : e.item.type)

  function runPlan(p: CoachPlan) {
    if (p.sport === 'gym') { setGymSession(gymSessionFromPlan(p)); navigate('/gym-session/play') }
    else { setCurrentRide({ title: p.title, sport: p.sport === 'ride' ? 'cycling' : 'running', segments: p.segments || [], ftp: p.ftp || ftp, source: p.id }); navigate(p.sport === 'ride' ? '/ride-player' : '/run-player') }
  }
  async function delEntry(e: Entry) {
    if (e.k === 'plan') await calApi.delPlan(e.plan.id)
    else if (e.k === 'item') await calApi.delItem(e.item.id)
    reload()
  }

  const selEntries = entriesFor(sel)
  const todayISO = localISO()

  return (
    <div>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setCur((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: (c.m + 11) % 12 }))}><ChevronLeft size={20} /></button>
        <h1 style={{ margin: 0, fontSize: 20 }}>{MONTHS[cur.m]} {cur.y}</h1>
        <button className="icon-btn" onClick={() => setCur((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: (c.m + 1) % 12 }))}><ChevronRight size={20} /></button>
      </div>

      <div className="cal-grid cal-dow">{DOW.map((d, i) => <div key={i} className="cal-dowcell">{d}</div>)}</div>
      <div className="cal-grid">
        {cells.map((day) => {
          const es = entriesFor(day)
          const inMonth = Number(day.slice(5, 7)) === cur.m + 1
          return (
            <button key={day} className={'cal-cell' + (day === sel ? ' cal-cell--sel' : '') + (inMonth ? '' : ' cal-cell--dim')} onClick={() => setSel(day)}>
              <span className={'cal-num' + (day === todayISO ? ' cal-num--today' : '')}>{Number(day.slice(8, 10))}</span>
              <span className="cal-evs">
                {es.slice(0, 3).map((e, i) => {
                  const c = colorFor(kindOf(e))
                  return <span key={i} className="cal-ev" style={{ background: c + '22', color: c }}>{iconFor(kindOf(e), 10)}<em>{titleOf(e)}</em></span>
                })}
                {es.length > 3 && <span className="cal-more">+{es.length - 3}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="cal-day-head">
        <div className="section-title" style={{ margin: 0 }}>{new Date(sel + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setAdding(true)}><Plus size={16} /> Add</button>
      </div>

      <div className="stack">
        {selEntries.length === 0 && <p className="meta">Nothing planned. Tap “Add”.</p>}
        {selEntries.map((e, i) => {
          const kind = kindOf(e)
          const title = e.k === 'plan' ? e.plan.title : e.k === 'event' ? e.ev.name : e.item.title
          const sub = e.k === 'plan' ? (e.plan.sport === 'gym' ? `${(e.plan.exercises || []).length} exercises` : `${Math.round((e.plan.segments || []).reduce((s, x) => s + x.duration, 0) / 60)} min`)
            : e.k === 'event' ? (e.ev.moving_time ? `${Math.round(e.ev.moving_time / 60)} min` : 'planned') : e.item.type === 'meal' ? `${e.item.mealType || 'meal'}${e.item.kcal ? ` · ${e.item.kcal} kcal` : ''}` : e.item.type === 'mind' ? `${e.item.minutes || ''} min` : 'note'
          const onClick = () => {
            if (e.k === 'plan') runPlan(e.plan)
            else if (e.k === 'event') navigate(`/plan/${e.ev.id}`)
            else if (e.item.type === 'meal' && e.item.refId) navigate(`/recipes/${e.item.refId}`)
            else if (e.item.type === 'mind' && e.item.refId) navigate(`/mind/${e.item.refId}`)
          }
          return (
            <div key={i} className="card cal-entry">
              <button className="cal-entry__main" onClick={onClick}>
                <span className="cal-chip" style={{ background: colorFor(kind) + '22', color: colorFor(kind) }}>{iconFor(kind)}</span>
                <span className="card-body"><h3>{title}</h3>{e.k === 'item' && e.item.type === 'note' && e.item.notes ? <div className="meta" style={{ whiteSpace: 'normal' }}>{e.item.notes}</div> : <div className="meta">{sub}</div>}</span>
              </button>
              {e.k !== 'event' && <button className="icon-btn" onClick={() => delEntry(e)} aria-label="Remove"><Trash2 size={16} /></button>}
            </div>
          )
        })}
      </div>

      {adding && <AddSheet date={sel} ftp={ftp} templates={templates} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload() }} />}
    </div>
  )
}

function AddSheet({ date, ftp, templates, onClose, onAdded }: { date: string; ftp: number; templates: WorkoutTemplate[]; onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState<'' | 'ride' | 'run' | 'gym' | 'meal' | 'mind' | 'note'>('')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(fn: () => Promise<unknown>) { setBusy(true); try { await fn(); onAdded() } catch { setBusy(false) } }

  const rideRun = (sport: 'ride' | 'run') => endurance.filter((w) => w.sport === (sport === 'ride' ? 'cycling' : 'running') && (!q || w.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 40)
  const meals = recipes.filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const minds = mindSessions.filter((m) => !q || m.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><strong>Add to {new Date(date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>

        {!type && (
          <div className="sheet-types">
            {([['ride', 'Ride', Bike], ['run', 'Run', Footprints], ['gym', 'Gym', Dumbbell], ['meal', 'Meal', Salad], ['mind', 'Mind', Brain], ['note', 'Note', StickyNote]] as const).map(([t, label, Icon]) => (
              <button key={t} className="sheet-type" style={{ color: colorFor(t) }} onClick={() => setType(t)}><Icon size={22} /><span>{label}</span></button>
            ))}
          </div>
        )}

        {type && type !== 'note' && (
          <>
            <input className="search" autoFocus placeholder={`Search ${type}…`} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="stack sheet-list">
              {type === 'gym' && templates.map((t) => (
                <button key={t.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: 'gym', title: t.name, rounds: t.rounds, exercises: t.exercises.map((x) => ({ name: x.name, exId: x.exId, mode: x.mode || 'reps', seconds: x.seconds, sets: x.sets, reps: x.reps, weight: x.weight, rest: x.rest })) }))}>
                  <div className="card-row"><div className="thumb"><Dumbbell size={18} /></div><div className="card-body"><h3>{t.name}</h3><div className="meta">{t.exercises.length} exercises · {t.rounds} rounds</div></div></div>
                </button>
              ))}
              {type === 'gym' && !templates.length && <p className="meta">No saved gym templates yet — build one in Train.</p>}
              {(type === 'ride' || type === 'run') && rideRun(type).map((w) => (
                <button key={w.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: type, title: w.name, ftp, segments: segmentsFromEndurance(w) }))}>
                  <div className="card-row"><div className="thumb">{iconFor(type)}</div><div className="card-body"><h3>{w.name}</h3><div className="meta">{w.duration} min · {w.category}</div></div></div>
                </button>
              ))}
              {type === 'meal' && meals.map((r) => (
                <button key={r.id} className="card" disabled={busy} onClick={() => add(() => calApi.saveItem({ date, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal }))}>
                  <div className="card-row"><div className="thumb"><Salad size={18} /></div><div className="card-body"><h3>{r.title}</h3><div className="meta">{r.category} · {r.kcal} kcal</div></div></div>
                </button>
              ))}
              {type === 'mind' && minds.map((m) => (
                <button key={m.id} className="card" disabled={busy} onClick={() => add(() => calApi.saveItem({ date, type: 'mind', title: m.title, refId: m.id, minutes: m.duration }))}>
                  <div className="card-row"><div className="thumb"><Brain size={18} /></div><div className="card-body"><h3>{m.title}</h3><div className="meta">{m.kind} · {m.duration} min</div></div></div>
                </button>
              ))}
            </div>
            <button className="auth-link" onClick={() => { setType(''); setQ('') }}>‹ Back</button>
          </>
        )}

        {type === 'note' && (
          <>
            <textarea className="search" style={{ minHeight: 90, resize: 'vertical' }} autoFocus placeholder="Write a note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn" disabled={busy || !note.trim()} onClick={() => add(() => calApi.saveItem({ date, type: 'note', title: note.trim().slice(0, 40), notes: note.trim() }))}>Add note</button>
            <button className="auth-link" onClick={() => setType('')}>‹ Back</button>
          </>
        )}
      </div>
    </div>
  )
}
