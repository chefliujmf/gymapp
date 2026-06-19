import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEvents, sportOf, type IcuEvent } from '../intervals'
import { fetchGymPlans, gymSessionFromPlan, setGymSession, type CoachPlan } from '../plan'
import { setCurrentRide, segmentsFromEndurance } from '../ride'
import { calApi, newId, type CalItem } from '../calendar'
import { recipes, mindSessions, endurance, workouts } from '../data/catalog'
import { listTemplates, getSetting, type WorkoutTemplate } from '../db'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Salad, Brain, StickyNote, Plus, X, Trash2, Repeat, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
type View = 'day' | 'week' | 'month' | 'schedule'

function monthGrid(y: number, m: number): string[] {
  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7
  const start = new Date(y, m, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return localISO(d) })
}
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return localISO(d) }
const startOfWeek = (iso: string) => { const d = new Date(iso + 'T00:00'); return addDays(iso, -((d.getDay() + 6) % 7)) }
const weekDays = (iso: string) => { const s = startOfWeek(iso); return Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
const fmtFull = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const fmtShort = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

const colorFor = (s: string) => (s === 'cycling' || s === 'ride' ? '#34e07d' : s === 'running' || s === 'run' ? '#ffb13d' : s === 'gym' ? '#7fd1ff' : s === 'meal' ? '#ff8fb1' : s === 'mind' ? '#b98cff' : '#9aa3b2')
const iconFor = (s: string, sz = 15) => (s === 'cycling' || s === 'ride' ? <Bike size={sz} /> : s === 'running' || s === 'run' ? <Footprints size={sz} /> : s === 'gym' ? <Dumbbell size={sz} /> : s === 'meal' ? <Salad size={sz} /> : s === 'mind' ? <Brain size={sz} /> : <StickyNote size={sz} />)
const titleOf = (e: Entry) => (e.k === 'plan' ? e.plan.title : e.k === 'event' ? e.ev.name : e.item.title)

type Entry = { k: 'plan'; plan: CoachPlan } | { k: 'event'; ev: IcuEvent } | { k: 'item'; item: CalItem }

export default function Calendar() {
  const navigate = useNavigate()
  const now = new Date()
  const [view, setView] = useState<View>(() => (typeof localStorage !== 'undefined' && (localStorage.getItem('calView') as View)) || 'month')
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [sel, setSel] = useState(localISO())
  const [events, setEvents] = useState<IcuEvent[]>([])
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [ftp, setFtp] = useState(260)
  const [sheet, setSheet] = useState<{ date: string; replacing?: Entry } | null>(null)
  const todayISO = localISO()

  const changeView = (v: View) => { setView(v); try { localStorage.setItem('calView', v) } catch { /* ignore */ } }

  // Load a window wide enough for the active view.
  const monthCells = useMemo(() => monthGrid(cur.y, cur.m), [cur])
  const range = useMemo<[string, string]>(() => {
    if (view === 'schedule') return [todayISO, addDays(todayISO, 120)]
    if (view === 'day') return [sel, sel]
    if (view === 'week') { const w = weekDays(sel); return [w[0], w[6]] }
    return [monthCells[0], monthCells[41]]
  }, [view, cur.y, monthCells, sel, todayISO])

  const reload = useCallback(async () => {
    const [a, b] = range
    fetchEvents(a, b).then(setEvents).catch(() => setEvents([]))
    fetchGymPlans(a, b).then(setPlans).catch(() => setPlans([]))
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
  }, [range])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { listTemplates().then(setTemplates); getSetting('ftp').then((v) => v && setFtp(Number(v))) }, [])

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
  function openEntry(e: Entry) {
    if (e.k === 'plan') runPlan(e.plan)
    else if (e.k === 'event') navigate(`/plan/${e.ev.id}`)
    else if (e.k === 'item' && e.item.type === 'meal' && e.item.refId) navigate(`/recipes/${e.item.refId}`)
    else if (e.k === 'item' && e.item.type === 'mind' && e.item.refId) navigate(`/mind/${e.item.refId}`)
  }
  const subOf = (e: Entry) =>
    e.k === 'plan' ? (e.plan.sport === 'gym' ? `${(e.plan.exercises || []).length} exercises` : `${Math.round((e.plan.segments || []).reduce((s, x) => s + x.duration, 0) / 60)} min`)
      : e.k === 'event' ? (e.ev.moving_time ? `${Math.round(e.ev.moving_time / 60)} min` : 'planned')
        : e.item.type === 'meal' ? `${e.item.mealType || 'meal'}${e.item.kcal ? ` · ${e.item.kcal} kcal` : ''}` : e.item.type === 'mind' ? `${e.item.minutes || ''} min` : 'note'

  // Entry card (used by day/week/schedule list rendering).
  const EntryCard = ({ e, day }: { e: Entry; day: string }) => {
    const kind = kindOf(e)
    return (
      <div className="card cal-entry">
        <button className="cal-entry__main" onClick={() => openEntry(e)}>
          <span className="cal-chip" style={{ background: colorFor(kind) + '22', color: colorFor(kind) }}>{iconFor(kind)}</span>
          <span className="card-body"><h3>{titleOf(e)}</h3>{e.k === 'item' && e.item.type === 'note' && e.item.notes ? <div className="meta" style={{ whiteSpace: 'normal' }}>{e.item.notes}</div> : <div className="meta">{subOf(e)}</div>}</span>
        </button>
        {e.k !== 'event' && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button className="icon-btn" onClick={() => setSheet({ date: day, replacing: e })} aria-label="Substitute" title="Substitute"><Repeat size={16} /></button>
            <button className="icon-btn" onClick={() => delEntry(e)} aria-label="Remove" title="Remove"><Trash2 size={16} /></button>
          </div>
        )}
      </div>
    )
  }

  // Small chips (used inside month/week cells).
  const Chips = ({ day, max }: { day: string; max: number }) => {
    const es = entriesFor(day)
    return (
      <span className="cal-evs">
        {es.slice(0, max).map((e, i) => { const c = colorFor(kindOf(e)); return <span key={i} className="cal-ev" style={{ background: c + '22', color: c }}>{iconFor(kindOf(e), 10)}<em>{titleOf(e)}</em></span> })}
        {es.length > max && <span className="cal-more">+{es.length - max}</span>}
      </span>
    )
  }

  // ---- header: view switcher + contextual nav -----------------------------
  const VIEWS: [View, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['schedule', 'Schedule']]
  const title = view === 'month' ? `${MONTHS[cur.m]} ${cur.y}` : view === 'day' ? fmtFull(sel) : view === 'week' ? `Week of ${new Date(weekDays(sel)[0] + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Schedule'
  const nav = (dir: -1 | 1) => {
    if (view === 'day') setSel((s) => addDays(s, dir))
    else if (view === 'week') setSel((s) => addDays(s, dir * 7))
    else setCur((c) => ({ y: c.m === (dir === 1 ? 11 : 0) ? c.y + dir : c.y, m: (c.m + 12 + dir) % 12 }))
  }
  const goToday = () => { const t = new Date(); setSel(localISO()); setCur({ y: t.getFullYear(), m: t.getMonth() }) }

  return (
    <div>
      <div className="cal-views">
        {VIEWS.map(([v, label]) => (
          <button key={v} className={'cal-viewbtn' + (view === v ? ' cal-viewbtn--on' : '')} onClick={() => changeView(v)}>{label}</button>
        ))}
      </div>

      <div className="cal-head">
        {view !== 'schedule' ? <button className="icon-btn" onClick={() => nav(-1)}><ChevronLeft size={20} /></button> : <span style={{ width: 36 }} />}
        <h1 style={{ margin: 0, fontSize: 19, flex: 1, textAlign: 'center' }}>{title}</h1>
        {view !== 'schedule' ? <button className="icon-btn" onClick={() => nav(1)}><ChevronRight size={20} /></button> : <span style={{ width: 36 }} />}
        <button className="cal-today" onClick={goToday}>Today</button>
      </div>

      {/* ---- MONTH ---- */}
      {view === 'month' && (
        <div className="cal-month-layout">
          <div className="cal-month-cal">
            <div className="cal-grid cal-dow">{DOW.map((d, i) => <div key={i} className="cal-dowcell">{d}</div>)}</div>
            <div className="cal-grid">
              {monthCells.map((day) => {
                const inMonth = Number(day.slice(5, 7)) === cur.m + 1
                return (
                  <button key={day} className={'cal-cell' + (day === sel ? ' cal-cell--sel' : '') + (inMonth ? '' : ' cal-cell--dim')} onClick={() => setSel(day)}>
                    <span className={'cal-num' + (day === todayISO ? ' cal-num--today' : '')}>{Number(day.slice(8, 10))}</span>
                    <Chips day={day} max={3} />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="cal-month-detail">
            <div className="cal-day-head">
              <div className="section-title" style={{ margin: 0 }}>{fmtFull(sel)}</div>
              <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setSheet({ date: sel })}><Plus size={16} /> Add</button>
            </div>
            <div className="stack">
              {entriesFor(sel).length === 0 && <p className="meta">Nothing planned. Tap “Add”.</p>}
              {entriesFor(sel).map((e, i) => <EntryCard key={i} e={e} day={sel} />)}
            </div>
          </div>
        </div>
      )}

      {/* ---- WEEK ---- (7 day sections, mobile-first) */}
      {view === 'week' && (
        <div className="stack" style={{ gap: 10 }}>
          {weekDays(sel).map((day) => {
            const es = entriesFor(day)
            return (
              <div key={day} className="card" style={{ padding: 12, border: day === todayISO ? '1px solid #2fb968' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: es.length ? 8 : 0 }}>
                  <strong style={{ color: day === todayISO ? '#2fb968' : undefined }}>{fmtShort(day)}</strong>
                  <button className="icon-btn" onClick={() => setSheet({ date: day })} aria-label="Add"><Plus size={16} /></button>
                </div>
                <div className="stack" style={{ gap: 6 }}>{es.map((e, i) => <EntryCard key={i} e={e} day={day} />)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- DAY ---- */}
      {view === 'day' && (
        <>
          <div className="cal-day-head">
            <div className="section-title" style={{ margin: 0 }}>{entriesFor(sel).length} planned</div>
            <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setSheet({ date: sel })}><Plus size={16} /> Add</button>
          </div>
          <div className="stack">
            {entriesFor(sel).length === 0 && <p className="meta">Nothing planned for {fmtShort(sel)}. Tap “Add”.</p>}
            {entriesFor(sel).map((e, i) => <EntryCard key={i} e={e} day={sel} />)}
          </div>
        </>
      )}

      {/* ---- SCHEDULE ---- (agenda: each day with entries, today forward) */}
      {view === 'schedule' && (
        <div className="stack" style={{ gap: 14 }}>
          {(() => {
            const days: string[] = []
            for (let d = todayISO; d <= range[1]; d = addDays(d, 1)) if (entriesFor(d).length) days.push(d)
            if (!days.length) return <p className="meta">Nothing scheduled in the next 120 days.</p>
            return days.map((day) => (
              <div key={day}>
                <div className="section-title" style={{ margin: '0 0 6px', color: day === todayISO ? '#2fb968' : undefined }}>{day === todayISO ? 'Today · ' : ''}{fmtFull(day)}</div>
                <div className="stack" style={{ gap: 6 }}>{entriesFor(day).map((e, i) => <EntryCard key={i} e={e} day={day} />)}</div>
              </div>
            ))
          })()}
        </div>
      )}

      {sheet && <AddSheet date={sheet.date} replacing={sheet.replacing} ftp={ftp} templates={templates} onClose={() => setSheet(null)} onAdd={reload} onReplaced={() => { if (sheet.replacing) delEntry(sheet.replacing); setSheet(null) }} />}
    </div>
  )
}

function AddSheet({ date, replacing, ftp, templates, onClose, onAdd, onReplaced }: { date: string; replacing?: Entry; ftp: number; templates: WorkoutTemplate[]; onClose: () => void; onAdd: () => void; onReplaced: () => void }) {
  const [type, setType] = useState<'' | 'ride' | 'run' | 'gym' | 'meal' | 'mind' | 'note'>('')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [count, setCount] = useState(0)

  // Replace mode adds one then swaps out the old entry. Otherwise stay open so
  // you can quick-add several to the same day; "Done" closes.
  async function add(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      if (replacing) { onReplaced(); return }
      setCount((c) => c + 1); setNote(''); onAdd()
    } catch { /* keep the sheet open */ } finally { setBusy(false) }
  }

  const rideRun = (sport: 'ride' | 'run') => endurance.filter((w) => w.sport === (sport === 'ride' ? 'cycling' : 'running') && (!q || w.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 40)
  const meals = recipes.filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const minds = mindSessions.filter((m) => !q || m.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><strong>{replacing ? 'Substitute on' : 'Add to'} {new Date(date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{count > 0 ? ` · ${count} added` : ''}</strong><button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={onClose}>{count > 0 ? 'Done' : <X size={18} />}</button></div>

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
              {type === 'gym' && templates.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())).map((t) => (
                <button key={t.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: 'gym', title: t.name, rounds: t.rounds, exercises: t.exercises.map((x) => ({ name: x.name, exId: x.exId, mode: x.mode || 'reps', seconds: x.seconds, sets: x.sets, reps: x.reps, weight: x.weight, rest: x.rest })) }))}>
                  <div className="card-row"><div className="thumb"><Dumbbell size={18} /></div><div className="card-body"><h3>{t.name}</h3><div className="meta">My workout · {t.exercises.length} exercises{t.rounds > 1 ? ` · ${t.rounds} rounds` : ''}</div></div></div>
                </button>
              ))}
              {type === 'gym' && workouts.filter((w) => !q || w.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40).map((w) => (
                <button key={w.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: 'gym', title: w.title, rounds: 1, exercises: (w.exercises || []).map((e) => ({ name: e.name, mode: e.seconds ? 'timed' : 'reps', seconds: e.seconds || 0, rest: 0 })) }))}>
                  <div className="card-row"><div className="thumb"><Dumbbell size={18} /></div><div className="card-body"><h3>{w.title}</h3><div className="meta">{w.discipline} · {(w.exercises || []).length} exercises · {w.duration} min</div></div></div>
                </button>
              ))}
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
