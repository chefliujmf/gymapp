import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchEvents, deleteEvent, sportOf, flattenIcuSteps, fetchActivities, fetchActivityStreams, sportOfActivity, type IcuEvent, type IcuActivity } from '../intervals'
// #5013 — a completed intervals activity with no matching plan/event is an UNPLANNED workout.
import { MiniProfile, DoneStats } from '../ui'
import { PowerBlocks } from '../charts'
import { fetchGymPlans, syncIcuPlans, setCoachPlans, type CoachPlan } from '../plan'
import { calApi, type CalItem } from '../calendar'
import { recipes } from '../data/catalog'
import { listTemplates, listRideTemplates, getSetting, setSetting, type WorkoutTemplate, type RideTemplate } from '../db'
import { localISO } from '../date'
import { Plus, ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { EntryMenu } from '../EntryMenu'
import { AddSheet, colorFor, iconFor, type SheetType } from './AddSheet'
import Today, { DayCheckinStrip, checkinVerdictTone } from './Today' // #488 — Plan DAY = full Today; per-day check-in strip/dot elsewhere
import { authApi, type Checkin } from '../auth/api'
import { orphanActivities } from '../orphan-activities'
import { MovePicker } from './MovePicker'
import { useAuth } from '../auth/AuthContext'

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

// #5013 — 'ride' | 'run' | 'gym' → a display label for a completed activity's title.
const actLabel = (s: string) => (s === 'ride' ? 'Ride' : s === 'run' ? 'Run' : 'Gym')
const titleOf = (e: Entry) => (e.k === 'plan' ? e.plan.title : e.k === 'event' ? e.ev.name : e.k === 'item' ? e.item.title : e.act.name || actLabel(sportOfActivity(e.act)))

type Entry = { k: 'plan'; plan: CoachPlan } | { k: 'event'; ev: IcuEvent } | { k: 'item'; item: CalItem } | { k: 'activity'; act: IcuActivity }
// Substitute is type-locked to the replaced entry; map an Entry → the AddSheet's pre-selected type.
const lockTypeOf = (e: Entry): SheetType => (e.k === 'plan' ? e.plan.sport : e.k === 'item' ? e.item.type : e.k === 'activity' ? sportOfActivity(e.act) : e.ev.type === 'Run' ? 'run' : e.ev.type === 'WeightTraining' ? 'gym' : 'ride') as SheetType

// #379 — a plan/item entry carries a stable id + date, so moving = re-save with a new date.
// icu-origin events (read-only, intervals-owned) can't be moved from here — edit them in intervals.
const movableId = (e: Entry): string | null => (e.k === 'plan' ? e.plan.id : e.k === 'item' ? e.item.id : null)

export default function Calendar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const maxPerDay = Math.max(1, Number((user?.info as { maxPerDay?: number } | undefined)?.maxPerDay) || 1)
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
  const [checkins, setCheckins] = useState<Checkin[]>([]) // #488 — per-day check-ins for the visible range
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [rideTemplates, setRideTemplates] = useState<RideTemplate[]>([])
  const [ftp, setFtp] = useState(260)
  const [sheet, setSheet] = useState<{ date: string; replacing?: Entry } | null>(null)
  // #379 — the move "quick picker" sheet + the post-move Undo bar (auto-dismisses).
  const [moving, setMoving] = useState<{ e: Entry; from: string } | null>(null)
  const [undo, setUndo] = useState<{ e: Entry; from: string; to: string } | null>(null)
  const todayISO = localISO()
  // Completed rides that render WITHOUT a planned power profile (orphans / unstructured) would fall to a
  // generic icon. Fetch their real watts stream so the card shows PowerBlocks — same as the detail page + the
  // planned MiniProfile look (JM: "show the thumbnail like the planned one, it has power data"). Ride-only
  // (needs watts); guarded once per activity; bounded to the loaded window's rides lacking a plan profile.
  const [rideStreams, setRideStreams] = useState<Record<string, (number | null)[]>>({})
  const streamReq = useRef<Set<string>>(new Set())
  useEffect(() => {
    const hasPlanProfile = (d: string) =>
      plans.some((p) => p.date === d && p.sport === 'ride' && (p.segments?.length || 0) > 0) ||
      events.some((ev) => ev.start_date_local.slice(0, 10) === d && sportOf(ev) === 'cycling' && flattenIcuSteps(ev.workout_doc?.steps).length > 0)
    activities
      .filter((a) => sportOfActivity(a) === 'ride' && !streamReq.current.has(String(a.id)) && !hasPlanProfile((a.start_date_local || '').slice(0, 10)))
      .forEach((a) => {
        streamReq.current.add(String(a.id))
        fetchActivityStreams(a.id, ['watts']).then((st) => setRideStreams((s) => ({ ...s, [String(a.id)]: st.watts || [] }))).catch(() => {})
      })
  }, [activities, plans, events])
  // A PowerBlocks chip for a completed ride whose watts stream we have (≥9 real samples), else null → icon.
  const powerBlocks = (a?: IcuActivity) => {
    if (!a || sportOfActivity(a) !== 'ride') return null
    const w = rideStreams[String(a.id)]
    return w && w.filter((v) => v != null).length >= 9 ? <PowerBlocks watts={w} ftp={ftp} /> : null
  }

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
    authApi.checkins(a, b).then(setCheckins).catch(() => setCheckins([])) // #488
  }, [range])
  useEffect(() => { reload() }, [reload])
  // #379 — auto-dismiss the Undo bar after 7s.
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 7000); return () => clearTimeout(t) }, [undo])
  useEffect(() => { listTemplates().then(setTemplates); listRideTemplates().then(setRideTemplates); getSetting('ftp').then((v) => v && setFtp(Number(v))) }, [])
  // Arriving from Today's "Add"/"Substitute" (?add=1) opens the add sheet straight away
  // so it's a single tap, not land-on-Plan-then-click-Add (#56/#57). Runs once.
  useEffect(() => { if (params.get('add') === '1') { setSheet({ date: qDay || sel }); navigate(`/plan?d=${qDay || sel}&v=day`, { replace: true }) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the selected day + view in the URL so leaving and coming back (e.g. the
  // import flow, or re-tapping Plan) restores them instead of snapping to today (#140).
  useEffect(() => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('d', sel); n.set('v', view); n.delete('add'); return n }, { replace: true })
  }, [sel, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkinFor = (day: string): Checkin | null => checkins.find((c) => c.date === day) || null
  const openDay = (day: string) => { setSel(day); changeView('day') } // #488 — tap a day's check-in → its Day view (full card + plan)
  const entriesFor = (day: string): Entry[] => {
    const out: Entry[] = []
    plans.filter((p) => p.date === day).forEach((plan) => out.push({ k: 'plan', plan }))
    events.filter((e) => e.start_date_local.slice(0, 10) === day && !plans.some((p) => (e.external_id && p.id === e.external_id) || (p.icuEventId != null && String(p.icuEventId) === String(e.id)) || (p.date === day && (p.sport === 'ride' ? 'cycling' : p.sport) === sportOf(e) && String(p.title || '').trim().toLowerCase() === String(e.name || '').trim().toLowerCase()))).forEach((ev) => out.push({ k: 'event', ev }))
    items.filter((it) => it.date === day).forEach((item) => out.push({ k: 'item', item }))
    // #5013 — completed intervals activities on this day NOT matched to any plan/event become their own
    // entries (mirrors Today's #455 ActivityCard), so a day trained off-plan never reads "Nothing planned".
    orphanActivities(day, plans, events, activities).forEach((act) => out.push({ k: 'activity', act }))
    return out
  }
  const kindOf = (e: Entry) => (e.k === 'plan' ? e.plan.sport : e.k === 'event' ? sportOf(e.ev) : e.k === 'activity' ? sportOfActivity(e.act) : e.item.type)
  // intervals.icu Annual-Training-Plan phase markers ("ATP W06 - …") aren't actual workouts.
  const isAtp = (e: Entry) => e.k === 'event' && (/^ATP\b/i.test(e.ev.name) || e.ev.category === 'NOTE')
  // #379 — a "session" for the max/day (full-day) rule = a real workout (ride/run/gym plan or icu
  // event), NOT a meal/mind/note/recovery item. ATP markers don't count either.
  const isSession = (e: Entry): boolean => !isAtp(e) && (e.k === 'plan' || e.k === 'event')
  // Identity across a reload (objects differ) — plans/items by id, events by id.
  const sameEntry = (a: Entry, b: Entry): boolean =>
    a.k === b.k && (a.k === 'plan' ? a.plan.id === (b as Extract<Entry, { k: 'plan' }>).plan.id
      : a.k === 'item' ? a.item.id === (b as Extract<Entry, { k: 'item' }>).item.id
        : a.k === 'activity' ? String(a.act.id) === String((b as Extract<Entry, { k: 'activity' }>).act.id)
          : String(a.ev.id) === String((b as Extract<Entry, { k: 'event' }>).ev.id))

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
  // #379 — MOVE a plan/item to another day. Same id + new date → the server UPDATES it (upsertPlan/
  // upsertItem key on id) and re-pushes the intervals mirror; the whole payload is preserved via spread.
  // The UI path is exempt from the coach 409 max/day guard (a person can double-book on purpose).
  // `showUndo` is off for the Undo-bar's own reverse move (so undoing doesn't spawn another bar).
  async function moveEntry(e: Entry, to: string, showUndo = true) {
    const from = e.k === 'plan' ? e.plan.date : e.k === 'item' ? e.item.date : ''
    if (!from || to === from) return
    if (e.k === 'plan') await calApi.savePlan({ ...e.plan, date: to })
    else if (e.k === 'item') await calApi.saveItem({ ...e.item, date: to })
    else return // icu events aren't moved from here
    await reload()
    if (showUndo) {
      // Re-point the entry at its new date so Undo reverses correctly, then auto-dismiss.
      const moved: Entry = e.k === 'plan' ? { k: 'plan', plan: { ...e.plan, date: to } } : { k: 'item', item: { ...e.item, date: to } }
      setUndo({ e: moved, from, to })
    }
  }
  function openEntry(e: Entry) {
    if (e.k === 'plan') navigate(`/coach/${e.plan.id}`) // open the rich detail (aim/tempo/structure); Start is in there
    else if (e.k === 'event') navigate(`/plan/${e.ev.id}`)
    else if (e.k === 'activity') navigate(`/activity/${e.act.id}`) // #5013 — a done workout opens its analysed result
    else if (e.k === 'item' && e.item.type === 'meal' && e.item.refId) navigate(`/recipes/${e.item.refId}`)
    else if (e.k === 'item' && e.item.type === 'mind' && e.item.refId) navigate(`/mind/${e.item.refId}`)
  }
  const subOf = (e: Entry) =>
    e.k === 'plan' ? (e.plan.sport === 'gym' ? `${(e.plan.exercises || []).length} exercises` : `${Math.round((e.plan.segments || []).reduce((s, x) => s + x.duration, 0) / 60)} min`)
      : e.k === 'event' ? (e.ev.moving_time ? `${Math.round(e.ev.moving_time / 60)} min` : 'planned')
        : e.k === 'activity' ? 'completed'
          : e.item.type === 'meal' ? `${e.item.mealType || 'meal'}${e.item.kcal ? ` · ${e.item.kcal} kcal` : ''}` : e.item.type === 'mind' ? `${e.item.minutes || ''} min` : 'note'

  // Entry card (used by day/week/schedule list rendering).
  const EntryCard = ({ e, day }: { e: Entry; day: string }) => {
    // #5013 — a completed UNPLANNED activity: read-only (it already happened), taps to its result.
    if (e.k === 'activity') {
      const sport = sportOfActivity(e.act)
      const pb = powerBlocks(e.act) // completed ride → real power profile, not a generic icon
      return (
        <div className="card cal-entry">
          <button className="cal-entry__main" onClick={() => navigate(`/activity/${e.act.id}`)}>
            <span className={'cal-chip cal-chip--grad cal-chip--' + (pb ? 'chart' : sport)}>{pb || iconFor(sport)}</span>
            <span className="card-body"><h3>{titleOf(e)}</h3><DoneStats a={e.act} /></span>
          </button>
        </div>
      )
    }
    const kind = kindOf(e)
    const atp = isAtp(e)
    const k = kind as string
    const mod = atp ? 'note' : k === 'cycling' || k === 'ride' ? 'ride' : k === 'running' || k === 'run' ? 'run' : k === 'swimming' || k === 'swim' ? 'swim' : k === 'gym' ? 'gym' : k === 'meal' ? 'meal' : k === 'mind' ? 'mind' : 'note'
    const photo = e.k === 'item' && e.item.type === 'meal' && e.item.refId ? recipes.find((r) => r.id === e.item.refId)?.thumbnail : undefined
    // Match Today: rides/runs show their power profile, not a generic icon.
    const segs = !atp && (mod === 'ride' || mod === 'run')
      ? (e.k === 'plan' ? (e.plan.segments || []) : e.k === 'event' ? flattenIcuSteps(e.ev.workout_doc?.steps) : [])
      : []
    // Completed activity for this workout (by day + sport) → show the executed stats.
    const act = (mod === 'ride' || mod === 'run' || mod === 'gym') && e.k !== 'item'
      ? activities.find((x) => x.start_date_local.slice(0, 10) === day && sportOfActivity(x) === mod)
      : undefined
    // A completed ride with no planned profile (segs empty) → show its executed PowerBlocks, not an icon.
    const pb = !segs.length ? powerBlocks(act) : null
    return (
      <div className="card cal-entry">
        <button className="cal-entry__main" onClick={() => openEntry(e)}>
          <span className={'cal-chip cal-chip--grad cal-chip--' + (segs.length || pb ? 'chart' : mod)}>{atp ? <Flag size={15} /> : photo ? <img src={photo} alt="" /> : segs.length ? <MiniProfile segs={segs} /> : pb || iconFor(kind)}</span>
          <span className="card-body"><h3>{titleOf(e)}</h3>{act ? <DoneStats a={act} /> : e.k === 'item' && e.item.type === 'note' && e.item.notes ? <div className="meta" style={{ whiteSpace: 'normal' }}>{e.item.notes}</div> : <div className="meta">{atp ? 'Training block · plan' : subOf(e)}</div>}</span>
        </button>
        <EntryMenu
          title={titleOf(e)}
          onMove={movableId(e) ? () => setMoving({ e, from: day }) : undefined}
          moveHint={movableId(e) ? undefined : 'edit this one in intervals'}
          onSubstitute={() => setSheet({ date: day, replacing: e })}
          onRemove={() => delEntry(e)}
        />
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

  // Week scrubber (#166) — hop between the days of the selected week; coloured dots preview
  // each day's entries, today is green, the selected day is outlined. Used by the Day view.
  // #488 — the day scrubber lived here for the old sparse day view; Plan's DAY view is now the full Today screen
  // (which brings its own day strip), so WeekScrubber was removed.

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

      {/* #488 — the DAY view is the merged Today screen (own day strip + Add), so skip Calendar's day title/nav there. */}
      {view !== 'day' && (
        <div className="cal-head">
          {view !== 'schedule' ? <button className="icon-btn" onClick={() => nav(-1)}><ChevronLeft size={20} /></button> : <span style={{ width: 36 }} />}
          <h1 style={{ margin: 0, fontSize: 19, flex: 1, textAlign: 'center' }}>{title}</h1>
          {view !== 'schedule' ? <button className="icon-btn" onClick={() => nav(1)}><ChevronRight size={20} /></button> : <span style={{ width: 36 }} />}
          <button className="cal-today" onClick={goToday}>Today</button>
        </div>
      )}

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
                    {(() => { const t = checkinVerdictTone(checkinFor(day)); return t ? <span className={'cal-ci-dot cal-ci-dot--' + t} /> : null })()}
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
              <DayCheckinStrip day={sel} ci={checkinFor(sel)} today={todayISO} onOpen={() => openDay(sel)} />
              {entriesFor(sel).length === 0 && <p className="meta">Nothing planned. Tap “Add”.</p>}
              {entriesFor(sel).map((e, i) => <EntryCard key={i} e={e} day={sel} />)}
            </div>
          </div>
        </div>
      )}

      {/* ---- WEEK ---- (#166: compact day-rows, rest days collapse to one line) */}
      {view === 'week' && (
        <div className="cal-week">
          {weekDays(sel).map((day) => {
            const es = entriesFor(day)
            const isToday = day === todayISO
            const hasStrip = day <= todayISO // #488 — strip only for past + today; future days show none
            return (
              <div key={day} className={'cal-wkrow' + (isToday ? ' cal-wkrow--today' : '')}>
                <div className="cal-wkrow__head">
                  <strong>{fmtShort(day)}</strong>
                  <span className="cal-wkrow__cnt">{es.length ? `${es.length} planned` : 'Rest day'}</span>
                  <button className="icon-btn" onClick={() => setSheet({ date: day })} aria-label="Add"><Plus size={16} /></button>
                </div>
                {(hasStrip || es.length > 0) && (
                  <div className="cal-wkrow__body">
                    {hasStrip && <DayCheckinStrip day={day} ci={checkinFor(day)} today={todayISO} onOpen={() => openDay(day)} />}
                    {es.length > 0 && <div className="stack" style={{ gap: 6 }}>{es.map((e, i) => <EntryCard key={i} e={e} day={day} />)}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ---- DAY ---- #488: the full Today screen (check-in · verdict · rich cards · recovery), day synced to Plan. */}
      {view === 'day' && <Today embedded initialDay={sel} onDay={setSel} />}

      {/* ---- SCHEDULE ---- (#166: date-rail timeline, month separators; only days with entries) */}
      {view === 'schedule' && (
        <div className="cal-agenda">
          {(() => {
            const days: string[] = []
            for (let d = todayISO; d <= range[1]; d = addDays(d, 1)) if (entriesFor(d).length) days.push(d)
            if (!days.length) return <p className="meta">Nothing scheduled in the next 120 days.</p>
            return days.map((day, idx) => {
              const dt = new Date(day + 'T00:00')
              const isToday = day === todayISO
              const showMonth = idx === 0 || days[idx - 1].slice(0, 7) !== day.slice(0, 7)
              return (
                <Fragment key={day}>
                  {showMonth && <div className="cal-agmonth">{dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>}
                  <div className="cal-agrow">
                    <div className={'cal-agrail' + (isToday ? ' cal-agrail--today' : '')}>
                      <small>{dt.toLocaleDateString(undefined, { weekday: 'short' })}</small>
                      <b>{Number(day.slice(8, 10))}</b>
                    </div>
                    <div className="cal-agcol">
                      <DayCheckinStrip day={day} ci={checkinFor(day)} today={todayISO} onOpen={() => openDay(day)} />
                      {entriesFor(day).map((e, i) => <EntryCard key={i} e={e} day={day} />)}
                    </div>
                  </div>
                </Fragment>
              )
            })
          })()}
        </div>
      )}

      {sheet && <AddSheet date={sheet.date} substitute={!!sheet.replacing} lockType={sheet.replacing ? lockTypeOf(sheet.replacing) : undefined} ftp={ftp} templates={templates} rideTemplates={rideTemplates} onClose={() => setSheet(null)} onAdd={reload} onReplaced={() => { if (sheet.replacing) delEntry(sheet.replacing, false); setSheet(null) }} />}

      {/* #379 — the "quick picker": move a plan/item to another day. Full days (≥ maxPerDay sessions,
          excluding this entry) get an amber dot + warn; picking one asks to combine or bump. */}
      {moving && (() => {
        const busy = new Set<string>()
        // Only the session's own week + the next week are pickable, so only those days can be "full".
        for (const d of [...weekDays(moving.from), ...weekDays(addDays(startOfWeek(moving.from), 7))]) {
          const sessions = entriesFor(d).filter((x) => isSession(x) && !sameEntry(x, moving.e))
          if (sessions.length >= maxPerDay) busy.add(d)
        }
        return (
          <MovePicker
            title={titleOf(moving.e)}
            kind={kindOf(moving.e) as string}
            fromISO={moving.from}
            todayISO={todayISO}
            busyDays={busy}
            maxPerDay={maxPerDay}
            onMove={(to) => { const e = moving.e; setMoving(null); moveEntry(e, to) }}
            onClose={() => setMoving(null)}
          />
        )
      })()}

      {undo && (
        <div className="mv-undo">
          <span>✓ Moved to <b>{fmtShort(undo.to)}</b></span>
          <button onClick={() => { const u = undo; setUndo(null); moveEntry(u.e, u.from, false) }}>Undo</button>
        </div>
      )}
    </div>
  )
}
