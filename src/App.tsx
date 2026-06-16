import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', icon: '🏠', end: true },
  { to: '/workouts', label: 'Workouts', icon: '💪', end: false },
  { to: '/programs', label: 'Programs', icon: '📅', end: false },
  { to: '/recipes', label: 'Recipes', icon: '🥗', end: false },
  { to: '/progress', label: 'Progress', icon: '📈', end: false },
]

export default function App() {
  const { pathname } = useLocation()
  // Hide the tab bar on detail pages for an immersive view.
  const isDetail = /\/(workouts|programs|recipes)\/[^/]+$/.test(pathname)

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
