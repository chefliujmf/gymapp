import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Dumbbell, Bike, Footprints, Brain, Salad, User, Settings as SettingsIcon, Activity, TrendingUp } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

type Item = { label: string; sub: string; to: string; icon: ReactNode; mine?: boolean }

function HubLink({ it }: { it: Item }) {
  return (
    <Link to={it.to} className="card hub-link">
      <span className="hub-link__ic">{it.icon}</span>
      <span className="hub-link__t"><h3>{it.label}{it.mine && <em> · yours</em>}</h3><div className="meta">{it.sub}</div></span>
      <span className="hub-link__ch">›</span>
    </Link>
  )
}

const ENDUR = ['cycling', 'running', 'triathlon']

/** Train hub — every discipline, the ones you do listed first. */
export function TrainHub() {
  const { user } = useAuth()
  const sports = user?.sports || []
  const mine = (s: string[]) => s.some((x) => sports.includes(x))
  const disc: Item[] = [
    { label: 'Ride', sub: 'Cycling workouts & builder', to: '/cycle', icon: <Bike strokeWidth={1.75} />, mine: mine(['cycling', 'triathlon']) },
    { label: 'Run', sub: 'Runs & pace work', to: '/run', icon: <Footprints strokeWidth={1.75} />, mine: mine(['running', 'triathlon']) },
    { label: 'Gym', sub: 'Strength programs & workouts', to: '/gym', icon: <Dumbbell strokeWidth={1.75} />, mine: mine(['strength']) },
    { label: 'Mind', sub: 'Yoga, mobility, meditation', to: '/mind', icon: <Brain strokeWidth={1.75} />, mine: mine(['yoga']) },
  ].sort((a, b) => Number(b.mine) - Number(a.mine))
  return (
    <div>
      <div className="page-head"><h1>Train</h1><p>Your disciplines</p></div>
      <div className="stack">{disc.map((it) => <HubLink key={it.label} it={it} />)}</div>
    </div>
  )
}

/** Stats hub — shows only what's relevant to your sports. */
export function StatsHub() {
  const { user } = useAuth()
  const sports = user?.sports || []
  const anyEndurance = !sports.length || sports.some((s) => ENDUR.includes(s))
  const items: Item[] = [
    ...(anyEndurance ? [{ label: 'Fitness & Form', sub: 'CTL/ATL/Form, VO₂max, power curve', to: '/fitness', icon: <Activity strokeWidth={1.75} /> }] : []),
    { label: 'Strength', sub: 'Estimated 1RM per exercise', to: '/strength', icon: <Dumbbell strokeWidth={1.75} /> },
    { label: 'Progress', sub: 'History, totals & streaks', to: '/progress', icon: <TrendingUp strokeWidth={1.75} /> },
  ]
  return (
    <div>
      <div className="page-head"><h1>Stats</h1><p>Your trends & progress</p></div>
      <div className="stack">{items.map((it) => <HubLink key={it.label} it={it} />)}</div>
    </div>
  )
}

/** More — everything else. */
export function MoreHub() {
  const items: Item[] = [
    { label: 'Eat', sub: 'Recipes & meal plans', to: '/eat', icon: <Salad strokeWidth={1.75} /> },
    { label: 'Mind', sub: 'Yoga, mobility, meditation', to: '/mind', icon: <Brain strokeWidth={1.75} /> },
    { label: 'Profile', sub: 'You & your coaching', to: '/profile', icon: <User strokeWidth={1.75} /> },
    { label: 'Settings', sub: 'Account, connections & preferences', to: '/settings', icon: <SettingsIcon strokeWidth={1.75} /> },
  ]
  return (
    <div>
      <div className="page-head"><h1>More</h1><p>Eat, mind & your account</p></div>
      <div className="stack">{items.map((it) => <HubLink key={it.label} it={it} />)}</div>
    </div>
  )
}
