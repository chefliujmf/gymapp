import { Link } from 'react-router-dom'
import { type ReactNode, useState } from 'react'
import { Dumbbell, Bike, Footprints, Brain, Salad, Activity, History, PlusCircle, HeartPulse, Waves, Trophy } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { hasModule } from '../modules'
import { BenchmarksCard } from '../Benchmarks'
import PageHead from '../PageHead'
import CyclingStats from './CyclingStats'
import RunningStats from './RunningStats'
import SwimmingStats from './SwimmingStats'
import TriathlonStats from './TriathlonStats'
import Progress from './Progress'

type Item = { label: string; sub: string; to: string; icon: ReactNode; mine?: boolean }

function HubLink({ it }: { it: Item }) {
  return (
    <Link to={it.to} className="card hub-link">
      <span className="hub-link__ic">{it.icon}</span>
      <span className="hub-link__t"><h3>{it.label}</h3><div className="meta">{it.sub}</div></span>
      <span className="hub-link__ch">›</span>
    </Link>
  )
}

/** Train hub — every discipline, the ones you do listed first (central hasModule, #198). */
export function TrainHub() {
  const { user } = useAuth()
  const sports = user?.sports || []
  const mine = (m: string) => hasModule(sports, m, { emptyShowsAll: false }) // "is this MINE" → no empty-fallback
  const disc: Item[] = [
    { label: 'Ride', sub: 'Cycling workouts & builder', to: '/cycle', icon: <Bike strokeWidth={1.75} />, mine: mine('cycling') },
    { label: 'Run', sub: 'Runs & pace work', to: '/run', icon: <Footprints strokeWidth={1.75} />, mine: mine('running') },
    { label: 'Gym', sub: 'Strength programs & workouts', to: '/gym', icon: <Dumbbell strokeWidth={1.75} />, mine: mine('strength') },
    { label: 'Mind', sub: 'Yoga, pilates, meditation', to: '/mind', icon: <Brain strokeWidth={1.75} />, mine: mine('mind') },
  ].sort((a, b) => Number(b.mine) - Number(a.mine))
  return (
    <div>
      <PageHead title="Train" sub="Your disciplines" />
      <div className="stack">
        <HubLink it={{ label: 'Log activity', sub: 'Add a session — manual, or import a .fit/.gpx/.tcx', to: '/log-activity', icon: <PlusCircle strokeWidth={1.75} /> }} />
        {disc.map((it) => <HubLink key={it.label} it={it} />)}
      </div>
    </div>
  )
}

/** Stats hub IA (#193) — GLOBAL (cross-sport) vs PER SPORT. Pure + testable (no JSX):
 *  `key` maps to an icon in the component. Per-sport cards only for the sports you train. */
type Spec = { key: string; label: string; sub: string; to: string }
export function statsGroups(sports: string[]): { global: Spec[]; perSport: Spec[] } {
  // central module helper (#198); "is this MINE" semantics for per-sport cards (no empty-fallback).
  const has = (m: string) => hasModule(sports, m, { emptyShowsAll: false })
  const global: Spec[] = []
  // Training load / Form aggregates whole-body stress (intervals) — global, shown when there's an
  // endurance sport (it's where Form comes from) OR no sports set yet (emptyShowsAll).
  if (hasModule(sports, 'endurance', { emptyShowsAll: true })) global.push({ key: 'form', label: 'Load & Form', sub: 'Fitness / Fatigue / Form · readiness · all sports', to: '/fitness' }) // #225 global
  global.push({ key: 'wellness', label: 'Wellness', sub: 'Sleep · HRV · resting HR · weight trends', to: '/wellness' }) // #194a
  global.push({ key: 'history', label: 'History', sub: 'All your logged sessions (every sport)', to: '/logs' })
  const perSport: Spec[] = []
  // #570 — a triathlete gets the Triathlon SYNTHESIS row first (limiter + balance over the 3 engines), then the
  // per-sport pages. Gated on the RAW sport (not the swim/bike/run modules it expands to).
  if (sports.includes('triathlon')) perSport.push({ key: 'triathlon', label: 'Triathlon', sub: 'Limiter · race readiness · combined load', to: '/triathlon' })
  if (has('cycling')) perSport.push({ key: 'cycling', label: 'Cycling', sub: 'Power curve · eFTP · VO₂max · W/kg', to: '/cycling-stats' }) // #225 per-sport page
  if (has('running')) perSport.push({ key: 'running', label: 'Running', sub: 'Threshold pace · zones · VDOT · race predictions', to: '/running-stats' }) // #225 per-sport page
  if (has('swimming')) perSport.push({ key: 'swimming', label: 'Swimming', sub: 'CSS · D′ · TTE · SWOLF · zones', to: '/swimming-stats' }) // #swim-tri per-sport page
  if (has('strength')) perSport.push({ key: 'strength', label: 'Strength', sub: 'Volume · PRs · est-1RM trends', to: '/progress' })
  // Mind stats DEACTIVATED 2026-07-11 (JM: remove mind traces, incl. under Stats).
  return { global, perSport }
}
const STAT_ICON: Record<string, ReactNode> = {
  form: <Activity strokeWidth={1.75} />, history: <History strokeWidth={1.75} />, wellness: <HeartPulse strokeWidth={1.75} />,
  cycling: <Bike strokeWidth={1.75} />, running: <Footprints strokeWidth={1.75} />, swimming: <Waves strokeWidth={1.75} />,
  triathlon: <Trophy strokeWidth={1.75} />, strength: <Dumbbell strokeWidth={1.75} />, mind: <Brain strokeWidth={1.75} />,
}
const toItem = (s: Spec): Item => ({ label: s.label, sub: s.sub, to: s.to, icon: STAT_ICON[s.key] })

/** Stats hub — GLOBAL (cross-sport) + PER SPORT sections (#193). */
// #570 — Stats is now INLINE-TABBED (JM): an Overview tab (global benchmarks + Load/Form · Wellness · History) plus
// one tab per sport you do — quick 1-tap access without leaving Stats. A TRIATHLETE gets a single merged "Triathlon"
// tab (swim+bike+run inside it) instead of three separate ones. Tabs adapt to the athlete's sports.
const TAB_EMOJI: Record<string, string> = { triathlon: '🏊🚴🏃', cycling: '🚴', running: '🏃', swimming: '🏊', strength: '💪' }
export function StatsHub() {
  const { user } = useAuth()
  const sports = user?.sports || []
  const isTri = sports.includes('triathlon')
  const { global, perSport } = statsGroups(sports)
  // Triathletes merge cycling/running/swimming INTO the Triathlon tab — drop the standalone ones.
  const sportTabs = perSport.filter((s) => !(isTri && ['cycling', 'running', 'swimming'].includes(s.key)))
  const tabs = [{ key: 'overview', label: 'Overview' }, ...sportTabs.map((s) => ({ key: s.key, label: s.label }))]
  const [tab, setTab] = useState('overview')
  const active = tabs.some((t) => t.key === tab) ? tab : 'overview'
  return (
    <div>
      <PageHead title="Stats" sub={active === 'overview' ? 'Your trends & progress' : 'Tap a tab for that sport'} />
      {tabs.length > 1 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {tabs.map((t) => <button key={t.key} className={'chip' + (active === t.key ? ' chip--active' : '')} onClick={() => setTab(t.key)}>{TAB_EMOJI[t.key] ? `${TAB_EMOJI[t.key]} ` : ''}{t.label}</button>)}
        </div>
      )}
      {active === 'overview' && <>
        <BenchmarksCard />{/* #228: global benchmarks (VO₂max, sleep, whole-body) lead the Overview */}
        <div className="stack">{global.map((s) => <HubLink key={s.key} it={toItem(s)} />)}</div>
        {sports.length > 0 && <p className="meta" style={{ marginTop: 14 }}>Tabs show only your sports — <Link to="/profile" style={{ color: 'var(--accent)' }}>edit sports</Link>.</p>}
      </>}
      {active === 'triathlon' && <TriathlonStats embedded />}
      {active === 'cycling' && <CyclingStats embedded />}
      {active === 'running' && <RunningStats embedded />}
      {active === 'swimming' && <SwimmingStats embedded />}
      {active === 'strength' && <Progress embedded />}
    </div>
  )
}

/** More — content extras. Account stuff (Profile/Settings) lives in the top-right
 *  avatar menu, not here, to avoid the duplication (#44). */
export function MoreHub() {
  const items: Item[] = [
    { label: 'Eat', sub: 'Recipes & meal plans', to: '/eat', icon: <Salad strokeWidth={1.75} /> },
    { label: 'Mind', sub: 'Yoga, mobility, meditation', to: '/mind', icon: <Brain strokeWidth={1.75} /> },
  ]
  return (
    <div>
      <PageHead title="More" sub="Eat & mind. Your account is under the avatar, top-right." />
      <div className="stack">{items.map((it) => <HubLink key={it.label} it={it} />)}</div>
    </div>
  )
}
