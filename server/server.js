// gymapp auth + static + intervals.icu proxy.
// Single Node service: serves the built SPA, gates /icu behind a login session,
// and provides multi-user auth (password + passkey), admin user management, and
// password reset (admin-driven always; emailed code when SMTP is configured).
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { randomBytes, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { initDb, loadStore, save as pgSave, newId } from './db.js'
import { load as loadJsonStore, save as fileSave } from './store.js'
// Store backend: QA/prod set DATABASE_URL → Postgres. Local dev (scripts/dev-api.sh)
// and the CI module-graph smoke-test have no DATABASE_URL → the JSON file store.
const USE_PG = !!process.env.DATABASE_URL
const save = (s) => (USE_PG ? pgSave(s) : fileSave(s))
import { stravaConfigured, userStravaConnected, stravaAuthorizeUrl, stravaExchangeCode, stravaActivities } from './strava.js'
import { parseActivityFile } from './activity-parse.js'
import { eventMatchesPlan, eventSport, slotKey, planDroppedByReconcile } from './icu-match.js'
import { readiness as computeReadiness, baselines as wellnessBaselines, forecastFreshness, projectFormSeries, bestVo2maxEstimate, weeklyLoadBudget } from './readiness.js'
import { fromIcuSportSettings, icuPatchForGroup, runThresholdFromPaceCurve } from './sport-settings.js'
import { encodeStep, flattenIcuStepsSrv, paceFromPowerPct, clampEasyEfforts, nativeWorkoutText, plannedTss, stripPlatyplusLinks } from './icu-steps.js'
import { weatherGuidance } from './weather.js'
import { cycleContext, normalizePhase, phaseFromDay } from './cycle.js' // #329

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = process.env.STATIC_DIR || '/usr/share/nginx/html'
const MEDIA_DIR = process.env.MEDIA_DIR || '/srv/media'   // self-hosted images/video/audio
const PORT = Number(process.env.PORT || 80)
const RP_ID = process.env.RP_ID || 'platyplus.duckdns.org'
const ORIGIN = process.env.ORIGIN || `https://${RP_ID}`
const RP_NAME = 'Platyplus'
const COOKIE = 'gymapp_sess'
const ICU = 'https://intervals.icu'

// ---- one-time seed of the admin account ---------------------------------
// The in-memory cache — loaded from Postgres in start() (bottom of file); reads use
// it directly (fast), every mutation calls save(store) which persists to Postgres.
let store = { users: [] }
async function seedAndDefaults() {
  if (!store.users.length) {
    store.users.push({
      id: newId(),
      username: process.env.SEED_USER || 'jmfiset',
      email: (process.env.SEED_EMAIL || 'jmfiset@gmail.com').toLowerCase(),
      role: 'admin',
      passwordHash: bcrypt.hashSync(process.env.SEED_PASSWORD || 'qwerty123456', 10),
      passkeys: [],
      info: {},
      icuKey: process.env.SEED_ICU_KEY || '',
      icuAthlete: process.env.SEED_ICU_ATHLETE || 'i28814',
      apiToken: randomBytes(24).toString('base64url'),
      plans: [],
      createdAt: Date.now(),
    })
    console.log('Seeded admin user.')
  }
  // Backfill api tokens / plan arrays for any user created before these existed.
  for (const u of store.users) { if (!u.apiToken) u.apiToken = randomBytes(24).toString('base64url'); if (!u.plans) u.plans = []; if (!u.logs) u.logs = []; if (!u.items) u.items = []; if (!u.notifications) u.notifications = []; if (!u.coachReviews) u.coachReviews = [] }
  // Late-seed the admin's intervals.icu key if it wasn't stored yet (idempotent).
  const seedKey = process.env.SEED_ICU_KEY
  if (seedKey) {
    const a = store.users.find((u) => u.role === 'admin')
    if (a && !a.icuKey) { a.icuKey = seedKey; a.icuAthlete = process.env.SEED_ICU_ATHLETE || a.icuAthlete || 'i28814'; console.log('Seeded admin intervals.icu key.') }
  }
  await save(store)
}

// ---- email (optional) ----------------------------------------------------
let mailer = null
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  console.log('SMTP configured — email reset enabled.')
} else {
  console.log('SMTP not set — email reset disabled (admin reset still works).')
}
async function sendMail(to, subject, text) {
  if (!mailer) return false
  await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text })
  return true
}

// ---- helpers -------------------------------------------------------------
const sha = (s) => createHash('sha256').update(s).digest('hex')
const pub = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, info: u.info || {}, avatar: u.avatar || '', coachName: u.coachName || '', sports: u.sports || (u.sport ? [u.sport] : []), sex: u.sex || '', hasCoachProfile: !!(u.coachProfile && u.coachProfile.trim()), hasIcuKey: !!u.icuKey, icuAthlete: u.icuAthlete || '', sleepNeed: u.sleepNeed || null, maxHR: u.maxHR || null, ftp: u.ftp || null, vo2max: u.vo2max || null, sportSettings: u.sportSettings || {}, runVdot: u.runVdot || null, runThresholdPace: u.sportSettings?.running?.thresholdPace || null, statPrefs: u.statPrefs || {}, learnReadiness: u.learnReadiness !== false, statsSyncedAt: u.statsSyncedAt || 0, onboardedAt: u.onboardedAt || 0, passkeys: (u.passkeys || []).map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt })) })
const findById = (id) => store.users.find((u) => u.id === id)
const findByLogin = (login) => { const l = String(login || '').trim().toLowerCase(); return l ? store.users.find((u) => (u.username || '').toLowerCase() === l || (u.email || '').toLowerCase() === l) : undefined }
const challenges = new Map() // transient WebAuthn challenges, keyed by user id

function setSession(res, user) {
  const token = jwt.sign({ uid: user.id }, store.sessionSecret, { expiresIn: '30d' })
  res.cookie(COOKIE, token, { httpOnly: true, secure: ORIGIN.startsWith('https'), sameSite: 'lax', maxAge: 30 * 864e5 })
}
function auth(req, res, next) {
  try {
    const { uid } = jwt.verify(req.cookies[COOKIE], store.sessionSecret)
    const u = findById(uid)
    if (!u) return res.status(401).json({ error: 'unauthorized' })
    req.user = u; next()
  } catch { return res.status(401).json({ error: 'unauthorized' }) }
}
const admin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'forbidden' }))
const tempPassword = () => randomBytes(6).toString('base64url')

// ---- app -----------------------------------------------------------------
const app = express()
app.set('trust proxy', true) // behind NPM — honor X-Forwarded-Proto
// Force HTTPS so the Secure session cookie always sticks (only acts on traffic
// that actually came through the proxy as http; leaves direct localhost alone).
app.use((req, res, next) => {
  const xfp = req.headers['x-forwarded-proto']
  if (xfp && xfp !== 'https') return res.redirect(308, ORIGIN + req.originalUrl)
  next()
})
app.use(express.json({ limit: '25mb' })) // base64 activity files (.fit/.gpx/.tcx) ride along in JSON
app.use(cookieParser())

// password login
app.post('/auth/login', (req, res) => {
  const u = findByLogin(req.body.login)
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' })
  setSession(res, u); res.json(pub(u))
})
app.post('/auth/logout', (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }) })
app.get('/auth/me', auth, (req, res) => res.json(pub(req.user)))

// passkey login
app.post('/auth/passkey/login/options', async (req, res) => {
  const u = findByLogin(req.body.login)
  if (!u || !u.passkeys?.length) return res.status(404).json({ error: 'No passkey for this account' })
  const options = await generateAuthenticationOptions({ rpID: RP_ID, allowCredentials: u.passkeys.map((p) => ({ id: p.id })), userVerification: 'preferred' })
  challenges.set('login:' + u.id, options.challenge)
  res.json({ uid: u.id, options })
})
app.post('/auth/passkey/login/verify', async (req, res) => {
  const u = findById(req.body.uid)
  const expected = challenges.get('login:' + req.body.uid)
  const pk = u?.passkeys?.find((p) => p.id === req.body.response?.id)
  if (!u || !expected || !pk) return res.status(400).json({ error: 'Bad passkey attempt' })
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: req.body.response, expectedChallenge: expected, expectedOrigin: ORIGIN, expectedRPID: RP_ID,
      credential: { id: pk.id, publicKey: Buffer.from(pk.publicKey, 'base64url'), counter: pk.counter || 0, transports: pk.transports },
    })
    if (!verified) return res.status(401).json({ error: 'Passkey verification failed' })
    pk.counter = authenticationInfo.newCounter; save(store)
    setSession(res, u); res.json(pub(u))
  } catch (e) { res.status(400).json({ error: String(e.message || e) }) }
  finally { challenges.delete('login:' + req.body.uid) }
})

// Usernameless (discoverable) passkey login — no username needed. The device
// offers the passkeys it holds for this site; the credential id identifies the
// user. The username-first endpoints above stay as a fallback.
app.post('/auth/passkey/login/begin', async (req, res) => {
  const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'preferred' })
  challenges.set('anon:' + options.challenge, Date.now())
  res.json(options)
})
app.post('/auth/passkey/login/finish', async (req, res) => {
  const resp = req.body.response
  let challenge
  try { challenge = JSON.parse(Buffer.from(resp.response.clientDataJSON, 'base64url').toString()).challenge } catch { return res.status(400).json({ error: 'Bad response' }) }
  if (!challenges.has('anon:' + challenge)) return res.status(400).json({ error: 'Unknown or expired challenge' })
  const u = store.users.find((x) => x.passkeys?.some((p) => p.id === resp.id))
  const pk = u?.passkeys?.find((p) => p.id === resp.id)
  if (!u || !pk) { challenges.delete('anon:' + challenge); return res.status(404).json({ error: 'Passkey not recognised — sign in with your password, then add a passkey on this device.' }) }
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: resp, expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID,
      credential: { id: pk.id, publicKey: Buffer.from(pk.publicKey, 'base64url'), counter: pk.counter || 0, transports: pk.transports },
    })
    if (!verified) return res.status(401).json({ error: 'Passkey verification failed' })
    pk.counter = authenticationInfo.newCounter; save(store)
    setSession(res, u); res.json(pub(u))
  } catch (e) { res.status(400).json({ error: String(e.message || e) }) }
  finally { challenges.delete('anon:' + challenge) }
})

// change own password
app.post('/auth/password/change', auth, (req, res) => {
  if (!bcrypt.compareSync(String(req.body.current || ''), req.user.passwordHash)) return res.status(400).json({ error: 'Current password is wrong' })
  if (String(req.body.newPassword || '').length < 6) return res.status(400).json({ error: 'New password too short' })
  req.user.passwordHash = bcrypt.hashSync(req.body.newPassword, 10); save(store); res.json({ ok: true })
})

// forgot / reset by emailed code (no account enumeration)
app.post('/auth/password/forgot', async (req, res) => {
  const u = findByLogin(req.body.email)
  if (u) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    store.resets[u.id] = { codeHash: sha(code), expiresAt: Date.now() + 15 * 6e4 }; save(store)
    await sendMail(u.email, 'Your Platyplus reset code', `Your reset code is ${code}. It expires in 15 minutes.`).catch(() => {})
  }
  res.json({ ok: true, emailSent: !!mailer })
})
app.post('/auth/password/reset', (req, res) => {
  const u = findByLogin(req.body.email)
  const r = u && store.resets[u.id]
  if (!u || !r || r.expiresAt < Date.now() || r.codeHash !== sha(String(req.body.code || ''))) return res.status(400).json({ error: 'Invalid or expired code' })
  if (String(req.body.newPassword || '').length < 6) return res.status(400).json({ error: 'New password too short' })
  u.passwordHash = bcrypt.hashSync(req.body.newPassword, 10); delete store.resets[u.id]; save(store); res.json({ ok: true })
})

// passkey registration (authed)
app.post('/auth/passkey/register/options', auth, async (req, res) => {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME, rpID: RP_ID, userName: req.user.username, userID: new TextEncoder().encode(req.user.id),
    attestationType: 'none', excludeCredentials: req.user.passkeys.map((p) => ({ id: p.id })),
    // #311 — hint the ON-DEVICE (platform) authenticator: the phone's fingerprint/Face/PIN, so Android
    // offers that instead of pushing the user into a Samsung-account / security-key flow they don't know.
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'preferred' },
  })
  challenges.set('reg:' + req.user.id, options.challenge); res.json(options)
})
app.post('/auth/passkey/register/verify', auth, async (req, res) => {
  const expected = challenges.get('reg:' + req.user.id)
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge: expected, expectedOrigin: ORIGIN, expectedRPID: RP_ID })
    if (!verified) return res.status(400).json({ error: 'Could not register passkey' })
    const c = registrationInfo.credential
    req.user.passkeys.push({ id: c.id, publicKey: Buffer.from(c.publicKey).toString('base64url'), counter: c.counter, transports: c.transports, label: req.body.label || 'Passkey', createdAt: Date.now() })
    save(store); res.json(pub(req.user))
  } catch (e) { res.status(400).json({ error: String(e.message || e) }) }
  finally { challenges.delete('reg:' + req.user.id) }
})
app.delete('/auth/passkeys/:id', auth, (req, res) => {
  req.user.passkeys = req.user.passkeys.filter((p) => p.id !== req.params.id); save(store); res.json(pub(req.user))
})

// intervals.icu key, stored server-side so the plan follows the account
app.put('/auth/icu', auth, async (req, res) => {
  if (typeof req.body.icuKey === 'string') req.user.icuKey = req.body.icuKey.trim()
  if (typeof req.body.icuAthlete === 'string') req.user.icuAthlete = req.body.icuAthlete.trim()
  // #262: if a key is set but no athlete was given, resolve THIS user's own athlete id from
  // intervals (athlete/0 = the authenticated athlete). Never inherit JM's 'i28814'.
  if (req.user.icuKey && !req.user.icuAthlete) {
    const me = await icuGet(req.user, '/athlete/0').catch(() => null)
    if (me && me.id) req.user.icuAthlete = String(me.id)
  }
  save(store); res.json(pub(req.user))
  // #288: make sure this athlete has our custom feedback fields in intervals (new accounts don't),
  // so bi-directional feedback has somewhere to write. Idempotent + best-effort.
  if (req.user.icuKey) ensureIcuFields(req.user).catch(() => {})
})

// profile picture — small client-resized data URL stored on the account
app.put('/auth/avatar', auth, (req, res) => {
  const a = String(req.body.avatar || '')
  if (a && !/^data:image\/(png|jpeg|webp);base64,/.test(a)) return res.status(400).json({ error: 'expected a data:image URL' })
  if (a.length > 400000) return res.status(413).json({ error: 'image too large (resize client-side)' })
  req.user.avatar = a; save(store); res.json(pub(req.user))
})

// profile info (arbitrary general fields: displayName, etc.)
app.put('/auth/profile', auth, (req, res) => {
  req.user.info = { ...(req.user.info || {}), ...(req.body || {}) }
  if (typeof req.body.email === 'string' && req.body.email.includes('@')) req.user.email = req.body.email.toLowerCase()
  if (typeof req.body.coachName === 'string') req.user.coachName = req.body.coachName.trim().slice(0, 40)
  if (Array.isArray(req.body.sports)) req.user.sports = req.body.sports.filter((s) => typeof s === 'string').map((s) => s.toLowerCase().trim().slice(0, 20)).slice(0, 8)
  else if (typeof req.body.sport === 'string') req.user.sports = req.body.sport ? [req.body.sport.toLowerCase().trim().slice(0, 20)] : []
  if (typeof req.body.sex === 'string') req.user.sex = req.body.sex.trim().toLowerCase().slice(0, 10)
  // #207 Phase 2: athlete stats — personalize readiness (sleepNeed) + tell the coach how hard a
  // session is FOR this athlete (FTP/maxHR/VO2max). Clamp to sane ranges; 0/blank clears.
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : null }
  if ('sleepNeed' in req.body) req.user.sleepNeed = num(req.body.sleepNeed, 4, 12)
  if ('maxHR' in req.body) req.user.maxHR = num(req.body.maxHR, 120, 230)
  if ('ftp' in req.body) req.user.ftp = num(req.body.ftp, 50, 600)
  if ('vo2max' in req.body) req.user.vo2max = num(req.body.vo2max, 20, 95)
  if ('learnReadiness' in req.body) req.user.learnReadiness = req.body.learnReadiness !== false // #235 calibration on/off
  // #236 — per-stat MANUAL vs COMPUTED preference. { vo2max:'manual'|'computed', ftp:…, thresholdPace:…, maxHr:… }
  if (req.body.statPrefs && typeof req.body.statPrefs === 'object') {
    req.user.statPrefs = req.user.statPrefs || {}
    for (const [k, v] of Object.entries(req.body.statPrefs)) if ((v === 'manual' || v === 'computed' || v === 'auto') && /^(vo2max|ftp|thresholdPace|maxHr|sleepNeed)$/.test(k)) req.user.statPrefs[k] = v
  }
  save(store); res.json(pub(req.user))
})

// #210 — per-sport athlete stats, TWO-WAY synced with intervals.icu.
// PULL: read the athlete's intervals sportSettings[] (ftp/maxHr/lthr/threshold_pace, PER SPORT)
// + weight, mapped to our shape. intervals is CANONICAL for these — we also refresh our local
// mirror (+ flat ftp/maxHR the coach reads) so nothing drifts.
app.get('/auth/intervals/athlete', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ connected: false })
  const ath = req.user.icuAthlete || 'i28814'
  const a = await icuGet(req.user, `/athlete/${ath}`)
  if (!a) return res.status(502).json({ connected: true, error: 'could not read intervals athlete' })
  const mapped = fromIcuSportSettings(a.sportSettings || [])
  // refresh the local mirror from intervals (canonical), keeping Platyplus-only fields
  req.user.sportSettings = { ...(req.user.sportSettings || {}), ...mapped }
  if (mapped.cycling?.ftp != null) req.user.ftp = mapped.cycling.ftp
  if (mapped.cycling?.maxHr != null) req.user.maxHR = mapped.cycling.maxHr
  const weight = a.icu_weight != null ? a.icu_weight : (a.weight != null ? a.weight : null)
  if (weight != null && weight > 0) req.user.weight = weight // #207 Part 4: stash for the server-side VO₂max estimate
  save(store)
  res.json({ connected: true, sportSettings: mapped, weight, source: 'intervals' })
})

// #215 — ESTIMATE the runner's threshold pace from intervals' pace curve (Critical Speed),
// the running analog of eFTP. A suggestion the user can apply/override; never auto-written.
// #271/#272: ASSESS data sufficiency before suggesting — a Critical-Speed read off a handful of
// easy runs is unreliable, and suggesting a (slower) threshold off thin data is misleading.
// We gate on (a) the model fit (r2) AND (b) how much the athlete has actually run recently, and
// return a confidence so the UI only surfaces a suggestion when we're genuinely confident.
app.get('/auth/intervals/run-estimate', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete || 'i28814'
  const pc = await icuGet(req.user, `/athlete/${ath}/pace-curves?type=Run`)
  const est = pc ? runThresholdFromPaceCurve(pc) : null
  if (!est) return res.json({ available: false, reason: 'no-model' })
  // How much running is behind this estimate? Count recent runs (42d) + a hard effort.
  const DAYS = 42
  const acts = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(DAYS)}&newest=${icuDay(0)}`)
  const runs = Array.isArray(acts) ? acts.filter((a) => /run/i.test(a.type || '') && a.distance > 0) : []
  const totalKm = runs.reduce((s, a) => s + a.distance, 0) / 1000
  const r2 = est.r2 != null ? est.r2 : 0.7
  // confidence: needs both a decent fit AND enough recent running to trust the curve.
  let confidence = 'low'
  if (runs.length >= 8 && totalKm >= 60 && r2 >= 0.85) confidence = 'high'
  else if (runs.length >= 4 && totalKm >= 25 && r2 >= 0.7) confidence = 'medium'
  // Not confident → assessed, but DON'T present it as a suggestion. Tell the UI why.
  if (confidence === 'low') {
    return res.json({ available: false, assessed: true, reason: runs.length < 4 ? 'too-few-runs' : 'low-fit', runs: runs.length, weeklyKm: +(totalKm / (DAYS / 7)).toFixed(1) })
  }
  if (est.thresholdPace > 0) { req.user.runPaceEst = Math.round(est.thresholdPace); save(store) } // #236 stash computed pace for the coach
  res.json({ available: true, ...est, confidence, runs: runs.length, source: 'critical speed (your recent runs)' })
})

// #337 — cycling power benchmarks for a PROPER VO₂max: best 5-min power (≈ maximal aerobic power, MAP)
// + best 20-min + weight, over 90 days. MAP is the right VO₂max input (FTP under-reads badly). Also the
// recent run count so we can suppress a running VO₂max off almost no running.
app.get('/auth/intervals/power-benchmarks', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete || 'i28814'
  const pc = await icuGet(req.user, `/athlete/${ath}/power-curves?type=Ride&start=${icuDay(90)}&end=${icuDay(0)}`)
  const curve = pc && Array.isArray(pc.list) ? pc.list[0] : null
  let map5 = null, ftp20 = null, weight = null
  if (curve && Array.isArray(curve.secs)) {
    const vals = curve.values || curve.watts || curve.best || []
    const at = (t) => { for (let i = 0; i < curve.secs.length; i++) if (curve.secs[i] >= t) return Number(vals[i]) || null; return null }
    map5 = at(300); ftp20 = at(1200); weight = curve.weight || null
  }
  const runs = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(180)}&newest=${icuDay(0)}`)
  const runsRecent = Array.isArray(runs) ? runs.filter((a) => /run/i.test(a.type || '') && a.distance > 800).length : null
  // #337c — Max HR is COMPUTABLE (JM): NOT an age formula, but a real observed ceiling. Two honest
  // sources — (a) the highest per-activity max HR she's actually hit over 180d, and (b) intervals'
  // athlete_max_hr (her zone ceiling). Max HR is a CEILING, so take the higher of the two. Source line
  // says which drove it + the sample count, so sparse HR data (e.g. only easy runs) is transparent.
  let observedMaxHr = null, maxHrSamples = 0, icuMaxHr = null
  if (Array.isArray(runs)) {
    const hrs = runs.map((a) => Number(a.max_heartrate ?? a.max_hr ?? a.icu_hr_max) || 0).filter((h) => h >= 120 && h <= 230).sort((x, y) => y - x)
    if (hrs.length) { observedMaxHr = hrs[0]; maxHrSamples = hrs.filter((h) => h >= hrs[0] - 3).length }
    const am = runs.map((a) => Number(a.athlete_max_hr) || 0).find((h) => h >= 120 && h <= 230)
    if (am) icuMaxHr = am
  }
  const computedMaxHr = Math.max(observedMaxHr || 0, icuMaxHr || 0) || null
  const maxHrFrom = computedMaxHr == null ? '' : (observedMaxHr && observedMaxHr >= (icuMaxHr || 0) ? 'observed' : 'intervals')
  res.json({ available: !!map5, map5min: map5, ftp20, weight, runsRecent, observedMaxHr, maxHrSamples, icuMaxHr, computedMaxHr, maxHrFrom })
})

// #216 — running endurance base for the marathon-realism range: longest single run +
// average weekly volume over the recent window, from intervals run activities (km).
app.get('/auth/intervals/run-volume', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete || 'i28814'
  const DAYS = 42 // ~6 weeks — enough to read a long-run + weekly-volume base
  const acts = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(DAYS)}&newest=${icuDay(0)}`)
  if (!Array.isArray(acts)) return res.json({ available: false })
  const runs = acts.filter((a) => /run/i.test(a.type || '') && a.distance > 0)
  if (!runs.length) return res.json({ available: false })
  const longestKm = +(Math.max(...runs.map((a) => a.distance)) / 1000).toFixed(1)
  const totalKm = runs.reduce((s, a) => s + a.distance, 0) / 1000
  const weeklyKm = +(totalKm / (DAYS / 7)).toFixed(1)
  res.json({ available: true, longestKm, weeklyKm, runs: runs.length, windowDays: DAYS })
})

// #230 — per-week average run pace (sec/km) for the Running pace trend chart. Weighted (total
// time ÷ total distance per week) so a long easy run doesn't get out-weighted by a short fast one.
app.get('/auth/intervals/run-pace-trend', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete || 'i28814'
  const WEEKS = 8, DAYS = WEEKS * 7
  const acts = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(DAYS)}&newest=${icuDay(0)}`)
  if (!Array.isArray(acts)) return res.json({ available: false })
  const time = Array(WEEKS).fill(0), dist = Array(WEEKS).fill(0) // bucket 0 = oldest week
  for (const a of acts) {
    if (!/run/i.test(a.type || '') || !(a.distance > 0) || !(a.moving_time > 0)) continue
    const daysAgo = Math.floor((Date.now() - Date.parse(a.start_date_local || a.start_date)) / 86400000)
    if (daysAgo < 0 || daysAgo >= DAYS) continue
    const wk = WEEKS - 1 - Math.floor(daysAgo / 7) // newest → last bucket
    time[wk] += a.moving_time; dist[wk] += a.distance
  }
  const paces = time.map((t, i) => (dist[i] > 0 ? Math.round(t / (dist[i] / 1000)) : null)) // sec/km, oldest→newest
  if (!paces.some((p) => p != null)) return res.json({ available: false })
  res.json({ available: true, paces, weeks: WEEKS })
})

// PUSH: edit a per-sport stat → write it back to intervals AND mirror locally.
// The ONLY working write is PUT /athlete/{id}/sport-settings/{entryId} with just the changed
// field (a /athlete/{id} {sportSettings} PUT returns 200 but is silently ignored; full-athlete
// PUT is 403). Sending one field leaves custom_field_values (#147) + everything else intact.
// VO₂max/runVdot are Platyplus-only (no intervals field) and never go to intervals.
const GROUPS = ['cycling', 'running', 'swimming']
// Save one sport's threshold stats on the user (mirror of intervals) + push them back to intervals.
// Shared by the UI (/auth/sport-stat) and the COACH (/api/sport-stat → set_thresholds, #313) so the
// coach's estimate PERSISTS and anchors run %pace / ride %ftp on the device.
async function applySportStat(user, body = {}) {
  const group = String(body.group || '')
  if (!GROUPS.includes(group)) return { status: 400, body: { error: 'bad group' } }
  const numOr = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : null }
  const patch = {}
  if (group === 'cycling' && 'ftp' in body) patch.ftp = numOr(body.ftp, 50, 600)
  if ('maxHr' in body) patch.maxHr = numOr(body.maxHr, 120, 230)
  if ('lthr' in body) patch.lthr = numOr(body.lthr, 90, 220)
  if ('thresholdPace' in body) patch.thresholdPace = group === 'running' ? numOr(body.thresholdPace, 120, 900) : numOr(body.thresholdPace, 40, 300)

  user.sportSettings = user.sportSettings || {}
  user.sportSettings[group] = { ...(user.sportSettings[group] || {}), ...patch }
  if (group === 'running' && 'runVdot' in body) user.runVdot = numOr(body.runVdot, 20, 95)
  if (group === 'cycling') {
    if ('ftp' in patch) user.ftp = patch.ftp
    if ('maxHr' in patch) user.maxHR = patch.maxHr
  }

  let synced = false, pushError = null
  if (user.icuKey) {
    const ath = user.icuAthlete || 'i28814'
    try {
      const list = await icuGet(user, `/athlete/${ath}/sport-settings`)
      const w = Array.isArray(list) ? icuPatchForGroup(list, group, patch) : null
      if (w && Object.keys(w.body).length) {
        const r = await icuFetch(user, `/athlete/${ath}/sport-settings/${w.id}`, { method: 'PUT', body: JSON.stringify(w.body) })
        synced = r.ok
        if (!r.ok) pushError = `intervals ${r.status}: ${(await r.text().catch(() => '')).slice(0, 120)}`
        else user.statsSyncedAt = Date.now()
      } else pushError = Array.isArray(list) ? `no ${group} sport in intervals` : 'could not read intervals sport-settings'
    } catch (e) { pushError = String(e).slice(0, 120) }
  }
  save(store)
  return { status: 200, body: { ...pub(user), synced, pushError } }
}
app.put('/auth/sport-stat', auth, async (req, res) => {
  const r = await applySportStat(req.user, req.body || {}); res.status(r.status).json(r.body)
})

// Admin: trigger the prod-promotion GitHub workflow (workflow_dispatch) from the app
// instead of the Actions tab (#47). Needs a GH token with actions:write in the server
// env (GH_PROMOTE_TOKEN, injected via AUTH_ENV at deploy). Promotes dev → prod.
app.post('/auth/promote-prod', auth, admin, async (req, res) => {
  const token = process.env.GH_PROMOTE_TOKEN
  if (!token) return res.status(503).json({ error: 'GH_PROMOTE_TOKEN not set on the server — add it to the deploy secrets to enable in-app promotion.' })
  const REPO = 'chefliujmf/gymapp'
  // Do what promote-prod.yml does, DIRECTLY: open/reuse a dev→main PR + enable
  // auto-merge. This needs only Contents+Pull-requests:write (what the PAT has) — NOT
  // actions:write, so it avoids the 403 the old workflow_dispatch hit (#144).
  const gh = (path, opts = {}) => fetch(`https://api.github.com${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'platyplus-server', ...(opts.headers || {}) } })
  try {
    // 1) reuse an open dev→main PR, else create one
    let pr
    const list = await gh(`/repos/${REPO}/pulls?base=main&head=chefliujmf:dev&state=open`)
    const arr = list.ok ? await list.json() : []
    if (arr.length) pr = arr[0]
    else {
      const cr = await gh(`/repos/${REPO}/pulls`, { method: 'POST', body: JSON.stringify({ title: 'Promote dev → main', head: 'dev', base: 'main', body: 'Promotion from the in-app button — auto-merges once `build` passes.' }) })
      if (cr.status === 422) return res.status(409).json({ error: 'Nothing to promote — prod is already up to date with dev.' })
      if (!cr.ok) return res.status(502).json({ error: `Create PR ${cr.status}: ${(await cr.text()).slice(0, 180)}` })
      pr = await cr.json()
    }
    // 2) enable auto-merge (GraphQL) so it merges when the protected `build` check passes
    const mm = await gh('/graphql', { method: 'POST', body: JSON.stringify({ query: 'mutation($id:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:MERGE}){clientMutationId}}', variables: { id: pr.node_id } }) })
    const mj = await mm.json().catch(() => ({}))
    return res.json({ ok: true, pr: pr.number, autoMerge: !mj.errors, note: mj.errors ? String(mj.errors[0]?.message || '').slice(0, 140) : undefined })
  } catch (e) { return res.status(502).json({ error: String(e).slice(0, 200) }) }
})

// Coach post-workout reviews — the app reads to render takeaways (#91).
app.get('/auth/coach-reviews', auth, (req, res) => {
  let r = req.user.coachReviews || []
  if (req.query.from) r = r.filter((x) => x.date >= req.query.from)
  if (req.query.to) r = r.filter((x) => x.date <= req.query.to)
  res.json(r)
})

// #232 — activity & changes log. Append-only per user (capped), so you can investigate what changed —
// plan edits, coach actions, syncs. `actor` = you | coach | sync | system. Does NOT save() itself; the
// caller's existing save() persists it (audit always precedes a save at each mutation).
function audit(user, e) {
  if (!user || !e || !e.action) return
  user.audit = user.audit || []
  user.audit.push({ at: Date.now(), actor: e.actor || 'system', action: e.action, target: e.target || '', detail: e.detail || '', kind: e.kind || 'other' })
  if (user.audit.length > 500) user.audit = user.audit.slice(-500)
}
app.get('/auth/audit', auth, (req, res) => {
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 200))
  res.json((req.user.audit || []).slice(-limit).reverse()) // most recent first
})

// Coach-activity notifications — the user reads (bell) + marks read.
app.get('/auth/notifications', auth, (req, res) => res.json(req.user.notifications || []))
app.post('/auth/notifications/read', auth, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  for (const n of req.user.notifications || []) { if (!ids || ids.includes(n.id)) n.read = true }
  save(store); res.json({ ok: true })
})

// Athlete profile — the per-user coaching profile (engine-native markdown) the
// coach reads to personalize every answer. Reviewable/editable in Profile → Athlete.
app.get('/auth/profile/athlete', auth, (req, res) => res.json({ profile: req.user.coachProfile || '', updatedAt: req.user.coachProfileAt || 0 }))
app.put('/auth/profile/athlete', auth, (req, res) => {
  const p = String(req.body?.profile ?? '')
  if (p.length > 60000) return res.status(413).json({ error: 'profile too long (max 60k chars)' })
  req.user.coachProfile = p; req.user.coachProfileAt = Date.now(); save(store)
  res.json({ profile: req.user.coachProfile, updatedAt: req.user.coachProfileAt })
})
// #256 port — durable COACH MEMORY: what the coach has learned works/fails for THIS athlete +
// how they like to be coached (rules with status). Separate from the athlete profile; the coach
// reads it every session and updates it after. Reviewable in-app (read) so nothing is hidden.
app.get('/auth/coach-memory', auth, (req, res) => res.json({ memory: req.user.coachMemory || '', updatedAt: req.user.coachMemoryAt || 0 }))

// Daily check-in (how the athlete feels) — Platyplus-collected signal the coach reads,
// so it has something to adapt to even without intervals.icu. Light: a few taps.
function upsertCheckin(user, body) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body?.date || '') ? body.date : new Date().toISOString().slice(0, 10)
  user.checkins = user.checkins || []
  const lvl = (v) => (Number(v) >= 1 && Number(v) <= 5 ? Number(v) : undefined)
  const ci = { date,
    energy: lvl(body.energy), sleep: lvl(body.sleep), soreness: lvl(body.soreness),
    note: typeof body.note === 'string' ? body.note.slice(0, 200) : undefined }
  // #207 Phase 2b: record the AUTO scores the athlete was shown (display terms: energy/sleep/freshness,
  // each 1–5) so we can later learn how their own ratings systematically differ → personal calibration.
  if (body.auto && typeof body.auto === 'object') {
    const a = { energy: lvl(body.auto.energy), sleep: lvl(body.auto.sleep), freshness: lvl(body.auto.freshness) }
    if (a.energy != null || a.sleep != null || a.freshness != null) ci.auto = a
  }
  const i = user.checkins.findIndex((x) => x.date === date)
  if (i >= 0) user.checkins[i] = { ...user.checkins[i], ...ci }; else user.checkins.push(ci)
  if (i < 0) audit(user, { actor: 'you', action: 'Checked in', target: date, detail: [ci.energy != null && `energy ${ci.energy}`, ci.sleep != null && `sleep ${ci.sleep}`, ci.soreness != null && `soreness ${ci.soreness}`].filter(Boolean).join(' · '), kind: 'checkin' }) // #232
  return ci
}
const checkinsInRange = (user, from, to) => (user.checkins || []).filter((c) => (!from || c.date >= from) && (!to || c.date <= to)).sort((a, b) => (a.date < b.date ? -1 : 1))
app.post('/auth/checkin', auth, (req, res) => {
  const ci = upsertCheckin(req.user, req.body || {})
  save(store)
  res.json(ci)
  // #206: a COMPLETE check-in for TODAY → fire the coach for a real STICK-OR-ADJUST morning call
  // (not only on poor days). Overnight HRV/sleep is usually still mid-sync from the watch this
  // early, so the coach is told to lean on the subjective check-in + FRESHNESS/Form (always
  // available). Once per day (coachDecided), only for athletes who've set up their coach.
  try {
    const today = localTodayInTz(req.user.icuTimezone) // #347 — local today (cached tz), so a near-midnight check-in still fires
    const complete = ci.energy != null && ci.sleep != null && ci.soreness != null
    if (req.user.coachProfile && req.user.coachProfile.trim() && ci.date === today && complete && !ci.coachDecided) {
      ci.coachDecided = true; save(store)
      const poor = ci.energy <= 2 || ci.sleep <= 2 || ci.soreness >= 4
      const msg = `Morning check-in is in for today (${today}) — energy ${ci.energy}/5, sleep ${ci.sleep}/5, soreness ${ci.soreness}/5 (5 = very sore)${poor ? ' — this reads run-down' : ''}. IMPORTANT: overnight HRV/sleep from their watch often hasn't synced to intervals this early, so decide from (a) this subjective check-in and (b) their FRESHNESS / Form (CTL−ATL, always available — read get_wellness). Look at TODAY's planned session(s) with list_schedule and make a STICK-OR-ADJUST call: if they're ready, leave the plan and send a one-line "stick with it" via notify; if run-down (poor check-in and/or deeply negative Form), EASE today — cut intensity/volume, swap to recovery, or move it — with the tools, then notify what changed and why. If today is already rest/easy, a one-line reassurance. Be concise; don't ask questions — decide and act.`
      runCoachTask(req.user, msg).catch((e) => console.error('[checkin-decide] ' + (e.message || e)))
    }
  } catch (e) { console.error('[checkin-decide] trigger ' + e.message) }
})

// #341/#268 — the athlete's LOCATION (weather + local time), BI-DIRECTIONALLY synced with intervals: we
// READ the intervals athlete `city` (option C prefill) and WRITE a changed city back. intervals persists
// `city` but IGNORES lat/lng (verified) → we geocode + keep lat/lon Platyplus-side for weather.
app.get('/auth/location', auth, async (req, res) => {
  const u = req.user
  if (u.info && Number.isFinite(u.info.lat) && Number.isFinite(u.info.lon)) return res.json({ name: u.info.locationName || null, lat: u.info.lat, lon: u.info.lon, source: 'saved', timezone: u.icuTimezone || null })
  if (u.icuKey) {
    const me = await icuGet(u, `/athlete/${u.icuAthlete || 'i28814'}`).catch(() => null)
    if (me) {
      if (me.timezone && !u.icuTimezone) { u.icuTimezone = me.timezone; save(store) }
      if (me.city) { const g = await geocodePlace(me.city, me.state, me.country); if (g) return res.json({ name: [me.city, me.state].filter(Boolean).join(', '), lat: g.lat, lon: g.lon, source: 'intervals', timezone: u.icuTimezone || me.timezone || null }) }
    }
  }
  res.json({ name: null, lat: null, lon: null, source: null, timezone: u.icuTimezone || null })
})
app.post('/auth/location', auth, async (req, res) => {
  const u = req.user, city = typeof req.body?.city === 'string' ? req.body.city.trim().slice(0, 80) : ''
  if (!city) return res.status(400).json({ error: 'city required' })
  const g = await geocodePlace(city)
  if (!g) return res.status(400).json({ error: "Couldn't find that place — try a nearby city or add the region." })
  u.info = u.info || {}; u.info.lat = g.lat; u.info.lon = g.lon; u.info.locationName = city
  audit(u, { actor: 'you', action: 'Set location', target: city, detail: 'weather + local time · synced to intervals', kind: 'other' }) // #232
  save(store)
  if (u.icuKey) icuFetch(u, `/athlete/${u.icuAthlete || 'i28814'}`, { method: 'PUT', body: JSON.stringify({ city }) }).catch((e) => console.error('[icu-city-write] ' + (e.message || e))) // #268 write-back
  res.json({ name: city, lat: g.lat, lon: g.lon, source: 'saved' })
})
app.get('/auth/checkins', auth, (req, res) => res.json(checkinsInRange(req.user, req.query.from, req.query.to)))
// #347 — the athlete's LOCAL "today" from their intervals timezone (not the server's UTC), so a
// tomorrow-forecast near local midnight isn't mistaken for today (e.g. 8pm Montreal = next-day UTC).
// Caches the tz on the user (stable); falls back to UTC.
function localTodayInTz(tz) { try { return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'UTC' }) } catch { return new Date().toISOString().slice(0, 10) } }
// #367 — the athlete's LOCAL hour (0–23) in their intervals timezone, for the morning auto-adapt scheduler.
function localHourInTz(tz) { try { return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', hour12: false }).format(new Date()), 10) % 24 } catch { return new Date().getUTCHours() } }
async function athleteToday(user) {
  if (!user.icuTimezone && user.icuKey) {
    try { const me = await icuGet(user, `/athlete/${user.icuAthlete || 'i28814'}`); if (me && me.timezone) { user.icuTimezone = me.timezone; save(store) } } catch { /* fall back to UTC */ }
  }
  return localTodayInTz(user.icuTimezone)
}
// #195: auto-derived readiness (Sleep · Freshness · Energy 1–5) from 60d of intervals wellness +
// personal baselines. Returns { connected:false } if intervals isn't connected; energy is null on
// cold start (too few HRV days) so the UI keeps the manual tap. See server/readiness.js.
app.get('/auth/readiness', auth, async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : await athleteToday(req.user) // #347 local, not UTC
  const oldest = new Date(date + 'T00:00:00Z'); oldest.setUTCDate(oldest.getUTCDate() - 60)
  const ath = req.user.icuAthlete || 'i28814'
  const data = await icuGet(req.user, `/athlete/${ath}/wellness?oldest=${oldest.toISOString().slice(0, 10)}&newest=${date}`)
  if (!data) return res.json({ connected: false })
  const rows = (Array.isArray(data) ? data : []).map((d) => ({
    date: d.id, fitness: d.ctl, fatigue: d.atl, form: d.ctl != null && d.atl != null ? Math.round(d.ctl - d.atl) : null,
    restingHR: d.restingHR, hrv: d.hrv ?? d.hrvSDNN ?? null, eftp: d.eftp ?? d.icu_eftp ?? null,
    sleepHours: d.sleepSecs ? +(d.sleepSecs / 3600).toFixed(1) : null, sleepScore: d.sleepScore ?? null,
    weight: d.weight ?? null, // #265 — for BMR/TDEE fuel targets
    menstrualPhase: d.menstrualPhase ?? d.menstrualPhasePredicted ?? null, // #329
  }))
  const today = rows.find((r) => r.date === date) || rows[rows.length - 1] || {}
  // #329 — cycle phase for female athletes: intervals wellness `menstrualPhase` if present, else derive
  // from a stored cycle start date + length. Stash it so the coach's system prompt can adjust the PLAN.
  const cyclePhase = req.user.sex === 'female'
    ? (normalizePhase(today.menstrualPhase)
      || (req.user.info?.cycleStart ? phaseFromDay(Math.floor((new Date(date) - new Date(req.user.info.cycleStart)) / 86400000) + 1, req.user.info.cycleLength) : null))
    : null
  if (cyclePhase) { req.user.cyclePhase = cyclePhase; req.user.cyclePhaseAt = date } else if (req.user.cyclePhase) { delete req.user.cyclePhase; delete req.user.cyclePhaseAt }
  const history = rows.filter((r) => r.date < date)
  // #236: stash the latest resting HR + eFTP so the coach's computed VO₂max/FTP match the app.
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].restingHR != null) { req.user.restingHR = rows[i].restingHR; break }
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].eftp != null) { req.user.eftp = Math.round(rows[i].eftp); break }
  // #375 — stash the latest CTL/ATL so the coach's system prompt can state a concrete WEEKLY LOAD BUDGET.
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].fitness != null) { req.user.ctl = Math.round(rows[i].fitness); if (rows[i].fatigue != null) req.user.atl = Math.round(rows[i].fatigue); break }
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].weight != null) { req.user.weight = Math.round(rows[i].weight * 10) / 10; break } // #265
  // #256 port (per-athlete LEARNED baselines): stash this athlete's own 60-day HRV/RHR norm so the
  // COACH interprets today's reading as a deviation from THEIR baseline, not textbook absolutes.
  const bl = wellnessBaselines(rows)
  if (bl.rhrBaseline) req.user.rhrBaseline = { mean: Math.round(bl.rhrBaseline.mean), sd: Math.round(bl.rhrBaseline.sd * 10) / 10, n: bl.nRhr }
  if (bl.hrvBaseline) req.user.hrvBaseline = { mean: Math.round(Math.exp(bl.hrvBaseline.mean)), cv7: bl.hrvCV7 != null ? Math.round(bl.hrvCV7 * 1000) / 10 : null, n: bl.nHrv } // exp(ln-mean) → raw rmssd ms
  const sleepNeed = Number(req.user.sleepNeed) > 0 ? Number(req.user.sleepNeed) : 8
  // #207 Phase 2b: pass PAST check-ins (before this date) so the model calibrates to the athlete's
  // own overrides — but never the day being viewed. #235: skip entirely if learning is turned OFF.
  const calCheckins = req.user.learnReadiness === false ? [] : (req.user.checkins || []).filter((c) => c && c.date < date)
  res.json({ connected: true, date, sleepNeed, today, cyclePhase, ...computeReadiness(history, today, { sleepNeed, checkins: calCheckins, cyclePhase }) })
})

// #223 — FORECAST a FUTURE day's freshness from planned load (only Freshness is knowable ahead;
// Energy/Sleep depend on HRV/sleep that haven't happened). Projects CTL/ATL → Form over the
// planned TSS between today and the target, then maps to an expected Freshness 1–5.
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
app.get('/auth/readiness-forecast', auth, async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null
  if (!date) return res.status(400).json({ error: 'date required' })
  if (!req.user.icuKey) return res.json({ connected: false })
  const today = await athleteToday(req.user) // #347 — LOCAL today (intervals tz), not UTC, so tomorrow isn't read as today
  if (date <= today) return res.json({ connected: true, future: false }) // only future days forecast
  const ath = req.user.icuAthlete || 'i28814'
  // current fitness state: latest wellness row with CTL+ATL, + a personal TSB baseline (60d)
  const wOld = addDays(today, -60)
  const wData = await icuGet(req.user, `/athlete/${ath}/wellness?oldest=${wOld}&newest=${today}`)
  const rows = (Array.isArray(wData) ? wData : []).map((d) => ({ form: d.ctl != null && d.atl != null ? d.ctl - d.atl : null, ctl: d.ctl, atl: d.atl, date: d.id }))
  const latest = [...rows].reverse().find((r) => r.ctl != null && r.atl != null)
  if (!latest) return res.json({ connected: true, future: true, available: false })
  const tsbBaseline = wellnessBaselines(rows).tsbBaseline
  // #365 — planned TSS per day for the days BEFORE the target (today+1 .. target-1). We forecast the
  // freshness you'll carry INTO the target day (morning readiness), so we do NOT include the target
  // day's OWN planned session — otherwise a hard workout on that day projects its own post-session
  // fatigue (Form crashes to e.g. −29.8 → "wrecked"), which is not how recovered you'll be going in.
  const evs = await icuGet(req.user, `/athlete/${ath}/events?oldest=${today}&newest=${date}`)
  const byDay = {}
  for (const e of (Array.isArray(evs) ? evs : [])) {
    const d = (e.start_date_local || '').slice(0, 10)
    if (d <= today || d >= date) continue // between now and the target, EXCLUSIVE of the target's own session
    // #366 — SKIP non-session markers: an ATP WEEKLY TARGET (category TARGET, e.g. "ATP W06", ~250 TSS for the
    // whole WEEK) or a NOTE is NOT a single-day load. Counting it as one day spiked ATL → false "wrecked".
    if (e.category === 'TARGET' || e.category === 'NOTE' || /^ATP\b/i.test(e.name || '')) continue
    const load = e.icu_training_load || e.icu_planned_training_load || 0
    if (load > 0) byDay[d] = (byDay[d] || 0) + load
  }
  const loads = []
  for (let dd = addDays(today, 1); dd < date; dd = addDays(dd, 1)) loads.push(byDay[dd] || 0)
  const f = forecastFreshness({ ctl: latest.ctl, atl: latest.atl, tsbBaseline }, loads)
  res.json({ connected: true, future: true, available: true, date, daysOut: loads.length, ...f, totalPlannedLoad: Math.round(loads.reduce((a, b) => a + b, 0)), plannedDays: Object.keys(byDay).length })
})

// #248 — per-day CTL/ATL/Form PROJECTION for the next N days (forward line on the Load & Form charts).
app.get('/auth/readiness-projection', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ connected: false })
  const days = Math.min(28, Math.max(1, Number(req.query.days) || 14))
  const ath = req.user.icuAthlete || 'i28814'
  const today = await athleteToday(req.user) // #347 local tz
  const wData = await icuGet(req.user, `/athlete/${ath}/wellness?oldest=${addDays(today, -30)}&newest=${today}`)
  const rows = (Array.isArray(wData) ? wData : []).map((d) => ({ ctl: d.ctl, atl: d.atl }))
  const latest = [...rows].reverse().find((r) => r.ctl != null && r.atl != null)
  if (!latest) return res.json({ connected: true, available: false })
  const end = addDays(today, days)
  const evs = await icuGet(req.user, `/athlete/${ath}/events?oldest=${today}&newest=${end}`)
  const byDay = {}
  for (const e of (Array.isArray(evs) ? evs : [])) {
    const d = (e.start_date_local || '').slice(0, 10)
    if (d <= today || d > end) continue
    if (e.category === 'TARGET' || e.category === 'NOTE' || /^ATP\b/i.test(e.name || '')) continue // #366 — not a single-day load (ATP weekly target / note)
    const load = e.icu_training_load || e.icu_planned_training_load || 0
    if (load > 0) byDay[d] = (byDay[d] || 0) + load
  }
  const dates = [], loads = []
  for (let dd = addDays(today, 1); dd <= end; dd = addDays(dd, 1)) { dates.push(dd); loads.push(byDay[dd] || 0) }
  const series = projectFormSeries({ ctl: latest.ctl, atl: latest.atl }, loads)
  res.json({ connected: true, available: true, dates, loads, ctl: series.map((s) => s.ctl), atl: series.map((s) => s.atl), form: series.map((s) => s.form) })
})

// Post-workout feedback (how the session went) — stored on the plan so the coach reads
// it (it comes back on /api/plans). Fields are sport-specific; kept as a free object.
app.post('/auth/plan/:id/feedback', auth, (req, res) => {
  const plan = (req.user.plans || []).find((p) => p.id === req.params.id)
  if (!plan) return res.status(404).json({ error: 'plan not found' })
  const b = req.body || {}
  plan.feedback = {
    feel: typeof b.feel === 'string' ? b.feel : undefined,
    rpe: Number(b.rpe) >= 1 && Number(b.rpe) <= 10 ? Number(b.rpe) : undefined,
    fields: (b.fields && typeof b.fields === 'object') ? Object.fromEntries(Object.entries(b.fields).filter(([, v]) => typeof v === 'string').slice(0, 12)) : {},
    note: typeof b.note === 'string' ? b.note.slice(0, 1000) : '',
    at: Date.now(),
  }
  save(store)
  res.json({ ok: true, feedback: plan.feedback })
  // #76: fire an async coach review on the feedback (best-effort, non-blocking). Only
  // for athletes who've set up their coach (skip mid-onboarding users).
  if (req.user.coachProfile && req.user.coachProfile.trim()) {
    try {
      const fb = plan.feedback
      const fields = Object.entries(fb.fields || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
      const msg = `The athlete just completed their planned ${plan.sport || 'workout'} "${plan.title || ''}" on ${plan.date}. Post-workout feedback — feel: ${fb.feel || '—'}, RPE: ${fb.rpe || '—'}/10${fields ? ', ' + fields : ''}${fb.note ? `, notes: "${fb.note}"` : ''}. Review how it went: read the completed activity (get_recent_activities) and recent check-ins if useful, then call save_coach_review (date ${plan.date}, sport "${plan.sport || ''}", planId "${plan.id}", and activityId if it matched a device activity) with a one-line verdict, 2-4 short takeaways, and what's next (this auto-posts your note to the intervals Notes thread). If it matched a device activity, ALSO set a PUBLIC-safe title + description with set_activity_text (activity id from get_recent_activities) — workout/route/effort only, NO health/score/plan. If the feedback warrants it (pain/niggle, "too hard", poor feel, or RPE well above target), adjust the UPCOMING plan with the tools and use notify to tell them what changed and why. Be concise; don't ask questions — just review and act.`
      runCoachTask(req.user, msg).catch((e) => console.error('[coach-review] ' + (e.message || e)))
    } catch (e) { console.error('[coach-review] trigger ' + e.message) }
  }
})

// #273 — post-workout feedback for a COMPLETED intervals ACTIVITY (device rides/runs that have no
// Platyplus plan). Stored per-user keyed by activity id; triggers an async coach review (activityId).
app.get('/auth/activity/:id/feedback', auth, (req, res) => res.json((req.user.activityFeedback || {})[String(req.params.id)] || null))
// #273 — intervals feel scale + custom ACTIVITY_FIELD options (label → 1-based index intervals stores).
// Keep in sync with src/icu-fields.ts.
const ICU_FEEL_LABELS = ['Strong', 'Good', 'Normal', 'Poor', 'Weak']
const ICU_FB_FIELDS = {
  'Legs Before': { code: 'LegsBefore', opts: ['fresh', 'normal', 'relaxed', 'heavy', 'sore', 'flat', 'tired'] },
  'Legs After': { code: 'LegsAfter', opts: ['strong', 'normal', 'tired OK', 'barely tired', 'heavy', 'sore', 'cooked'] },
  'Fuel/GI': { code: 'FuelGI', opts: ['not needed', 'water only OK', 'carbs OK', 'underfueled', 'GI issue', 'too much fuel'] },
  'Pain/Niggles': { code: 'PainNiggles', opts: ['none', 'knee', 'back', 'neck/shoulder', 'foot', 'saddle', 'other'] },
  'Life Constraint': { code: 'LifeConstraint', opts: ['none', 'time cap', 'family', 'work', 'poor sleep', 'stress', 'weather', 'other'] },
  'Mental State': { code: 'MentalState', opts: ['calm', 'focused', 'impatient', 'overexcited', 'doubtful', 'frustrated', 'checked out'] },
}
// #330 — RUN overrides (running-appropriate Fuel + Pain locations, no "saddle"). Same codes as above.
// MUST mirror RUN_FIELDS in src/icu-fields.ts so the index the app shows == the index we write.
const ICU_FB_FIELDS_RUN = {
  ...ICU_FB_FIELDS,
  'Fuel/GI': { code: 'FuelGI', opts: ['not needed', 'water only OK', 'gels/carbs OK', 'underfueled', 'GI issue', 'too much fuel'] },
  'Pain/Niggles': { code: 'PainNiggles', opts: ['none', 'knee', 'shin/calf', 'foot/ankle', 'hip', 'IT band', 'hamstring', 'other'] },
}
const fbFieldsFor = (sport) => (sport === 'run' ? ICU_FB_FIELDS_RUN : ICU_FB_FIELDS)
// #287 — post the athlete's free-text comment to the intervals activity MESSAGE thread (deduped:
// skip if an identical comment already exists, so re-saving feedback doesn't spam duplicates).
async function syncActivityNote(user, id, content) {
  const existing = await icuFetch(user, `/activity/${id}/messages`).then((r) => (r.ok ? r.json() : [])).catch(() => [])
  if (Array.isArray(existing) && existing.some((m) => m && typeof m.content === 'string' && m.content.trim() === content)) return
  await icuFetch(user, `/activity/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) })
}

// #288 — a NEW user's intervals account has none of our custom feedback fields, so the 1-based
// values we write have nowhere to land. Create the six ACTIVITY_FIELDs (idempotent — skip any that
// already exist by code). Called on connect/onboarding. Best-effort; never throws to the caller.
async function ensureIcuFields(user, { force = false } = {}) {
  if (!user || !user.icuKey) return
  if (!force && user.icuFieldsAt) return // already ensured (flag) — skip the round-trip
  const ath = user.icuAthlete || 'i28814'
  try {
    const cur = await icuFetch(user, `/athlete/${ath}/custom-item`).then((r) => (r.ok ? r.json() : [])).catch(() => [])
    const have = new Set((Array.isArray(cur) ? cur : []).filter((it) => it && it.content && it.content.code).map((it) => it.content.code))
    let created = 0
    for (const [name, def] of Object.entries(ICU_FB_FIELDS)) {
      if (have.has(def.code)) continue
      const item = {
        type: 'ACTIVITY_FIELD', visibility: 'PRIVATE', name,
        description: 'Private athlete feedback field for coach analysis (Platyplus).',
        content: { code: def.code, type: 'select', gauge: true, example: def.opts[0], options: def.opts.map((text, i) => ({ text, value: i + 1 })) },
      }
      const r = await icuFetch(user, `/athlete/${ath}/custom-item`, { method: 'POST', body: JSON.stringify(item) }).catch((e) => { console.error('[icu-field-create ' + def.code + '] ' + (e.message || e)); return null })
      if (r && r.ok) created++
    }
    // #305 — TELL the user we set these up in their intervals (transparency).
    if (created > 0) pushNotification(user, { id: 'icu-fields-' + user.id, title: `Set up ${created} feedback field${created > 1 ? 's' : ''} in your intervals`, body: 'Private per-workout fields (legs, fuel, pain, mind…) so your feedback syncs both ways and the coach can read it. Only you see them.', link: '/settings' })
    user.icuFieldsAt = Date.now(); save(store) // mark done so we don't re-check every time
  } catch (e) { console.error('[ensureIcuFields] ' + (e.message || e)) }
}

app.post('/auth/activity/:id/feedback', auth, (req, res) => {
  const id = String(req.params.id)
  const b = req.body || {}
  const fb = {
    feel: typeof b.feel === 'string' ? b.feel : undefined,
    rpe: Number(b.rpe) >= 1 && Number(b.rpe) <= 10 ? Number(b.rpe) : undefined,
    fields: (b.fields && typeof b.fields === 'object') ? Object.fromEntries(Object.entries(b.fields).filter(([, v]) => typeof v === 'string').slice(0, 12)) : {},
    note: typeof b.note === 'string' ? b.note.slice(0, 1000) : '',
    sport: typeof b.sport === 'string' ? b.sport.slice(0, 20) : undefined,
    date: typeof b.date === 'string' ? b.date.slice(0, 10) : undefined,
    at: Date.now(),
  }
  if (!req.user.activityFeedback) req.user.activityFeedback = {}
  req.user.activityFeedback[id] = fb
  audit(req.user, { actor: 'you', action: 'Logged feedback', target: fb.title || `${fb.sport || 'workout'} ${fb.date || ''}`.trim(), detail: [fb.feel && `felt ${fb.feel}`, fb.rpe && `RPE ${fb.rpe}`].filter(Boolean).join(' · '), kind: 'feedback' }) // #232
  save(store)
  res.json({ ok: true, feedback: fb })
  // #273 BI-DIRECTIONAL: write feel/RPE + custom fields BACK to the intervals activity (as the
  // 1-based indices intervals stores), so it shows up in intervals too. Only for real intervals ids.
  if (req.user.icuKey && /^i?\d+$/.test(id)) {
    // #288 — make sure the custom fields exist BEFORE writing values (guarded flag → runs once); covers
    // athletes who connected before #288 so the 1-based values have somewhere to land.
    if (!req.user.icuFieldsAt) ensureIcuFields(req.user).catch(() => {})
    const payload = {}
    const fi = ICU_FEEL_LABELS.indexOf(fb.feel); if (fi >= 0) payload.feel = fi + 1
    if (fb.rpe) payload.icu_rpe = fb.rpe
    const fbDefs = fbFieldsFor(fb.sport) // #330 — a run's values map through the RUN option list
    for (const [label, val] of Object.entries(fb.fields || {})) { const def = fbDefs[label]; if (def) { const i = def.opts.indexOf(val); if (i >= 0) payload[def.code] = i + 1 } }
    if (Object.keys(payload).length) icuFetch(req.user, `/activity/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch((e) => console.error('[icu-feedback-write] ' + (e.message || e)))
    // #287: the free-text comment isn't a field — it lives in the intervals MESSAGE thread. Post it
    // there (deduped) so "Anything else?" shows up in intervals too, not just Platyplus.
    if (fb.note && fb.note.trim()) syncActivityNote(req.user, id, fb.note.trim()).catch((e) => console.error('[icu-note-write] ' + (e.message || e)))
  }
  // async coach review referencing the activity (best-effort; only once the coach is set up).
  if (req.user.coachProfile && req.user.coachProfile.trim()) {
    try {
      const fields = Object.entries(fb.fields || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
      const msg = `The athlete just completed a ${fb.sport || 'workout'} on ${fb.date || 'today'} (intervals activity ${id}). Post-workout feedback — feel: ${fb.feel || '—'}, RPE: ${fb.rpe || '—'}/10${fields ? ', ' + fields : ''}${fb.note ? `, notes: "${fb.note}"` : ''}. Review it: read the activity (get_recent_activities) + recent check-ins, then call save_coach_review (date ${fb.date || ''}, sport "${fb.sport || ''}", activityId "${id}") with a one-line verdict, 2-4 short takeaways, and what's next (this auto-posts your note to the intervals Notes thread). ALSO give the activity a PUBLIC-safe title + description with set_activity_text (activityId "${id}") — describe the workout/route/effort only, NO health/score/plan (that stays in the coach note). If the feedback warrants it (pain, "too hard", poor feel, high RPE), adjust the UPCOMING plan + notify. Be concise; decide and act.`
      runCoachTask(req.user, msg).catch((e) => console.error('[activity-review] ' + (e.message || e)))
    } catch (e) { console.error('[activity-review] trigger ' + e.message) }
  }
})

// admin: user management
app.get('/auth/users', auth, admin, (req, res) => res.json(store.users.map(pub)))
app.post('/auth/users', auth, admin, async (req, res) => {
  const username = String(req.body.username || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!username || !email.includes('@')) return res.status(400).json({ error: 'username + valid email required' })
  if (findByLogin(username) || findByLogin(email)) return res.status(409).json({ error: 'User already exists' })
  const temp = tempPassword()
  // #262: new users get NO athlete id — it's resolved from THEIR OWN intervals key when they connect.
  // (Never seed JM's 'i28814' — that pointed every new account at his intervals athlete.)
  const u = { id: newId(), username, email, role: req.body.role === 'admin' ? 'admin' : 'user', passwordHash: bcrypt.hashSync(temp, 10), passkeys: [], info: {}, icuKey: '', icuAthlete: '', apiToken: randomBytes(24).toString('base64url'), plans: [], createdAt: Date.now() }
  store.users.push(u); save(store)
  const emailed = await sendMail(email, 'Your Platyplus account', `You've been added to Platyplus.\nUsername: ${username}\nTemporary password: ${temp}\nSign in at ${ORIGIN} and change it.`).catch(() => false)
  res.json({ user: pub(u), tempPassword: temp, emailed })
})
app.post('/auth/users/:id/reset', auth, admin, async (req, res) => {
  const u = findById(req.params.id); if (!u) return res.status(404).json({ error: 'not found' })
  const temp = tempPassword(); u.passwordHash = bcrypt.hashSync(temp, 10); save(store)
  const emailed = await sendMail(u.email, 'Your Platyplus password was reset', `Your new temporary password is ${temp}. Sign in at ${ORIGIN} and change it.`).catch(() => false)
  res.json({ tempPassword: temp, emailed })
})
// #261 — admin sets a SPECIFIC password for a user (vs the random reset above).
app.post('/auth/users/:id/password', auth, admin, (req, res) => {
  const u = findById(req.params.id); if (!u) return res.status(404).json({ error: 'not found' })
  const pw = String(req.body.password || '')
  if (pw.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' })
  u.passwordHash = bcrypt.hashSync(pw, 10); save(store); res.json({ ok: true })
})
app.delete('/auth/users/:id', auth, admin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete yourself" })
  store.users = store.users.filter((u) => u.id !== req.params.id); save(store); res.json({ ok: true })
})

// ---- coach API token (shown to its owner only) ---------------------------
app.get('/auth/token', auth, (req, res) => res.json({ token: req.user.apiToken }))
app.post('/auth/token/rotate', auth, (req, res) => { req.user.apiToken = randomBytes(24).toString('base64url'); save(store); res.json({ token: req.user.apiToken }) })

// The app (session) reads its own plans for the Today merge-by-id.
app.get('/auth/plans', auth, (req, res) => res.json(plansInRange(req.user, req.query.from, req.query.to)))
// Calendar authoring (session): create/update/delete workout plans from the UI
// — same path as the coach API, so it auto-pushes to intervals.
app.post('/auth/plans', auth, async (req, res) => { const r = await upsertPlan(req.user, req.body, 'you'); res.status(r.status).json(r.body) })
// Import intervals.icu-origin planned workouts into Platyplus (Platyplus then owns them).
app.post('/auth/plans/sync', auth, async (req, res) => {
  const from = req.body?.from || req.query.from, to = req.body?.to || req.query.to
  if (!from || !to) return res.status(400).json({ error: 'from + to (YYYY-MM-DD) required' })
  res.json(await reconcileFromIcu(req.user, from, to))
})
// #346 — pair a completed intervals ACTIVITY to our planned EVENT so a done workout shows as ONE
// (planned-vs-actual), not a ghost planned event + a separate activity. Idempotent (only when unpaired).
async function pairActivityToPlan(user, activityId, eventId) {
  try { const r = await icuFetch(user, `/activity/${activityId}`, { method: 'PUT', body: JSON.stringify({ paired_event_id: eventId }) }); return r.ok } catch { return false }
}
// #156/#346 — on app load, reconcile PAST plans against reality (no scheduler):
//   • DONE (a matching activity in the day+sport slot) → PAIR the activity to our planned event (#346), so
//     intervals stops showing the ghost planned event next to the done activity. Idempotent.
//   • MISSED (no completion, recent) → the coach reshapes the week + removes it + notifies (#156). Once per
//     plan (missedHandledAt). Local today via the athlete's intervals tz (#347). Window: last 6 days.
app.post('/auth/plans/handle-missed', auth, async (req, res) => {
  const user = req.user, today = await athleteToday(user)
  const past = (user.plans || []).filter((p) => p.date && p.date < today && p.date >= addDays(today, -6))
  if (!past.length) return res.json({ missed: 0, paired: 0 })
  // completion signals: local logs (by id + day/sport) + the intervals ACTIVITY object per slot (for pairing)
  const logDoneIds = new Set((user.logs || []).map((l) => l.workoutId).filter(Boolean))
  const logSlots = new Set((user.logs || []).map((l) => slotKey(l.date, l.discipline === 'running' ? 'run' : l.discipline === 'cycling' ? 'ride' : 'gym')))
  const actBySlot = {}
  if (user.icuKey) {
    const acts = await icuGet(user, `/athlete/${user.icuAthlete || 'i28814'}/activities?oldest=${addDays(today, -6)}&newest=${today}`).catch(() => null)
    for (const a of (Array.isArray(acts) ? acts : [])) { const k = slotKey((a.start_date_local || '').slice(0, 10), eventSport(a.type)); if (!actBySlot[k]) actBySlot[k] = a }
  }
  let paired = 0
  const missed = []
  for (const p of past) {
    const act = actBySlot[slotKey(p.date, p.sport)]
    // #346 — DONE: pair the completed activity to our planned event (idempotent — only if not already paired)
    if (act && p.icuEventId && act.id && act.paired_event_id == null) {
      if (await pairActivityToPlan(user, act.id, p.icuEventId)) { paired++; act.paired_event_id = p.icuEventId }
    }
    // #156 — MISSED handling, once per plan: NO completion at all → the coach reshapes/removes.
    if (!p.missedHandledAt) {
      const done = !!act || logDoneIds.has(p.id) || logDoneIds.has(`plan-${p.id}`) || logSlots.has(slotKey(p.date, p.sport))
      p.missedHandledAt = Date.now()
      if (!done && p.date >= addDays(today, -3)) missed.push(p) // recent + truly missed
    }
  }
  save(store)
  if (missed.length && user.coachProfile && user.coachProfile.trim()) {
    const list = missed.map((p) => `"${p.title}" (${p.sport}, planned ${p.date}, id ${p.id})`).join('; ')
    const ids = missed.map((p) => p.id).join(', ')
    const msg = `The athlete MISSED ${missed.length} planned session${missed.length > 1 ? 's' : ''} (now past, not completed): ${list}. Reassess the REST OF THIS WEEK (list_schedule): if a missed session still matters for the plan, MOVE it to a free upcoming day that fits their availability + the one-session-per-day rule; if the week's stimulus is already covered or there's no room, DROP it. EITHER WAY, remove each missed workout from the calendar now with remove_workout (ids: ${ids}) so it doesn't linger. Keep easy days easy; never stack two hard days. Then call notify with a SHORT, warm message telling the athlete EXACTLY what you did and why — e.g. "You missed Wednesday's tempo — I moved it to Saturday and kept Thu/Fri easy so your week still lands." Don't nag or ask questions — just fix it and tell them.`
    runCoachTask(user, msg).catch((e) => console.error('[missed-handler] ' + (e.message || e)))
  }
  res.json({ missed: missed.length, paired })
})

// PUSH every Platyplus-origin plan in a window OUT to intervals (dedup-aware) — the manual
// "re-sync" button (#150). Recovers plans that never pushed (errored/predate the push) and
// adopts any matching event the athlete's other coach already created (no duplicates).
app.post('/auth/plans/resync', auth, async (req, res) => {
  const from = req.body?.from || req.query.from, to = req.body?.to || req.query.to
  if (!from || !to) return res.status(400).json({ error: 'from + to (YYYY-MM-DD) required' })
  if (!req.user.icuKey) return res.json({ skipped: 'no intervals key' })
  const plans = (req.user.plans || []).filter((p) => p.date >= from && p.date <= to && (p.origin || 'platyplus') === 'platyplus')
  let created = 0, exists = 0, updated = 0, skipped = 0, errors = 0
  for (const p of plans) {
    const r = await pushPlanToIcu(req.user, p)
    if (r.created) created++; else if (r.exists) exists++; else if (r.updated) updated++; else if (r.skipped) skipped++; else if (r.error) errors++
  }
  res.json({ total: plans.length, created, exists, updated, skipped, errors })
})
app.delete('/auth/plans/:id', auth, async (req, res) => { await deletePlanById(req.user, req.params.id, 'you'); res.json({ ok: true }) })

// Non-workout calendar items (meal / mind / note) — Platyplus only, no intervals push.
app.get('/auth/items', auth, (req, res) => res.json(itemsInRange(req.user, req.query.from, req.query.to)))
app.post('/auth/items', auth, (req, res) => { const r = upsertItem(req.user, req.body || {}); res.status(r.status).json(r.body) })
app.delete('/auth/items/:id', auth, (req, res) => { deleteItemById(req.user, req.params.id); res.json({ ok: true }) })

// Workout logs — stored per account so they sync across devices.
app.get('/auth/logs', auth, (req, res) => res.json(req.user.logs || []))
app.post('/auth/logs', auth, (req, res) => {
  const b = req.body || {}
  const log = { sid: newId(), workoutId: b.workoutId || '', title: b.title || '', discipline: b.discipline || '', duration: Number(b.duration) || 0, date: b.date || new Date().toISOString().slice(0, 10), completedAt: b.completedAt || Date.now(), setsCompleted: b.setsCompleted, volume: b.volume, tss: b.tss, sets: b.sets, notes: b.notes }
  req.user.logs = req.user.logs || []; req.user.logs.push(log); save(store); res.status(201).json(log)
})
app.put('/auth/logs/:sid', auth, (req, res) => { const l = (req.user.logs || []).find((x) => x.sid === req.params.sid); if (!l) return res.status(404).json({ error: 'not found' }); Object.assign(l, req.body || {}, { sid: l.sid }); save(store); res.json(l) })
app.delete('/auth/logs/:sid', auth, (req, res) => { req.user.logs = (req.user.logs || []).filter((x) => x.sid !== req.params.sid); save(store); res.json({ ok: true }) })
app.delete('/auth/logs', auth, (req, res) => { req.user.logs = []; save(store); res.json({ ok: true }) })

// Strava — per-user OAuth "Connect with Strava" (users never touch an API key).
// One app-level client (env); each user authorizes their own account.
app.get('/auth/strava/status', auth, (req, res) => res.json({ available: stravaConfigured(), connected: userStravaConnected(req.user), scope: req.user.strava?.scope || null, athleteId: req.user.strava?.athleteId || null }))
app.get('/auth/strava/connect', auth, (req, res) => {
  if (!stravaConfigured()) return res.status(503).send('Strava not configured on the server')
  const state = randomBytes(16).toString('hex')
  req.user.stravaState = state; save(store)
  res.redirect(stravaAuthorizeUrl(ORIGIN + '/auth/strava/callback', state))
})
app.get('/auth/strava/callback', auth, async (req, res) => {
  if (req.query.error) return res.redirect('/profile?strava=denied')
  const { code, state } = req.query
  if (!code || !state || state !== req.user.stravaState) return res.redirect('/profile?strava=error')
  try {
    const tok = await stravaExchangeCode(String(code))
    req.user.strava = { ...tok, scope: String(req.query.scope || '') }
    delete req.user.stravaState; save(store)
    res.redirect('/profile?strava=connected')
  } catch (e) { console.error('strava callback', e); res.redirect('/profile?strava=error') }
})
app.post('/auth/strava/disconnect', auth, (req, res) => { delete req.user.strava; save(store); res.json({ ok: true }) })
app.get('/auth/strava/activities', auth, async (req, res) => {
  if (!userStravaConnected(req.user)) return res.json([])
  try { res.json(await stravaActivities(req.user, Number(req.query.limit) || 15, () => save(store))) }
  catch (e) { res.status(502).json({ error: String(e.message || e) }) }
})

// --- Coach chatbot ---------------------------------------------------------
// A locked-down headless `claude -p` (owner's Claude subscription) that can ONLY
// use the per-user Platyplus MCP — no shell, files, or other tools, and scoped to
// the signed-in account's Coach API token so it can never touch another user or
// the app itself. The boundary is the TOOLSET, not the prompt.
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude'
const MCP_PATH = process.env.PLATYPLUS_MCP_PATH || fileURLToPath(new URL('../mcp/server.js', import.meta.url))
const CHAT_BASE = process.env.CHAT_SELF_URL || `http://127.0.0.1:${PORT}`
const CHAT_DENY = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite'
// When the container can't run the glibc claude binary (Alpine), proxy to a host
// chat-helper instead of spawning locally. Set on QA/prod; unset in dev.
const CHAT_HELPER_URL = process.env.CHAT_HELPER_URL || ''
const CHAT_HELPER_SECRET = process.env.CHAT_HELPER_SECRET || ''
const coachIdentity = (name) => `You are ${name}, a personal training & nutrition coach inside the Platyplus app, helping ONE user (the signed-in account) with THEIR own plan. Use ONLY the provided platyplus tools to create or adjust their workouts, rides, runs, meals, mind sessions and notes. You cannot modify the app, read files, run commands, or access any other user. When you schedule or change something, do it with the tools, then confirm in one short sentence what you changed (e.g. "Added a Push day to Thursday."). Be concise, practical and encouraging.

FORMAT FOR A PHONE (never a wall of text): lead with the answer in one line. If the reply runs beyond ~3 sentences, break it up — use a short **bold** mini-header per topic and hyphen "- " bullets for lists (days, steps, options). Keep bullets to one line each. Markdown renders (**bold**, "- " bullets, "## " headers); don't use tables or code blocks. Prefer 2-4 tight sections over one long paragraph.`

// The coach also helps users configure & use Platyplus itself. These steps require
// taps in the user's browser (the coach guides, it can't do them).
const APP_HELP = `# Helping with Platyplus (configuration & usage)
You can also help the user set up and use the app — guide them in plain steps:
- intervals.icu: Profile → Athlete/Connections → intervals.icu. They paste their Athlete ID and an API key (from intervals.icu → Settings → "Developer settings" → API key). Once connected, planned and completed rides sync into their calendar.
- Strava/Garmin/Coros/Wahoo: DON'T connect these to Platyplus directly — connect them INSIDE intervals.icu (intervals → Settings → connections). Platyplus reads everything through intervals, so their activities + wellness flow in automatically.
- Athlete profile: Profile → Athlete. This is the profile YOU read — goals, sport, weekly hours, FTP/maxes, equipment, constraints, injuries, preferences. Encourage them to keep it current; the more accurate it is, the better you plan.
- Features: Today/Calendar (the plan), Train (gym, ride, run), Eat (recipes & meals), Mind (meditation/yoga/pilates), Stats (Fitness/Strength/Progress), and this Coach chat.
- Strength prescription: when you schedule a gym workout, prescribe each lift as sets × TARGET REPS (e.g. 4×4 for power, 3×8 for hypertrophy). The app auto-fills the suggested WEIGHT from the athlete's estimated 1RM (logged history) — you do NOT need to specify kg unless they ask. After they log, their e1RM updates and you adjust next time.
Keep these answers short and concrete.`

// The coaching ENGINE (method/philosophy) — synced from the cyclingcoach repo by
// scripts/sync-coach-engine.mjs. ONE polyvalent engine shared by all users; the
// per-user profile supplies the specifics. Optional (dev before first sync).
function loadEngine(f) { try { return readFileSync(join(__dirname, f), 'utf8').trim() } catch { return '' } }
const COACH_ENGINE = loadEngine('coach-engine.md')             // generic, all athletes
const COACH_ENGINE_FEMALE = loadEngine('coach-engine-female.md')   // gated by sex
// ONE engine PER SPORT/activity (JM directive): running ≠ cycling — each has its own method (Daniels
// pace vs FTP power). Inject the engine for every sport the athlete actually does. `sports` = onboarding
// sport keys; `rx` = a profile-text fallback when the structured field is unset. Add a row per new sport.
const SPORT_ENGINES = [
  { key: 'cycling', file: 'coach-engine-cycling.md', sports: ['cycling', 'triathlon'], rx: /\b(cycl|bike|biking|\bride\b|\brides\b|ftp|w\/kg|wattage|triathlon|gran fondo)\b/i },
  { key: 'running', file: 'coach-engine-running.md', sports: ['running', 'triathlon'], rx: /\b(run|running|jog|marathon|\b5k\b|\b10k\b|half|ultra|vdot|daniels|threshold pace)\b/i },
].map((e) => ({ ...e, text: loadEngine(e.file) }))

function buildSystemPrompt(user) {
  const name = user.coachName || 'Coach'
  const prof = user.coachProfile || ''
  let p = coachIdentity(name)
  if (COACH_ENGINE) p += `\n\n# Your coaching method (the Platyplus engine — apply it to THIS athlete per their profile)\n` + COACH_ENGINE
  // Gated modules — only the athletes they apply to get them (the engine is ONE coach,
  // not cycling-for-everyone). Prefer the STRUCTURED fields (sport from onboarding, sex
  // from intervals.icu); fall back to a profile-text heuristic only when unset.
  const sports = user.sports && user.sports.length ? user.sports : (user.sport ? [user.sport] : [])
  // Inject each sport engine the athlete does (structured sport, else profile-text fallback).
  for (const e of SPORT_ENGINES) {
    const does = sports.length ? sports.some((sp) => e.sports.includes(sp)) : e.rx.test(prof)
    if (does && e.text) p += '\n\n' + e.text
  }
  const isFemale = user.sex ? user.sex === 'female' : /\b(female|woman|she\/her)\b/i.test(prof)
  if (isFemale && COACH_ENGINE_FEMALE) p += '\n\n' + COACH_ENGINE_FEMALE
  // #329 — this athlete's CURRENT cycle phase (from intervals menstrualPhase or a stored cycle start,
  // stashed by /auth/readiness). Adjust the PLAN by phase, not just readiness. Only if reasonably fresh.
  if (isFemale) {
    const fresh = user.cyclePhaseAt && (Date.now() - new Date(user.cyclePhaseAt + 'T00:00:00Z').getTime()) < 6 * 86400000
    const cc = fresh ? cycleContext({ phase: user.cyclePhase }) : null
    if (cc) p += `\n\n# CYCLE PHASE — currently **${cc.phase}** (as of ${user.cyclePhaseAt}). ${cc.guidance} When you plan or adjust this week, apply a load bias of ~×${cc.loadModifier} for this phase (push intensity in the follicular/ovulatory green window; ease top-end + add recovery/Z2 + carbs/sleep in late-luteal/PMS if symptomatic). Don't over-medicalise it — many train through; adapt to how SHE reports feeling. Their late-luteal RHR/HRV naturally shift, so don't read that as poor recovery.`
    else if (!user.cyclePhase) p += `\n\n# CYCLE PHASE — unknown. If it would help tailor load/recovery and she's open to it, ASK for her last period start date + typical cycle length (or connect it in intervals), then factor the phase into planning. Never assume; ask once, respect a "no".`
  }
  // #207 Phase 2: the athlete's own benchmarks — so the coach judges intensity FOR THEM.
  const stats = []
  // #236/#277: FTP resolves by statPrefs.ftp — computed/AUTO prefer eFTP when available, else the set FTP.
  const wantsComputed = (k) => user.statPrefs?.[k] === 'computed' || (user.statPrefs?.[k] ?? 'auto') === 'auto'
  if (wantsComputed('ftp') && user.eftp) stats.push(`cycling FTP ~${user.eftp} W (eFTP, estimated)`)
  else if (user.ftp) stats.push(`cycling FTP ${user.ftp} W`)
  if (user.maxHR) stats.push(`max HR ${user.maxHR} bpm`)
  // #236/#277: VO₂max — computed/AUTO prefer the submax estimate; else the manual value.
  const vo2est = bestVo2maxEstimate({ ftp: user.ftp, weightKg: user.weight, vdot: user.runVdot, hrMax: user.maxHR, hrRest: user.restingHR })
  if (wantsComputed('vo2max') && vo2est) stats.push(`VO2max ~${vo2est.value} (est. from ${vo2est.source})`)
  else if (user.vo2max) stats.push(`VO2max ${user.vo2max}`)
  else if (vo2est) stats.push(`VO2max ~${vo2est.value} (est. from ${vo2est.source})`)
  // #236/#277: threshold pace — computed/AUTO prefer the #215 estimate when ready, else the set value.
  const tpComputed = wantsComputed('thresholdPace') && user.runPaceEst > 0
  const tp = tpComputed ? user.runPaceEst : user.sportSettings?.running?.thresholdPace // sec/km
  if (tp > 0) { const m = Math.floor(tp / 60), s = String(Math.round(tp % 60)).padStart(2, '0'); stats.push(`running threshold pace ${m}:${s}/km${tpComputed ? ' (estimated)' : user.runVdot ? ` (VDOT ${user.runVdot})` : ''}`) }
  const rhr = user.sportSettings?.running?.maxHr
  if (rhr && rhr !== user.maxHR) stats.push(`running max HR ${rhr} bpm`)
  if (user.sleepNeed) stats.push(`sleep need ~${user.sleepNeed} h`)
  // #256 port — per-athlete LEARNED baselines (their own 60d norm). Interpret a reading as a
  // DEVIATION from these, not against textbook absolutes. (Stashed by /auth/readiness.)
  const bl2 = []
  if (user.hrvBaseline?.mean) bl2.push(`HRV baseline ~${user.hrvBaseline.mean} ms${user.hrvBaseline.cv7 != null ? ` (7-day variability ${user.hrvBaseline.cv7}%)` : ''}`)
  if (user.rhrBaseline?.mean) bl2.push(`resting HR baseline ~${user.rhrBaseline.mean}±${user.rhrBaseline.sd} bpm`)
  if (bl2.length) p += `\n\n# THIS ATHLETE'S LEARNED BASELINES (their OWN ~60-day norm) — ${bl2.join(', ')}.\nInterpret today's HRV/resting-HR as a DEVIATION from these, never as textbook absolutes: a clear HRV drop or resting-HR rise vs baseline (beyond ~1 SD, especially multi-day) signals accumulating fatigue, poor sleep, or oncoming illness → ease off; within the normal band → train as planned. Rising 7-day HRV variability is itself a fatigue flag. Always cross-check with their check-in and Form before deciding.`
  if (stats.length) p += `\n\n# THIS ATHLETE'S BENCHMARKS — ${stats.join(', ')}.\nJudge how hard a session is FOR THEM against these: prescribe ride intensities as % of THEIR FTP and RUN intensities as a pace off THEIR threshold pace (Daniels E/M/T/I/R), set HR zones off THEIR max HR, and gym loads by reps (the app fills the weight). Their sleep NEED is ~${user.sleepNeed || 8} h — score sleep against that, not a generic 8 h.`
  p += `\n\n# Data you have — and don't\nPlatyplus does NOT collect passive analytics: no HRV, resting HR, sleep, body weight, or Form/Fitness/CTL/ATL here. Those live in the athlete's intervals.icu (read them with get_wellness / get_recent_activities WHEN connected). What Platyplus DOES have: the plan, logged workouts, and the athlete's quick DAILY CHECK-IN, all 1-5 (energy: 5=energized, sleep: 5=fully rested, soreness: 5=very sore) — read get_checkins; it's your main recovery signal when intervals isn't connected. When you lack data, say what you'd want to check, then ADAPT to what you DO have rather than inventing numbers. Make plan changes with the platyplus tools.`
  const ownedEq = Array.isArray(user.info?.equipment) ? user.info.equipment.filter((e) => typeof e === 'string') : []
  if (ownedEq.length) p += `\n\n# Equipment the athlete OWNS: ${ownedEq.join(', ')}.\nWhen building gym/strength sessions, prescribe ONLY exercises that use this gear or Bodyweight — pass \`equipment="${ownedEq.join(',')}"\` to search_exercises so you never pick something they can't do. (They set this in Settings → Equipment.)`
  // #303 — weekly availability (hours/day) so the coach places sessions within the athlete's real windows.
  const av = user.info?.availability && typeof user.info.availability === 'object' ? user.info.availability : null
  if (av) {
    const DOW = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
    const line = DOW.map(([k, d]) => `${d} ${Number(av[k]) || 0}h`).join(' · ')
    const wk = DOW.reduce((s, [k]) => s + (Number(av[k]) || 0), 0)
    if (wk > 0) p += `\n\n# WEEKLY AVAILABILITY (hours/day the athlete can train): ${line} (${wk}h/wk total). RESPECT IT — fit each session inside that day's window (no ${'`'}2h+${'`'} ride on a 30-min day), place the long ride on the biggest day, and don't schedule anything on a 0h/rest day. If the week's target needs more time than available, say so rather than overbooking.`
  }
  // #316 — desired training FREQUENCY. Plan exactly this many COMMITTED sessions/week; if they want more,
  // an EXTRA session is a clearly-labelled OPTIONAL/BONUS (title it "(optional)" and note it's a bonus),
  // never part of the base load.
  const freq = Number(user.info?.trainingDays) || 0
  if (freq > 0) p += `\n\n# TRAINING FREQUENCY: the athlete wants ~${freq} training days/week. Plan exactly ${freq} COMMITTED sessions. If they ask for more (a bonus day), add ONE OPTIONAL session — prefix its title with "(optional)" and say it's a bonus they can skip — don't inflate the base week.`
  // #345 — most athletes train ONCE a day. Never stack two sessions (e.g. a gym + a run) on the same
  // calendar day beyond this cap unless the athlete explicitly opts into doubles.
  const maxPerDay = Math.max(1, Number(user.info?.maxPerDay) || 1)
  p += `\n\n# ONE SESSION PER DAY (max ${maxPerDay}/day): the athlete trains at most ${maxPerDay} session${maxPerDay > 1 ? 's' : ''} per calendar day. ${maxPerDay === 1 ? 'Do NOT schedule two workouts on the same day (no gym + run, no ride + run together) — spread sessions across different days. If two efforts must share a day because time is tight, ask first or fold them into ONE combined session.' : `Never exceed ${maxPerDay} on any single day, and only double up when it genuinely serves the plan (e.g. AM/PM split).`} Respect their weekly availability + rest days when spacing them.`
  // #375 — WEEKLY LOAD BUDGET so the coach doesn't over-cook a week (it planned ~2× sustainable when it
  // couldn't see planned loads; #372 fixed the visibility, this states the budget). Uses the stashed CTL.
  const budget = weeklyLoadBudget(user.ctl)
  p += `\n\n# WEEKLY LOAD BUDGET (a BAND — hit the productive zone, don't sit under it OR blow past it): CTL×7 TSS only HOLDS fitness flat (maintenance/recovery). A PRODUCTIVE BUILD must create real stimulus — aim ~CTL×9-11 so Form dips into the GREEN productive zone (roughly −10 to −20 here). ${budget ? `Their CTL≈${user.ctl} → a build week is ~${budget.build}-${budget.hard} TSS (flat ≈ ${budget.sustainable}, overload cap ≈ ${budget.cap}).` : `Read their CTL with get_wellness, then: flat ≈ CTL×7, build ≈ CTL×9-11.`} Two failure modes, avoid BOTH: (1) TOO EASY — a build week that leaves Form in the grey (>−8) is junk miles that waste the week (unless it's deliberately a recovery/taper week). A real build needs ~2 quality days (e.g. sweet-spot/threshold + a longer harder ride), NOT back-to-back, with easy days between. (2) TOO HARD — past the overload cap, or Form projecting below ~−25, is overreaching: only as a NAMED overload block + a following recovery week. ALWAYS verify: after planning, sum the week's TSS (list_schedule shows each session's load) AND check the Form forecast lands in green (−10 to −20) — re-plan if it's grey or past −25.`
  // #341 — weather-aware coaching for OUTDOOR sessions.
  p += `\n\n# WEATHER (outdoor sessions): before planning or confirming an outdoor run/ride — especially in heat or cold — call get_weather (date = the session day). In the heat, DERATE: judge easy days by feel/HR (pace/power hold at a higher cost), trim quality targets, add hydration/electrolyte + fueling notes, prefer the cool hour or shade, and move a hard session indoors when it's extreme. Cold → longer warm-up + layers; strong wind → ride to effort not speed; likely rain → grip/visibility or indoors. Fold it into the plan/notes, don't just report it. If it returns needsLocation, ask their city once.`
  // #323 — the athlete's OWN goal & identity. This is what makes the plan theirs; center on it and
  // let it OVERRIDE generic defaults (e.g. "tone, don't bulk" ⇒ not a hypertrophy block).
  const goals = user.info?.goals
  if (goals && ((Array.isArray(goals.focus) && goals.focus.length) || (goals.notes && String(goals.notes).trim()))) {
    p += `\n\n# ATHLETE GOALS — CENTER THE PLAN ON THIS: ${Array.isArray(goals.focus) && goals.focus.length ? `focus = ${goals.focus.join(', ')}. ` : ''}${goals.notes ? `In their words: "${String(goals.notes).trim().slice(0, 600)}". ` : ''}Honor it exactly — someone who wants to "stay fit & consistent, NOT bulk up" gets a very different plan than someone chasing a 300 W FTP. When their goal conflicts with a default, follow THEIR goal, and fold it into set_athlete_profile.`
  }
  // #284 — gym prescription depth: tempo (time-under-tension) + per-lift + session tips.
  p += `\n\n# GYM PRESCRIPTION DEPTH (create_workout): for each lift set sets×reps and ALWAYS set a TEMPO on strength lifts — 4 digits eccentric-pauseBottom-concentric-pauseTop, e.g. "3-1-1-0" = 3s lower · 1s pause · 1s lift · 0s top (slower eccentric ⇒ more time-under-tension ⇒ hypertrophy/control; faster ⇒ power). Default to "3-1-1-0" for main + accessory strength work; only omit tempo for pure mobility/holds/plyometrics. This is REQUIRED, not optional — the app shows it as a chip. Add a one-line FORM tip per lift, and ONE whole-session \`tip\`. Don't set weight — the app fills it from the athlete's e1RM. Keep tips short and practical.`
  const diet = String(user.info?.diet || '').toLowerCase()
  if (diet === 'vegetarian' || diet === 'vegan') p += `\n\n# DIET: the athlete is ${diet.toUpperCase()}.\nEVERY meal you pick or suggest MUST be ${diet}. search_recipes already returns ONLY ${diet}-compatible recipes for this athlete, so pick from those — never recommend a meal outside their diet, and don't suggest meat${diet === 'vegan' ? ', fish, dairy, eggs, or honey' : ' or fish'}. (They set this in Settings → Preferences.)`
  // #265 — daily FUEL TARGETS (mirror src/nutrition.ts: Mifflin-St Jeor BMR → TDEE → goal calories + protein).
  const fKg = Number(user.weight) || null, fCm = Number(user.info?.heightCm) || null
  const fAge = user.info?.dob ? Math.floor((Date.now() - new Date(user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null
  if (user.sex && fKg && fCm && fAge && fAge > 12 && fAge < 100) {
    const bmr = Math.round(10 * fKg + 6.25 * fCm - 5 * fAge + (user.sex === 'female' ? -161 : 5))
    const days = Number(user.info?.trainingDays) || 0
    const act = days >= 7 ? 1.9 : days >= 5 ? 1.725 : days >= 3 ? 1.55 : 1.375
    const tdeeV = Math.round(bmr * act)
    const goal = ['lose', 'gain', 'maintain'].includes(user.info?.fuelGoal) ? user.info.fuelGoal : 'maintain'
    const cal = Math.round(tdeeV * (goal === 'lose' ? 0.82 : goal === 'gain' ? 1.1 : 1))
    const protein = Math.round(fKg * (goal === 'lose' ? 2.2 : goal === 'gain' ? 2.0 : 1.8))
    p += `\n\n# DAILY FUEL TARGETS — ~${cal} kcal/day (goal: ${goal}), protein ~${protein} g (BMR ${bmr} · TDEE ${tdeeV}). When you pick meals/portions, aim the DAY near these and hit the protein — it's the priority. Fuel UP on hard/long days (more carbs around the session) and trim on rest days. These are estimates; adapt to how their weight/energy actually trend.`
  }
  p += '\n\n' + APP_HELP
  // #256 port — durable COACH MEMORY: consult it EVERY session, then keep it current.
  if (user.coachMemory && user.coachMemory.trim()) {
    p += `\n\n# YOUR COACH MEMORY for this athlete (what you've LEARNED works/fails + how they like to be coached — apply it, don't repeat past mistakes)\n${user.coachMemory.trim()}\n\nWhen you learn something durable (a rule that worked or failed, a preference they state, a constraint, an adjustment that paid off), UPDATE this with save_coach_memory (rewrite the full memory, keep it tight — dated bullets, mark rules active/retired). This is separate from their profile: the profile is WHO they are, the memory is HOW to coach THEM.`
  } else {
    p += `\n\n# COACH MEMORY — you have none for this athlete yet. As you learn what works/fails and how they like to be coached, start one with save_coach_memory (tight dated bullets) so you improve every session instead of starting fresh.`
  }
  if (user.coachProfile && user.coachProfile.trim()) {
    p += `\n\n# This athlete's profile (their own context — use it to personalize every answer)\n` + user.coachProfile.trim()
  } else {
    const known = []
    if (user.sex) known.push(`sex ${user.sex}`)
    if (user.weight) known.push(`weight ${user.weight} kg`)
    if (user.ftp) known.push(`FTP ${user.ftp} W`)
    if (user.maxHR) known.push(`max HR ${user.maxHR} bpm`)
    if ((user.sports || []).length) known.push(`sports ${user.sports.join(', ')}`)
    const icuOn = !!user.icuKey
    const stravaOn = userStravaConnected(user)
    p += `\n\n# ONBOARDING — this athlete has NO profile yet. RUN THE INTERVIEW NOW, and GET THEIR DATA CONNECTED.
You are meeting them for the FIRST time. Open with a warm one-line hello using their name if known (${user.username || 'there'}), say you're their coach and you'll get them set up in a couple of minutes, then START asking. Lead the conversation — they may reply by tapping, typing, OR voice, and may give extra detail; roll with it.
${known.length ? `Already known from intervals.icu (CONFIRM, don't re-ask): ${known.join(', ')}. ` : ''}

## Connections — do this EARLY, it's what makes the plan good
Platyplus↔service status right now: intervals.icu ${icuOn ? 'CONNECTED ✅' : 'NOT connected ❌'} · Strava ${stravaOn ? 'connected ✅' : 'not connected'}.
- **CALL check_connections** to see the TRUTH — not just whether intervals is linked, but whether their data is actually FLOWING in: recent synced activities (+ the source device), and whether HRV/sleep/resting-HR are present. Do this early, and again after you learn what device they use.
- **intervals.icu is the data hub** — fitness/fatigue/Form, HRV, sleep, resting HR, FTP/threshold/max-HR and past activities all come from it. Without it you're planning half-blind.
${icuOn ? '- intervals is linked — call check_connections; if activities/wellness are flowing, pull their benchmarks + recent training to ground the plan.' : `- intervals is NOT linked. Walk them through it: **Profile → Connect intervals.icu**, paste their intervals API key (from intervals.icu → Settings → Developer). Explain plainly why. You can't do it for them — guide, then re-check.`}
- **Match device to data flow**: ask what watch/head-unit they use (Garmin, Coros, Wahoo, Suunto, Polar, Apple Watch…), then use check_connections to see if that source is actually syncing into intervals. If it isn't, tell them EXACTLY what to fix: connect that device (and Strava) INSIDE intervals.icu (intervals → Settings → connections) so every ride/run + overnight HRV/sleep flows in automatically. Confirm ("your Coros runs are flowing ✅" / "I don't see any Coros data yet — connect it in intervals").
- Sharing to Strava: they connect Strava INSIDE intervals.icu (not Platyplus) — then completed activities land on Strava automatically.

## The app already collected the basics — DON'T re-interview (#310)
Onboarding is now a GUIDED IN-APP SETUP: before reaching you, the user set — via tappable pages — their sport(s), sex,
equipment, and weekly availability, and (optionally) FTP / threshold pace. Those are in the profile above. So when they
say they're set: **do NOT ask a wall of questions.** Read what's already there. Ask AT MOST one short thing, and only if a
truly critical anchor is missing (e.g. main goal, or a hard injury). Keep every message short and encouraging.

## ANALYSE INTERVALS FIRST, then build — estimate what they didn't enter (#313)
- **Call check_connections + pull their recent training** (last ~3 months, incl. Strava history synced into intervals)
  BEFORE drafting. Ground the plan in real data, not assumptions.
- **They may not know their numbers.** If FTP / threshold pace is blank, ESTIMATE it from their intervals history (recent
  hard efforts, Critical Power/Speed, best 20-min power, threshold runs), **call set_thresholds to SAVE it** (so run %pace /
  ride %ftp targets actually resolve on their watch — a run with no threshold pace is useless), and TELL them your estimate
  + that it'll refine. Don't block on it and don't invent a number with no data — reason from what's actually there.
- Runs use PACE (min/km) or HR, never watts. Author every ride AND run as STRUCTURED steps (warmup / work / cooldown with
  targets) so intervals → Garmin gives a followable workout — not a text-only description (#312/#314).
- As you learn durable facts, call set_athlete_profile with the FULL clean markdown profile (rewrite it whole each time).

## Then BUILD their first week
Draft it with create_workout/create_ride/create_run around their availability (easy-first, one quality day, respect time +
equipment + female-athlete module if applicable), call notify with a short "here's your first week" summary, and FINALLY
call finish_onboarding. If intervals isn't connected yet, draft a sensible STARTER week and say it'll sharpen once their
data syncs.`
  }
  return p
}

// Fire the coach NON-INTERACTIVELY for a background task (e.g. a post-workout review,
// #76). Best-effort; drains output — the POINT is the coach's MCP side-effects (it
// saves a review / adjusts the plan / notifies). NOT the user's chat thread (no session).
// The system prompt (~128 KB: base engine + per-sport engines + profile) is too large to pass as a
// command-line arg — Linux caps a single argv at 128 KiB (MAX_ARG_STRLEN) → E2BIG spawn failure. Write
// it to a temp file and use --append-system-prompt-file. (Prod goes via the chat-helper, which does the
// same; these local spawns are the dev path.)
function writeSysPromptFile(prompt) {
  const f = `${tmpdir()}/coach-sp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`
  writeFileSync(f, prompt)
  return f
}
async function runCoachTask(user, message) {
  const systemPrompt = buildSystemPrompt(user)
  if (CHAT_HELPER_URL) {
    const hr = await fetch(CHAT_HELPER_URL + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat-secret': CHAT_HELPER_SECRET },
      body: JSON.stringify({ message, token: user.apiToken, coach: user.coachName || 'Coach', systemPrompt }),
    })
    if (!hr.ok || !hr.body) throw new Error('coach helper ' + hr.status)
    const reader = hr.body.getReader()
    for (;;) { const { done } = await reader.read(); if (done) break } // drain to completion
    return
  }
  await new Promise((resolve, reject) => {
    const mcpConfig = JSON.stringify({ mcpServers: { platyplus: { command: 'node', args: [MCP_PATH], env: { PLATYPLUS_URL: CHAT_BASE, PLATYPLUS_TOKEN: user.apiToken } } } })
    const spFile = writeSysPromptFile(systemPrompt)
    const cleanup = () => { try { unlinkSync(spFile) } catch { /* gone */ } }
    const args = ['-p', message, '--output-format', 'stream-json', '--verbose', '--mcp-config', mcpConfig, '--allowedTools', 'mcp__platyplus', '--disallowedTools', CHAT_DENY, '--append-system-prompt-file', spFile]
    const proc = spawn(CLAUDE_BIN, args, { env: process.env })
    proc.stdin?.end()
    const killer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('coach task timeout')) }, 180000)
    proc.stdout.on('data', () => {}); proc.stderr.on('data', () => {}) // drain
    proc.on('error', (e) => { clearTimeout(killer); cleanup(); reject(e) })
    proc.on('close', () => { clearTimeout(killer); cleanup(); resolve() })
  })
}

// #353 — a human phrase for the tool the coach is calling, shown as "Reviewing your …" in the UI.
const TOOL_LABEL = { get_wellness: 'your wellness data', get_checkins: 'your check-ins', get_recent_activities: 'your recent activity', list_schedule: 'your schedule', get_weather: 'the weather', check_connections: 'your connections', search_exercises: 'the exercise library', search_recipes: 'recipes', create_workout: 'a gym session', create_ride: 'a ride', create_run: 'a run', schedule_recovery: 'recovery', schedule_supplement: 'supplements', save_coach_review: 'your review', set_activity_text: 'your activity notes', set_athlete_profile: 'your profile', set_thresholds: 'your thresholds', set_weekly_target: 'your week', save_coach_memory: 'your coaching notes', schedule_meal: 'a meal', schedule_mind: 'a mind session', notify: 'a note for you' }
const friendlyTool = (name) => { const t = String(name || '').replace(/^mcp__platyplus__/, ''); return TOOL_LABEL[t] || t.replace(/_/g, ' ') }

// #363 — coach conversations as THREADS (ChatGPT/Claude-style): named + searchable, each keeping its own
// claude --resume session (per-conversation memory), all persisted server-side so they SYNC across devices
// (#356). The pre-threads single conversation (chatMsgs) migrates into the first thread. `chatMsgs` is kept
// as a mirror of the ACTIVE thread for backward compat.
const chatTitleOf = (msgs) => { const u = (msgs || []).find((m) => m.role === 'user'); return u ? String(u.text).replace(/\s+/g, ' ').trim().slice(0, 60) : '' }
function ensureThreads(user) {
  if (!Array.isArray(user.chatThreads)) user.chatThreads = []
  if (!user.chatThreads.length && Array.isArray(user.chatMsgs) && user.chatMsgs.length) {
    user.chatThreads.push({ id: newId(), title: chatTitleOf(user.chatMsgs), sessionId: user.chatSession || null, msgs: user.chatMsgs, createdAt: Date.now(), updatedAt: Date.now() })
    user.chatThreadId = user.chatThreads[0].id
  }
  return user.chatThreads
}
function activeThread(user) {
  ensureThreads(user)
  let t = user.chatThreads.find((x) => x.id === user.chatThreadId)
  if (!t) t = user.chatThreads.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null
  if (!t) { t = { id: newId(), title: '', sessionId: null, msgs: [], createdAt: Date.now(), updatedAt: Date.now() }; user.chatThreads.unshift(t) }
  user.chatThreadId = t.id
  user.chatMsgs = t.msgs // compat mirror
  return t
}
const threadSummary = (t, activeId) => { const last = (t.msgs || [])[(t.msgs || []).length - 1]; return { id: t.id, title: t.title || 'New conversation', at: new Date(t.updatedAt || t.createdAt || Date.now()).toISOString(), preview: last ? String(last.text).replace(/\s+/g, ' ').trim().slice(0, 90) : '', active: t.id === activeId } }

// persist a completed turn into the ACTIVE thread (append + auto-title + touch updatedAt). #363
function persistChat(user, userMsg, coachReply) {
  if (!coachReply || !coachReply.trim()) return
  const t = activeThread(user)
  t.msgs.push({ role: 'user', text: userMsg, ts: Date.now() }, { role: 'coach', text: coachReply, ts: Date.now() })
  if (t.msgs.length > 400) t.msgs = t.msgs.slice(-400)
  if (!t.title) t.title = chatTitleOf(t.msgs)
  t.updatedAt = Date.now()
  user.chatMsgs = t.msgs
  save(store)
}

// list conversations (newest first) + which is active
app.get('/auth/chat/threads', auth, (req, res) => { ensureThreads(req.user); res.json({ activeId: req.user.chatThreadId || null, threads: (req.user.chatThreads || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map((t) => threadSummary(t, req.user.chatThreadId)) }) })
// open a conversation (makes it active) → its messages
app.get('/auth/chat/threads/:id', auth, (req, res) => { ensureThreads(req.user); const t = (req.user.chatThreads || []).find((x) => x.id === req.params.id); if (!t) return res.status(404).json({ error: 'no such conversation' }); req.user.chatThreadId = t.id; req.user.chatMsgs = t.msgs; save(store); res.json({ id: t.id, title: t.title || '', msgs: t.msgs || [] }) })
// new conversation (fresh claude session) → becomes active
app.post('/auth/chat/threads', auth, (req, res) => { ensureThreads(req.user); const t = { id: newId(), title: '', sessionId: null, msgs: [], createdAt: Date.now(), updatedAt: Date.now() }; req.user.chatThreads.unshift(t); req.user.chatThreadId = t.id; req.user.chatMsgs = []; save(store); res.status(201).json({ id: t.id }) })
app.delete('/auth/chat/threads/:id', auth, (req, res) => { ensureThreads(req.user); req.user.chatThreads = (req.user.chatThreads || []).filter((x) => x.id !== req.params.id); if (req.user.chatThreadId === req.params.id) { const nt = req.user.chatThreads.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]; req.user.chatThreadId = nt ? nt.id : null; req.user.chatMsgs = nt ? nt.msgs : [] } save(store); res.json({ ok: true }) })
// search ACROSS all conversations → matching snippets (title + a window around the hit). #363
app.get('/auth/chat/search', auth, (req, res) => {
  ensureThreads(req.user)
  const q = String(req.query.q || '').trim().toLowerCase()
  if (q.length < 2) return res.json([])
  const out = []
  for (const t of (req.user.chatThreads || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) {
    for (const m of t.msgs || []) {
      const txt = String(m.text || ''); const i = txt.toLowerCase().indexOf(q)
      if (i < 0) continue
      const snippet = (i > 24 ? '…' : '') + txt.slice(Math.max(0, i - 24), i + q.length + 44).replace(/\s+/g, ' ').trim() + '…'
      out.push({ threadId: t.id, title: t.title || 'New conversation', at: new Date(t.updatedAt || Date.now()).toISOString(), snippet, role: m.role })
      if (out.length >= 40) return res.json(out)
    }
  }
  res.json(out)
})

// The ACTIVE conversation's messages (any device loads it → same thread everywhere). #356
app.get('/auth/chat/history', auth, (req, res) => { const t = activeThread(req.user); save(store); res.json(t.msgs || []) })
// Seed the ACTIVE thread from a device's LOCAL copy — ONLY when it's empty (migrates a pre-sync convo). #356
app.post('/auth/chat/history', auth, (req, res) => {
  const t = activeThread(req.user)
  if (!t.msgs.length) {
    const msgs = (Array.isArray(req.body?.msgs) ? req.body.msgs : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'coach') && typeof m.text === 'string' && m.text.trim())
      .slice(-400).map((m) => ({ role: m.role, text: m.text, ts: Number(m.ts) || Date.now() }))
    if (msgs.length) { t.msgs.push(...msgs); if (!t.title) t.title = chatTitleOf(t.msgs); t.updatedAt = Date.now(); req.user.chatMsgs = t.msgs; save(store) }
  }
  res.json(t.msgs || [])
})

app.post('/auth/chat', auth, async (req, res) => {
  const message = String(req.body?.message || '').trim().slice(0, 4000)
  if (!message) return res.status(400).json({ error: 'empty message' })
  const thread = activeThread(req.user) // #363 — this turn belongs to the active conversation (its own claude session)
  // Stream tokens to the client over SSE.
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // stop nginx/NPM from buffering the SSE (else it arrives all at once)
  res.flushHeaders?.()
  const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`)
  send({ coach: req.user.coachName || 'Coach' })

  // QA/prod: the container can't run the glibc claude → proxy to the host helper.
  if (CHAT_HELPER_URL) {
    let pdone = false, reply = ''
    const pend = () => { if (pdone) return; pdone = true; persistChat(req.user, message, reply); send({ done: true }); res.end() }
    try {
      const hr = await fetch(CHAT_HELPER_URL + '/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-chat-secret': CHAT_HELPER_SECRET },
        body: JSON.stringify({ message, token: req.user.apiToken, coach: req.user.coachName || 'Coach', systemPrompt: buildSystemPrompt(req.user), sessionId: thread.sessionId }),
      })
      if (!hr.ok || !hr.body) { send({ error: 'coach unavailable (' + hr.status + ')' }); return pend() }
      const reader = hr.body.getReader(); const dec = new TextDecoder(); let hbuf = ''
      res.on('close', () => { try { reader.cancel() } catch { /* */ } })
      for (;;) {
        const { done: rdone, value } = await reader.read(); if (rdone) break
        hbuf += dec.decode(value, { stream: true })
        let i
        while ((i = hbuf.indexOf('\n\n')) >= 0) {
          const data = hbuf.slice(0, i).split('\n').find((l) => l.startsWith('data:')); hbuf = hbuf.slice(i + 2)
          if (!data) continue
          let ev; try { ev = JSON.parse(data.slice(5).trim()) } catch { continue }
          if (ev.sessionId) { thread.sessionId = ev.sessionId; save(store) } // #363 persist per-thread, don't forward
          else if (ev.error && /no conversation found|session id/i.test(String(ev.error))) { thread.sessionId = null; save(store); send({ error: 'Lost the thread — tap send again to start fresh.' }) } // stale session → clear so next send is fresh
          else if (!ev.done) { if (ev.delta) reply += ev.delta; send(ev) } // forward delta / tool / error (our own done at the end); #356 accumulate the reply to persist
        }
      }
    } catch (e) { send({ error: 'coach unavailable: ' + (e.message || e) }) }
    return pend()
  }

  // Dev: spawn claude locally.
  const mcpConfig = JSON.stringify({ mcpServers: { platyplus: { command: 'node', args: [MCP_PATH], env: { PLATYPLUS_URL: CHAT_BASE, PLATYPLUS_TOKEN: req.user.apiToken } } } })
  const spFile = writeSysPromptFile(buildSystemPrompt(req.user))
  const baseArgs = [
    '-p', message,
    '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
    '--mcp-config', mcpConfig,
    '--allowedTools', 'mcp__platyplus',
    '--disallowedTools', CHAT_DENY,
    '--append-system-prompt-file', spFile,
  ]
  let done = false, reply = ''
  const end = () => { if (done) return; done = true; try { unlinkSync(spFile) } catch { /* gone */ } persistChat(req.user, message, reply); send({ done: true }); res.end() } // #356 persist for cross-device sync
  // Run claude; if a stored session id is STALE (claude's local session store can vanish across
  // restarts → "No conversation found with session ID"), drop it and retry ONCE with a fresh thread.
  const run = (resume, isRetry) => {
    const args = resume && thread.sessionId ? [...baseArgs, '--resume', thread.sessionId] : baseArgs
    const proc = spawn(CLAUDE_BIN, args, { env: process.env })
    proc.stdin?.end() // close stdin (EOF) so claude doesn't wait for piped input
    const killer = setTimeout(() => proc.kill('SIGKILL'), 180000)
    let buf = '', err = '', sawOutput = false
    proc.stdout.on('data', (d) => {
      buf += d
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (!line) continue
        let ev; try { ev = JSON.parse(line) } catch { continue }
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') { sawOutput = true; reply += ev.event.delta.text; send({ delta: ev.event.delta.text }) }
        else if (ev.type === 'stream_event' && ev.event?.type === 'content_block_start' && ev.event.content_block?.type === 'tool_use') send({ tool: friendlyTool(ev.event.content_block.name) }) // #353
        else if (ev.type === 'result' && ev.session_id) { thread.sessionId = ev.session_id; save(store) }
      }
    })
    proc.stderr.on('data', (d) => (err += d))
    proc.on('error', (e) => { if (!done) { clearTimeout(killer); send({ error: 'coach unavailable: ' + e.message }); end() } })
    proc.on('close', () => {
      clearTimeout(killer)
      // Stale-session recovery: clear the bad id and retry fresh, once, before surfacing anything.
      if (!isRetry && resume && !sawOutput && /no conversation found|session id/i.test(err)) {
        thread.sessionId = null; save(store); return run(false, true)
      }
      if (err && !sawOutput) send({ error: err.slice(0, 200) })
      end()
    })
    // Kill claude only if the CLIENT actually disconnects (res close) — NOT req close, which fires
    // the moment the request body is read and would kill it early.
    res.on('close', () => { if (!done) { clearTimeout(killer); proc.kill('SIGKILL') } })
  }
  run(true, false)
})
// Reset the per-user conversation thread.
// #363 — "reset" now starts a NEW conversation (a fresh thread), leaving past ones in the history.
app.post('/auth/chat/reset', auth, (req, res) => { ensureThreads(req.user); const t = { id: newId(), title: '', sessionId: null, msgs: [], createdAt: Date.now(), updatedAt: Date.now() }; req.user.chatThreads.unshift(t); req.user.chatThreadId = t.id; req.user.chatMsgs = []; delete req.user.chatSession; save(store); res.json({ ok: true, id: t.id }) })

// ---- coach REST API (Bearer token) ---------------------------------------
// The cyclingcoach dual-writes each session here (rich execution detail) and to
// intervals.icu (calendar/load), linked by the shared `id` it provides. See /api/docs.
function apiAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const u = t && store.users.find((x) => x.apiToken === t)
  if (!u) return res.status(401).json({ error: 'invalid api token' })
  req.user = u; next()
}
function plansInRange(u, from, to) {
  let p = u.plans || []
  if (from) p = p.filter((x) => x.date >= from)
  if (to) p = p.filter((x) => x.date <= to)
  return p.sort((a, b) => (a.date < b.date ? -1 : 1))
}
function validatePlan(b) {
  if (!b || typeof b !== 'object') return 'body must be a JSON object'
  if (!b.id || typeof b.id !== 'string') return 'id (string, your shared id) is required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return 'date (YYYY-MM-DD) is required'
  if (!['gym', 'ride', 'run'].includes(b.sport)) return "sport must be 'gym' | 'ride' | 'run'"
  if (!b.title || typeof b.title !== 'string') return 'title (string) is required'
  return null
}

// --- Platyplus -> intervals.icu push (the fan-out; coach only writes here) --
const ICU_API = 'https://intervals.icu/api/v1'
function icuFetch(user, path, opts = {}) {
  return fetch(ICU_API + path, { ...opts, headers: { authorization: 'Basic ' + Buffer.from('API_KEY:' + user.icuKey).toString('base64'), 'content-type': 'application/json', accept: 'application/json', ...(opts.headers || {}) } })
}
// Render the coach's structured brief (objective, fueling + the day's meals, mind +
// the day's session, recovery, success, cues) into the intervals event description,
// so intervals.icu MIRRORS the full plan even though Platyplus is the master. Meals/
// mind are separate calendar items (passed in for plan.date); each carries its own
// per-pick `why`, the plan carries the strategy `why`. Returns '' when there's nothing.
function renderCoachBrief(plan, items = []) {
  const L = []
  if (plan.objective) L.push(`Objective: ${plan.objective}`)
  const meals = items.filter((it) => it.type === 'meal')
  if (plan.fuel?.why || plan.fuel?.supplements || meals.length) {
    L.push('\n## Fueling')
    if (plan.fuel?.why) L.push(plan.fuel.why)
    for (const m of meals) L.push(`• ${m.mealType ? m.mealType + ': ' : ''}${m.title}${m.kcal ? ` (${m.kcal} kcal)` : ''}${m.why ? ` — ${m.why}` : ''}`)
    if (plan.fuel?.supplements) L.push(`Supplements: ${plan.fuel.supplements}`)
  }
  const mind = items.filter((it) => it.type === 'mind')
  if (plan.mind?.why || mind.length) {
    L.push('\n## Mind')
    if (plan.mind?.why) L.push(plan.mind.why)
    for (const s of mind) L.push(`• ${s.title}${s.minutes ? ` (${s.minutes} min)` : ''}${s.why ? ` — ${s.why}` : ''}`)
  }
  if (plan.recovery) L.push(`\n## Recovery\n${plan.recovery}`)
  if (plan.success) L.push(`\n## Success\n${plan.success}`)
  if (Array.isArray(plan.cues) && plan.cues.length) L.push(`\n## Cues\n${plan.cues.map((c) => `• ${c}`).join('\n')}`)
  return L.length ? L.join('\n') + '\n\n— authored in Platyplus' : ''
}
// #157 — a SHORT coaching note (below a divider) instead of the full brief dump; the full plan lives in Platyplus.
function shortCoachNote(plan) {
  const L = []
  if (plan.objective) L.push(`Objective: ${plan.objective}`)
  if (plan.fuel?.why) L.push(`Fuel: ${plan.fuel.why}`)
  if (Array.isArray(plan.cues) && plan.cues.length) L.push(`Cues: ${plan.cues.join('; ')}`)
  L.push(`Full plan · meals · mind → ${ORIGIN}/coach/${encodeURIComponent(plan.id)}`)
  return '\n─────────── coach notes ───────────\n' + L.join('\n')
}
// intervals/Wahoo won't render a single step longer than this — split + interpolate.
// Map a plan to an intervals calendar event. Rides carry POWER (%ftp) steps, runs carry PACE
// (%pace) steps (#312) so intervals pushes a real interval workout to the head unit / Garmin.
function planToIcuEvent(plan, items = []) {
  const brief = renderCoachBrief(plan, items)
  const ev = { start_date_local: plan.date + 'T00:00:00', category: 'WORKOUT', name: plan.title, external_id: plan.id, description: '' }
  if (plan.sport === 'ride' || plan.sport === 'run') {
    const segs = clampEasyEfforts(plan.title, plan.segments || []).segments // #331c last-line guard on the push (covers pre-guard plans on re-sync)
    ev.type = plan.sport === 'ride' ? 'Ride' : 'Run'
    ev.moving_time = segs.reduce((s, x) => s + (Number(x.duration) || 0), 0)
    // #372 — supply the planned LOAD (Coggan TSS from the %targets) so intervals' Form/CTL/ATL PROJECTS the
    // fatigue. intervals doesn't compute planned load for API-created workouts, so ours stayed null → flat Form.
    const tss = plannedTss(segs)
    if (tss && tss.tss > 0) ev.icu_training_load = tss.tss
    // CRITICAL: intervals only MODELS a ride/run (chart, planned load, Wahoo steps) when the
    // event carries a top-level `time_target` (total seconds) alongside moving_time + workout_doc.
    // Without it the event stores UNMODELED → empty chart. (TODO P1f: also emit native workout
    // text for the chart, per cyclingcoach instructions_intervals_icu — verify parity before closing #14.)
    ev.time_target = ev.moving_time
    // Split any step > MAX (3600s) into interpolated chunks — a single over-long step makes the
    // intervals workout render EMPTY (matches cyclingcoach split_long_doc_step).
    const isRun = plan.sport === 'run'
    // #157 — native Warmup / Nx / Cooldown workout text (reads like a real intervals workout). RUNS parse
    // this text for the pace chart (#331), so each step keeps its "- Xm Y% pace" target. RIDES also carry
    // the structured workout_doc (the chart authority). The coaching brief is TRIMMED below a divider — the
    // full plan (meals/mind/recovery) stays in Platyplus via the link.
    const native = nativeWorkoutText(segs, isRun)
    if (!isRun && segs.length) ev.workout_doc = { steps: segs.flatMap((s) => encodeStep(s, false)) }
    ev.description = [native, stripPlatyplusLinks(plan.notes), shortCoachNote(plan)].filter(Boolean).join('\n\n')
  } else {
    ev.type = 'WeightTraining'
    // #301 — DON'T mirror gym structure as text (tempo/sets can't round-trip through intervals, which
    // has no gym model). Platyplus is the canonical home for the structured workout; intervals just gets
    // a deep LINK to open it in Platyplus, plus the coach's human notes.
    const link = `${ORIGIN}/coach/${encodeURIComponent(plan.id)}`
    ev.description = [`🏋️ Open workout in Platyplus → ${link}`, stripPlatyplusLinks(plan.notes), brief].filter(Boolean).join('\n\n')
  }
  return ev
}
// All intervals planned EVENTS that already represent this plan (incl. the other coach's copy,
// whose name carries a "#Codex Coach" suffix — matched fuzzily). See server/icu-match.js (#150).
async function findIcuEventsForPlan(user, plan) {
  const ath = user.icuAthlete || 'i28814'
  try {
    const r = await icuFetch(user, `/athlete/${ath}/events?oldest=${plan.date}&newest=${plan.date}`)
    if (!r.ok) return []
    const events = await r.json()
    return (events || []).filter((e) => eventMatchesPlan(plan, e))
  } catch { return [] }
}
const icuToday = () => { try { return new Date().toLocaleDateString('en-CA') } catch { return new Date().toISOString().slice(0, 10) } }
const stripIcuInstance = (s) => String(s || '').replace(/:\d{4}-\d{2}-\d{2}$/, '')
// Mirror a plan to intervals — self-healing, Platyplus is the MASTER (#150):
//   • COLLAPSE duplicates: events carrying our external_id (incl. intervals' ":date" instance
//     copy) are the same session pushed twice → keep ONE, delete the extras.
//   • PAST: keep NO planned event in the past — delete ours; never create.
//   • else update our event (or adopt a foreign one — the other coach's — without duplicating).
async function pushPlanToIcu(user, plan) {
  if (!user.icuKey) return { skipped: 'no intervals key' }
  const ath = user.icuAthlete || 'i28814'
  const delEvent = async (id) => { try { await icuFetch(user, `/athlete/${ath}/events/${id}`, { method: 'DELETE' }) } catch { /* best effort */ } }
  const mineId = plan.icuEventId ? String(plan.icuEventId) : null

  const matches = await findIcuEventsForPlan(user, plan)
  // #381 — the event may have been MOVED to another day IN intervals; findIcuEventsForPlan only searches
  // plan.date, so it wouldn't find it → case (3) would CREATE A DUPLICATE (JM saw the gym on two days).
  // Also fetch our known event by id (any date) so we UPDATE+move the existing one instead of duplicating.
  if (mineId && !matches.some((e) => String(e.id) === mineId)) {
    try { const rr = await icuFetch(user, `/athlete/${ath}/events/${mineId}`); if (rr.ok) { const em = await rr.json(); if (em && em.id) matches.push(em) } } catch { /* event gone — fall through to create */ }
  }
  // OUR events = external_id matches this plan's id — either exactly, or minus the ":date" instance
  // suffix. (#301 mirror fix: some ids already END in a date, so the stripped form wouldn't match and
  // the event was mis-read as "foreign" → never updated.)
  let ours = matches.filter((e) => e.external_id && (e.external_id === plan.id || stripIcuInstance(e.external_id) === plan.id))
  if (ours.length > 1) { // collapse the instance-suffix duplicate(s) → keep one
    const keep = ours.find((e) => String(e.id) === mineId) || ours[0]
    for (const e of ours) if (String(e.id) !== String(keep.id)) await delEvent(e.id)
    ours = [keep]
  }
  const mine = ours[0] || null
  const foreign = matches.find((e) => !ours.includes(e)) // a different event for the same session

  // (1) PAST: Platyplus keeps no planned event in the past — delete ours, never create.
  if (plan.date < icuToday()) {
    if (mine) await delEvent(mine.id)
    if (plan.icuEventId) { plan.icuEventId = undefined; plan.icuEventMine = undefined; save(store) }
    return { skipped: 'past' }
  }
  // (2) None of our own but the session already exists (e.g. the retired cyclingcoach's event) →
  // ADOPT it and UPDATE it so Platyplus's content (incl. the #301 gym link) mirrors. cyclingcoach is
  // retired → Platyplus is the sole writer now, so it's safe to take over the event.
  if (!mine && foreign) {
    const evF = planToIcuEvent(plan, (user.items || []).filter((it) => it.date === plan.date))
    const r = await icuFetch(user, `/athlete/${ath}/events/${foreign.id}`, { method: 'PUT', body: JSON.stringify(evF) }).catch(() => null)
    plan.icuEventId = foreign.id; plan.icuEventMine = true; save(store)
    return (r && r.ok) ? { updated: foreign.id } : { exists: foreign.id }
  }
  // (3) Update OUR event, else create one.
  const ev = planToIcuEvent(plan, (user.items || []).filter((it) => it.date === plan.date))
  const targetId = mine ? String(mine.id) : null
  try {
    if (targetId) {
      const r = await icuFetch(user, `/athlete/${ath}/events/${targetId}`, { method: 'PUT', body: JSON.stringify(ev) })
      if (r.ok) { plan.icuEventId = targetId; plan.icuEventMine = true; save(store); return { updated: targetId } }
      if (r.status !== 404) return { error: `update ${r.status}` }
    }
    const r = await icuFetch(user, `/athlete/${ath}/events`, { method: 'POST', body: JSON.stringify(ev) })
    if (!r.ok) return { error: `create ${r.status}` }
    const created = await r.json()
    plan.icuEventId = created.id; plan.icuEventMine = true; save(store)
    return { created: created.id }
  } catch (e) { return { error: String(e.message || e) } }
}
async function deleteIcuEvent(user, plan) {
  if (!user.icuKey || !plan?.icuEventId) return
  try { await icuFetch(user, `/athlete/${user.icuAthlete || 'i28814'}/events/${plan.icuEventId}`, { method: 'DELETE' }) } catch { /* best effort */ }
}
// #297 — guarantee a TEMPO on strength lifts (default 3-1-1-0) so the chip always shows, even when
// the coach LLM omits it. Only reps-mode (loaded) lifts; timed/mobility holds keep no tempo.
function withDefaultTempo(x) {
  if (!x || typeof x !== 'object') return x
  if ((x.mode || 'reps') === 'reps' && (!x.tempo || !String(x.tempo).trim())) return { ...x, tempo: '3-1-1-0' }
  return x
}
// Shared upsert/delete for workout plans (used by both the coach API and the UI).
async function upsertPlan(user, body, actor = 'coach') {
  const err = validatePlan(body); if (err) return { status: 400, body: { error: err } }
  const i = user.plans.findIndex((p) => p.id === body.id)
  // #371 — ENFORCE the athlete's max sessions/day for COACH-created plans (the UI path uses actor 'you' and
  // is exempt — a person can double-book if they want). Instruction alone drifted: the coach was stacking two
  // same-sport rides on a day (max 1). REJECT a NEW session on a day already at the cap → it must COMBINE into
  // the existing session (same id = update) or move to a free day. Doesn't block updates (same id).
  if (actor === 'coach' && i < 0) {
    const maxPerDay = Math.max(1, Number(user.info?.maxPerDay) || 1)
    const sameDay = (user.plans || []).filter((p) => p.date === body.date)
    if (sameDay.length >= maxPerDay) {
      return { status: 409, body: { error: `Rejected — ${body.date} already has ${sameDay.length} session(s) and the athlete's max is ${maxPerDay}/day (${sameDay.map((p) => `"${p.title}"`).join(', ')}). Do NOT stack sessions: either COMBINE this into that day's existing session (re-call create_* with THAT session's id to make it one longer/richer workout) or move it to a free day. Two short rides of the same sport should be ONE session, not two.` } }
    }
  }
  const plan = {
    id: body.id, date: body.date, sport: body.sport, title: body.title,
    notes: body.notes || '', updatedAt: Date.now(),
    // Structured coaching (all optional, additive). Meals/mind are separate
    // calendar items (with their own per-pick `why`); these are the plan-level
    // strategy + cues. The plan view joins the day's items by date.
    objective: typeof body.objective === 'string' ? body.objective : '',
    cues: Array.isArray(body.cues) ? body.cues.filter((c) => typeof c === 'string') : [],
    tip: typeof body.tip === 'string' ? body.tip.slice(0, 400) : '', // #284 session-level tip (e.g. tempo/rest focus)
    success: typeof body.success === 'string' ? body.success : '',
    recovery: typeof body.recovery === 'string' ? body.recovery : '',
    fuel: body.fuel && typeof body.fuel === 'object' ? { why: String(body.fuel.why || ''), supplements: String(body.fuel.supplements || '') } : undefined,
    mind: body.mind && typeof body.mind === 'object' ? { why: String(body.mind.why || '') } : undefined,
    origin: i >= 0 ? (user.plans[i].origin || 'platyplus') : 'platyplus',
    icuEventId: i >= 0 ? user.plans[i].icuEventId : undefined,
    ...(body.sport === 'gym'
      ? { rounds: Number(body.rounds) || 1, exercises: (Array.isArray(body.exercises) ? body.exercises : []).map(withDefaultTempo) }
      : { ftp: Number(body.ftp) || undefined, segments: Array.isArray(body.segments) ? body.segments : [] }),
  }
  // #331c — HARD guard: never persist an "easy/recovery/warm-up"-labelled run/ride segment at near-threshold
  // effort (95% is NEVER easy — any sport). Fixes it at the source so the DB, the app view, AND the intervals
  // push are all sane, even when the coach fat-fingers the %.
  if (plan.sport !== 'gym' && Array.isArray(plan.segments) && plan.segments.length) {
    const g = clampEasyEfforts(plan.title, plan.segments)
    if (g.clamped) { plan.segments = g.segments; console.log(`[clampEasyEfforts] ${user.username} "${plan.title}" — clamped ${g.clamped} easy segment(s) below ${'threshold'}`) }
  }
  if (i >= 0) user.plans[i] = plan; else user.plans.push(plan)
  audit(user, { actor, action: i >= 0 ? 'Updated' : 'Created', target: plan.title, detail: `${plan.sport}${plan.date ? ' · ' + plan.date : ''} · mirrored to intervals`, kind: 'plan' }) // #232
  save(store)
  const icu = await pushPlanToIcu(user, plan)
  return { status: i >= 0 ? 200 : 201, body: { ...plan, icu } }
}
async function deletePlanById(user, id, actor = 'coach') {
  const plan = (user.plans || []).find((x) => x.id === id)
  await deleteIcuEvent(user, plan)
  user.plans = (user.plans || []).filter((x) => x.id !== id)
  // Cascade: drop any completed log tied to this plan so removing a workout can't
  // leave a phantom "completed" session behind (#197). Match by workoutId === plan id.
  if (Array.isArray(user.logs) && user.logs.some((l) => l.workoutId === id)) {
    user.logs = user.logs.filter((l) => l.workoutId !== id)
  }
  if (plan) audit(user, { actor, action: 'Removed', target: plan.title, detail: `${plan.sport}${plan.date ? ' · ' + plan.date : ''}`, kind: 'plan' }) // #232
  save(store)
}

// --- intervals.icu -> Platyplus import (reconcile) -------------------------
// The mirror is Platyplus-first + PLATYPLUS-WINS: plans created here push OUT to
// intervals (above). Workouts that originate IN intervals.icu are imported ONCE
// into user.plans and thereafter OWNED by Platyplus (its later edits push back
// over intervals). This function only READS intervals and writes to our own store
// — it never mutates the intervals calendar, so it is safe to run repeatedly.
// (Step resolve/flatten — incl. the "5 W" power_zone fix + #312 pace read — live in ./icu-steps.js.)
function icuEventToPlan(ev) {
  const date = String(ev.start_date_local || '').slice(0, 10)
  const sport = ev.type === 'Ride' ? 'ride' : ev.type === 'Run' ? 'run' : 'gym'
  const plan = { id: ev.external_id || `icu-${ev.id}`, date, sport, title: ev.name || 'Workout', notes: stripPlatyplusLinks(ev.description || ''), origin: 'icu', icuEventId: ev.id, updatedAt: Date.now() }
  if (sport === 'ride' || sport === 'run') {
    plan.segments = flattenIcuStepsSrv(ev.workout_doc?.steps || [])
  } else {
    plan.rounds = 1; plan.exercises = [] // gym structure stays in notes; the client parses it
  }
  return plan
}
async function reconcileFromIcu(user, from, to) {
  if (!user.icuKey) return { skipped: 'no intervals key' }
  const ath = user.icuAthlete || 'i28814'
  let events
  try {
    const r = await icuFetch(user, `/athlete/${ath}/events?oldest=${from}&newest=${to}`)
    if (!r.ok) return { error: `fetch ${r.status}` }
    events = await r.json()
  } catch (e) { return { error: String(e.message || e) } }
  user.plans = user.plans || []
  const liveIcuIds = new Set((events || []).map((e) => e.id))
  const ownedIcuIds = new Set(user.plans.map((p) => p.icuEventId).filter(Boolean))
  // intervals appends a ":YYYY-MM-DD" instance suffix to external_id on recurring /
  // re-pushed events; strip it so an event still matches the plan it came from.
  const stripInstance = (s) => String(s || '').replace(/:\d{4}-\d{2}-\d{2}$/, '')
  const planIds = new Set(user.plans.map((p) => p.id))
  // PLATYPLUS-WINS dedup key: same day + sport + title ⇒ it's the same session.
  const planKey = (date, sport, title) => `${date}|${sport}|${String(title || '').trim().toLowerCase()}`
  const planKeys = new Set(user.plans.map((p) => planKey(p.date, p.sport, p.title)))
  let imported = 0, refreshed = 0
  for (const ev of events || []) {
    if (ev.category && ev.category !== 'WORKOUT') continue
    if (!['Ride', 'Run', 'WeightTraining'].includes(ev.type)) continue
    if (ownedIcuIds.has(ev.id)) {
      // We already have this event as a plan — REFRESH its derived fields from intervals so
      // edits to the workout (and the #217 power_zone fix) propagate. icu-origin ONLY:
      // platyplus-origin plans are master and never overwritten. Completion/feedback untouched.
      const existing = user.plans.find((p) => p.icuEventId === ev.id)
      if (existing) {
        // #380 — a MOVE made IN intervals WINS FOR THE DAY (JM's pick): adopt the new date so a reschedule
        // done on the intervals calendar mirrors back to Platyplus. Applies to EVERY origin (incl. gym — the
        // #377 skip is only for NEW-shell imports, not a date-refresh of an already-owned plan). Content
        // (exercises/steps/title) stays Platyplus-owned unless the plan itself originated in intervals.
        const icuDate = String(ev.start_date_local || '').slice(0, 10)
        if (icuDate && icuDate !== existing.date) { existing.date = icuDate; existing.updatedAt = Date.now(); refreshed++ }
        if (existing.origin === 'icu') {
          const fresh = icuEventToPlan(ev)
          const sig = (p) => JSON.stringify([p.title, p.notes, p.segments])
          if (sig(existing) !== sig(fresh)) { existing.title = fresh.title; existing.notes = fresh.notes; existing.segments = fresh.segments; existing.updatedAt = Date.now(); refreshed++ }
        }
      }
      continue
    }
    // Shares our plan id (with or without the ":date" instance suffix) → skip.
    const extId = stripInstance(ev.external_id)
    if (ev.external_id && (planIds.has(ev.external_id) || planIds.has(extId))) continue
    // A plan already exists for this day+sport+title → Platyplus wins, don't re-import a copy.
    const date = String(ev.start_date_local || '').slice(0, 10)
    const sport = ev.type === 'Ride' ? 'ride' : ev.type === 'Run' ? 'run' : 'gym'
    if (planKeys.has(planKey(date, sport, ev.name))) continue
    // #377 — our OWN gym session (it carries the Platyplus deep-link): the real exercises live in
    // Platyplus, intervals has no gym model, so importing it here would fabricate an EMPTY-exercise shell
    // (and, cross-env, shadow the origin env's real plan). Skip — Platyplus is canonical for gym.
    if (sport === 'gym' && /Open workout in Platyplus/i.test(ev.description || '')) continue
    const plan = icuEventToPlan(ev)
    user.plans.push(plan); imported++
    planIds.add(plan.id); planKeys.add(planKey(plan.date, plan.sport, plan.title)) // guard against dups within this batch too
  }
  // Deletion mirror (#150) + replaced-plan cleanup (#185): drop a stored plan whose
  // intervals mirror is gone — icu-origin always, platyplus-origin ONLY when a live
  // (replacement) WORKOUT event now occupies the same day+sport (the coach republished
  // it under a new title). A pure intervals deletion with no replacement is kept, so
  // Platyplus stays master for plans it solely owns. See planDroppedByReconcile.
  const liveSlots = new Set((events || [])
    .filter((e) => (!e.category || e.category === 'WORKOUT') && ['Ride', 'Run', 'WeightTraining'].includes(e.type))
    .map((e) => slotKey(String(e.start_date_local || '').slice(0, 10), eventSport(e.type))))
  const before = user.plans.length
  user.plans = user.plans.filter((p) => !planDroppedByReconcile(p, { liveIds: liveIcuIds, liveSlots, from, to }))
  const dropped = before - user.plans.length
  if (imported || dropped) audit(user, { actor: 'sync', action: 'Synced from intervals', target: '', detail: [imported && `${imported} imported`, dropped && `${dropped} removed`, refreshed && `${refreshed} refreshed`].filter(Boolean).join(' · '), kind: 'sync' }) // #232
  if (imported || dropped || refreshed) save(store)
  return { imported, dropped, refreshed, scanned: (events || []).length }
}

// ---- calendar items (meal/mind/note) — shared by the UI (/auth) and API (/api).
function itemsInRange(user, from, to) {
  let items = user.items || []
  if (from) items = items.filter((x) => x.date >= from)
  if (to) items = items.filter((x) => x.date <= to)
  return items.sort((a, b) => (a.date < b.date ? -1 : 1))
}
function validateItem(b) {
  if (!b || typeof b !== 'object') return 'body must be a JSON object'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return 'date (YYYY-MM-DD) is required'
  if (!['meal', 'mind', 'note', 'recovery', 'supplement'].includes(b.type)) return "type must be 'meal' | 'mind' | 'note' | 'recovery' | 'supplement'"
  return null
}
function upsertItem(user, b) {
  const err = validateItem(b); if (err) return { status: 400, body: { error: err } }
  user.items = user.items || []
  const item = { id: b.id || newId(), date: b.date, type: b.type, title: b.title || '', refId: b.refId || '', mealType: b.mealType || '', kind: b.kind || '', kcal: b.kcal, minutes: b.minutes, notes: b.notes || '', why: typeof b.why === 'string' ? b.why : '', updatedAt: Date.now() }
  const i = user.items.findIndex((x) => x.id === item.id)
  if (i >= 0) user.items[i] = item; else user.items.push(item)
  save(store)
  return { status: i >= 0 ? 200 : 201, body: item }
}
function deleteItemById(user, id) {
  user.items = (user.items || []).filter((x) => x.id !== id); save(store)
}

// ---- exercise catalog (read-only) — lets the coach API resolve real exIds.
// Loaded once from CATALOG_DIR (the synced generated catalog); empty if absent.
let EXERCISES = []
;(() => {
  try {
    const cdir = process.env.CATALOG_DIR || join(__dirname, '..', 'src', 'data', 'generated')
    const p = join(cdir, 'exercises.json')
    if (existsSync(p)) { EXERCISES = JSON.parse(readFileSync(p, 'utf8')); console.log(`catalog: ${EXERCISES.length} exercises from ${p}`) }
    else console.log(`catalog: no exercises.json at ${p} — /api/exercises returns empty`)
  } catch (e) { console.log('catalog load failed:', e.message) }
})()
function searchExercises(q, limit, equipment) {
  const n = String(q || '').trim().toLowerCase()
  const eq = equipment ? String(equipment).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : null
  let list = n ? EXERCISES.filter((e) => e.name.toLowerCase().includes(n)) : EXERCISES
  if (eq) list = list.filter((e) => e.equipment && eq.includes(e.equipment.toLowerCase())) // owned-equipment filter
  return list.slice(0, Math.min(Number(limit) || 20, 100)).map((e) => ({ id: e.id, name: e.name, category: e.category, equipment: e.equipment, image: e.image, video: e.video }))
}
// Recipe + mind/movement catalogs — let the coach PICK real Platyplus content by id
// (for fuel meals + meditation/yoga/pilates sessions), mirroring the exercise catalog.
let RECIPES = [], MIND = []
;(() => {
  try {
    const cdir = process.env.CATALOG_DIR || join(__dirname, '..', 'src', 'data', 'generated')
    const rp = join(cdir, 'recipes.json'); if (existsSync(rp)) { RECIPES = JSON.parse(readFileSync(rp, 'utf8')); console.log(`catalog: ${RECIPES.length} recipes`) }
    const mp = join(cdir, 'mind.json'); if (existsSync(mp)) { MIND = JSON.parse(readFileSync(mp, 'utf8')); console.log(`catalog: ${MIND.length} mind/movement sessions`) }
  } catch (e) { console.log('recipe/mind catalog load failed:', e.message) }
})()
// Diet gate (#40): a vegetarian athlete may only get vegetarian+vegan recipes; a
// vegan only vegan; anything else = no restriction. Enforced HERE so the coach
// physically cannot pick a non-conforming meal, not just asked to.
function dietAllows(pref, recipeDiet) {
  const p = String(pref || '').toLowerCase()
  const d = String(recipeDiet || 'omnivore').toLowerCase()
  if (p === 'vegan') return d === 'vegan'
  if (p === 'vegetarian') return d === 'vegetarian' || d === 'vegan'
  return true // 'no preference' / unset
}
function searchRecipes(q, limit, category, diet) {
  const n = String(q || '').trim().toLowerCase()
  let list = RECIPES.filter((r) => dietAllows(diet, r.diet))
  if (category) list = list.filter((r) => String(r.category || '').toLowerCase() === String(category).toLowerCase())
  if (n) list = list.filter((r) => r.title.toLowerCase().includes(n) || (r.tags || []).some((t) => String(t).toLowerCase().includes(n)))
  return list.slice(0, Math.min(Number(limit) || 20, 100)).map((r) => ({ id: r.id, title: r.title, category: r.category, kcal: r.kcal, protein: r.protein, minutes: r.minutes, diet: r.diet }))
}
function searchSessions(q, limit, kind) {
  const n = String(q || '').trim().toLowerCase()
  let list = MIND
  if (kind) list = list.filter((m) => String(m.kind || '').toLowerCase() === String(kind).toLowerCase())
  if (n) list = list.filter((m) => m.title.toLowerCase().includes(n) || String(m.summary || '').toLowerCase().includes(n))
  return list.slice(0, Math.min(Number(limit) || 20, 100)).map((m) => ({ id: m.id, title: m.title, kind: m.kind, duration: m.duration }))
}

// Upsert a planned session by id (idempotent — re-POST to update).
app.post('/api/plan', apiAuth, async (req, res) => { const r = await upsertPlan(req.user, req.body); res.status(r.status).json(r.body) })
app.get('/api/plans', apiAuth, (req, res) => res.json(plansInRange(req.user, req.query.from, req.query.to)))
app.get('/api/plan/:id', apiAuth, (req, res) => { const p = (req.user.plans || []).find((x) => x.id === req.params.id); return p ? res.json(p) : res.status(404).json({ error: 'not found' }) })
app.delete('/api/plan/:id', apiAuth, async (req, res) => { await deletePlanById(req.user, req.params.id); res.json({ ok: true }) })
app.get('/api/strava/activities', apiAuth, async (req, res) => {
  if (!userStravaConnected(req.user)) return res.json([])
  try { res.json(await stravaActivities(req.user, Number(req.query.limit) || 15, () => save(store))) }
  catch (e) { res.status(502).json({ error: String(e.message || e) }) }
})

// --- intervals.icu READ-THROUGH (for the coach) ---------------------------
// The coach reads analytics LIVE from intervals (we don't store/clone any of it).
// Scoped to the user's stored key; returns { connected:false } gracefully if they
// haven't connected intervals.icu, so the coach adapts with what it has.
async function icuGet(user, path) {
  if (!user.icuKey) return null
  try { const r = await icuFetch(user, path); return r.ok ? await r.json() : null } catch { return null }
}
const icuDay = (n = 0) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

// ---- Completed-activity capture → intervals (MATCH-FIRST, #122/#123) -------------
// The locked data-flow model (FEEDBACK-LOG.md → 🎨 Design reference): intervals = read hub; Platyplus always
// keeps the local copy; for in-app workouts, check intervals for a device activity
// first (match → don't duplicate), else upload our own. No Strava dependency.
const tcxSport = (s) => /ride|cycl|bike/i.test(s) ? 'Biking' : /run/i.test(s) ? 'Running' : 'Other'
function tcxFromSamples(samples, { sport, startIso, durationSec }) {
  const t0 = new Date(startIso).getTime()
  const pts = (samples || []).map((s) => {
    const time = new Date(t0 + (s.t || 0) * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
    let x = `<Trackpoint><Time>${time}</Time>`
    if (s.hr != null) x += `<HeartRateBpm><Value>${Math.round(s.hr)}</Value></HeartRateBpm>`
    if (s.cadence != null) x += `<Cadence>${Math.round(s.cadence)}</Cadence>`
    if (s.power != null) x += `<Extensions><ns3:TPX><ns3:Watts>${Math.round(s.power)}</ns3:Watts></ns3:TPX></Extensions>`
    return x + '</Trackpoint>'
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Activities><Activity Sport="${tcxSport(sport)}"><Id>${startIso}</Id><Lap StartTime="${startIso}"><TotalTimeSeconds>${Math.round(durationSec)}</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${pts}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`
}
// Find a device activity already in intervals for this day+sport (so we don't dup).
async function icuFindMatch(user, { date, sport }) {
  const ath = user.icuAthlete || 'i28814'
  const acts = await icuGet(user, `/athlete/${ath}/activities?oldest=${date}&newest=${date}`)
  if (!Array.isArray(acts)) return null
  const want = /ride|cycl|bike/i.test(sport) ? /ride|cycl|bike/i : /run/i.test(sport) ? /run/i : /weight|strength|workout/i
  return acts.find((a) => want.test(String(a.type || ''))) || null
}
async function icuUploadTcx(user, tcx, name) {
  const ath = user.icuAthlete || 'i28814'
  const fd = new FormData()
  fd.append('file', new Blob([tcx], { type: 'application/xml' }), `${String(name).replace(/[^\w-]/g, '_').slice(0, 40)}.tcx`)
  const r = await fetch(`${ICU_API}/athlete/${ath}/activities`, {
    method: 'POST', body: fd,
    headers: { authorization: 'Basic ' + Buffer.from('API_KEY:' + user.icuKey).toString('base64') },
  })
  if (!r.ok) throw new Error(`icu upload ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.json().catch(() => ({}))
}

// A Platyplus-recorded workout finished. Keep the local copy (client already logged it);
// fan out to intervals match-first. Body: {sport, title, date, startIso, durationSec, samples[]}.
app.post('/auth/activity/complete', auth, async (req, res) => {
  const b = req.body || {}
  const date = String(b.date || '').slice(0, 10)
  const sport = String(b.sport || 'ride').slice(0, 20)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date required' })
  if (!req.user.icuKey) return res.json({ status: 'local-only' }) // no intervals → lives in Platyplus
  try {
    const match = await icuFindMatch(req.user, { date, sport })
    if (match) return res.json({ status: 'matched', icuId: match.id }) // device recorded it → don't dup
    const samples = Array.isArray(b.samples) ? b.samples.slice(0, 60000) : []
    if (!samples.length) return res.json({ status: 'no-stream' }) // nothing to upload (e.g. gym handled separately)
    const startIso = typeof b.startIso === 'string' ? b.startIso : new Date(date + 'T12:00:00Z').toISOString()
    const tcx = tcxFromSamples(samples, { sport, startIso, durationSec: Number(b.durationSec) || samples.length })
    const up = await icuUploadTcx(req.user, tcx, b.title || sport)
    res.json({ status: 'uploaded', icuId: up?.id ?? up?.activity?.id ?? null })
  } catch (e) {
    res.json({ status: 'error', error: String(e).slice(0, 160) })
  }
})

// Upload a RAW activity file (.fit/.gpx/.tcx) straight to intervals — best fidelity.
async function icuUploadRaw(user, buffer, filename) {
  const ath = user.icuAthlete || 'i28814'
  const fd = new FormData()
  fd.append('file', new Blob([buffer]), String(filename || 'activity').replace(/[^\w.\-]/g, '_').slice(0, 60))
  const r = await fetch(`${ICU_API}/athlete/${ath}/activities`, {
    method: 'POST', body: fd,
    headers: { authorization: 'Basic ' + Buffer.from('API_KEY:' + user.icuKey).toString('base64') },
  })
  if (!r.ok) throw new Error(`icu upload ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.json().catch(() => ({}))
}
// Build a minimal TCX from entered totals (manual entry, no file) so intervals gets
// duration/distance + avg HR/power.
function tcxManual({ sport, startIso, durationSec, distanceM, avgHr, avgPower }) {
  const t0 = new Date(startIso).getTime()
  const dur = Math.max(1, Math.round(durationSec || 1))
  const mk = (offset) => {
    const time = new Date(t0 + offset * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
    let x = `<Trackpoint><Time>${time}</Time>`
    if (avgHr != null) x += `<HeartRateBpm><Value>${Math.round(avgHr)}</Value></HeartRateBpm>`
    if (avgPower != null) x += `<Extensions><ns3:TPX><ns3:Watts>${Math.round(avgPower)}</ns3:Watts></ns3:TPX></Extensions>`
    return x + '</Trackpoint>'
  }
  const hrLap = avgHr != null ? `<AverageHeartRateBpm><Value>${Math.round(avgHr)}</Value></AverageHeartRateBpm>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Activities><Activity Sport="${tcxSport(sport)}"><Id>${startIso}</Id><Lap StartTime="${startIso}"><TotalTimeSeconds>${dur}</TotalTimeSeconds><DistanceMeters>${Math.round(distanceM || 0)}</DistanceMeters>${hrLap}<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${mk(0)}${mk(dur)}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`
}

// Parse an uploaded activity file → summary + GPS track, to prefill manual entry.
// Body: { name, b64 }. Pure parse — no storage, no intervals call.
app.post('/auth/activity/parse', auth, async (req, res) => {
  try {
    const { name, b64 } = req.body || {}
    if (!b64) return res.status(400).json({ error: 'file required' })
    const buffer = Buffer.from(String(b64), 'base64')
    if (buffer.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'file too large (25MB max)' })
    res.json(await parseActivityFile(name || 'activity', buffer))
  } catch (e) { res.status(422).json({ error: String(e.message || e).slice(0, 200) }) }
})

// Manual activity entry (with or without a file). The local Platyplus copy is already
// saved via /logs; here we fan out to intervals match-first: upload the raw file
// (best fidelity) or a summary TCX built from the entered totals. Body:
// {sport,title,date,startIso,durationSec,distanceM,avgHr,avgPower, file?:{name,b64}}.
app.post('/auth/activity/manual', auth, async (req, res) => {
  const b = req.body || {}
  const date = String(b.date || '').slice(0, 10)
  const sport = String(b.sport || 'other').slice(0, 20)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date required' })
  if (!req.user.icuKey) return res.json({ status: 'local-only' }) // no intervals → Platyplus-only
  try {
    const match = await icuFindMatch(req.user, { date, sport })
    if (match) return res.json({ status: 'matched', icuId: match.id }) // device already has it
    const startIso = typeof b.startIso === 'string' && b.startIso ? b.startIso : new Date(date + 'T12:00:00Z').toISOString()
    if (b.file && b.file.b64) {
      const buffer = Buffer.from(String(b.file.b64), 'base64')
      const up = await icuUploadRaw(req.user, buffer, b.file.name || `${sport}.fit`)
      return res.json({ status: 'uploaded', icuId: up?.id ?? up?.activity?.id ?? null })
    }
    const tcx = tcxManual({ sport, startIso, durationSec: Number(b.durationSec) || 0, distanceM: Number(b.distanceM) || 0, avgHr: b.avgHr != null ? Number(b.avgHr) : null, avgPower: b.avgPower != null ? Number(b.avgPower) : null })
    const up = await icuUploadTcx(req.user, tcx, b.title || sport)
    res.json({ status: 'uploaded', icuId: up?.id ?? up?.activity?.id ?? null })
  } catch (e) {
    res.json({ status: 'error', error: String(e).slice(0, 160) })
  }
})

app.get('/api/intervals/wellness', apiAuth, async (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 14))
  const data = await icuGet(req.user, `/athlete/${req.user.icuAthlete || 'i28814'}/wellness?oldest=${icuDay(days)}&newest=${icuDay(0)}`)
  if (!data) return res.json({ connected: false, wellness: [] })
  const wellness = (Array.isArray(data) ? data : []).map((d) => ({
    date: d.id, fitness: d.ctl, fatigue: d.atl, form: d.ctl != null && d.atl != null ? Math.round(d.ctl - d.atl) : null,
    restingHR: d.restingHR, hrv: d.hrv ?? d.hrvSDNN ?? null, sleepHours: d.sleepSecs ? +(d.sleepSecs / 3600).toFixed(1) : null, sleepScore: d.sleepScore ?? null, weight: d.weight ?? null,
  }))
  res.json({ connected: true, wellness })
})

// #341/#347 — geocode a CITY → { lat, lon } via Open-Meteo (free, no key). Disambiguates same-named
// cities (Montreal QC vs Spain/France) by matching the athlete's region/country.
async function geocodePlace(city, region, country) {
  if (!city) return null
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10`, { headers: { 'user-agent': 'platyplus/1.0' } })
    if (!r.ok) return null
    const res = (await r.json()).results || []
    if (!res.length) return null
    const norm = (s) => String(s || '').toLowerCase().trim()
    const hit = res.find((x) => region && norm(x.admin1) === norm(region))
      || res.find((x) => country && (norm(x.country) === norm(country) || norm(x.country_code) === norm(country)))
      || res[0]
    return Number.isFinite(hit.latitude) ? { lat: hit.latitude, lon: hit.longitude } : null
  } catch { return null }
}
// #341 — best-effort athlete location for weather. Order: (1) a saved location; (2) the intervals athlete
// PROFILE — direct lat/lng, else geocode its city (and stash the timezone, #347); (3) the most recent
// OUTDOOR activity's GPS. Cached. (JM: capture it in ONBOARDING too so it's reliable — separate item.)
async function athleteLatLon(user) {
  if (user.info && Number.isFinite(user.info.lat) && Number.isFinite(user.info.lon)) return { lat: user.info.lat, lon: user.info.lon }
  const ath = user.icuAthlete || 'i28814'
  const cache = (lat, lon) => { if (Number.isFinite(lat) && Number.isFinite(lon)) { user.info = user.info || {}; user.info.lat = lat; user.info.lon = lon; save(store); return { lat, lon } } return null }
  // (2) the intervals athlete profile — lat/lng directly, else geocode the city
  const me = await icuGet(user, `/athlete/${ath}`).catch(() => null)
  if (me) {
    if (me.timezone && !user.icuTimezone) { user.icuTimezone = me.timezone; save(store) } // #347 grab tz while here
    if (Number.isFinite(me.lat) && Number.isFinite(me.lng)) { const h = cache(me.lat, me.lng); if (h) return h }
    const g = me.city ? await geocodePlace(me.city, me.state, me.country) : null
    if (g) return cache(g.lat, g.lon)
  }
  const acts = await icuGet(user, `/athlete/${ath}/activities?oldest=${icuDay(60)}&newest=${icuDay(0)}`).catch(() => null)
  const list = Array.isArray(acts) ? acts : []
  for (const a of list) {
    const ll = Array.isArray(a.start_latlng) ? a.start_latlng : null
    const lat = ll ? ll[0] : (a.icu_lat ?? a.start_lat)
    const lon = ll ? ll[1] : (a.icu_lng ?? a.start_lng)
    const hit = cache(lat, lon); if (hit) return hit
  }
  const gps = list.find((a) => (a.distance || 0) > 0 && !a.trainer)
  if (gps) {
    const s = await icuGet(user, `/activity/${gps.id}/streams?types=latlng`).catch(() => null)
    const pts = Array.isArray(s) ? (s.find((x) => x.type === 'latlng') || {}).data : null
    if (Array.isArray(pts) && Array.isArray(pts[0])) return cache(pts[0][0], pts[0][1])
  }
  return null
}

// #341 — the day's forecast + coaching guidance for the athlete's location (Open-Meteo, FREE, no key).
app.get('/api/weather', apiAuth, async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : icuDay(0)
  const loc = await athleteLatLon(req.user).catch(() => null)
  if (!loc) return res.json({ available: false, needsLocation: true, reason: 'No location yet — ask the athlete where they train (city), or it fills in from their next GPS activity.' })
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${date}&end_date=${date}`
    const r = await fetch(url, { headers: { 'user-agent': 'platyplus/1.0' } })
    if (!r.ok) return res.json({ available: false, reason: `weather service ${r.status}` })
    const j = await r.json()
    const d = j.daily || {}
    const at = (k) => (Array.isArray(d[k]) ? d[k][0] : null)
    const g = weatherGuidance({ tMax: at('temperature_2m_max'), tApparentMax: at('apparent_temperature_max'), tMin: at('temperature_2m_min'), precipProb: at('precipitation_probability_max'), windMax: at('wind_speed_10m_max') })
    res.json({ available: true, date, ...g })
  } catch (e) { res.json({ available: false, reason: (e && e.message) || 'weather fetch failed' }) }
})

app.get('/api/intervals/activities', apiAuth, async (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 14))
  const data = await icuGet(req.user, `/athlete/${req.user.icuAthlete || 'i28814'}/activities?oldest=${icuDay(days)}&newest=${icuDay(0)}`)
  if (!data) return res.json({ connected: false, activities: [] })
  const activities = (Array.isArray(data) ? data : []).map((a) => ({
    date: (a.start_date_local || '').slice(0, 10), type: a.type, indoor: a.trainer === true || /virtual/i.test(a.type || ''),
    minutes: a.moving_time ? Math.round(a.moving_time / 60) : null, km: a.distance ? +(a.distance / 1000).toFixed(1) : null,
    avgHR: a.average_heartrate ? Math.round(a.average_heartrate) : null, avgW: a.icu_average_watts ? Math.round(a.icu_average_watts) : null,
    load: a.icu_training_load ?? null, intensity: a.icu_intensity ?? null, rpe: a.icu_rpe ?? null, feel: a.feel ?? null, name: a.name,
  }))
  res.json({ connected: true, activities })
})

// Daily check-ins (how the athlete reported feeling) — coach reads these.
app.get('/api/checkins', apiAuth, (req, res) => res.json(checkinsInRange(req.user, req.query.from, req.query.to)))

// Coach WRITES the athlete profile/sports (onboarding: interview → persist).
app.put('/api/profile/athlete', apiAuth, (req, res) => {
  const p = String(req.body?.profile ?? '')
  if (p.length > 60000) return res.status(413).json({ error: 'profile too long' })
  req.user.coachProfile = p; req.user.coachProfileAt = Date.now(); save(store)
  res.json({ ok: true, length: p.length })
})
// #256 port — coach WRITES its durable memory (learnings + coaching rules for this athlete).
app.put('/api/coach-memory', apiAuth, (req, res) => {
  const m = String(req.body?.memory ?? '')
  if (m.length > 40000) return res.status(413).json({ error: 'memory too long' })
  req.user.coachMemory = m; req.user.coachMemoryAt = Date.now(); save(store)
  res.json({ ok: true, length: m.length })
})
app.put('/api/profile', apiAuth, (req, res) => {
  if (Array.isArray(req.body?.sports)) req.user.sports = req.body.sports.filter((s) => typeof s === 'string').map((s) => s.toLowerCase().trim().slice(0, 20)).slice(0, 8)
  if (typeof req.body?.coachName === 'string') req.user.coachName = req.body.coachName.trim().slice(0, 40)
  save(store); res.json({ ok: true, sports: req.user.sports || [], coachName: req.user.coachName || '' })
})
// #313 — coach SAVES the athlete's threshold stats (FTP / threshold pace / max-HR / LTHR) it estimated
// from their intervals history, so they PERSIST and anchor run %pace / ride %ftp on the device.
app.put('/api/sport-stat', apiAuth, async (req, res) => {
  const r = await applySportStat(req.user, req.body || {})
  res.status(r.status).json(r.status === 200 ? { ok: true, synced: r.body.synced, pushError: r.body.pushError, sportSettings: req.user.sportSettings } : r.body)
})
// #257 — coach marks onboarding COMPLETE (after it saved the profile AND drafted the first week).
// Sets onboardedAt so the Today welcome card stops showing. The user can still skip earlier.
app.post('/api/onboarding/complete', apiAuth, (req, res) => {
  req.user.onboardedAt = Date.now(); save(store); res.json({ ok: true, onboardedAt: req.user.onboardedAt })
  // #288 — make sure the athlete's intervals has our custom feedback fields by the end of onboarding
  // (covers users who connected their key BEFORE #288 shipped, so /auth/icu never fired for them).
  if (req.user.icuKey) ensureIcuFields(req.user).catch(() => {})
})
// #257 — the coach VERIFIES connections & data flow (so it can tell the user exactly what to connect).
// Reports Platyplus↔intervals/Strava links AND whether data is actually flowing INTO intervals
// (recent activities + their source device, and whether HRV/sleep/RHR wellness is present).
app.get('/api/connections', apiAuth, async (req, res) => {
  const intervals = !!req.user.icuKey
  const strava = userStravaConnected(req.user)
  let recentActivities = 0, lastActivity = null, wellness = { hrv: false, sleep: false, restingHR: false }
  const sources = []
  if (intervals) {
    const ath = req.user.icuAthlete || 'i28814'
    const acts = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(21)}&newest=${icuDay(0)}`).catch(() => null)
    if (Array.isArray(acts)) {
      recentActivities = acts.length
      const sorted = acts.filter((a) => a.start_date_local).sort((a, b) => (a.start_date_local < b.start_date_local ? 1 : -1))
      if (sorted[0]) lastActivity = { date: sorted[0].start_date_local.slice(0, 10), type: sorted[0].type || null, source: sorted[0].source || sorted[0].device_name || null }
      for (const a of acts) { const s = a.source || a.device_name; if (s && !sources.includes(s)) sources.push(s) }
    }
    const well = await icuGet(req.user, `/athlete/${ath}/wellness?oldest=${icuDay(14)}&newest=${icuDay(0)}`).catch(() => null)
    if (Array.isArray(well)) wellness = {
      hrv: well.some((w) => w.hrv != null || w.hrvSDNN != null),
      sleep: well.some((w) => w.sleepSecs != null || w.sleepScore != null),
      restingHR: well.some((w) => w.restingHR != null),
    }
  }
  res.json({ intervals, strava, recentActivities, lastActivity, deviceSources: sources.slice(0, 6), wellness })
})

// Calendar items (meal / mind / note) — Platyplus-only, no intervals push.
app.get('/api/items', apiAuth, (req, res) => res.json(itemsInRange(req.user, req.query.from, req.query.to)))
app.post('/api/items', apiAuth, (req, res) => { const r = upsertItem(req.user, req.body || {}); res.status(r.status).json(r.body) })
app.delete('/api/items/:id', apiAuth, (req, res) => { deleteItemById(req.user, req.params.id); res.json({ ok: true }) })

// Exercise catalog search — resolve a name to a real exId (with demo media).
// Coach-activity notification: the coach posts a short note of what it just did
// (created/adjusted the plan, reviewed a workout). Surfaces in the user's bell.
function pushNotification(u, { title, body, items, subkind, link, score, id, date }) {
  if (!u.notifications) u.notifications = []
  const t = String(title || '').trim().slice(0, 120)
  if (!t) return null
  audit(u, { actor: 'coach', action: 'Notified you', target: t, detail: String(body || '').slice(0, 140), kind: 'notify' }) // #232
  const n = {
    id: id || ('coach-' + randomBytes(6).toString('base64url')),
    kind: 'coach',
    subkind: subkind === 'review' ? 'review' : undefined, // #233 distinguishes review vs update in the bell
    date: (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : new Date().toISOString().slice(0, 10), // #361 caller can set the SESSION date
    at: new Date().toISOString(),
    title: t,
    body: typeof body === 'string' ? body.trim().slice(0, 600) : undefined,
    items: Array.isArray(items) ? items.filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, 200)).slice(0, 12) : undefined,
    link: typeof link === 'string' ? link.slice(0, 200) : undefined,
    score: typeof score === 'number' ? score : undefined,
    read: false,
  }
  // dedup by id (re-reviews replace the prior notification for that review)
  u.notifications = (u.notifications || []).filter((x) => x.id !== n.id)
  u.notifications.unshift(n)
  u.notifications = u.notifications.slice(0, 50) // cap
  return n
}
app.post('/api/notify', apiAuth, (req, res) => {
  const n = pushNotification(req.user, req.body || {})
  if (!n) return res.status(400).json({ error: 'title is required' })
  save(store); res.status(201).json(n)
})

// On-demand coach trigger: run a coach task with a custom instruction (e.g. "re-author this week as
// structured workouts with tempo"). Fires the same locked-down coach as the auto-triggers. Async.
app.post('/api/coach/run', apiAuth, (req, res) => {
  const message = String((req.body || {}).message || '').trim().slice(0, 4000)
  if (!message) return res.status(400).json({ error: 'message is required' })
  if (!req.user.coachProfile || !req.user.coachProfile.trim()) return res.status(400).json({ error: 'coach not set up (no coachProfile)' })
  runCoachTask(req.user, message).catch((e) => console.error('[coach-run] ' + (e.message || e)))
  res.status(202).json({ ok: true, running: true })
})

// #254 — weekly macro TARGET (cyclingcoach parity): the coach sets the week's load/hours/focus goal
// as an intervals TARGET event (the athlete's weekly context), stored + mirrored. Best-effort mirror.
app.post('/api/weekly-target', apiAuth, async (req, res) => {
  const b = req.body || {}
  const weekStart = String(b.weekStart || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return res.status(400).json({ error: 'weekStart (YYYY-MM-DD, a Monday) required' })
  const target = {
    weekStart,
    load: Number(b.load) || undefined, hours: Number(b.hours) || undefined,
    focus: typeof b.focus === 'string' ? b.focus.slice(0, 300) : undefined,
    note: typeof b.note === 'string' ? b.note.slice(0, 800) : undefined,
    at: Date.now(),
  }
  if (!req.user.weeklyTargets) req.user.weeklyTargets = []
  req.user.weeklyTargets = [target, ...req.user.weeklyTargets.filter((t) => t.weekStart !== weekStart)].slice(0, 26)
  save(store); res.status(201).json(target)
  // mirror to intervals as a TARGET event (best-effort)
  if (req.user.icuKey) {
    const ath = req.user.icuAthlete || 'i28814'
    const name = `Weekly target${target.hours ? ` · ${target.hours}h` : ''}${target.load ? ` · ${target.load} load` : ''}`
    const desc = [target.focus, target.note].filter(Boolean).join('\n\n')
    icuFetch(req.user, `/athlete/${ath}/events`, { method: 'POST', body: JSON.stringify({ category: 'TARGET', start_date_local: `${weekStart}T00:00:00`, name, description: desc }) }).catch((e) => console.error('[weekly-target-mirror] ' + (e.message || e)))
  }
})

// Coach post-workout REVIEW (#91): the cyclingcoach engine writes its existing
// COACHCHECK output (Verdict/Execution/Body/Mind/Next) HERE — Platyplus is master,
// not intervals. Stored per-user; surfaced in-app (Progress takeaways + post-workout).
// Keyed by date (+ optional planId/activityId) so re-POST updates. Mirror-to-intervals
// is a follow-on (the planned-workout mirror already exists).
app.post('/api/coach-review', apiAuth, (req, res) => {
  const b = req.body || {}
  const date = String(b.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
  if (!req.user.coachReviews) req.user.coachReviews = []
  const arr = (x) => Array.isArray(x) ? x.filter((s) => typeof s === 'string').map((s) => s.slice(0, 300)).slice(0, 8) : undefined
  const review = {
    id: b.id || ('rev-' + date + (b.activityId ? '-' + b.activityId : '')),
    date, planId: b.planId || undefined, activityId: b.activityId || undefined,
    sport: typeof b.sport === 'string' ? b.sport.slice(0, 20) : undefined,
    score: typeof b.score === 'number' ? b.score : undefined,
    verdict: typeof b.verdict === 'string' ? b.verdict.slice(0, 600) : undefined,
    execution: arr(b.execution),
    body: typeof b.body === 'string' ? b.body.slice(0, 600) : undefined,
    mind: b.mind && typeof b.mind === 'object' ? { pattern: String(b.mind.pattern || '').slice(0, 300), cue: String(b.mind.cue || '').slice(0, 300) } : undefined,
    next: typeof b.next === 'string' ? b.next.slice(0, 600) : undefined,
    recovery: typeof b.recovery === 'string' ? b.recovery.slice(0, 800) : undefined,
    takeaways: arr(b.takeaways), // optional short bullets for the Progress card
    at: new Date().toISOString(),
  }
  req.user.coachReviews = [review, ...req.user.coachReviews.filter((r) => r.id !== review.id)].slice(0, 200)
  audit(req.user, { actor: 'coach', action: 'Reviewed a session', target: review.title || `${review.sport || ''} ${review.date || ''}`.trim(), detail: review.verdict || (review.score != null ? `score ${review.score}` : ''), kind: 'review' }) // #232
  // #233 — notify the athlete their session was reviewed (tappable → the activity / plan).
  const score10 = review.score == null ? null : (review.score > 10 ? Math.round(review.score / 10) : review.score)
  pushNotification(req.user, {
    id: 'review-' + review.id, subkind: 'review',
    title: `Coach reviewed your ${review.sport || 'workout'}`,
    body: review.verdict || (review.takeaways && review.takeaways[0]) || undefined,
    score: score10 != null ? score10 : undefined,
    date: review.date || undefined, // #361 — the SESSION date (which activity), so a stack of reviews is followable
    link: review.activityId ? `/activity/${review.activityId}` : (review.planId ? `/coach/${review.planId}` : undefined),
  })
  save(store); res.status(201).json(review)
  // #290: the coach note belongs in the intervals Notes/comment thread too (not just Platyplus), in
  // the standard "Coach note" format so #286 reads it back. Private-safe context lives HERE, never in
  // the public description (#289 set_activity_text). Best-effort, deduped.
  if (review.activityId && req.user.icuKey && /^i?\d+$/.test(review.activityId)) {
    postCoachNote(req.user, review.activityId, review).catch((e) => console.error('[coach-note-write] ' + (e.message || e)))
  }
})

// #289 — the coach sets the PUBLIC title + description on a completed activity (syncs to Strava).
// Public-safe ONLY (the coach engine enforces: workout/route/effort, no health/score/plan leaks).
app.put('/api/activity/:id/public-text', apiAuth, async (req, res) => {
  const id = String(req.params.id)
  if (!/^i?\d+$/.test(id)) return res.status(400).json({ error: 'expected an intervals activity id' })
  if (!req.user.icuKey) return res.status(400).json({ error: 'no intervals connection' })
  const payload = {}
  if (typeof req.body.name === 'string' && req.body.name.trim()) payload.name = req.body.name.trim().slice(0, 200)
  if (typeof req.body.description === 'string') payload.description = req.body.description.slice(0, 4000)
  if (!Object.keys(payload).length) return res.status(400).json({ error: 'name or description required' })
  try {
    const r = await icuFetch(req.user, `/activity/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    if (!r.ok) return res.status(502).json({ error: 'intervals rejected the update', status: r.status })
    res.json({ ok: true, ...payload })
  } catch (e) { res.status(502).json({ error: String(e.message || e) }) }
})

// #290 — format a saved coach review into the standard "Coach note" (+ Recovery/Supplements) blocks
// and post them to the intervals activity message thread. Matches coach_feedback_format.md so #286's
// parseCoachNote reads it back into the verdict card + expander.
async function postCoachNote(user, id, r) {
  const score = r.score == null ? null : (r.score > 10 ? Math.round(r.score / 10) : r.score) // normalize 0-100 → /10
  const bullets = (r.takeaways && r.takeaways.length ? r.takeaways : r.execution) || []
  const lines = [`Coach note - ${(r.sport || 'workout')} ${r.date}`, '', 'Verdict']
  lines.push(`- ${score != null ? `Score: ${score}/10. ` : ''}${r.verdict || ''}`.trimEnd())
  if (r.execution && r.execution.length && bullets !== r.execution) { lines.push('', 'Execution'); for (const t of r.execution) lines.push(`- ${t}`) }
  else if (bullets.length) { for (const t of bullets) lines.push(`- ${t}`) }
  if (r.body) { lines.push('', 'Body / Recovery Exercises', `- ${r.body}`) }
  if (r.mind && (r.mind.pattern || r.mind.cue)) { lines.push('', 'Mind'); if (r.mind.pattern) lines.push(`- ${r.mind.pattern}`); if (r.mind.cue) lines.push(`- ${r.mind.cue}`) }
  if (r.next) { lines.push('', 'Next', `- ${r.next}`) }
  await syncActivityNote(user, id, lines.join('\n').trim())
  if (r.recovery && r.recovery.trim()) await syncActivityNote(user, id, `Recovery / Supplements\n\n${r.recovery.trim()}`)
}
app.get('/api/exercises', apiAuth, (req, res) => res.json(searchExercises(req.query.q, req.query.limit, req.query.equipment)))
// Recipe + session catalog search — the coach picks a real id for fuel meals / mind sessions.
app.get('/api/recipes', apiAuth, (req, res) => res.json(searchRecipes(req.query.q, req.query.limit, req.query.category, req.query.diet || req.user.info?.diet)))
app.get('/api/sessions', apiAuth, (req, res) => res.json(searchSessions(req.query.q, req.query.limit, req.query.kind)))

// ---- OpenAPI spec + Swagger UI (session-gated — not public) ---------------
// `auth` requires a valid login cookie, so the docs + spec are invisible to
// anyone who isn't signed in. Swagger's spec fetch carries the cookie (same-origin
// + requestInterceptor) so it loads fine for a logged-in user.
app.get('/api/openapi.json', auth, (req, res) => res.sendFile(join(__dirname, 'openapi.json')))
app.get('/api/docs', auth, (req, res) => res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Platyplus Coach API</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.onload=()=>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#ui',withCredentials:true,requestInterceptor:(r)=>{r.credentials='same-origin';return r}})</script></body></html>`))

// ---- intervals.icu proxy (session required) ------------------------------
app.all('/icu/*', auth, async (req, res) => {
  const url = ICU + req.originalUrl.replace(/^\/icu/, '')
  const headers = {}
  if (req.headers.authorization) headers.authorization = req.headers.authorization
  else if (req.user.icuKey) headers.authorization = 'Basic ' + Buffer.from('API_KEY:' + req.user.icuKey).toString('base64')
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  const init = { method: req.method, headers }
  if (!['GET', 'HEAD'].includes(req.method)) init.body = JSON.stringify(req.body)
  try {
    const r = await fetch(url, init)
    res.status(r.status)
    const ct = r.headers.get('content-type'); if (ct) res.set('content-type', ct)
    // #267: never let the browser heuristically cache an intervals read — without this a
    // GET (e.g. /activities) could be served stale, so an activity DELETED upstream still
    // shows in Platyplus. Always revalidate against intervals.
    res.set('Cache-Control', 'no-store')
    res.send(Buffer.from(await r.arrayBuffer()))
  } catch (e) { res.status(502).json({ error: 'intervals.icu proxy failed', detail: String(e.message || e) }) }
})

// ---- static SPA ----------------------------------------------------------
// Self-hosted media (range requests for video seeking + long immutable cache).
app.use('/media', express.static(MEDIA_DIR, { maxAge: '365d', immutable: true }))
app.use(express.static(STATIC_DIR, { index: false, setHeaders: (res, p) => { if (p.endsWith('index.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache') } }))
app.get('*', (req, res) => res.sendFile(join(STATIC_DIR, 'index.html')))

// ---- observability: log every failure so it's reviewable (not silent) --------
// Structured, greppable lines (prefix `[err`, `[unhandled`, `[boot`) so the
// monitoring routine / a future watchdog bot can scrape docker logs, flag spikes,
// and act. Each 500 carries a short `ref` echoed to the client for correlation.
const errId = () => randomBytes(4).toString('hex')
// Translate a raw error into a sentence a human (and a monitoring bot) can act on.
function humanizeError(err) {
  const m = String(err?.message || err || '')
  if (/secretOrPrivateKey|jwt/i.test(m)) return "The server's session key wasn't loaded, so sign-in is temporarily unavailable."
  if (/ECONNREFUSED|ETIMEDOUT|terminating connection|the database system|relation .* does not exist|password authentication|too many clients/i.test(m)) return 'The database is unavailable or misconfigured right now.'
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) return 'A service we depend on (e.g. intervals.icu) is unreachable right now.'
  if (/ENOSPC|EROFS|disk/i.test(m)) return 'The server is out of disk space.'
  return 'Something unexpected went wrong on our end.'
}
app.use((err, req, res, next) => {
  const ref = errId()
  const human = humanizeError(err)
  // Plain-English summary first, then the where + raw detail + stack for investigation.
  console.error(`[err ${ref}] ${human}\n  where: ${req.method} ${req.originalUrl} (user ${req.user?.username || req.user?.id || 'anonymous'})\n  detail: ${err?.message || err}\n${err?.stack || ''}`)
  if (res.headersSent) return next(err)
  res.status(err?.status || 500).json({ error: human, ref })
})
// Last-resort safety nets — async throws that bypass Express still get logged.
process.on('unhandledRejection', (e) => console.error(`[unhandledRejection] ${e?.stack || e}`))
process.on('uncaughtException', (e) => console.error(`[uncaughtException] ${e?.stack || e}`))

// #367 — DAILY auto-adapt: each morning the coach proactively re-plans the rolling ~2-week horizon from
// the athlete's readiness, so JM doesn't have to ask. TWO passes (JM's pick): an EARLY pass ~4am local
// (Form/freshness are always available), then a REFINE pass once overnight HRV/sleep/RHR lands in
// intervals. Runs in-process (single instance); guarded once-per-pass-per-day via user.dailyAdapt.
const DAILY_HORIZON = 14 // days the coach keeps populated + adapted ahead
function dailyAdaptMsg(today, pass) {
  const head = pass === 'refine'
    ? `Daily auto-adaptation — REFINE pass (${today}). Their overnight HRV/sleep/resting-HR has now LANDED in intervals — read it (get_wellness) + their check-in (get_checkins). If it changes today's readiness vs earlier, refine; if nothing meaningful changed, don't churn the plan.`
    : `Daily auto-adaptation — EARLY pass (${today}). Overnight HRV/sleep from their watch usually ISN'T synced this early, so decide from their FRESHNESS / Form (CTL−ATL, always available — get_wellness) + their latest check-in (get_checkins). You'll get a refine pass later once HRV/sleep lands.`
  return `${head} Then PROACTIVELY adapt their plan for the NEXT ${DAILY_HORIZON} DAYS (list_schedule): ease / harden / shift / add sessions so the rolling ~2-week plan matches how they're recovering AND their goals, weekly frequency + availability. Keep ~${DAILY_HORIZON} days populated ahead (fill gaps toward their target frequency; never double-book a day / exceed their max sessions per day). If a MATERIAL call is uncertain (e.g. several run-down days → cut this week's volume? a race clash?), use notify to ASK them rather than guess. When you change things, notify ONE short line of what changed + why. Don't ask trivial questions — decide and act; ask only when it truly matters. Be concise.`
}
async function runDailyAdapt(user, pass) {
  try { await runCoachTask(user, dailyAdaptMsg(await athleteToday(user), pass)) } catch (e) { console.error(`[daily-adapt ${pass}] ${user.username || ''} ${e.message || e}`) }
}
// One scheduler tick: fire the due pass for each coached athlete. Called every ~30 min.
async function dailyAdaptTick() {
  for (const user of store.users || []) {
    if (!user.icuKey || !user.coachProfile || !String(user.coachProfile).trim()) continue
    const tz = user.icuTimezone || 'UTC'
    const today = localTodayInTz(tz), hour = localHourInTz(tz)
    user.dailyAdapt = user.dailyAdapt || {}
    try {
      if (hour >= 4 && hour < 11 && user.dailyAdapt.early !== today) { // EARLY pass — from ~4am local, once/day
        user.dailyAdapt.early = today; save(store); runDailyAdapt(user, 'early'); continue
      }
      // REFINE pass — after the early pass, once today's HRV/sleep/RHR has actually landed in intervals.
      if (user.dailyAdapt.early === today && user.dailyAdapt.refine !== today && hour >= 6 && hour < 23) {
        const w = await icuGet(user, `/athlete/${user.icuAthlete || 'i28814'}/wellness?oldest=${today}&newest=${today}`).catch(() => null)
        const row = Array.isArray(w) ? w.find((d) => d.id === today) : null
        if (row && (row.hrv != null || row.sleepSecs != null || row.restingHR != null)) { user.dailyAdapt.refine = today; save(store); runDailyAdapt(user, 'refine') }
      }
    } catch (e) { console.error(`[daily-adapt tick] ${user.username || ''} ${e.message || e}`) }
  }
}
// Run the daily adaptation on demand (testing / "adapt now"). #367
app.post('/api/coach/daily-adapt', apiAuth, (req, res) => {
  if (!req.user.coachProfile || !String(req.user.coachProfile).trim()) return res.status(400).json({ error: 'coach not set up (no coachProfile)' })
  runDailyAdapt(req.user, req.body?.pass === 'refine' ? 'refine' : 'early')
  res.status(202).json({ ok: true, running: true })
})
// #372 — re-mirror all FUTURE plans to intervals so they pick up the computed planned LOAD (or any
// push-format change). No content change — just re-pushes via pushPlanToIcu. Bearer.
app.post('/api/plans/resync', apiAuth, async (req, res) => {
  const today = await athleteToday(req.user)
  const future = (req.user.plans || []).filter((p) => p.date && p.date >= today)
  let synced = 0
  for (const plan of future) { try { await pushPlanToIcu(req.user, plan); synced++ } catch { /* best effort */ } }
  save(store)
  res.json({ ok: true, synced, total: future.length })
})

// Startup: connect Postgres → load the cache → seed/defaults → listen. (#DB migration)
async function start() {
  if (USE_PG) {
    await initDb()
    store = await loadStore()
    // First Postgres boot with an empty DB: auto-import the legacy JSON store (no data loss).
    if (!store.users.length) {
      try {
        const fileStore = loadJsonStore()
        if (fileStore?.users?.length) { store = fileStore; await save(store); console.log(`Migrated ${store.users.length} users from store.json → Postgres`) }
      } catch (e) { console.log('No legacy store.json to migrate (' + e.message + ')') }
    }
  } else {
    store = loadJsonStore() // local dev / CI: the JSON file store (no Postgres around)
  }
  await seedAndDefaults()
  // boot self-check — a missing sessionSecret would 500 every login (silently before).
  if (!store.sessionSecret) console.error('[boot] CRITICAL: the session key is missing — every sign-in will fail until this is fixed.')
  console.log(`[boot] Ready on the ${USE_PG ? 'Postgres' : 'file'} store with ${store.users.length} user account(s). Session key ${store.sessionSecret ? 'loaded' : 'MISSING'}.`)
  app.listen(PORT, () => console.log(`gymapp listening on :${PORT} (rpID ${RP_ID}) [${USE_PG ? 'postgres' : 'file'}, ${store.users.length} users]`))
  // #367 — daily morning auto-adapt scheduler (QA/prod only; CI has no DB/coach). Tick every 30 min so
  // the EARLY (~4am local) and REFINE (once HRV/sleep lands) passes fire at the right local time per user.
  if (USE_PG) {
    setInterval(() => dailyAdaptTick().catch((e) => console.error('[daily-adapt] ' + (e.message || e))), 30 * 60 * 1000)
    setTimeout(() => dailyAdaptTick().catch(() => {}), 90 * 1000) // a first pass shortly after boot (guarded once/day)
  }
}
start().catch((e) => { console.error('FATAL startup failed:', e); process.exit(1) })
