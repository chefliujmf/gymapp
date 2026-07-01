import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchEvents, deleteEvent, sportOf, flattenIcuSteps, fetchActivities, sportOfActivity, type IcuEvent, type IcuActivity } from '../intervals'
import { MiniProfile, DoneStats } from '../ui'
import { fetchGymPlans, syncIcuPlans, setCoachPlans, type CoachPlan } from '../plan'
import { calApi, type CalItem } from '../calendar'
import { recipes } from '../data/catalog'
import { listTemplates, listRideTemplates, getSetting, setSetting, type WorkoutTemplate, type RideTemplate } from '../db'
import { localISO } from '../date'
import { Plus, ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { EntryMenu } from '../EntryMenu'
import { AddSheet, colorFor, iconFor, type SheetType } from './AddSheet'

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

const titleOf = (e: Entry) => (e.k === 'plan' ? e.plan.title : e.k === 'event' ? e.ev.name : e.item.title)

type Entry = { k: 'plan'; plan: CoachPlan } | { k: 'event'; ev: IcuEvent } | { k: 'item'; item: CalItem }
// Substitute is type-locked to the replaced entry; map an Entry → the AddSheet's pre-selected type.
const lockTypeOf = (e: Entry): SheetType => (e.k === 'plan' ? e.plan.sport : e.k === 'item' ? e.item.type : e.ev.type === 'Run' ? 'run' : e.ev.type === 'WeightTraining' ? 'gym' : 'ride') as SheetType

export default function Calendar() {
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const now = new Date()
  const qDay = params.get('d')
  const qView = params.get('v') as View | null
  const [view, setView] = useState<View>(() => qView || (typeof localStorage !== 'undefined' && (localStorage.getItem('calView') as View)) || 'month')
  const [cur, setCur] = useState(() => { const d = qDay ? new Date(qDay + 'T00:00') : now; return { y: d.getFullYear(), m: d.getMonth() } })
  const [sel, setSel] = useState(qDay || localISO())
  const [events, setEvents] = useState<IcuEvent[]>([])
  const [activities, setActivities] = useState<IcuActivity[]>([])
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [rideTemplates, setRideTemplates] = useState<RideTemplate[]>([])
  const [ftp, setFtp] = useState(260)
  const [sheet, setSheet] = useState<{ date: string; replacing?: Entry } | null>(null)
  const todayISO = localISO()

  const changeView = (v: View) => { setView(v); setSetting('calView', v); try { localStorage.setItem('calView', v) } catch { /* ignore */ } }

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
    fetchActivities(a, b).then(setActivities).catch(() => setActivities([]))
    syncIcuPlans(a, b).finally(() => fetchGymPlans(a, b).then((pl) => { setPlans(pl); setCoachPlans(pl) }).catch(() => setPlans([])))
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
  }, [range])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { listTemplates().then(setTemplates); listRideTemplates().then(setRideTemplates); getSetting('ftp').then((v) => v && setFtp(Number(v))) }, [])
  // Arriving from Today's "Add"/"Substitute" (?add=1) opens the add sheet straight away
  // so it's a single tap, not land-on-Plan-then-click-Add (#56/#57). Runs once.
  useEffect(() => { if (params.get('add') === '1') { setSheet({ date: qDay || sel }); navigate(`/plan?d=${qDay || sel}&v=day`, { replace: true }) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the selected day + view in the URL so leaving and coming back (e.g. the
  // import flow, or re-tapping Plan) restores them instead of snapping to today (#140).
  useEffect(() => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('d', sel); n.set('v', view); n.delete('add'); return n }, { replace: true })
  }, [sel, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const entriesFor = (day: string): Entry[] => {
    const out: Entry[] = []
    plans.filter((p) => p.date === day).forEach((plan) => out.push({ k: 'plan', plan }))
    events.filter((e) => e.start_date_local.slice(0, 10) === day && !plans.some((p) => (e.external_id && p.id === e.external_id) || (p.icuEventId != null && String(p.icuEventId) === String(e.id)) || (p.date === day && (p.sport === 'ride' ? 'cycling' : p.sport) === sportOf(e) && String(p.title || '').trim().toLowerCase() === String(e.name || '').trim().toLowerCase()))).forEach((ev) => out.push({ k: 'event', ev }))
    items.filter((it) => it.date === day).forEach((item) => out.push({ k: 'item', item }))
    return out
  }
  const kindOf = (e: Entry) => (e.k === 'plan' ? e.plan.sport : e.k === 'event' ? sportOf(e.ev) : e.item.type)
  // intervals.icu Annual-Training-Plan phase markers ("ATP W06 - …") aren't actual workouts.
  const isAtp = (e: Entry) => e.k === 'event' && (/^ATP\b/i.test(e.ev.name) || e.ev.category === 'NOTE')

  async function delEntry(e: Entry, confirmEvent = true) {
    if (e.k === 'plan') await calApi.delPlan(e.plan.id)
    else if (e.k === 'item') await calApi.delItem(e.item.id)
    else if (e.k === 'event') {
      // Intervals events are the coach's calendar — deleting writes back there.
      if (confirmEvent && !confirm(`Remove “${e.ev.name}” from your intervals calendar?`)) return
      try { await deleteEvent(e.ev.id) } catch { alert('Could not remove that intervals event.'); return }
    }
    reload()
  }
  function openEntry(e: Entry) {
    if (e.k === 'plan') navigate(`/coach/${e.plan.id}`) // open the rich detail (aim/tempo/structure); Start is in there
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
    const atp = isAtp(e)
    const k = kind as string
    const mod = atp ? 'note' : k === 'cycling' || k === 'ride' ? 'ride' : k === 'running' || k === 'run' ? 'run' : k === 'gym' ? 'gym' : k === 'meal' ? 'meal' : k === 'mind' ? 'mind' : 'note'
    const photo = e.k === 'item' && e.item.type === 'meal' && e.item.refId ? recipes.find((r) => r.id === e.item.refId)?.thumbnail : undefined
    // Match Today: rides/runs show their power profile, not a generic icon.
    const segs = !atp && (mod === 'ride' || mod === 'run')
      ? (e.k === 'plan' ? (e.plan.segments || []) : e.k === 'event' ? flattenIcuSteps(e.ev.workout_doc?.steps) : [])
      : []
    // Completed activity for this workout (by day + sport) → show the executed stats.
    const act = (mod === 'ride' || mod === 'run' || mod === 'gym') && e.k !== 'item'
      ? activities.find((x) => x.start_date_local.slice(0, 10) === day && sportOfActivity(x) === mod)
      : undefined
    return (
      <div className="card cal-entry">
        <button className="cal-entry__main" onClick={() => openEntry(e)}>
          <span className={'cal-chip cal-chip--grad cal-chip--' + (segs.length ? 'chart' : mod)}>{atp ? <Flag size={15} /> : photo ? <img src={photo} alt="" /> : segs.length ? <MiniProfile segs={segs} /> : iconFor(kind)}</span>
          <span className="card-body"><h3>{titleOf(e)}</h3>{act ? <DoneStats a={act} /> : e.k === 'item' && e.item.type === 'note' && e.item.notes ? <div className="meta" style={{ whiteSpace: 'normal' }}>{e.item.notes}</div> : <div className="meta">{atp ? 'Training block · plan' : subOf(e)}</div>}</span>
        </button>
        <EntryMenu title={titleOf(e)} onSubstitute={() => setSheet({ date: day, replacing: e })} onRemove={() => delEntry(e)} />
      </div>
    )
  }

  // Small chips (used inside month/week cells).
  const Chips = ({ day, max }: { day: string; max: number }) => {
    const es = entriesFor(day)
    return (
      <span className="cal-evs">
        {es.slice(0, max).map((e, i) => { const atp = isAtp(e); const c = atp ? '#9aa3b2' : colorFor(kindOf(e)); return <span key={i} className="cal-ev" style={{ background: c + '22', color: c }}>{atp ? <Flag size={10} /> : iconFor(kindOf(e), 10)}<em>{titleOf(e)}</em></span> })}
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

      {sheet && <AddSheet date={sheet.date} substitute={!!sheet.replacing} lockType={sheet.replacing ? lockTypeOf(sheet.replacing) : undefined} ftp={ftp} templates={templates} rideTemplates={rideTemplates} onClose={() => setSheet(null)} onAdd={reload} onReplaced={() => { if (sheet.replacing) delEntry(sheet.replacing, false); setSheet(null) }} />}
    </div>
  )
}
