// Strava integration — per-user OAuth ("Connect with Strava" button), so normal
// users never touch an API key. ONE app-level client id/secret (env, server-side);
// each user authorizes their own account and we store THEIR tokens on the user
// record (like user.icuKey for intervals). Token refresh is automatic.
//
// Scopes: activity:read_all (pull activities) + activity:write (push workouts).
const AUTH_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL = 'https://www.strava.com/oauth/token'
const API = 'https://www.strava.com/api/v3'
export const STRAVA_SCOPE = 'activity:read_all,activity:write'

export function stravaConfigured() {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET)
}
export function userStravaConnected(user) {
  return !!user?.strava?.refreshToken
}

export function stravaAuthorizeUrl(redirectUri, state) {
  const p = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state,
  })
  return `${AUTH_URL}?${p}`
}

async function tokenReq(params) {
  const body = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    ...params,
  })
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) throw new Error(`strava token ${r.status}: ${await r.text()}`)
  return r.json()
}

/** Exchange the OAuth `code` from the callback for tokens. Returns the strava
 *  state to store on the user (refresh token + athlete id). */
export async function stravaExchangeCode(code) {
  const j = await tokenReq({ grant_type: 'authorization_code', code })
  return {
    refreshToken: j.refresh_token,
    accessToken: j.access_token,
    expiresAt: (j.expires_at || 0) * 1000,
    athleteId: j.athlete?.id,
  }
}

/** Valid access token for a user, refreshing (and persisting rotation) as needed. */
async function accessToken(user, persist) {
  const s = user.strava
  if (!s?.refreshToken) throw new Error('not connected')
  if (s.accessToken && Date.now() < s.expiresAt - 60_000) return s.accessToken
  const j = await tokenReq({ grant_type: 'refresh_token', refresh_token: s.refreshToken })
  s.accessToken = j.access_token
  s.expiresAt = (j.expires_at || 0) * 1000
  if (j.refresh_token) s.refreshToken = j.refresh_token // Strava rotates these
  if (persist) persist()
  return s.accessToken
}

// How far back to pull Strava activities. 14 days for now (testing) — change
// later via STRAVA_LOOKBACK_DAYS in the env, no code deploy needed.
const LOOKBACK_DAYS = Number(process.env.STRAVA_LOOKBACK_DAYS) || 14

/** Recent activities for a connected user, trimmed to what the app shows.
 *  Capped to the last LOOKBACK_DAYS — never pulls older history. */
export async function stravaActivities(user, perPage = 15, persist) {
  const token = await accessToken(user, persist)
  const after = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 3600
  const r = await fetch(`${API}/athlete/activities?after=${after}&per_page=${Math.min(50, perPage)}`, {
    headers: { authorization: 'Bearer ' + token },
  })
  if (!r.ok) throw new Error(`strava activities ${r.status}: ${await r.text()}`)
  const acts = await r.json()
  return (Array.isArray(acts) ? acts : []).map((a) => ({
    id: a.id, name: a.name, type: a.sport_type || a.type, start: a.start_date_local,
    distance: a.distance, movingTime: a.moving_time, elapsedTime: a.elapsed_time,
    elevation: a.total_elevation_gain, avgWatts: a.average_watts, avgHr: a.average_heartrate,
    kudos: a.kudos_count, url: `https://www.strava.com/activities/${a.id}`,
  }))
}
