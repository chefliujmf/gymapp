import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { WeekStrip } from '../ui'
import { fetchEvents, deleteEvent, eventObjective, sportOf, type IcuEvent } from '../intervals'
import { setPlanEvents, fetchGymPlans, gymSessionFromPlan, setGymSession, type CoachPlan } from '../plan'
import { setCurrentRide } from '../ride'
import { calApi, type CalItem } from '../calendar'
import { recipes, mindSessions } from '../data/catalog'
import type { Recipe } from '../types'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Target, Salad, Brain, StickyNote, Plus } from 'lucide-react'
import { EntryMenu } from '../EntryMenu'

// Stable daily pick: same item all day, rotates with the date (+salt for variety).
function pickByDate<T>(arr: T[], dateStr: string, salt = 0): T | undefined {
  if (!arr.length) return undefined
  let h = salt >>> 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

const planIcon = (s: CoachPlan['sport']) => (s === 'ride' ? <Bike strokeWidth={1.75} /> : s === 'run' ? <Footprints strokeWidth={1.75} /> : <Dumbbell strokeWidth={1.75} />)

/** A coach-pushed plan that isn't mirrored by an intervals event — runs in-app. */
function CoachPlanCard({ p, onRun, showDate, fmtDay, onSwap, onRemove }: { p: CoachPlan; onRun: (p: CoachPlan) => void; showDate?: boolean; fmtDay: (s: string) => string; onSwap?: () => void; onRemove?: () => void }) {
  const mins = p.sport === 'gym' ? undefined : Math.round((p.segments || []).reduce((s, x) => s + x.duration, 0) / 60)
  return (
    <div className="today-entry">
      <button className="card" style={{ textAlign: 'left', width: '100%' }} onClick={() => onRun(p)}>
        <div className="card-row">
          <div className="thumb">{planIcon(p.sport)}</div>
          <div className="card-body">
            <span className="eyebrow">{p.sport === 'ride' ? 'Ride' : p.sport === 'run' ? 'Run' : 'Gym'} · in-app{showDate ? ` · ${fmtDay(p.date)}` : ''}</span>
            <h3>{p.title}</h3>
            {p.notes && <div className="meta" style={{ display: 'block', whiteSpace: 'normal' }}>{p.notes.length > 110 ? p.notes.slice(0, 110) + '…' : p.notes}</div>}
            <div className="meta">{mins ? <span>{mins} min</span> : <span>{(p.exercises || []).length} exercises{p.rounds && p.rounds > 1 ? ` · ${p.rounds} rounds` : ''}</span>}<span className="dot">▶ start</span></div>
          </div>
        </div>
      </button>
      {onSwap && onRemove && <EntryMenu title={p.title} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

const iso = localISO
const todayISO = () => localISO()
function weekRange(): [string, string] {
  const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const end = new Date(mon); end.setDate(mon.getDate() + 13)
  return [iso(mon), iso(end)]
}
const sportIcon = (e: IcuEvent) => { const s = sportOf(e); return s === 'cycling' ? <Bike strokeWidth={1.75} /> : s === 'gym' ? <Dumbbell strokeWidth={1.75} /> : e.type === 'Run' ? <Footprints strokeWidth={1.75} /> : <Target strokeWidth={1.75} /> }
const fmtDay = (s: string) => new Date(s + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

function PlanCard({ e, showDate, onSwap, onRemove }: { e: IcuEvent; showDate?: boolean; onSwap?: () => void; onRemove?: () => void }) {
  const obj = eventObjective(e)
  const mins = e.moving_time ? Math.round(e.moving_time / 60) : undefined
  return (
    <div className="today-entry">
      <Link to={`/plan/${e.id}`} className="card">
        <div className="card-row">
          <div className="thumb">{sportIcon(e)}</div>
          <div className="card-body">
            <span className="eyebrow">{e.category === 'TARGET' ? 'Target' : sportOf(e) === 'gym' ? 'Gym' : sportOf(e) === 'cycling' ? 'Ride' : e.type}{showDate ? ` · ${fmtDay(e.start_date_local.slice(0, 10))}` : ''}</span>
            <h3>{e.name}</h3>
            {obj && <div className="meta" style={{ display: 'block', whiteSpace: 'normal' }}>{obj.length > 110 ? obj.slice(0, 110) + '…' : obj}</div>}
            {mins && <div className="meta"><span>{mins} min</span>{e.icu_training_load ? <span className="dot">{e.icu_training_load} TSS</span> : null}</div>}
          </div>
        </div>
      </Link>
      {onSwap && onRemove && <EntryMenu title={e.name} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

/** An assigned meal / mind / note item on the day — editable like everything else. */
function ItemCard({ it, onSwap, onRemove }: { it: CalItem; onSwap: () => void; onRemove: () => void }) {
  const label = it.type === 'meal' ? 'Meal' : it.type === 'mind' ? 'Mind' : 'Note'
  const sub = it.type === 'meal' ? `${it.mealType || 'meal'}${it.kcal ? ` · ${it.kcal} kcal` : ''}` : it.type === 'mind' ? (it.minutes ? `${it.minutes} min` : 'session') : (it.notes || 'note')
  const icon = it.type === 'meal' ? <Salad strokeWidth={1.75} /> : it.type === 'mind' ? <Brain strokeWidth={1.75} /> : <StickyNote strokeWidth={1.75} />
  const to = it.type === 'meal' && it.refId ? `/recipes/${it.refId}` : it.type === 'mind' && it.refId ? `/mind/${it.refId}` : undefined
  const body = (
    <div className="card-row">
      <div className="thumb">{icon}</div>
      <div className="card-body"><span className="eyebrow">{label}</span><h3>{it.title}</h3><div className="meta" style={{ whiteSpace: 'normal' }}>{sub}</div></div>
    </div>
  )
  return (
    <div className="today-entry">
      {to ? <Link to={to} className="card">{body}</Link> : <div className="card">{body}</div>}
      <EntryMenu title={it.title} onSubstitute={onSwap} onRemove={onRemove} />
    </div>
  )
}

export default function Today() {
  const [selDay, setSelDay] = useState(todayISO())
  const todaysLogs = useLiveQuery(() => db.logs.where('date').equals(todayISO()).toArray())
  const diet = useLiveQuery(() => getSetting('diet'))
  const [events, setEvents] = useState<IcuEvent[] | null>(null)
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [err, setErr] = useState<string>()
  const navigate = useNavigate()

  const load = useCallback(() => {
    const [a, b] = weekRange()
    fetchEvents(a, b).then((evs) => { setEvents(evs); setPlanEvents(evs) }).catch((e) => setErr((e as Error).message))
    fetchGymPlans(a, b).then(setPlans)
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])

  function runPlan(p: CoachPlan) {
    if (p.sport === 'gym') { setGymSession(gymSessionFromPlan(p)); navigate('/gym-session/play') }
    else { setCurrentRide({ title: p.title, sport: p.sport === 'ride' ? 'cycling' : 'running', segments: p.segments || [], ftp: p.ftp || 260, source: p.id }); navigate(p.sport === 'ride' ? '/ride-player' : '/run-player') }
  }

  // Editable here too: Remove deletes (intervals event → writes back; coach plan → local).
  // Substitute jumps to that day's calendar where the full swap sheet lives.
  async function removeEvent(e: IcuEvent) {
    if (!confirm(`Remove “${e.name}” from your intervals calendar?`)) return
    try { await deleteEvent(e.id) } catch { alert('Could not remove that intervals event.'); return }
    load()
  }
  async function removePlan(p: CoachPlan) {
    if (!confirm(`Remove “${p.title}”?`)) return
    await calApi.delPlan(p.id); load()
  }
  async function removeItem(it: CalItem) { await calApi.delItem(it.id); load() }
  const swapOn = (day: string) => navigate(`/plan?d=${day}&v=day`)

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()
  // Merge-by-id: a coach plan whose id matches an intervals event's external_id is
  // already shown as that event's card — only show un-mirrored plans, so no dupes.
  const linkedIds = new Set((events ?? []).map((e) => e.external_id).filter(Boolean))
  const dayEvents = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) === selDay)
  const dayPlans = plans.filter((p) => p.date === selDay && !linkedIds.has(p.id))
  const dayItems = items.filter((it) => it.date === selDay)
  const upcoming = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) > selDay).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
  const upcomingPlans = plans.filter((p) => p.date > selDay && !linkedIds.has(p.id)).sort((a, b) => a.date.localeCompare(b.date))

  // Daily fuel (diet-aware) + a mind reset for the selected day.
  const dietOk = (r: Recipe) => {
    const p = diet ?? 'vegetarian'
    if (p === 'no preference') return true
    if (p === 'vegan') return !!r.diet?.includes('vegan')
    return !!(r.diet?.includes('vegetarian') || r.diet?.includes('vegan'))
  }
  // Suggestion logic: diet-filtered, and TRAINING-AWARE — on a day with a workout we
  // bias toward higher-protein recovery fuel (variety kept by date-rotating among the
  // top picks); on rest days it's the normal daily rotation. (Coach-driven suggestions
  // based on the day's load + goals are the next step — see backlog.)
  const trainingDay = dayEvents.length > 0 || dayPlans.length > 0
  const suggestMeal = (cat: Recipe['category'], salt: number) => {
    let pool = recipes.filter((r) => r.category === cat && dietOk(r))
    if (trainingDay && pool.length > 6) pool = [...pool].sort((a, b) => (b.protein ?? 0) - (a.protein ?? 0)).slice(0, Math.max(6, Math.ceil(pool.length / 3)))
    return pickByDate(pool, selDay, salt)
  }
  const meals = (['breakfast', 'lunch', 'dinner'] as const).map((cat, i) => suggestMeal(cat, i + 1)).filter(Boolean) as Recipe[]
  const meditation = pickByDate(mindSessions, selDay, 7)
  async function addMealSuggestion(r: Recipe) { await calApi.saveItem({ date: selDay, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal }); load() }
  async function addMindSuggestion() { if (!meditation) return; await calApi.saveItem({ date: selDay, type: 'mind', title: meditation.title, refId: meditation.id, minutes: meditation.duration }); load() }

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{greeting}</span>
        <h1>Ready to train?</h1>
      </div>

      <WeekStrip selected={selDay} onSelect={setSelDay} />

      {todaysLogs && todaysLogs.length > 0 && (
        <p style={{ color: 'var(--text-dim)', fontWeight: 700, marginTop: 4 }}>✓ {todaysLogs.length} logged today — nice.</p>
      )}

      <div className="cal-day-head" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{selDay === todayISO() ? "Today's plan" : fmtDay(selDay)}</div>
        <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => swapOn(selDay)}><Plus size={16} /> Add</button>
      </div>
      {err === 'NO_KEY' ? (
        <p className="meta">Connect intervals.icu in <Link to="/profile">Profile</Link> for your coach's plan — you can still add your own below.</p>
      ) : err ? (
        <p className="meta">Couldn't load plan: {err}</p>
      ) : events === null ? (
        <p className="meta">Loading your plan…</p>
      ) : null}
      {dayEvents.length > 0 || dayPlans.length > 0 || dayItems.length > 0 ? (
        <div className="stack">
          {dayEvents.map((e) => <PlanCard key={e.id} e={e} onSwap={() => swapOn(selDay)} onRemove={() => removeEvent(e)} />)}
          {dayPlans.map((p) => <CoachPlanCard key={p.id} p={p} onRun={runPlan} fmtDay={fmtDay} onSwap={() => swapOn(selDay)} onRemove={() => removePlan(p)} />)}
          {dayItems.map((it) => <ItemCard key={it.id} it={it} onSwap={() => swapOn(selDay)} onRemove={() => removeItem(it)} />)}
        </div>
      ) : events !== null && !err ? (
        <p className="meta">Nothing scheduled — tap Add, or enjoy a rest day.</p>
      ) : null}

      {meals.length > 0 && (
        <>
          <div className="section-title">Suggested fuel{selDay !== todayISO() ? ` · ${fmtDay(selDay)}` : ''}</div>
          <p className="meta" style={{ margin: '-4px 2px 8px' }}>{trainingDay ? 'Higher-protein picks for a training day.' : 'A balanced day — tap ＋ to add one to your plan.'}</p>
          <div className="stack">
            {meals.map((r) => (
              <div key={r.id} className="today-entry">
                <Link to={`/recipes/${r.id}`} className="card">
                  <div className="card-row">
                    <div className="thumb">{r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Salad strokeWidth={1.75} />}</div>
                    <div className="card-body">
                      <span className="eyebrow">{r.category}</span>
                      <h3>{r.title}</h3>
                      <div className="meta"><span>{r.minutes} min</span><span className="dot">{r.kcal} kcal</span><span className="dot">{r.protein}g protein</span></div>
                    </div>
                  </div>
                </Link>
                <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12 }} aria-label="Add to this day" title="Add to this day" onClick={(e) => { e.preventDefault(); addMealSuggestion(r) }}><Plus size={18} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {meditation && (
        <>
          <div className="section-title">Suggested reset</div>
          <div className="stack">
            <div className="today-entry">
              <Link to={`/mind/${meditation.id}`} className="card">
                <div className="card-row">
                  <div className="thumb"><Brain strokeWidth={1.75} /></div>
                  <div className="card-body">
                    <span className="eyebrow">{meditation.kind}</span>
                    <h3>{meditation.title}</h3>
                    <div className="meta"><span>{meditation.duration} min</span>{meditation.coach ? <span className="dot">{meditation.coach}</span> : null}</div>
                  </div>
                </div>
              </Link>
              <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12 }} aria-label="Add to this day" title="Add to this day" onClick={(e) => { e.preventDefault(); addMindSuggestion() }}><Plus size={18} /></button>
            </div>
          </div>
        </>
      )}

      {(upcoming.length > 0 || upcomingPlans.length > 0) && (
        <>
          <div className="section-title">Coming up</div>
          <div className="stack">
            {upcoming.map((e) => <PlanCard key={e.id} e={e} showDate onSwap={() => swapOn(e.start_date_local.slice(0, 10))} onRemove={() => removeEvent(e)} />)}
            {upcomingPlans.map((p) => <CoachPlanCard key={p.id} p={p} onRun={runPlan} showDate fmtDay={fmtDay} onSwap={() => swapOn(p.date)} onRemove={() => removePlan(p)} />)}
          </div>
        </>
      )}

    </div>
  )
}
