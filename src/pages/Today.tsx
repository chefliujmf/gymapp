import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { WeekStrip } from '../ui'
import { fetchEvents, eventObjective, sportOf, type IcuEvent } from '../intervals'
import { setPlanEvents } from '../plan'
import { localISO } from '../date'

const iso = localISO
const todayISO = () => localISO()
function weekRange(): [string, string] {
  const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const end = new Date(mon); end.setDate(mon.getDate() + 13)
  return [iso(mon), iso(end)]
}
const sportIcon = (e: IcuEvent) => { const s = sportOf(e); return s === 'cycling' ? '🚴' : s === 'gym' ? '🏋️' : e.type === 'Run' ? '🏃' : '🎯' }
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
  const [events, setEvents] = useState<IcuEvent[] | null>(null)
  const [err, setErr] = useState<string>()

  useEffect(() => {
    const [a, b] = weekRange()
    fetchEvents(a, b).then((evs) => { setEvents(evs); setPlanEvents(evs) }).catch((e) => setErr((e as Error).message))
  }, [])

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()
  const dayEvents = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) === selDay)
  const upcoming = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) > selDay).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))

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
      ) : dayEvents.length === 0 ? (
        <p className="meta">Nothing scheduled — rest day or self-guided.</p>
      ) : (
        <div className="stack">{dayEvents.map((e) => <PlanCard key={e.id} e={e} />)}</div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="section-title">Coming up</div>
          <div className="stack">{upcoming.map((e) => <PlanCard key={e.id} e={e} showDate />)}</div>
        </>
      )}

      <div className="section-title">Jump in</div>
      <div className="stack">
        {[
          { to: '/exercises', icon: '💪', label: 'Train' },
          { to: '/cycle', icon: '🚴', label: 'Ride' },
          { to: '/eat', icon: '🥗', label: 'Eat' },
          { to: '/mind', icon: '🧘', label: 'Mind' },
        ].map((j) => (
          <Link key={j.to} to={j.to} className="card"><div className="card-row"><div className="thumb">{j.icon}</div><div className="card-body"><h3>{j.label}</h3></div></div></Link>
        ))}
      </div>
    </div>
  )
}
