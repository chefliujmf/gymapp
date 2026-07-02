import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export interface Passkey { id: string; label: string; createdAt: number }
export interface CoachNotification { id: string; kind: 'coach'; subkind?: 'update' | 'review'; date: string; at: string; title: string; body?: string; items?: string[]; link?: string; score?: number; read?: boolean }
export interface CoachReview { id: string; date: string; planId?: string; activityId?: string; sport?: string; score?: number; verdict?: string; execution?: string[]; body?: string; mind?: { pattern?: string; cue?: string }; next?: string; recovery?: string; takeaways?: string[]; at: string }
// #207 Phase 2b: `auto` records the auto scores shown (display terms) so the model can learn the
// athlete's systematic overrides → a personal calibration.
export interface Checkin { date: string; energy?: number; sleep?: number; soreness?: number; note?: string; auto?: { energy?: number; sleep?: number; freshness?: number } }
export interface ReadinessScore { score: number; raw?: number }
export interface Readiness {
  connected: boolean; date?: string; sleepNeed?: number
  sleep?: (ReadinessScore & { sleepHours?: number; sleepScore?: number }) | null
  freshness?: (ReadinessScore & { acwr?: number | null; tsb?: number | null; personalZ?: number | null }) | null
  energy?: (ReadinessScore & { hrvZ?: number | null; rhrZ?: number | null; guard?: boolean; provisional?: boolean; needDays?: number }) | null
  calibration?: { energy: number; sleep: number; freshness: number } // #207 Phase 2b learned offsets
  baseline?: { nHrv: number; nRhr: number; hrvCV7: number | null }
  today?: { hrv?: number | null; restingHR?: number | null; sleepHours?: number | null }
}

export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  info: Record<string, unknown>
  avatar: string
  passkeys: Passkey[]
  hasIcuKey: boolean
  icuAthlete: string
  coachName?: string
  hasCoachProfile?: boolean
  sports?: string[] // the sports you do (multi-select) — drives nav hubs + engine gating
  sex?: string // from intervals.icu athlete record — gates female-athlete module
  sleepNeed?: number | null // h — personalises the Sleep readiness score (#159)
  maxHR?: number | null // bpm
  ftp?: number | null // W
  vo2max?: number | null // ml/kg/min — athlete benchmarks the coach + readiness learn from (#207)
  // #210 per-sport stats, two-way synced with intervals (ftp cycling only; thresholdPace running sec/km, swim sec/100m)
  sportSettings?: Partial<Record<'cycling' | 'running' | 'swimming', SportStat>>
  runVdot?: number | null // running VDOT ≈ VO₂max, derived from threshold pace (#209)
  runThresholdPace?: number | null // sec/km
  statPrefs?: Partial<Record<'vo2max' | 'ftp' | 'thresholdPace' | 'maxHr', 'manual' | 'computed' | 'auto'>> // #236 manual vs computed; #277 auto = computed-when-ready, manual until then
  learnReadiness?: boolean // #235 — auto-calibrate readiness from check-in overrides (default true)
  statsSyncedAt?: number // last successful push to intervals
  onboardedAt?: number // #257 set when the coach finishes onboarding (profile + first week)
}

export interface SportStat { ftp?: number | null; maxHr?: number | null; lthr?: number | null; thresholdPace?: number | null }
export type SportGroup = 'cycling' | 'running' | 'swimming'
export interface IcuAthletePull {
  connected: boolean
  sportSettings?: Partial<Record<SportGroup, SportStat>>
  weight?: number | null
  source?: string
  error?: string
}

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch('/auth' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: opts.body ? { 'content-type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    // fetch only rejects on a network-level failure (offline, server unreachable).
    throw new Error("Can't reach the server. Check your connection and try again.")
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const body = (data || {}) as { error?: string; ref?: string }
    // Prefer the server's human message; turn bare 5xx/4xx into plain English.
    let message = body.error
    if (!message) {
      if (res.status >= 500) message = 'Something went wrong on our end. It has been logged.'
      else if (res.status === 401) message = 'Wrong username or password.'
      else if (res.status === 404) message = 'Not found.'
      else message = 'That request could not be completed.'
    }
    if (res.status >= 500 && body.ref) message += ` (ref ${body.ref})`
    const err = new Error(message) as Error & { status?: number; ref?: string }
    err.status = res.status // so callers can tell a server error (e.g. 401) from a network failure
    err.ref = body.ref
    throw err
  }
  return data as T
}

export interface ParsedActivity {
  format: 'fit' | 'gpx' | 'tcx'
  sport: string
  startIso: string | null
  durationSec?: number
  distanceM?: number
  avgHr?: number
  avgPower?: number
  elevationM?: number
  kcal?: number
  hasGps: boolean
  track: [number, number][]
}
export interface ManualActivity {
  sport: string
  title: string
  date: string
  startIso: string
  durationSec: number
  distanceM?: number
  avgHr?: number
  avgPower?: number
  file?: { name: string; b64: string }
}

export const authApi = {
  me: () => req<User>('/me'),
  login: (login: string, password: string) => req<User>('/login', { body: { login, password } }),
  logout: () => req<{ ok: boolean }>('/logout', { method: 'POST' }),

  async passkeyLogin(login: string): Promise<User> {
    const { uid, options } = await req<{ uid: string; options: unknown }>('/passkey/login/options', { body: { login } })
    const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
    return req<User>('/passkey/login/verify', { body: { uid, response } })
  },
  // Usernameless: the device offers its passkeys for this site — no username.
  async passkeyLoginDiscoverable(): Promise<User> {
    const options = await req<unknown>('/passkey/login/begin', { method: 'POST' })
    const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
    return req<User>('/passkey/login/finish', { body: { response } })
  },
  async passkeyRegister(label: string): Promise<User> {
    const options = await req<unknown>('/passkey/register/options', { method: 'POST' })
    const response = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] })
    return req<User>('/passkey/register/verify', { body: { response, label } })
  },
  passkeyDelete: (id: string) => req<User>(`/passkeys/${id}`, { method: 'DELETE' }),

  // Coach chatbot (locked-down claude -p + per-user Platyplus MCP, server-side).
  chat: (message: string) => req<{ reply: string; coach: string }>('/chat', { body: { message } }),
  chatReset: () => req<{ ok: boolean }>('/chat/reset', { method: 'POST' }),

  changePassword: (current: string, newPassword: string) => req<{ ok: boolean }>('/password/change', { body: { current, newPassword } }),
  forgot: (email: string) => req<{ ok: boolean; emailSent: boolean }>('/password/forgot', { body: { email } }),
  reset: (email: string, code: string, newPassword: string) => req<{ ok: boolean }>('/password/reset', { body: { email, code, newPassword } }),
  saveProfile: (info: Record<string, unknown>) => req<User>('/profile', { method: 'PUT', body: info }),
  // #210 per-sport stats two-way sync
  pullIcuAthlete: () => req<IcuAthletePull>('/intervals/athlete'),
  runEstimate: () => req<{ available: boolean; thresholdPace?: number; criticalSpeed?: number; r2?: number | null; source?: string; confidence?: 'high' | 'medium' | 'low'; assessed?: boolean; reason?: string; runs?: number; weeklyKm?: number }>('/intervals/run-estimate'),
  runVolume: () => req<{ available: boolean; longestKm?: number; weeklyKm?: number; runs?: number; windowDays?: number }>('/intervals/run-volume'),
  runPaceTrend: () => req<{ available: boolean; paces?: (number | null)[]; weeks?: number }>('/intervals/run-pace-trend'), // #230 per-week avg pace
  // #223 — forecast a FUTURE day's expected freshness from planned load.
  readinessForecast: (date: string) => req<{ connected: boolean; future?: boolean; available?: boolean; date?: string; daysOut?: number; form?: number; freshness?: number | null; acwr?: number | null; totalPlannedLoad?: number; plannedDays?: number }>(`/readiness-forecast?date=${date}`),
  // #248 — per-day CTL/ATL/Form projection (forward line on Load & Form charts).
  readinessProjection: (days = 14) => req<{ connected: boolean; available?: boolean; dates?: string[]; loads?: number[]; ctl?: number[]; atl?: number[]; form?: number[] }>(`/readiness-projection?days=${days}`),
  saveSportStat: (body: { group: SportGroup; ftp?: number | null; maxHr?: number | null; lthr?: number | null; thresholdPace?: number | null; runVdot?: number | null }) =>
    req<User & { synced?: boolean; pushError?: string | null }>('/sport-stat', { method: 'PUT', body }),
  getAthlete: () => req<{ profile: string; updatedAt: number }>('/profile/athlete'),
  saveAthlete: (profile: string) => req<{ profile: string; updatedAt: number }>('/profile/athlete', { method: 'PUT', body: { profile } }),
  checkin: (data: Checkin) => req<Checkin>('/checkin', { method: 'POST', body: data }),
  checkins: (from: string, to: string) => req<Checkin[]>(`/checkins?from=${from}&to=${to}`),
  readiness: (date: string) => req<Readiness>(`/readiness?date=${date}`),
  planFeedback: (id: string, data: { feel?: string; rpe?: number; fields?: Record<string, string>; note?: string }) => req<{ ok: boolean }>(`/plan/${encodeURIComponent(id)}/feedback`, { method: 'POST', body: data }),
  // #273 feedback on a completed device activity (no plan)
  getActivityFeedback: (id: string) => req<{ feel?: string; rpe?: number; fields?: Record<string, string>; note?: string; at?: number } | null>(`/activity/${encodeURIComponent(id)}/feedback`),
  activityFeedback: (id: string, data: { feel?: string; rpe?: number; fields?: Record<string, string>; note?: string; sport?: string; date?: string }) => req<{ ok: boolean }>(`/activity/${encodeURIComponent(id)}/feedback`, { method: 'POST', body: data }),
  promoteProd: () => req<{ ok: boolean }>('/promote-prod', { method: 'POST' }),
  // Fan a Platyplus-recorded workout out to intervals (match-first, server-side, #122/#123).
  completeActivity: (a: { sport: string; title: string; date: string; startIso: string; durationSec: number; samples: { t: number; power?: number; cadence?: number; hr?: number }[] }) =>
    req<{ status: string; icuId?: number | null; error?: string }>('/activity/complete', { method: 'POST', body: a }),
  // Manual activity entry (#129): parse an uploaded .fit/.gpx/.tcx, then fan the
  // entered/edited activity out to intervals (match-first). Local copy via logWorkout.
  parseActivityFile: (name: string, b64: string) => req<ParsedActivity>('/activity/parse', { method: 'POST', body: { name, b64 } }),
  logManualActivity: (a: ManualActivity) => req<{ status: string; icuId?: number | null; error?: string }>('/activity/manual', { method: 'POST', body: a }),
  notifications: () => req<CoachNotification[]>('/notifications'),
  coachReviews: () => req<CoachReview[]>('/coach-reviews'),
  markNotificationsRead: (ids?: string[]) => req<{ ok: boolean }>('/notifications/read', { method: 'POST', body: { ids } }),
  saveIcu: (icuKey: string, icuAthlete: string) => req<User>('/icu', { method: 'PUT', body: { icuKey, icuAthlete } }),
  saveAvatar: (avatar: string) => req<User>('/avatar', { method: 'PUT', body: { avatar } }),
  getToken: () => req<{ token: string }>('/token'),
  rotateToken: () => req<{ token: string }>('/token/rotate', { method: 'POST' }),

  listUsers: () => req<User[]>('/users'),
  addUser: (username: string, email: string, role: 'admin' | 'user') => req<{ user: User; tempPassword: string; emailed: boolean }>('/users', { body: { username, email, role } }),
  resetUser: (id: string) => req<{ tempPassword: string; emailed: boolean }>(`/users/${id}/reset`, { method: 'POST' }),
  setUserPassword: (id: string, password: string) => req<{ ok: boolean }>(`/users/${id}/password`, { method: 'POST', body: { password } }),
  deleteUser: (id: string) => req<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
}
