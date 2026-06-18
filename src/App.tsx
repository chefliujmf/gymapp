import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Dumbbell, Bike, Footprints, Salad, Brain } from 'lucide-react'
import AccountMenu from './auth/AccountMenu'

const tabs = [
  { to: '/', label: 'Today', icon: <Home strokeWidth={1.75} />, end: true },
  { to: '/exercises', label: 'Train', icon: <Dumbbell strokeWidth={1.75} />, end: false },
  { to: '/cycle', label: 'Ride', icon: <Bike strokeWidth={1.75} />, end: false },
  { to: '/run', label: 'Run', icon: <Footprints strokeWidth={1.75} />, end: false },
  { to: '/eat', label: 'Eat', icon: <Salad strokeWidth={1.75} />, end: false },
  { to: '/mind', label: 'Mind', icon: <Brain strokeWidth={1.75} />, end: false },
]

export default function App() {
  const { pathname } = useLocation()
  // Hide chrome on detail/player pages for an immersive view.
  const isDetail = /\/(workouts|exercises|programs|recipes|trainers|mind|cycle|plan)\/[^/]+$/.test(pathname) || pathname === '/ride-player' || pathname === '/run-player' || pathname === '/build' || /\/play$/.test(pathname)

  return (
    <div className="app-shell">
      {!isDetail && (
        <header className="app-bar">
          <span className="app-bar__brand"><img src="/favicon.svg" alt="" style={{ width: 22, height: 22, borderRadius: 6, verticalAlign: '-5px', marginRight: 7 }} />Platyplus</span>
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
              className={({ isActive }) => 'tab' + (isActive ? ' tab--active' : '')}
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
