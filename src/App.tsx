import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, Dumbbell, BarChart3, Salad, MessageCircle, RotateCw } from 'lucide-react'
import AccountMenu from './auth/AccountMenu'
import ReleaseBell from './ReleaseBell'
import PromoteButton from './PromoteButton'
import ReportButton from './ReportButton'
import PasskeyPrompt from './auth/PasskeyPrompt'

// 5 fixed tabs (best practice). Train & Stats are hubs whose CONTENT adapts to the
// user's sports, so the nav stays the same for a one-sport or multi-sport athlete.
const tabs = [
  { to: '/', label: 'Today', icon: <Home strokeWidth={1.75} />, end: true },
  { to: '/plan', label: 'Plan', icon: <CalendarDays strokeWidth={1.75} />, end: false },
  { to: '/train', label: 'Train', icon: <Dumbbell strokeWidth={1.75} />, end: false, match: /^\/(train|gym|workouts|exercises|programs|trainers|cycle|run|ride-builder|run-builder|mind)/ },
  { to: '/eat', label: 'Eat', icon: <Salad strokeWidth={1.75} />, end: false, match: /^\/(eat|recipes)/ },
  { to: '/stats', label: 'Stats', icon: <BarChart3 strokeWidth={1.75} />, end: false, match: /^\/(stats|fitness|strength|progress|logs)/ },
]

// #370 — a Refresh for the installed DESKTOP PWA (no address bar / pull-to-refresh there). Pulls a newer
// bundle if one's waiting (post-deploy, #200) then reloads. Hidden on touch devices (mobile swipes to refresh).
function RefreshButton() {
  const [busy, setBusy] = useState(false)
  const refresh = () => {
    if (busy) return
    setBusy(true)
    try { (window as unknown as { __pwaUpdate?: (r?: boolean) => Promise<void> }).__pwaUpdate?.(true) } catch { /* no SW */ }
    setTimeout(() => window.location.reload(), 1200) // reload even when no new bundle is waiting
  }
  return <button className="refresh-btn" onClick={refresh} aria-label="Refresh" title="Refresh the app"><RotateCw size={17} className={busy ? 'spin' : undefined} /></button>
}

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // #457 — when a push notification is tapped while the app is OPEN, the service worker posts {notif-nav}
  // and we client-side route to its link (deep-link into the activity/plan) instead of leaving them put.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { const d = e.data as { type?: string; link?: string } | undefined; if (d?.type === 'notif-nav' && d.link) navigate(d.link) }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [navigate])
  // Hide chrome on detail/player pages for an immersive view.
  const isDetail = /\/(workouts|exercises|programs|recipes|trainers|mind|cycle|plan)\/[^/]+$/.test(pathname) || pathname === '/ride-player' || pathname === '/run-player' || pathname === '/build' || pathname === '/ride-builder' || pathname === '/run-builder' || pathname === '/admin' || pathname === '/chat' || /\/play$/.test(pathname)

  return (
    <div className="app-shell">
      {!isDetail && (
        <header className="app-bar">
          <Link to="/" className="app-bar__brand" style={{ textDecoration: 'none', color: 'inherit' }}><img src="/favicon.svg?v=4" alt="" style={{ width: 22, height: 22, borderRadius: 6, verticalAlign: '-5px', marginRight: 7 }} />Platyplus</Link>
          {/* Top-right is the status cluster only: notifications + account (Coach moved to the FAB). */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <RefreshButton /><PromoteButton /><ReportButton /><ReleaseBell /><AccountMenu />
          </div>
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      <PasskeyPrompt />{/* #266: one-time prompt to set up a passkey when the device has none */}
      {/* Coach FAB — primary assistant action, thumb-reachable bottom-right, above the tab bar (#50). */}
      {!isDetail && (
        <Link to="/chat" className="coach-fab" aria-label="Coach chat"><MessageCircle size={20} /> <span className="coach-fab__l">Coach</span></Link>
      )}
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
