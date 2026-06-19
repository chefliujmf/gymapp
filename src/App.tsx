import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { Home, CalendarDays, Dumbbell, Bike, Footprints, Salad, Brain } from 'lucide-react'
import AccountMenu from './auth/AccountMenu'

const tabs = [
  { to: '/', label: 'Today', icon: <Home strokeWidth={1.75} />, end: true },
  { to: '/plan', label: 'Plan', icon: <CalendarDays strokeWidth={1.75} />, end: false },
  { to: '/workouts', label: 'Train', icon: <Dumbbell strokeWidth={1.75} />, end: false, match: /^\/(workouts|exercises)/ },
  { to: '/cycle', label: 'Ride', icon: <Bike strokeWidth={1.75} />, end: false },
  { to: '/run', label: 'Run', icon: <Footprints strokeWidth={1.75} />, end: false },
  { to: '/eat', label: 'Eat', icon: <Salad strokeWidth={1.75} />, end: false },
  { to: '/mind', label: 'Mind', icon: <Brain strokeWidth={1.75} />, end: false },
]

export default function App() {
  const { pathname } = useLocation()
  // Hide chrome on detail/player pages for an immersive view.
  const isDetail = /\/(workouts|exercises|programs|recipes|trainers|mind|cycle|plan)\/[^/]+$/.test(pathname) || pathname === '/ride-player' || pathname === '/run-player' || pathname === '/build' || pathname === '/ride-builder' || pathname === '/run-builder' || pathname === '/admin' || /\/play$/.test(pathname)

  return (
    <div className="app-shell">
      {!isDetail && (
        <header className="app-bar">
          <Link to="/" className="app-bar__brand" style={{ textDecoration: 'none', color: 'inherit' }}><img src="/favicon.svg?v=2" alt="" style={{ width: 22, height: 22, borderRadius: 6, verticalAlign: '-5px', marginRight: 7 }} />Platyplus</Link>
          <AccountMenu />
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      {!isDetail && (
        <nav className="tab-bar">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => 'tab' + ((isActive || (t.match && t.match.test(pathname))) ? ' tab--active' : '')}
            >
              <span className="tab__icon">{t.icon}</span>
              <span className="tab__label">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
