import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', icon: '🏠', end: true },
  { to: '/train', label: 'Train', icon: '💪', end: false },
  { to: '/eat', label: 'Eat', icon: '🥗', end: false },
  { to: '/mind', label: 'Mind', icon: '🧘', end: false },
  { to: '/profile', label: 'Profile', icon: '👤', end: false },
]

export default function App() {
  const { pathname } = useLocation()
  // Hide the tab bar on detail pages for an immersive view.
  const isDetail = /\/(workouts|programs|recipes|trainers|mind)\/[^/]+$/.test(pathname)

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
