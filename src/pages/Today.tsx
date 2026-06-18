import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { WeekStrip } from '../ui'
import { fetchEvents, eventObjective, sportOf, type IcuEvent } from '../intervals'
import { setPlanEvents, fetchGymPlans, gymSessionFromPlan, setGymSession, type CoachPlan } from '../plan'
import { setCurrentRide } from '../ride'
import { recipes, mindSessions } from '../data/catalog'
import type { Recipe } from '../types'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Target, Salad, Brain } from 'lucide-react'

// Stable daily pick: same item all day, rotates with the date (+salt for variety).
function pickByDate<T>(arr: T[], dateStr: string, salt = 0): T | undefined {
  if (!arr.length) return undefined
  let h = salt >>> 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

const planIcon = (s: CoachPlan['sport']) => (s === 'ride' ? <Bike strokeWidth={1.75} /> : s === 'run' ? <Footprints strokeWidth={1.75} /> : <Dumbbell strokeWidth={1.75} />)

/** A coach-pushed plan that isn't mirrored by an intervals event — runs in-app. */
function CoachPlanCard({ p, onRun, showDate, fmtDay }: { p: CoachPlan; onRun: (p: CoachPlan) => void; showDate?: boolean; fmtDay: (s: string) => string }) {
  const mins = p.sport === 'gym' ? undefined : Math.round((p.segments || []).reduce((s, x) => s + x.duration, 0) / 60)
  return (
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

function PlanCard({ e, showDate }: { e: IcuEvent; showDate?: boolean }) {
  const obj = eventObjective(e)
  const mins = e.moving_time ? Math.round(e.moving_time / 60) : undefined
  return (
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
  )
}

export default function Today() {
  const [selDay, setSelDay] = useState(todayISO())
  const todaysLogs = useLiveQuery(() => db.logs.where('date').equals(todayISO()).toArray())
  const diet = useLiveQuery(() => getSetting('diet'))
  const [events, setEvents] = useState<IcuEvent[] | null>(null)
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [err, setErr] = useState<string>()
  const navigate = useNavigate()

  useEffect(() => {
    const [a, b] = weekRange()
    fetchEvents(a, b).then((evs) => { setEvents(evs); setPlanEvents(evs) }).catch((e) => setErr((e as Error).message))
    fetchGymPlans(a, b).then(setPlans)
  }, [])

  function runPlan(p: CoachPlan) {
    if (p.sport === 'gym') { setGymSession(gymSessionFromPlan(p)); navigate('/gym-session/play') }
    else { setCurrentRide({ title: p.title, sport: p.sport === 'ride' ? 'cycling' : 'running', segments: p.segments || [], ftp: p.ftp || 260, source: p.id }); navigate(p.sport === 'ride' ? '/ride-player' : '/run-player') }
  }

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()
  // Merge-by-id: a coach plan whose id matches an intervals event's external_id is
  // already shown as that event's card — only show un-mirrored plans, so no dupes.
  const linkedIds = new Set((events ?? []).map((e) => e.external_id).filter(Boolean))
  const dayEvents = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) === selDay)
  const dayPlans = plans.filter((p) => p.date === selDay && !linkedIds.has(p.id))
  const upcoming = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) > selDay).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
  const upcomingPlans = plans.filter((p) => p.date > selDay && !linkedIds.has(p.id)).sort((a, b) => a.date.localeCompare(b.date))

  // Daily fuel (diet-aware) + a mind reset for the selected day.
  const dietOk = (r: Recipe) => {
    const p = diet ?? 'vegetarian'
    if (p === 'no preference') return true
    if (p === 'vegan') return !!r.diet?.includes('vegan')
    return !!(r.diet?.includes('vegetarian') || r.diet?.includes('vegan'))
  }
  const meals = (['breakfast', 'lunch', 'dinner'] as const)
    .map((cat, i) => pickByDate(recipes.filter((r) => r.category === cat && dietOk(r)), selDay, i + 1))
    .filter(Boolean) as Recipe[]
  const meditation = pickByDate(mindSessions, selDay, 7)

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

      <div className="section-title" style={{ marginTop: 8 }}>{selDay === todayISO() ? "Today's plan" : fmtDay(selDay)}</div>
      {err === 'NO_KEY' ? (
        <div className="card" style={{ padding: 18 }}>
          <p className="meta" style={{ margin: 0 }}>Connect intervals.icu to see your coach's plan here.</p>
          <Link to="/profile" className="btn btn--ghost" style={{ marginTop: 12 }}>Connect →</Link>
        </div>
      ) : err ? (
        <p className="meta">Couldn't load plan: {err}</p>
      ) : events === null ? (
        <p className="meta">Loading your plan…</p>
      ) : dayEvents.length === 0 && dayPlans.length === 0 ? (
        <p className="meta">Nothing scheduled — rest day or self-guided.</p>
      ) : (
        <div className="stack">
          {dayEvents.map((e) => <PlanCard key={e.id} e={e} />)}
          {dayPlans.map((p) => <CoachPlanCard key={p.id} p={p} onRun={runPlan} fmtDay={fmtDay} />)}
        </div>
      )}

      {(upcoming.length > 0 || upcomingPlans.length > 0) && (
        <>
          <div className="section-title">Coming up</div>
          <div className="stack">
            {upcoming.map((e) => <PlanCard key={e.id} e={e} showDate />)}
            {upcomingPlans.map((p) => <CoachPlanCard key={p.id} p={p} onRun={runPlan} showDate fmtDay={fmtDay} />)}
          </div>
        </>
      )}

      {meals.length > 0 && (
        <>
          <div className="section-title">Fuel{selDay !== todayISO() ? ` · ${fmtDay(selDay)}` : ''}</div>
          <div className="stack">
            {meals.map((r) => (
              <Link key={r.id} to={`/recipes/${r.id}`} className="card">
                <div className="card-row">
                  <div className="thumb">{r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Salad strokeWidth={1.75} />}</div>
                  <div className="card-body">
                    <span className="eyebrow">{r.category}</span>
                    <h3>{r.title}</h3>
                    <div className="meta"><span>{r.minutes} min</span><span className="dot">{r.kcal} kcal</span><span className="dot">{r.protein}g protein</span></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {meditation && (
        <>
          <div className="section-title">Reset your mind</div>
          <div className="stack">
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
          </div>
        </>
      )}

      <div className="section-title">Jump in</div>
      <div className="stack">
        {[
          { to: '/exercises', icon: <Dumbbell strokeWidth={1.75} />, label: 'Train' },
          { to: '/cycle', icon: <Bike strokeWidth={1.75} />, label: 'Ride' },
          { to: '/eat', icon: <Salad strokeWidth={1.75} />, label: 'Eat' },
          { to: '/mind', icon: <Brain strokeWidth={1.75} />, label: 'Mind' },
        ].map((j) => (
          <Link key={j.to} to={j.to} className="card"><div className="card-row"><div className="thumb">{j.icon}</div><div className="card-body"><h3>{j.label}</h3></div></div></Link>
        ))}
      </div>
    </div>
  )
}
