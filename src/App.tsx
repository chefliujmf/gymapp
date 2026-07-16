import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { CalendarDays, BarChart3, MessageCircle, RotateCw } from 'lucide-react'
import AccountMenu from './auth/AccountMenu'
import ReleaseBell from './ReleaseBell'
import PromoteButton from './PromoteButton'
import ReportButton from './ReportButton'
import PasskeyPrompt from './auth/PasskeyPrompt'

// Fixed tabs (best practice). Train & Stats are hubs whose CONTENT adapts to the
// user's sports, so the nav stays the same for a one-sport or multi-sport athlete.
// Eat DEACTIVATED 2026-07-11 (JM: simplify the app) — the /eat route still exists, just no nav trace.
const tabs = [
  // #488 — Today merged INTO Plan (Plan's DAY view = the Today screen); Plan is now home ('/').
  { to: '/', label: 'Plan', icon: <CalendarDays strokeWidth={1.75} />, end: true, match: /^\/plan/ },
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

// #496 — RELIABLE update detection. The service worker can serve a stale shell, so instead of trusting it, we poll a
// tiny `/version` endpoint (which the SW passes straight to the network) for the DEPLOYED main bundle and compare it to
// the one THIS page is running. On a mismatch we show a one-tap banner that does a HARD update: unregister the SW +
// clear all caches + reload → guaranteed fresh build. This is why "everything failed" could happen — a wedged SW.
const RUNNING_BUNDLE = (typeof document !== 'undefined'
  ? ([...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[A-Za-z0-9_]+\.js/.test(s)) || '').match(/\/assets\/index-[A-Za-z0-9_]+\.js/)?.[0]
  : '') || ''
function UpdateBanner() {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (!RUNNING_BUNDLE) return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch('/version', { cache: 'no-store' })
        const { bundle } = await r.json()
        if (alive && bundle && bundle !== RUNNING_BUNDLE) setStale(true)
      } catch { /* offline / dev — ignore */ }
    }
    check()
    const iv = window.setInterval(check, 120000)
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  const hardUpdate = () => {
    // #update-hang v2 — the thing that ACTUALLY forces a fresh build is emptying the SW's precache (caches),
    // because Workbox serves the precached index.html for every navigation regardless of a ?query. So: clear
    // caches (fast), fire the SW unregister as NON-BLOCKING (a wedged SW can hang unregister forever — never
    // await it or the reload never fires), then ALWAYS reload to a cache-busted URL. Capped at 800ms so it's
    // instant even if caches.delete stalls.
    navigator.serviceWorker?.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {}) // non-blocking
    const clear = (async () => { try { const ks = (await window.caches?.keys?.()) || []; await Promise.all(ks.map((k) => caches.delete(k))) } catch { /* ignore */ } })()
    Promise.race([clear, new Promise((res) => setTimeout(res, 800))]).finally(() => {
      const u = new URL(window.location.href)
      u.searchParams.set('_v', String(Date.now())) // bust any HTTP/proxy cache of the shell
      window.location.replace(u.toString())
    })
  }
  if (!stale) return null
  return (
    <div className="update-banner" role="alert">
      <span>✨ A new version of Platyplus is ready.</span>
      <button onClick={hardUpdate}>Update now</button>
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // #496 — check for a newer build whenever the user navigates (throttled in main.tsx), so a fresh deploy
  // applies within a tap or two instead of sitting on the old bundle until the 30-min timer or a re-focus.
  useEffect(() => { (window as unknown as { __pwaCheck?: () => void }).__pwaCheck?.() }, [pathname])
  // #457 — when a push notification is tapped while the app is OPEN, the service worker posts {notif-nav}
  // and we client-side route to its link (deep-link into the activity/plan) instead of leaving them put.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { const d = e.data as { type?: string; link?: string } | undefined; if (d?.type === 'notif-nav' && d.link) navigate(d.link) }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [navigate])
  // #470 — on STARTUP, consume a link the sw stashed when a notification cold-launched the PWA (which lands on
  // Today, ignoring the deep link). Navigate there ourselves, then clear it — so tapping a notification always
  // opens the activity/plan, not just the app.
  useEffect(() => {
    ;(async () => {
      try {
        const cache = await caches.open('notif-nav'); const r = await cache.match('/pending')
        if (!r) return
        await cache.delete('/pending')
        const { link, at } = await r.json() as { link?: string; at?: number }
        if (link && link !== '/' && at && Date.now() - at < 120000) navigate(link)
      } catch { /* ignore */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Hide chrome on detail/player pages for an immersive view.
  // Immersive (no top bar / tab bar): players + builders + chat only. Admin is a normal destination — it keeps
  // the header + footer (#526, JM: chrome missing on Admin). Its own ‹ back button stays.
  const isDetail = /\/(workouts|exercises|programs|recipes|trainers|mind|cycle|plan)\/[^/]+$/.test(pathname) || pathname === '/ride-player' || pathname === '/run-player' || pathname === '/build' || pathname === '/ride-builder' || pathname === '/run-builder' || pathname === '/chat' || /\/play$/.test(pathname)

  return (
    <div className="app-shell">
      <UpdateBanner />
      {!isDetail && (
        <header className="app-bar">
          <Link to="/" className="app-bar__brand" style={{ textDecoration: 'none', color: 'inherit' }}><img src="/favicon.svg?v=6" alt="" style={{ width: 22, height: 22, borderRadius: 6, verticalAlign: '-5px', marginRight: 7 }} />platy<span style={{ color: 'var(--accent)' }}>plus</span></Link>
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
