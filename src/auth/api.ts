import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export interface Passkey { id: string; label: string; createdAt: number }
export interface CoachNotification { id: string; kind: 'coach'; subkind?: 'update' | 'review' | 'report'; date: string; at: string; title: string; body?: string; items?: string[]; link?: string; score?: number; read?: boolean }
export interface CoachReview { id: string; date: string; planId?: string; activityId?: string; sport?: string; score?: number; verdict?: string; execution?: string[]; body?: string; mind?: { pattern?: string; cue?: string }; next?: string; recovery?: string; takeaways?: string[]; at: string }
// #232 — activity & changes log entry
export interface AuditEvent { at: number; actor: 'you' | 'coach' | 'sync' | 'system'; action: string; target?: string; detail?: string; kind?: string }
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
  baseline?: { nHrv: number; nRhr: number; hrvCV7: number | null; hrvMin?: number | null; hrvMax?: number | null; rhrMin?: number | null; rhrMax?: number | null } // #373 known range
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
  statPrefs?: Partial<Record<'vo2max' | 'ftp' | 'thresholdPace' | 'maxHr' | 'sleepNeed', 'manual' | 'computed' | 'auto'>> // #236 manual vs computed; #277 auto; #337 sleepNeed
  learnReadiness?: boolean // #235 — auto-calibrate readiness from check-in overrides (default true)
  feedbackSkips?: string[] // #review-skip — activity ids the athlete skipped reviewing; excluded from the "to review" list
  statsSyncedAt?: number // last successful push to intervals
  onboardedAt?: number // #257 set when the coach finishes onboarding (profile + first week)
  cyclePhase?: string | null // #422 — current menstrual phase auto-derived from intervals wellness (last readiness read)
  cyclePhaseAt?: string | null // #422 — the date that phase is as-of (YYYY-MM-DD)
  staging?: boolean // #560 — this env is QA/staging
  syncsIntervals?: boolean // #570 — do this user's benchmark edits reach intervals? (prod, or QA on its OWN athlete). false = local sandbox (QA on the shared prod athlete)
}

export interface SportStat { ftp?: number | null; maxHr?: number | null; lthr?: number | null; thresholdPace?: number | null; tte?: number | null; cp?: number | null; wPrime?: number | null; cs?: number | null; dPrime?: number | null; swolf?: number | null }
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
  chatHistory: () => req<{ role: 'user' | 'coach'; text: string; ts?: number }[]>('/chat/history'), // #356 synced across devices
  chatHistorySeed: (msgs: { role: 'user' | 'coach'; text: string; ts?: number }[]) => req<{ role: 'user' | 'coach'; text: string; ts?: number }[]>('/chat/history', { body: { msgs } }), // #356 migrate a local convo up (once)
  // #363 — conversations (threads): list / open / new / delete / search, all synced.
  chatThreads: () => req<{ activeId: string | null; threads: { id: string; title: string; at: string; preview: string; active: boolean }[] }>('/chat/threads'),
  chatThread: (id: string) => req<{ id: string; title: string; msgs: { role: 'user' | 'coach'; text: string; ts?: number }[] }>(`/chat/threads/${id}`),
  chatNewThread: () => req<{ id: string }>('/chat/threads', { method: 'POST' }),
  chatDeleteThread: (id: string) => req<{ ok: boolean }>(`/chat/threads/${id}`, { method: 'DELETE' }),
  chatSearch: (q: string) => req<{ threadId: string; title: string; at: string; snippet: string; role: string }[]>(`/chat/search?q=${encodeURIComponent(q)}`),

  changePassword: (current: string, newPassword: string) => req<{ ok: boolean }>('/password/change', { body: { current, newPassword } }),
  forgot: (email: string) => req<{ ok: boolean; emailSent: boolean }>('/password/forgot', { body: { email } }),
  reset: (email: string, code: string, newPassword: string) => req<{ ok: boolean }>('/password/reset', { body: { email, code, newPassword } }),
  saveProfile: (info: Record<string, unknown>) => req<User>('/profile', { method: 'PUT', body: info }),
  // #210 per-sport stats two-way sync
  pullIcuAthlete: () => req<IcuAthletePull>('/intervals/athlete'),
  runEstimate: () => req<{ available: boolean; thresholdPace?: number; csPace?: number; vdot?: number; criticalSpeed?: number; r2?: number | null; source?: string; confidence?: 'high' | 'medium' | 'low'; assessed?: boolean; reason?: string; runs?: number; weeklyKm?: number }>('/intervals/run-estimate'), // #512 csPace/vdot from race-VDOT
  powerBenchmarks: () => req<{ available: boolean; map5min?: number | null; ftp20?: number | null; weight?: number | null; runsRecent?: number | null; observedMaxHr?: number | null; maxHrSamples?: number; icuMaxHr?: number | null; computedMaxHr?: number | null; maxHrFrom?: string }>('/intervals/power-benchmarks'), // #337
  runVolume: () => req<{ available: boolean; longestKm?: number; weeklyKm?: number; runs?: number; windowDays?: number }>('/intervals/run-volume'),
  runPaceTrend: () => req<{ available: boolean; paces?: (number | null)[]; weeks?: number }>('/intervals/run-pace-trend'), // #230 per-week avg pace
  // #223 — forecast a FUTURE day's expected freshness from planned load.
  readinessForecast: (date: string) => req<{ connected: boolean; future?: boolean; available?: boolean; date?: string; daysOut?: number; form?: number; freshness?: number | null; acwr?: number | null; totalPlannedLoad?: number; plannedDays?: number }>(`/readiness-forecast?date=${date}`),
  // #248 — per-day CTL/ATL/Form projection (forward line on Load & Form charts).
  readinessProjection: (days = 14) => req<{ connected: boolean; available?: boolean; dates?: string[]; loads?: number[]; plannedThrough?: string; ctl?: number[]; atl?: number[]; form?: number[] }>(`/readiness-projection?days=${days}`),
  saveSportStat: (body: { group: SportGroup; ftp?: number | null; maxHr?: number | null; lthr?: number | null; thresholdPace?: number | null; runVdot?: number | null; tte?: number | null; cp?: number | null; wPrime?: number | null; cs?: number | null; dPrime?: number | null; swolf?: number | null }) =>
    req<User & { synced?: boolean; pushError?: string | null }>('/sport-stat', { method: 'PUT', body }),
  getAthlete: () => req<{ profile: string; updatedAt: number }>('/profile/athlete'),
  saveAthlete: (profile: string) => req<{ profile: string; updatedAt: number }>('/profile/athlete', { method: 'PUT', body: { profile } }),
  checkin: (data: Checkin) => req<Checkin>('/checkin', { method: 'POST', body: data }),
  checkins: (from: string, to: string) => req<Checkin[]>(`/checkins?from=${from}&to=${to}`),
  readiness: (date: string) => req<Readiness>(`/readiness?date=${date}`),
  handleMissed: () => req<{ missed: number; paired?: number }>(`/plans/handle-missed`, { method: 'POST', body: {} }), // #156/#346
  audit: () => req<AuditEvent[]>(`/audit`), // #232
  location: () => req<{ name: string | null; lat: number | null; lon: number | null; source: 'saved' | 'intervals' | null; timezone: string | null }>(`/location`), // #341
  saveLocation: (city: string) => req<{ name: string; lat: number; lon: number; source: string }>(`/location`, { method: 'POST', body: { city } }), // #341/#268
  planFeedback: (id: string, data: { feel?: string; rpe?: number; fields?: Record<string, string>; note?: string }) => req<{ ok: boolean }>(`/plan/${encodeURIComponent(id)}/feedback`, { method: 'POST', body: data }),
  // #273 feedback on a completed device activity (no plan)
  getActivityFeedback: (id: string) => req<{ feel?: string; rpe?: number; fields?: Record<string, string>; note?: string; at?: number } | null>(`/activity/${encodeURIComponent(id)}/feedback`),
  activityFeedback: (id: string, data: { feel?: string; rpe?: number; fields?: Record<string, string>; note?: string; sport?: string; date?: string }) => req<{ ok: boolean }>(`/activity/${encodeURIComponent(id)}/feedback`, { method: 'POST', body: data }),
  feedbackSkip: (id: string) => req<{ ok: boolean }>(`/activity/${encodeURIComponent(id)}/feedback-skip`, { method: 'POST' }),
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
  // #450 — live connection status (is intervals linked + are activities actually flowing in, from any source)
  connections: () => req<{ intervals: boolean; strava: boolean; recentActivities: number; deviceSources: string[] }>('/connections'),

  listUsers: () => req<User[]>('/users'),
  addUser: (username: string, email: string, role: 'admin' | 'user') => req<{ user: User; tempPassword: string; emailed: boolean }>('/users', { body: { username, email, role } }),
  resetUser: (id: string) => req<{ tempPassword: string; emailed: boolean }>(`/users/${id}/reset`, { method: 'POST' }),
  setUserPassword: (id: string, password: string) => req<{ ok: boolean }>(`/users/${id}/password`, { method: 'POST', body: { password } }),
  deleteUser: (id: string) => req<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  // #438 — admin backlog triage overlay (status / priority / type / comments) on top of the bundled backlog.json
  getBacklogTriage: () => req<{ triage: BacklogTriage; added: BacklogAddedItem[]; items?: unknown[] }>('/admin/backlog'), // #485 items = shared list
  claudeStatus: () => req<ClaudeStatus>('/admin/claude-status'), // #468 — live "what is Claude working on"
  triggerClaude: () => req<{ ok: boolean }>('/admin/claude-trigger', { method: 'POST' }), // #468 — "Start next batch" now
  updateBacklog: (n: number, patch: { priority?: BacklogPriority | null; status?: BacklogStatus | null; type?: BacklogType | null; area?: string | null; comment?: string; deleteCommentAt?: number; discarded?: boolean }) =>
    req<{ n: number; triage: BacklogTriageItem | null }>(`/admin/backlog/${n}`, { method: 'PUT', body: patch }),
  addBacklogItem: (item: { n: number; title: string; type?: BacklogType; priority?: BacklogPriority; summary?: string }) =>
    req<{ item: BacklogAddedItem; triage: BacklogTriageItem | null }>('/admin/backlog', { body: item }),
  // #440 — ANY signed-in user reports a bug/idea (lands in the shared backlog as "under review")
  reportBug: (item: { title: string; type: BacklogType; summary?: string }) => req<{ ok: boolean; n: number }>('/report', { body: item }),
  // #467 — a user sees THEIR OWN reports + current status (so a non-admin can tell if their bug was fixed)
  myReports: () => req<{ reports: MyReport[] }>('/my-reports'),
}
export interface MyReport { n: number; title: string; summary: string; at: number; status: BacklogStatus; type: BacklogType }
// #468 — live pipeline status Claude writes as it works (Admin → Claude panel polls it). poolBugs/Features/Ideas
// = open items left by TYPE (priority order: bugs → features → ideas), so the panel shows the whole road to 0.
export interface ClaudeStatus { active: boolean; where?: 'xps' | 'mac'; item?: number | null; batch?: number; phase?: string; note?: string; done?: number; total?: number; poolRemaining?: number; poolBugs?: number; poolFeatures?: number; poolIdeas?: number; updatedAt?: number; trigger?: { requestedAt: number; by: string } | null; liveTotest?: number; pending?: number[] }

// #438 — admin backlog triage types
export type BacklogPriority = 'hi' | 'med' | 'lo'
export type BacklogStatus = 'review' | 'todo' | 'roadmap' | 'totest' | 'pass' | 'done' | 'fail' | 'discarded' // #494 roadmap = future work to assess/approve later (parked, not in the active queue)
export type BacklogType = 'bug' | 'feature' | 'idea'
export interface BacklogComment { text: string; at: number; by?: string }
export interface BacklogTriageItem { priority?: BacklogPriority; status?: BacklogStatus; type?: BacklogType; area?: string; comments?: BacklogComment[]; discarded?: boolean }
export type BacklogTriage = Record<string, BacklogTriageItem>
export interface BacklogAddedItem { n: number; title: string; summary?: string; reporter?: string; at: number }
