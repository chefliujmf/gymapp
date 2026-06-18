import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Dumbbell, Bike, Salad, Brain, User } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Today', icon: <Home strokeWidth={1.75} />, end: true },
  { to: '/exercises', label: 'Train', icon: <Dumbbell strokeWidth={1.75} />, end: false },
  { to: '/cycle', label: 'Ride', icon: <Bike strokeWidth={1.75} />, end: false },
  { to: '/eat', label: 'Eat', icon: <Salad strokeWidth={1.75} />, end: false },
  { to: '/mind', label: 'Mind', icon: <Brain strokeWidth={1.75} />, end: false },
  { to: '/profile', label: 'Profile', icon: <User strokeWidth={1.75} />, end: false },
]

export default function App() {
  const { pathname } = useLocation()
  // Hide the tab bar on detail pages for an immersive view.
  const isDetail = /\/(workouts|exercises|programs|recipes|trainers|mind|cycle|plan)\/[^/]+$/.test(pathname) || pathname === '/ride-player' || pathname === '/build' || /\/play$/.test(pathname)

  return (
    <div className="app-shell">
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
