import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi, type User } from './api'
import { setSetting, syncLogsFromServer } from '../db'
import Login from '../pages/Login'

interface Ctx {
  user: User | null
  loading: boolean
  apply: (u: User | null) => Promise<void>
  refresh: () => Promise<void>
  logout: () => Promise<void>
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(AuthCtx)

const DEV = import.meta.env.DEV

// Keep the client's intervals.icu settings in sync with the account: when the
// server holds the key, mark "connected" so the app calls /icu (proxy injects).
async function syncIcu(u: User | null) {
  if (!u) return
  await setSetting('icu_server_key', u.hasIcuKey ? '1' : '0')
  if (u.icuAthlete) await setSetting('icu_athlete_id', u.icuAthlete)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const apply = async (u: User | null) => { setUser(u); await syncIcu(u) }
  const refresh = async () => { try { await apply(await authApi.me()) } catch { setUser(null) } }
  const logout = async () => { await authApi.logout().catch(() => {}); setUser(null) }

  useEffect(() => {
    ;(async () => {
      try {
        // Use the real backend (dev runs server.js on :8088 via the vite proxy).
        await apply(await authApi.me())
      } catch (e) {
        const httpErr = e instanceof Error && /^HTTP \d/.test(e.message)
        if (DEV && httpErr) {
          // dev + signed out but the backend IS up → auto-login for REAL with the
          // seed creds, so server-auth features (chat, Strava OAuth) actually work
          // without a manual login. Falls back to the login screen if that fails.
          try { await apply(await authApi.login('jmfiset', 'devpass')) } catch { setUser(null) }
        } else if (DEV && !httpErr) {
          // No backend at all (plain `npm run dev`) → client-only mock so the shell
          // stays usable; server routes will 401 (run `npm run dev:full` for those).
          await apply({ id: 'dev', username: 'dev', email: 'dev@local', role: 'admin', info: {}, avatar: '', passkeys: [], hasIcuKey: true, icuAthlete: 'i28814' })
        } else {
          setUser(null)
        }
      }
      setLoading(false); syncLogsFromServer()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AuthCtx.Provider value={{ user, loading, apply, refresh, logout }}>{children}</AuthCtx.Provider>
}

/** Gates the whole app: splash while checking, Login when signed out. */
export function Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-splash"><div className="auth-logo"><img src="/favicon.svg?v=4" alt="" style={{ width: 40, height: 40, borderRadius: 10, verticalAlign: '-9px', marginRight: 9 }} />Platyplus</div></div>
  if (!user) return <Login />
  return <>{children}</>
}
