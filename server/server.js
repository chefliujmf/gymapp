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
import { readFileSync, existsSync, writeFileSync, unlinkSync, renameSync, mkdirSync } from 'node:fs'
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
import { eventMatchesPlan, eventSport, slotKey, planDroppedByReconcile, orphanIsMoveLeftover, userMovedPlatyplusPlan } from './icu-match.js'
import { readiness as computeReadiness, baselines as wellnessBaselines, forecastFreshness, projectFormSeries, bestVo2maxEstimate, weeklyLoadBudget, isoMonday, defaultLoadPlan, recentRestDows, periodizedLoads, coachTick, horizonCoverage } from './readiness.js'
import { weekShape } from './week-shape.js' // #613/#615 — code-decided week structure (the DOSE); the ceiling clamp lives in shape-enforce.js
import { assignArchetypeBlock, keyFromTitle } from './archetypes.js' // #620 — code-decided VARIETY (assign archetypes, don't hope the LLM varies)
import { enforceShape } from './shape-enforce.js' // #615/#620 — the PURE, unit-tested clamp that ENFORCES the week shape on a plan
import { periodizationPhase } from './periodization.js' // #626 — where THIS week sits in the meso-cycle (build/peak/recovery/taper) so the coach PROGRESSES
import { runMigrations } from './migrations.js' // #519 — run-once data migrations (athlete-profile back-fill, etc.)
import { tteFromPower, tteModelPower, tteFromPace, tteModelPace, efSummary, athleteProfile as computeAthleteProfile } from './perf-metrics.js' // #404
import { fromIcuSportSettings, icuPatchForGroup, runThresholdFromPaceCurve, tteAtThresholdSec, athleteBasicsPatch, significantBenchChange } from './sport-settings.js'
import { planCapViolation } from './plan-cap.js'
import { localDate } from './tz.js'
// #508 — DEEP-merge intervals sport-settings into ours PER GROUP. intervals only knows ftp/maxHr/lthr/thresholdPace;
// our LOCAL benchmarks (cp/wPrime/tte/cs/dPrime) live in the same per-sport object. A shallow `{...ours, ...mapped}`
// makes mapped.cycling REPLACE the whole cycling object → wipes cp/W′/TTE on every session-load/pull (JM: "manual
// value does not save" — it saved, then the next sync deleted it). Overlay intervals' fields, keep everything else.
// #582 — PLATYPLUS OWNS ITS BENCHMARKS (JM directive, "when I enter something it has to STICK / terrible architecture").
// The durable source of truth is OUR store, NOT intervals. The automatic merge (app-load / connect / pull) is FILL-BLANK:
// intervals fills a field the user has never set, but NEVER overwrites a Platyplus value — so a wrong/rotated key, or
// junk on the shared prod athlete, can no longer wipe your data. Platyplus still PUSHES edits OUT to intervals on save
// (applySportStat) so intervals stays in step. The ONLY intervals-overwrites-Platyplus path is the EXPLICIT
// "Import from intervals" action (`intervalsWins=true`) — a deliberate tap, never automatic.
function mergeIcuSportSettings(existing, mapped, intervalsWins = false) {
  const out = { ...(existing || {}) }
  for (const g of Object.keys(mapped || {})) {
    out[g] = intervalsWins
      ? { ...(out[g] || {}), ...(mapped[g] || {}) } // explicit Import: intervals overwrites ours
      : { ...(mapped[g] || {}), ...(out[g] || {}) } // default fill-blank: our value wins, intervals only fills gaps
  }
  return out
}
import { encodeStep, flattenIcuStepsSrv, paceFromPowerPct, clampEasyEfforts, normalizeRamps, bandSteadyPower, nativeWorkoutText, plannedTss, plannedGymTss, estimateGymSeconds, stripPlatyplusLinks, stripDerivedWorkout, isPlatyplusPushedEvent } from './icu-steps.js'
import { weatherGuidance } from './weather.js'
import { cycleContext, normalizePhase, phaseFromDay, phaseFromHistory, pregnancyStage } from './cycle.js' // #329 (#422 phaseFromHistory, #427 pregnancyStage)
import webpush from 'web-push' // #457 — phone push notifications

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = process.env.STATIC_DIR || '/usr/share/nginx/html'
const MEDIA_DIR = process.env.MEDIA_DIR || '/srv/media'   // self-hosted images/video/audio
const PORT = Number(process.env.PORT || 80)
const RP_ID = process.env.RP_ID || 'platyplus.duckdns.org'
const ORIGIN = process.env.ORIGIN || `https://${RP_ID}`
const RP_NAME = 'Platyplus'
// #457 — Web Push (phone notifications). VAPID keys from env; if ABSENT, push is DISABLED and the feature
// degrades gracefully (client shows "unavailable"). The PUBLIC key is safe to ship; the private key is secret.
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const PUSH_ENABLED = !!(VAPID_PUBLIC && VAPID_PRIVATE)
if (PUSH_ENABLED) { try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:admin@${RP_ID}`, VAPID_PUBLIC, VAPID_PRIVATE) } catch (e) { console.error('[webpush] bad VAPID keys: ' + (e.message || e)) } }
// #381 — QA/staging shares JM's ONE REAL intervals athlete (i28814) with prod (single intervals account).
// Both envs pushing/scheduling to it collided on the shared calendar → duplicate events, double "Open in
// Platyplus" links, empty gym shells (#377/#378/#381). Fix (JM's pick): staging is READ-ONLY toward
// intervals — it never MIRRORS plans out (pushPlanToIcu) and never runs the auto-scheduler. Only prod
// writes. QA still reconciles IN (read) so it shows the calendar. Detected from the QA RP_ID/ORIGIN.
const IS_STAGING = process.env.STAGING === '1' || /-qa\.|staging/i.test(`${RP_ID} ${ORIGIN}`)
// #570-follow — the ONLY reason QA is read-only toward intervals is that it USED to share prod's real athlete i28814.
// A user pointed at a DIFFERENT athlete (e.g. the QA test athlete i644563) is safe to write — it never touches prod.
// So "can this user's writes reach intervals?" = has key+athlete AND is not the shared-prod athlete on staging.
const SHARED_PROD_ATHLETE = 'i28814'
const syncsIntervals = (u) => !!(u && u.icuKey && u.icuAthlete) && !(IS_STAGING && u.icuAthlete === SHARED_PROD_ATHLETE)
// #491 — Eat + Mind are DEACTIVATED app-wide (JM 2026-07-11, "simplify for now"): nav tabs are gone, so the coach
// must NOT put meals / mind / supplements on the calendar (they'd be orphan items with no section to show them).
// Training + Recovery + notes stay. Reversible: flip to false to bring Eat/Mind back (and restore the nav tabs).
const EAT_MIND_OFF = true
const DEACTIVATED_ITEM_TYPES = ['meal', 'mind', 'supplement', 'recovery'] // #517/#518 — Eat/Mind + recovery items parked (roadmap): coach can't create them, calendar won't surface them
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
const pub = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, info: u.info || {}, avatar: u.avatar || '', coachName: u.coachName || '', sports: u.sports || (u.sport ? [u.sport] : []), sex: u.sex || '', hasCoachProfile: !!(u.coachProfile && u.coachProfile.trim()), hasIcuKey: !!u.icuKey, icuAthlete: u.icuAthlete || '', sleepNeed: u.sleepNeed || null, maxHR: u.maxHR || null, ftp: u.ftp || null, vo2max: u.vo2max || null, sportSettings: u.sportSettings || {}, runVdot: u.runVdot || null, runThresholdPace: u.sportSettings?.running?.thresholdPace || null, statPrefs: u.statPrefs || {}, learnReadiness: u.learnReadiness !== false, feedbackSkips: u.feedbackSkips || [], statsSyncedAt: u.statsSyncedAt || 0, onboardedAt: u.onboardedAt || 0, cyclePhase: u.cyclePhase || null, cyclePhaseAt: u.cyclePhaseAt || null, staging: IS_STAGING, syncsIntervals: syncsIntervals(u), activityLinks: u.activityLinks || {}, passkeys: (u.passkeys || []).map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt })) })
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
// #582 — refresh the per-sport BENCHMARKS from intervals (the PULL direction), the SAME merge as the pull endpoint.
// Reads the athlete record, maps + merges intervals-native fields (ftp/maxHr/lthr/threshold-pace/CSS/w_prime) — keeping
// our Platyplus-only ones (cp/tte/cs/dPrime/swolf). Shared by /auth/me (throttled) + the manual resync, so an
// intervals-side change reflects in Platyplus RELIABLY on next app-open, not only when the Stats card happens to mount.
// #582 — pull intervals' sport-settings. DEFAULT is fill-blank (Platyplus owns it — never clobbers a user value).
// `overwrite:true` is the EXPLICIT "Import from intervals" path (the only time intervals overwrites Platyplus).
async function syncBenchmarksFromIcu(user, { overwrite = false } = {}) {
  if (!user.icuKey) return false
  // read via /athlete/0 (the KEY's own athlete), which SELF-HEALS a wrong icuAthlete: if the stored one doesn't
  // match the key's real athlete (e.g. a stale i28814 from the old client default), correct it here so the sync works.
  const a = await icuGet(user, '/athlete/0').catch(() => null)
  if (!a || !a.id) return false
  if (String(a.id) !== user.icuAthlete) user.icuAthlete = String(a.id)
  const mapped = fromIcuSportSettings(a.sportSettings || [])
  const beforeSS = { cycling: { ...(user.sportSettings?.cycling || {}) }, running: { ...(user.sportSettings?.running || {}) }, swimming: { ...(user.sportSettings?.swimming || {}) } } // #563 snapshot
  user.sportSettings = mergeIcuSportSettings(user.sportSettings, mapped, overwrite)
  // mirror the coach anchors from the MERGED value (our value when set, intervals only when we had none / on import)
  const ftp = user.sportSettings.cycling?.ftp, maxHr = user.sportSettings.cycling?.maxHr
  if (ftp != null) user.ftp = ftp
  if (maxHr != null) user.maxHR = maxHr
  save(store)
  // #563 — an intervals IMPORT that CHANGED an existing benchmark → coach re-evaluates + acknowledges. Fill-blank never
  // fires (significantBenchChange needs a real before-value), so this only triggers on a deliberate overwrite/import.
  for (const g of ['cycling', 'running', 'swimming']) maybeCoachBenchmarkAdapt(user, significantBenchChange(g, beforeSS[g], user.sportSettings[g], 'intervals'), 'intervals').catch(() => {})
  return true
}
app.get('/auth/me', auth, async (req, res) => {
  // #265/#1003 — backfill height/DOB/sex/weight from the intervals athlete record on session load if still missing.
  // GUARDED to only fetch while something's absent, so it stops as soon as they're filled (no per-load overhead after).
  const u = req.user
  if (u.icuKey && u.icuAthlete && (u.info?.heightCm == null || !u.info?.dob || !u.sex)) { // #265 — also backfill SEX (the old gate stopped once height+dob filled, so sex stayed empty)
    const me = await icuGet(u, `/athlete/${u.icuAthlete}`).catch(() => null)
    if (me) { syncAthleteProfile(u, me); save(store) }
  }
  // #582 — keep benchmarks in step with intervals on app-load, THROTTLED (~3 min/user) so it's not a fetch per request.
  if (syncsIntervals(u) && Date.now() - (u.benchSyncAt || 0) > 3 * 60 * 1000) { u.benchSyncAt = Date.now(); await syncBenchmarksFromIcu(u).catch(() => {}) }
  // #497/#501 — also backfill the COMPUTED coach anchors (FTP/maxHR/run pace) for already-connected users who
  // predate the connect-time stash, so nobody is left un-analysed. Guarded: runs only while an anchor is still blank.
  if (u.icuKey && u.icuAthlete && (u.ftp == null || u.maxHR == null || u.runPaceEst == null)) {
    if (await computeAndStashAnchors(u).catch(() => false)) save(store)
  }
  res.json(pub(req.user))
})

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
// #265/#1003/#459 (JM) — sync profile BASICS from the intervals athlete record. They ARE there (verified: `height`
// in METRES, `icu_date_of_birth` YYYY-MM-DD, `sex` M/F, `icu_weight`) — Platyplus just never read them, so height +
// birthday showed empty. FILL-IF-EMPTY so a manual Platyplus value is never clobbered.
function syncAthleteProfile(user, me) {
  if (!me || typeof me !== 'object') return
  user.info = user.info || {}
  if (me.height > 0 && user.info.heightCm == null) user.info.heightCm = me.height < 3 ? Math.round(me.height * 100) : Math.round(me.height)
  if (/^\d{4}-\d{2}-\d{2}/.test(me.icu_date_of_birth || '') && !user.info.dob) user.info.dob = String(me.icu_date_of_birth).slice(0, 10)
  if (me.sex && !user.sex) user.sex = me.sex === 'M' ? 'male' : me.sex === 'F' ? 'female' : user.sex
  if (me.icu_weight > 0 && !user.weight) user.weight = Math.round(me.icu_weight * 10) / 10
}
// #497/#501 (JM: "for a new user, BE SURE this analysis is done — it's important") — when the athlete's intervals
// SETTINGS don't carry a stat (an unconfigured account with only ridden/run history), COMPUTE the coach anchor from
// their ACTUAL history so the coach has a real number immediately, without the user ever opening Stats. Fill-if-empty
// (never overrides a manual/configured value); best-effort + parallel; the Stats cards refine these from the full
// curves later with honest confidence. This is the difference between "Platyplus never analysed my data" and not.
async function computeAndStashAnchors(user) {
  if (!user.icuKey || !user.icuAthlete) return false
  const ath = user.icuAthlete
  const needFtp = user.ftp == null, needMaxHr = user.maxHR == null, needPace = user.runPaceEst == null
  if (!needFtp && !needMaxHr && !needPace) return false
  const [pc, acts, pace] = await Promise.all([
    needFtp ? icuGet(user, `/athlete/${ath}/power-curves?type=Ride&start=${icuDay(365)}&end=${icuDay(0)}`).catch(() => null) : Promise.resolve(null),
    needMaxHr ? icuGet(user, `/athlete/${ath}/activities?oldest=${icuDay(365)}&newest=${icuDay(0)}`).catch(() => null) : Promise.resolve(null),
    needPace ? icuGet(user, `/athlete/${ath}/pace-curves?type=Run`).catch(() => null) : Promise.resolve(null),
  ])
  let changed = false
  // FTP from the best 20-min on the power curve (classic 95%). A real anchor even off steady rides — it's their best
  // sustained 20-min, ×0.95; the HR-power method + eFTP refine it on the card. Only if settings gave no FTP.
  if (needFtp && pc) {
    const curve = Array.isArray(pc.list) ? pc.list[0] : null
    if (curve && Array.isArray(curve.secs)) {
      const vals = curve.values || curve.watts || curve.best || []
      const at = (t) => { for (let i = 0; i < curve.secs.length; i++) if (curve.secs[i] >= t) return Number(vals[i]) || null; return null }
      const ftp20 = at(1200)
      if (ftp20 > 0) { user.ftp = Math.round(ftp20 * 0.95); changed = true }
    }
  }
  // Max HR from the real observed ceiling over a year (or intervals' zone ceiling), else the Tanaka age formula.
  if (needMaxHr) {
    let observed = null
    if (Array.isArray(acts)) {
      const hrs = acts.map((a) => Number(a.max_heartrate ?? a.max_hr ?? a.icu_hr_max) || 0).filter((h) => h >= 120 && h <= 230).sort((x, y) => y - x)
      if (hrs.length) observed = hrs[0]
      if (!observed) { const am = acts.map((a) => Number(a.athlete_max_hr) || 0).find((h) => h >= 120 && h <= 230); if (am) observed = am }
    }
    if (!observed) { const ageYr = user.info?.dob ? Math.floor((Date.now() - new Date(user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null; if (ageYr != null && ageYr > 8 && ageYr < 100) observed = Math.round(user.sex === 'female' ? 206 - 0.88 * ageYr : 208 - 0.7 * ageYr) } // #508 sex-specific (Gulati/Tanaka)
    if (observed) { user.maxHR = observed; changed = true }
  }
  // Running threshold pace from the pace curve (Critical Speed) — the coach's run anchor.
  if (needPace && pace) {
    const est = runThresholdFromPaceCurve(pace)
    if (est && est.thresholdPace > 0) { user.runPaceEst = Math.round(est.thresholdPace); changed = true }
  }
  return changed
}
// #564 — manually LINK / UNLINK a completed activity to a planned workout (overrides the day+sport auto-match).
// activityLinks[activityId] = planId (explicit link) | null (explicit UNLINK → suppress the auto-match). Mirrors the
// pairing to intervals best-effort (only when this user's writes reach intervals): pair to the plan's event, or unpair.
app.put('/auth/activity-link', auth, async (req, res) => {
  const activityId = String(req.body.activityId || '').trim()
  if (!activityId) return res.status(400).json({ error: 'activityId required' })
  const planId = req.body.planId ? String(req.body.planId).trim() : null // null/absent = unlink
  const icuEventId = req.body.icuEventId ? String(req.body.icuEventId).trim() : null
  req.user.activityLinks = req.user.activityLinks || {}
  req.user.activityLinks[activityId] = planId
  save(store)
  let icuPaired = null
  if (syncsIntervals(req.user)) {
    try {
      if (planId && icuEventId) icuPaired = await pairActivityToPlan(req.user, activityId, icuEventId) // pair to the linked plan's event
      else { await icuFetch(req.user, `/activity/${activityId}`, { method: 'PUT', body: JSON.stringify({ paired_event_id: null }) }).catch(() => {}); icuPaired = false } // unpair on unlink
    } catch { /* best-effort — the Platyplus link is the source of truth */ }
  }
  res.json({ ...pub(req.user), icuPaired })
})
app.put('/auth/icu', auth, async (req, res) => {
  if (typeof req.body.icuKey === 'string') req.user.icuKey = req.body.icuKey.trim()
  // #582 ROOT-CAUSE FIX — the athlete is ALWAYS the KEY's own (athlete/0 = whoever this key authenticates), resolved
  // SERVER-SIDE. NEVER trust a client-sent icuAthlete: the browser's device-local id still defaults to the shared prod
  // athlete i28814, so connecting a QA key wrote icuAthlete=i28814 → syncsIntervals=false → the whole two-way sync was
  // dead (JM's QA pointed at i28814, not i644563). The old code set it from req.body then only ran athlete/0 "if empty",
  // so it never corrected the wrong value. Now: a set key ALWAYS re-resolves its real athlete.
  if (req.user.icuKey) {
    const me = await icuGet(req.user, '/athlete/0').catch(() => null) // athlete/0 = the key's authenticated athlete
    if (me && me.id) {
      req.user.icuAthlete = String(me.id) // AUTHORITATIVE — the key's own athlete, never the client's stale value
      syncAthleteProfile(req.user, me)
      // #497/#501 (JM: "for a new user, be sure this analysis is done") — stash the coach ANCHORS (FTP/maxHR + the
      // per-sport thresholds) from the athlete's intervals sport-settings ON CONNECT, so the coach has real numbers
      // immediately without the user opening Stats. Fill-if-empty; the Stats cards refine them from the curves later.
      const mapped = fromIcuSportSettings(me.sportSettings || [])
      req.user.sportSettings = mergeIcuSportSettings(req.user.sportSettings, mapped) // fill-blank: import intervals values the user doesn't already have, never overwrite
      if (mapped.cycling?.ftp != null && req.user.ftp == null) req.user.ftp = mapped.cycling.ftp
      if (mapped.cycling?.maxHr != null && req.user.maxHR == null) req.user.maxHR = mapped.cycling.maxHr
      // …and if settings still left an anchor blank (unconfigured account), COMPUTE it from their history so the
      // analysis is genuinely done on connect (#497/#501). Best-effort; won't block a successful key save.
      await computeAndStashAnchors(req.user).catch(() => false)
    }
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
  if (req.body && req.body.pregnant === true) { delete req.user.cyclePhase; delete req.user.cyclePhaseAt } // #427 — no menstrual cycle while pregnant; clear stale phase now
  if (typeof req.body.email === 'string' && req.body.email.includes('@')) req.user.email = req.body.email.toLowerCase()
  if (typeof req.body.coachName === 'string') req.user.coachName = req.body.coachName.trim().slice(0, 40)
  if (Array.isArray(req.body.sports)) req.user.sports = req.body.sports.filter((s) => typeof s === 'string').map((s) => s.toLowerCase().trim().slice(0, 20)).slice(0, 8)
  else if (typeof req.body.sport === 'string') req.user.sports = req.body.sport ? [req.body.sport.toLowerCase().trim().slice(0, 20)] : []
  // #534 — MAIN sport (drives the coach's gym focus: main endurance sport → gym is support). Must be one the athlete does.
  if ('mainSport' in req.body) { const ms = String(req.body.mainSport || '').toLowerCase().trim(); req.user.info.mainSport = ms && (req.user.sports || []).includes(ms) ? ms : undefined }
  // keep the stored main sport valid after a sports change (dropped sport can't stay primary)
  if (req.user.info.mainSport && !(req.user.sports || []).includes(req.user.info.mainSport)) req.user.info.mainSport = undefined
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
    // #508 — the whitelist was missing the model benchmarks (tteRide/tteRun/cp/wPrime/cs/dPrime), so switching one of
    // them to Manual silently dropped the MODE server-side → the card stayed on Auto/computed and the manual value the
    // user typed was never used (JM: "TTE manual won't save"). The VALUE saved (sportSettings); the PREF did not.
    for (const [k, v] of Object.entries(req.body.statPrefs)) if ((v === 'manual' || v === 'computed' || v === 'auto') && /^(vo2max|ftp|thresholdPace|maxHr|sleepNeed|tteRide|tteRun|cp|wPrime|cs|dPrime|css|dPrimeSwim|tteSwim|swolf)$/.test(k)) req.user.statPrefs[k] = v
  }
  // #457 — per-type phone-push preferences (clamped to booleans)
  if (req.body.pushPrefs && typeof req.body.pushPrefs === 'object') {
    req.user.info.pushPrefs = {
      planChanges: req.body.pushPrefs.planChanges !== false,
      reviews: req.body.pushPrefs.reviews !== false,
      reminders: req.body.pushPrefs.reminders === true,
    }
  }
  // #268/#1003/#459 (JM: "changed height in Platyplus, couldn't see it on intervals") — WRITE-BACK the profile basics
  // (height/DOB/sex) to the intervals athlete record so the sync is two-way, not just intervals→Platyplus. PROD-ONLY:
  // QA is READ-ONLY toward intervals (QA + prod share athlete i28814 — a QA write would corrupt the real account, #381).
  // Fire-and-forget (never fail the profile save if intervals is down); only maps fields the user actually changed.
  if (!IS_STAGING && req.user.icuKey && req.user.icuAthlete) {
    const w = athleteBasicsPatch(Object.keys(req.body || {}), { heightCm: req.user.info?.heightCm, dob: req.user.info?.dob, sex: req.user.sex })
    if (Object.keys(w).length) icuFetch(req.user, `/athlete/${req.user.icuAthlete}`, { method: 'PUT', body: JSON.stringify(w) }).catch((e) => console.error('[icu-profile-write] ' + (e.message || e)))
  }
  save(store); res.json(pub(req.user))
})

// #210 — per-sport athlete stats, TWO-WAY synced with intervals.icu.
// PULL: read the athlete's intervals sportSettings[] (ftp/maxHr/lthr/threshold_pace, PER SPORT)
// + weight, mapped to our shape. intervals is CANONICAL for these — we also refresh our local
// mirror (+ flat ftp/maxHR the coach reads) so nothing drifts.
app.get('/auth/intervals/athlete', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store') // #582 — never let the browser cache the pull (else an intervals change never reaches the client)
  if (!req.user.icuKey || !req.user.icuAthlete) return res.json({ connected: false })
  const ath = req.user.icuAthlete
  const a = await icuGet(req.user, `/athlete/${ath}`)
  if (!a) return res.status(502).json({ connected: true, error: 'could not read intervals athlete' })
  const mapped = fromIcuSportSettings(a.sportSettings || [])
  // #582 — FILL-BLANK only: Platyplus owns its numbers, so reading the athlete never overwrites a value the user set
  // (the response still returns intervals' raw `mapped` for the "what's in intervals" display + the Import button).
  req.user.sportSettings = mergeIcuSportSettings(req.user.sportSettings, mapped)
  const mFtp = req.user.sportSettings.cycling?.ftp, mMax = req.user.sportSettings.cycling?.maxHr
  if (mFtp != null) req.user.ftp = mFtp
  if (mMax != null) req.user.maxHR = mMax
  const weight = a.icu_weight != null ? a.icu_weight : (a.weight != null ? a.weight : null)
  if (weight != null && weight > 0) req.user.weight = weight // #207 Part 4: stash for the server-side VO₂max estimate
  save(store)
  res.json({ connected: true, sportSettings: mapped, weight, source: 'intervals' })
})
// #582 — EXPLICIT "Import from intervals" (the ONLY intervals-overwrites-Platyplus path). Deliberate: overwrite=true.
// UI button (Stats/Connections) + the coach/test hook both land here. Also self-heals a wrong icuAthlete via /athlete/0.
app.post('/auth/benchmarks/import', auth, async (req, res) => {
  if (!req.user.icuKey) return res.status(400).json({ error: 'not connected to intervals' })
  const ok = await syncBenchmarksFromIcu(req.user, { overwrite: true }).catch(() => false)
  if (!ok) return res.status(502).json({ error: 'could not read intervals' })
  res.json(pub(req.user))
})
app.post('/api/resync-benchmarks', apiAuth, async (req, res) => {
  // default is the SAFE fill-blank sync (never clobbers a Platyplus value, same as app-load); `?overwrite=1` = explicit import
  const overwrite = req.query.overwrite === '1' || req.body?.overwrite === true
  const ok = await syncBenchmarksFromIcu(req.user, { overwrite }).catch(() => false)
  res.json({ ok, overwrite, icuAthlete: req.user.icuAthlete || null, ftp: req.user.ftp || null, cycling: req.user.sportSettings?.cycling || null })
})

// #215 — ESTIMATE the runner's threshold pace from intervals' pace curve (Critical Speed),
// the running analog of eFTP. A suggestion the user can apply/override; never auto-written.
// #271/#272: ASSESS data sufficiency before suggesting — a Critical-Speed read off a handful of
// easy runs is unreliable, and suggesting a (slower) threshold off thin data is misleading.
// We gate on (a) the model fit (r2) AND (b) how much the athlete has actually run recently, and
// return a confidence so the UI only surfaces a suggestion when we're genuinely confident.
app.get('/auth/intervals/run-estimate', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete
  const pc = await icuGet(req.user, `/athlete/${ath}/pace-curves?type=Run`)
  const est = pc ? runThresholdFromPaceCurve(pc) : null
  if (!est) return res.json({ available: false, reason: 'no-model' })
  // How much running is behind this estimate? #501 (JM) — widened 42d → 180d so a valid full-history pace-curve
  // isn't hidden just because the last 6 weeks were light. The ESTIMATE is from intervals' full-history curve.
  const DAYS = 180
  const acts = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(DAYS)}&newest=${icuDay(0)}`)
  const runs = Array.isArray(acts) ? acts.filter((a) => /run/i.test(a.type || '') && a.distance > 0) : []
  const totalKm = runs.reduce((s, a) => s + a.distance, 0) / 1000
  const r2 = est.r2 != null ? est.r2 : 0.7
  // confidence: needs both a decent fit AND enough recent running to trust the curve.
  let confidence = 'low'
  if (runs.length >= 8 && totalKm >= 60 && r2 >= 0.85) confidence = 'high'
  else if (runs.length >= 4 && totalKm >= 25 && r2 >= 0.7) confidence = 'medium'
  // #501 (JM: "estimate with the data you have") — only WITHHOLD when the model itself is weak (poor fit). Thin
  // RECENT running with a good full-history curve → still present the number as a ROUGH estimate (honest low
  // confidence), never a bare "needs 4 runs" when intervals holds the history to model it.
  if (r2 < 0.7) {
    return res.json({ available: false, assessed: true, reason: 'low-fit', runs: runs.length, weeklyKm: +(totalKm / (DAYS / 7)).toFixed(1) })
  }
  if (est.thresholdPace > 0) { req.user.runPaceEst = Math.round(est.thresholdPace); save(store) } // #236 stash computed pace for the coach
  // #512 — a race-VDOT read is reliable (from actual race times), so never call it "low" — floor it to medium.
  if (est.source === 'race VDOT' && confidence === 'low') confidence = 'medium'
  // #512 — return the RAW source ('race VDOT' | 'critical speed') so the client can branch on it exactly. (Was
  // decorated to 'race VDOT (your best times)', which broke the client's `source === 'race VDOT'` match → the whole
  // VDOT path never activated in the UI. `...est` already carries the bare source; don't override it with a label.)
  res.json({ available: true, ...est, confidence, runs: runs.length })
})

// #337 — cycling power benchmarks for a PROPER VO₂max: best 5-min power (≈ maximal aerobic power, MAP)
// + best 20-min + weight, over 90 days. MAP is the right VO₂max input (FTP under-reads badly). Also the
// recent run count so we can suppress a running VO₂max off almost no running.
app.get('/auth/intervals/power-benchmarks', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete
  const pc = await icuGet(req.user, `/athlete/${ath}/power-curves?type=Ride&start=${icuDay(90)}&end=${icuDay(0)}`)
  const curve = pc && Array.isArray(pc.list) ? pc.list[0] : null
  let map5 = null, ftp20 = null, weight = null
  if (curve && Array.isArray(curve.secs)) {
    const vals = curve.values || curve.watts || curve.best || []
    const at = (t) => { for (let i = 0; i < curve.secs.length; i++) if (curve.secs[i] >= t) return Number(vals[i]) || null; return null }
    map5 = at(300); ftp20 = at(1200); weight = curve.weight || null
  }
  const runs = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${icuDay(365)}&newest=${icuDay(0)}`) // #501 — a full YEAR (was 180d) so the observed max-HR peak + HR-power points use more of the athlete's history
  const runsRecent = Array.isArray(runs) ? runs.filter((a) => /run/i.test(a.type || '') && a.distance > 800).length : null
  // #497 — (power, HR) points from steady RIDES (≥20 min, with power+HR) → the HR-power FTP estimator infers FTP from
  // the HR COST of normal/easy rides. Normalized power (icu_weighted_avg_watts) vs avg HR is the cleaner signal.
  const hrPower = (Array.isArray(runs) ? runs : [])
    .filter((a) => /ride|virtualride|cycl/i.test(a.type || '') && (a.icu_weighted_avg_watts || a.icu_average_watts) > 0 && a.average_heartrate > 60 && (a.moving_time || 0) >= 1200)
    .map((a) => ({ watts: Math.round(a.icu_weighted_avg_watts || a.icu_average_watts), hr: Math.round(a.average_heartrate) }))
    .slice(0, 80)
  // #497 running analog — (pace, HR) points from steady RUNS → the HR-pace threshold estimator infers threshold pace
  // from the HR cost of easy/steady runs. Avg pace (moving_time ÷ km) vs avg HR; ≥10 min and ≥1.5 km to skip warm-ups.
  const hrPace = (Array.isArray(runs) ? runs : [])
    .filter((a) => /run/i.test(a.type || '') && a.distance > 1500 && (a.moving_time || 0) >= 600 && a.average_heartrate > 60)
    .map((a) => ({ paceSecKm: Math.round(a.moving_time / (a.distance / 1000)), hr: Math.round(a.average_heartrate) }))
    .filter((p) => p.paceSecKm > 120 && p.paceSecKm < 900)
    .slice(0, 80)
  // #508 — per-ride signals for the multi-signal threshold ENGINE: normalized power + Pw:Hr DECOUPLING (aerobic drift %)
  // + efficiency factor, on real steady rides (≥30 min). decouplingCheck() uses these to CONFIRM or FLAG a candidate FTP.
  const rideSignals = (Array.isArray(runs) ? runs : [])
    .filter((a) => /ride|virtualride|cycl/i.test(a.type || '') && (a.icu_weighted_avg_watts || a.icu_average_watts) > 0 && a.average_heartrate > 60 && (a.moving_time || 0) >= 1800)
    .map((a) => ({ np: Math.round(a.icu_weighted_avg_watts || a.icu_average_watts), hr: Math.round(a.average_heartrate), decoupling: Math.round((Number(a.decoupling) || 0) * 10) / 10, durationMin: Math.round((a.moving_time || 0) / 60), ef: a.icu_efficiency_factor ? Math.round(a.icu_efficiency_factor * 100) / 100 : null, vi: a.icu_variability_index ? Math.round(a.icu_variability_index * 100) / 100 : null })) // #508 vi = variability index — decoupling is only valid on a STEADY effort (VI≈1.0), not intervals
    .slice(0, 60)
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
  // #501 (JM) — age-based fallback (Tanaka 208−0.7·age) so a brand-new athlete with no HR history still gets a
  // real starting max HR, never a blank. Only used when there's nothing observed AND no intervals ceiling.
  const ageYr = req.user.info?.dob ? Math.floor((Date.now() - new Date(req.user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null
  const ageMaxHr = ageYr != null && ageYr > 8 && ageYr < 100 ? Math.round(req.user.sex === 'female' ? 206 - 0.88 * ageYr : 208 - 0.7 * ageYr) : null // #508 sex-specific (Gulati/Tanaka)
  const computedMaxHr = (Math.max(observedMaxHr || 0, icuMaxHr || 0) || null) ?? ageMaxHr ?? null
  const maxHrFrom = computedMaxHr == null ? '' : (observedMaxHr && observedMaxHr >= (icuMaxHr || 0) ? 'observed' : icuMaxHr ? 'intervals' : 'age')
  res.json({ available: !!map5, map5min: map5, ftp20, weight, runsRecent, observedMaxHr, maxHrSamples, icuMaxHr, computedMaxHr, maxHrFrom, hrPower, hrPace, rideSignals }) // #497 hrPower/hrPace · #508 rideSignals = per-ride NP/decoupling/EF for the threshold engine
})

// #216 — running endurance base for the marathon-realism range: longest single run +
// average weekly volume over the recent window, from intervals run activities (km).
app.get('/auth/intervals/run-volume', auth, async (req, res) => {
  if (!req.user.icuKey) return res.json({ available: false })
  const ath = req.user.icuAthlete
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
  const ath = req.user.icuAthlete
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
  if ('tte' in body) patch.tte = numOr(body.tte, 30, 14400) // #401 — TTE seconds (our benchmark, not an intervals field; stored locally, not synced)
  if (group === 'cycling' && 'cp' in body) patch.cp = numOr(body.cp, 60, 500)   // #403 critical power (W)
  if (group === 'cycling' && 'wPrime' in body) patch.wPrime = numOr(body.wPrime, 2, 60) // #403 W′ (kJ)
  if (group === 'running' && 'cs' in body) patch.cs = numOr(body.cs, 120, 900)  // #403 critical speed (sec/km)
  if (group === 'running' && 'dPrime' in body) patch.dPrime = numOr(body.dPrime, 50, 400) // #403 D′ (m)
  if (group === 'swimming' && 'dPrime' in body) patch.dPrime = numOr(body.dPrime, 5, 150) // #swim-tri D′ (m) — smaller reserve than running
  if (group === 'swimming' && 'swolf' in body) patch.swolf = numOr(body.swolf, 20, 100)   // #swim-tri SWOLF (strokes + s per length; lower = better)

  user.sportSettings = user.sportSettings || {}
  const beforeGroup = { ...(user.sportSettings[group] || {}) } // #563 — snapshot to detect a meaningful benchmark change
  user.sportSettings[group] = { ...(user.sportSettings[group] || {}), ...patch }
  if (group === 'running' && 'runVdot' in body) user.runVdot = numOr(body.runVdot, 20, 95)
  if (group === 'cycling') {
    if ('ftp' in patch) user.ftp = patch.ftp
    if ('maxHr' in patch) user.maxHR = patch.maxHr
  }

  let synced = false, pushError = null
  // #570 — push to intervals when this user's writes are safe: prod, OR QA on its OWN athlete (i644563). Never when
  // QA still points at the shared prod athlete i28814 (that write would corrupt prod + clobber the local value).
  if (syncsIntervals(user)) {
    const ath = user.icuAthlete
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
  // #563 — a meaningful FTP/threshold/CSS edit → have the coach re-evaluate the plan + acknowledge the new number (async, best-effort)
  maybeCoachBenchmarkAdapt(user, significantBenchChange(group, beforeGroup, user.sportSettings[group], 'manual'), 'manual').catch(() => {})
  return { status: 200, body: { ...pub(user), synced, pushError } }
}
// #563 — when a KEY benchmark meaningfully changes (the athlete edits it, or imports a new value from intervals), have the
// coach RE-EVALUATE the upcoming plan + send ONE short notification acknowledging the new number. Guarded: only for
// athletes whose writes reach intervals (prod / own athlete — coach planning is prod-only) with a coach set up, and
// DEBOUNCED (~4h) so rapid edits (258→260→262) don't spam. Same runCoachTask pattern as the activity-review.
async function maybeCoachBenchmarkAdapt(user, change, source) {
  if (!change || !syncsIntervals(user)) return
  if (!(user.coachProfile && user.coachProfile.trim())) return
  if (Date.now() - (user.lastBenchAdaptAt || 0) < 4 * 3600 * 1000) return
  user.lastBenchAdaptAt = Date.now(); save(store)
  const src = source === 'manual' ? 'the athlete set it themselves in Platyplus' : 'imported from intervals.icu'
  const msg = `The athlete's ${change.label} just changed from ${Math.round(change.from)} to ${Math.round(change.to)} (${change.dir}) — ${src}. Their ${change.group} training zones move with it (each workout's % target stays, but the real watts/paces shift). Re-evaluate the UPCOMING plan with list_schedule: confirm it still fits, and adjust intensity/load ONLY if this change is big enough to matter. Then send ONE short, encouraging notify acknowledging the new ${change.label} (${Math.round(change.to)}) and what — if anything — you changed. Be concise; decide and act.`
  runCoachTask(user, msg).catch((e) => console.error('[bench-adapt] ' + (e.message || e)))
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
    // #498 (JM 2026-07-12) — the post-check-in coach trigger + its push notification fire on PROD ONLY, never QA/dev
    // (like the daily-adapt scheduler). So a check-in on staging never pushes a coach notification.
    if (!IS_STAGING && req.user.coachProfile && req.user.coachProfile.trim() && ci.date === today && complete && !ci.coachDecided) {
      ci.coachDecided = true; save(store)
      const poor = ci.energy <= 2 || ci.sleep <= 2 || ci.soreness >= 4
      // #535 — a session the coach removed for being MISSED is otherwise invisible. Surface it inside this ONE
      // notification (never a second push): acknowledge it honestly + warmly, credit any replacement, and only
      // if load is genuinely dipping, gently + persuasively motivate — never guilt-trip.
      const removals = (req.user.recentRemovals || []).filter((r) => r && r.date >= addDays(today, -2))
      const removedStr = removals.map((r) => `"${r.title}" (${r.sport}, was planned ${r.date})`).join('; ')
      const missBlock = removedStr ? ` RECENTLY MISSED — acknowledge it inside this SAME single notification (do NOT send a second one): the athlete did not complete ${removals.length > 1 ? 'these planned sessions' : 'this planned session'} — ${removedStr} — so ${removals.length > 1 ? 'they were' : 'it was'} removed from the calendar. Handle it with CARE, in this order: (1) call get_recent_activities first — if they actually trained something else instead (an off-plan ride/run/gym), CREDIT it warmly and reassure them their training is on track; don't call it "missed". (2) If they genuinely did nothing AND their fitness/freshness is trending below where their goal needs it (read get_wellness), name it — but be VERY respectful, compassionate and diplomatic: life happens, never guilt-trip, scold, or shame. Acknowledge it kindly, then gently PERSUADE and MOTIVATE by pointing to the ONE specific upcoming session that gets them back on track and why it matters to their goal. (3) If their load is still fine despite the skip, just note the removal lightly and reassure. Weave this into the plain-language notification, warmly.` : ''
      const msg = `Morning check-in is in for today (${today}) — energy ${ci.energy}/5, sleep ${ci.sleep}/5, soreness ${ci.soreness}/5 (5 = very sore)${poor ? ' — this reads run-down' : ''}. This is the ONE coach notification the athlete gets after checking in — keep it to TODAY; the rest of their plan is kept up to date separately and SILENTLY (no push), so don't re-plan the whole week here. Overnight HRV/sleep from their watch often hasn't synced to intervals this early, so decide from (a) this subjective check-in and (b) their freshness / form — read get_wellness. Look at TODAY's planned session(s) with list_schedule and make a STICK-OR-ADJUST call: if they're ready, keep the plan; if run-down, EASE today — cut intensity/volume, swap to recovery, or move it — with the tools. Then send EXACTLY ONE notify that explains in PLAIN language what you did and why, e.g. "I moved your Thursday ride to Friday and shortened it to 45 min because your legs are sore" or "Sticking with today's easy spin — you're recovered."${missBlock} Write it so a non-athlete understands: NO abbreviations or jargon (never "TTE", "CTL", "ATL", "IF", "NP", "VI", "Form", "eFTP" — say "how fresh you are", "your threshold power", etc.). One notify only. Don't ask questions — decide and act.`
      runCoachTask(req.user, msg).catch((e) => console.error('[checkin-decide] ' + (e.message || e)))
    }
  } catch (e) { console.error('[checkin-decide] trigger ' + e.message) }
})

// #341/#268 — the athlete's LOCATION (weather + local time), BI-DIRECTIONALLY synced with intervals: we
// READ the intervals athlete `city` (option C prefill) and WRITE a changed city back. intervals persists
// `city` but IGNORES lat/lng (verified) → we geocode + keep lat/lon Platyplus-side for weather.
app.get('/auth/location', auth, async (req, res) => {
  const u = req.user
  const hasSaved = u.info && Number.isFinite(u.info.lat) && Number.isFinite(u.info.lon)
  if (hasSaved && u.info.locationName) return res.json({ name: u.info.locationName, lat: u.info.lat, lon: u.info.lon, source: 'saved', timezone: u.icuTimezone || null })
  if (u.icuKey) {
    const me = await icuGet(u, `/athlete/${u.icuAthlete}`).catch(() => null)
    if (me) {
      syncAthleteProfile(u, me); save(store) // #265/#1003 — backfill height/DOB/sex/weight for already-connected users
      if (me.timezone && !u.icuTimezone) { u.icuTimezone = me.timezone; save(store) }
      if (me.city) {
        const name = [me.city, me.state].filter(Boolean).join(', ')
        // #458 — saved COORDS but no NAME (JM: "intervals has my location but it's not in Platyplus"): keep the
        // saved coords, adopt intervals' city name + PERSIST it so the profile shows a place instead of blank.
        if (hasSaved) { u.info.locationName = name; save(store); return res.json({ name, lat: u.info.lat, lon: u.info.lon, source: 'intervals', timezone: u.icuTimezone || me.timezone || null }) }
        const g = await geocodePlace(me.city, me.state, me.country); if (g) return res.json({ name, lat: g.lat, lon: g.lon, source: 'intervals', timezone: u.icuTimezone || me.timezone || null })
      }
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
  if (!IS_STAGING && u.icuKey) icuFetch(u, `/athlete/${u.icuAthlete}`, { method: 'PUT', body: JSON.stringify({ city }) }).catch((e) => console.error('[icu-city-write] ' + (e.message || e))) // #268 write-back (PROD-only — QA is read-only toward the shared athlete)
  res.json({ name: city, lat: g.lat, lon: g.lon, source: 'saved' })
})
app.get('/auth/checkins', auth, (req, res) => res.json(checkinsInRange(req.user, req.query.from, req.query.to)))
// #347 — the athlete's LOCAL "today" from their intervals timezone (not the server's UTC), so a
// tomorrow-forecast near local midnight isn't mistaken for today (e.g. 8pm Montreal = next-day UTC).
// Caches the tz on the user (stable); falls back to UTC.
// #448 — fall back to COACH_TZ (the app's real timezone), NOT UTC: UTC is a day AHEAD every evening in
// the Americas, so an athlete with no tz set (or any UTC path) made the coach think "today" was tomorrow.
const COACH_TZ = process.env.COACH_TZ || 'America/Toronto'
function localTodayInTz(tz) { try { return new Date().toLocaleDateString('en-CA', { timeZone: tz || COACH_TZ }) } catch { return new Date().toLocaleDateString('en-CA', { timeZone: COACH_TZ }) } }
// #448 — the athlete's local weekday name (e.g. "Wednesday"), for the coach's TODAY anchor.
function localWeekdayInTz(tz) { try { return new Date().toLocaleDateString('en-US', { timeZone: tz || COACH_TZ, weekday: 'long' }) } catch { return '' } }
// #367 — the athlete's LOCAL hour (0–23) in their intervals timezone, for the morning auto-adapt scheduler.
function localHourInTz(tz) { try { return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', hour12: false }).format(new Date()), 10) % 24 } catch { return new Date().getUTCHours() } }
async function athleteToday(user) {
  if (!user.icuTimezone && user.icuKey) {
    try { const me = await icuGet(user, `/athlete/${user.icuAthlete}`); if (me && me.timezone) { user.icuTimezone = me.timezone; save(store) } } catch { /* fall back to UTC */ }
  }
  return localTodayInTz(user.icuTimezone)
}
// #195: auto-derived readiness (Sleep · Freshness · Energy 1–5) from 60d of intervals wellness +
// personal baselines. Returns { connected:false } if intervals isn't connected; energy is null on
// cold start (too few HRV days) so the UI keeps the manual tap. See server/readiness.js.
app.get('/auth/readiness', auth, async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : await athleteToday(req.user) // #347 local, not UTC
  const oldest = new Date(date + 'T00:00:00Z'); oldest.setUTCDate(oldest.getUTCDate() - 60)
  const ath = req.user.icuAthlete
  const data = await icuGet(req.user, `/athlete/${ath}/wellness?oldest=${oldest.toISOString().slice(0, 10)}&newest=${date}`)
  if (!data) return res.json({ connected: false })
  const rows = (Array.isArray(data) ? data : []).map((d) => ({
    // #597 — Form matches intervals: ONE decimal (CTL−ATL), NOT integer-rounded. Math.round turned −3.5 into −4
    // while intervals + the rest of the app (round1) show −3.5, so prod disagreed with intervals by a whole point.
    date: d.id, fitness: d.ctl, fatigue: d.atl, form: d.ctl != null && d.atl != null ? Math.round((d.ctl - d.atl) * 10) / 10 : null,
    restingHR: d.restingHR, hrv: d.hrv ?? d.hrvSDNN ?? null, eftp: d.eftp ?? d.icu_eftp ?? null,
    sleepHours: d.sleepSecs ? +(d.sleepSecs / 3600).toFixed(1) : null, sleepScore: d.sleepScore ?? null,
    weight: d.weight ?? null, // #265 — for BMR/TDEE fuel targets
    menstrualPhase: d.menstrualPhase ?? d.menstrualPhasePredicted ?? null, // #329
  }))
  const today = rows.find((r) => r.date === date) || rows[rows.length - 1] || {}
  // #329 — cycle phase for female athletes: intervals wellness `menstrualPhase` if present, else derive
  // from a stored cycle start date + length. Stash it so the coach's system prompt can adjust the PLAN.
  // #422 — order of truth: today's logged/predicted phase → DERIVE from the last PERIOD marker in the
  // wellness history (intervals only stamps the period-start day, not every day) → manual cycleStart.
  // The middle step is what stops us re-asking Xenia for a date intervals already has (she logged it).
  // #427 — PREGNANCY suppresses all of this: there is no menstrual cycle during pregnancy, so never
  // compute/stash a cyclePhase for a pregnant athlete (the coach uses the pregnancy block instead).
  const cyclePhase = (req.user.sex === 'female' && !req.user.info?.pregnant)
    ? (normalizePhase(today.menstrualPhase)
      || phaseFromHistory(rows, date, req.user.info?.cycleLength)
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
  res.json({ connected: true, date, sleepNeed, today, cyclePhase, ...computeReadiness(history, today, { sleepNeed, checkins: calCheckins, cyclePhase, pregnant: !!req.user.info?.pregnant }) })
})

// #223 — FORECAST a FUTURE day's freshness from planned load (only Freshness is knowable ahead;
// Energy/Sleep depend on HRV/sleep that haven't happened). Projects CTL/ATL → Form over the
// planned TSS between today and the target, then maps to an expected Freshness 1–5.
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
app.get('/auth/readiness-forecast', auth, async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null
  if (!date) return res.status(400).json({ error: 'date required' })
  if (!req.user.icuKey || !req.user.icuAthlete) return res.json({ connected: false })
  const today = await athleteToday(req.user) // #347 — LOCAL today (intervals tz), not UTC, so tomorrow isn't read as today
  if (date <= today) return res.json({ connected: true, future: false }) // only future days forecast
  const ath = req.user.icuAthlete
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
  const f = forecastFreshness({ ctl: latest.ctl, atl: latest.atl, tsbBaseline, pregnant: !!req.user.info?.pregnant }, loads)
  res.json({ connected: true, future: true, available: true, date, daysOut: loads.length, ...f, totalPlannedLoad: Math.round(loads.reduce((a, b) => a + b, 0)), plannedDays: Object.keys(byDay).length })
})

// #248 — per-day CTL/ATL/Form PROJECTION for the next N days (forward line on the Load & Form charts).
app.get('/auth/readiness-projection', auth, async (req, res) => {
  if (!req.user.icuKey || !req.user.icuAthlete) return res.json({ connected: false })
  const days = Math.min(28, Math.max(1, Number(req.query.days) || 14))
  const ath = req.user.icuAthlete
  const today = await athleteToday(req.user) // #347 local tz
  const wData = await icuGet(req.user, `/athlete/${ath}/wellness?oldest=${addDays(today, -30)}&newest=${today}`)
  const rows = (Array.isArray(wData) ? wData : []).map((d) => ({ ctl: d.ctl, atl: d.atl }))
  const latest = [...rows].reverse().find((r) => r.ctl != null && r.atl != null)
  if (!latest) return res.json({ connected: true, available: false })
  const end = addDays(today, days)
  const evs = await icuGet(req.user, `/athlete/${ath}/events?oldest=${isoMonday(today)}&newest=${end}`)
  const byDay = {}, icuBlocks = []
  for (const e of (Array.isArray(evs) ? evs : [])) {
    const d = (e.start_date_local || '').slice(0, 10)
    if (!d) continue
    // #393 — an intervals ATP weekly TARGET (category=TARGET, load_target) IS the athlete's real periodization.
    // Collect it as a weekly block (its Monday + weekly TSS target) — still NOT a single-day load (#366).
    if (e.category === 'TARGET') { const t = Number(e.load_target ?? e.icu_training_load) || 0; if (t > 0) icuBlocks.push({ weekStart: isoMonday(d), target: Math.round(t), phase: 'plan', name: e.name }); continue }
    if (d <= today || d > end) continue
    if (e.category === 'NOTE' || /^ATP\b/i.test(e.name || '')) continue
    const load = e.icu_training_load || e.icu_planned_training_load || 0
    if (load > 0) byDay[d] = (byDay[d] || 0) + load
  }
  // #391 — extend the forecast to ~4 weeks. The coach only plans ~2 wks ahead, so PAST the last planned day
  // we assume the athlete HOLDS their recent average daily load (≈ CTL) — a "if you keep training like this"
  // projection. Without it, unplanned future days = 0 load → Form falsely shoots up (fresh from doing
  // nothing). `plannedThrough` marks where the real plan ends so the client can label the held-load tail.
  const plannedDates = Object.keys(byDay).sort()
  const plannedThrough = plannedDates.length ? plannedDates[plannedDates.length - 1] : today
  const heldLoad = Math.max(0, Math.round(latest.ctl)) // recent avg daily training stress (last-resort fallback)
  // #393 — past the coach's detailed plan, project the PERIODIZED weekly LOAD BLOCKS (build/peak/recovery)
  // spread across the athlete's real training days — NOT a flat held-load. Source priority: the coach's authored
  // blocks > the athlete's intervals ATP weekly TARGETs (their real plan) > a CTL-sized default (never flat).
  const authored = Array.isArray(req.user.info?.loadPlan) && req.user.info.loadPlan.length ? req.user.info.loadPlan : null
  const blocks = authored || (icuBlocks.length ? icuBlocks : defaultLoadPlan(latest.ctl, isoMonday(today)))
  const planSource = authored ? 'coach' : (icuBlocks.length ? 'atp' : 'default')
  const histLoads = {}; for (const r of (Array.isArray(wData) ? wData : [])) { if (r && r.id != null) histLoads[String(r.id)] = r.ctlLoad ?? r.atlLoad ?? 0 }
  const restDows = recentRestDows(histLoads)
  const periodized = periodizedLoads(addDays(plannedThrough, 1), end, blocks, { restDows })
  const dates = [], loads = []
  for (let dd = addDays(today, 1); dd <= end; dd = addDays(dd, 1)) { dates.push(dd); loads.push(dd <= plannedThrough ? (byDay[dd] || 0) : (periodized[dd] != null ? periodized[dd] : heldLoad)) }
  const series = projectFormSeries({ ctl: latest.ctl, atl: latest.atl }, loads)
  res.json({ connected: true, available: true, dates, loads, plannedThrough, loadPlan: blocks, planSource, restDows, ctl: series.map((s) => s.ctl), atl: series.map((s) => s.atl), form: series.map((s) => s.form) })
})

// #404 — the athlete's COMPUTED performance metrics (CP/W′/CS/D′/TTE/EF + a profile synthesis) for the COACH,
// mirroring the client benchmark/profile cards so the coach reasons from ACTUAL values (see perf-metrics.js).
app.get('/api/athlete-metrics', apiAuth, async (req, res) => {
  if (!req.user.icuKey || !req.user.icuAthlete) return res.json({ connected: false })
  const ath = req.user.icuAthlete, ss = req.user.sportSettings || {}, sports = req.user.sports || []
  const today = await athleteToday(req.user), from = addDays(today, -365)
  let acts = null
  const efFor = async (type) => {
    if (acts == null) acts = await icuGet(req.user, `/athlete/${ath}/activities?oldest=${from}&newest=${today}`)
    const pts = (Array.isArray(acts) ? acts : []).filter((a) => a.type === type && Number(a.icu_efficiency_factor) > 0 && Number(a.moving_time) >= 1200)
      .map((a) => ({ date: String(a.start_date_local || '').slice(0, 10), ef: Math.round(Number(a.icu_efficiency_factor) * 1000) / 1000 })).sort((x, y) => x.date.localeCompare(y.date))
    return efSummary(pts)
  }
  const out = { connected: true }
  if (sports.includes('cycling') || sports.includes('triathlon') || sports.length === 0) { // #629 — a triathlete needs their BIKE numbers too
    const c = ((await icuGet(req.user, `/athlete/${ath}/power-curves?curves=365d&type=Ride`))?.list || [])[0] || {}
    const pm = (c.powerModels || []).find((m) => m.type === 'FFT_CURVES') || (c.powerModels || [])[0] || {}
    // #464 — round the watt values (eFTP/CP) at the SOURCE so the coach never emits a raw 240.51825 in its
    // activity text ("punchy threshold"). The set FTP is already whole; the power-model eFTP/CP are the decimals.
    const cp = pm.criticalPower != null ? Math.round(pm.criticalPower) : null, wJ = pm.wPrime ?? null, eftp = pm.ftp != null ? Math.round(pm.ftp) : null
    const ftp = ss.cycling?.ftp ?? req.user.ftp ?? eftp
    const tte = tteFromPower(c.secs || [], c.values || [], ftp ?? eftp) ?? tteModelPower(ftp ?? eftp, cp, wJ)
    const ef = await efFor('Ride'), wKj = wJ != null ? Math.round(wJ / 100) / 10 : null
    out.cycling = { ftp, eftp, cp, wPrimeKj: wKj, tteSec: tte, ef, profile: computeAthleteProfile({ sport: 'cycling', threshold: ftp, eftp, tte, cp, reserveKj: wKj, reserveBig: 20, ef: ef.latest, efTrend: ef.trend }) }
  }
  if (sports.includes('running') || sports.includes('triathlon') || sports.length === 0) { // #629 — and their RUN numbers
    const pcFull = (await icuGet(req.user, `/athlete/${ath}/pace-curves?curves=365d&type=Run`)) || {}
    const c = (pcFull.list || [])[0] || {}
    const pmodel = (c.paceModels || [])[0] || {}
    const est = runThresholdFromPaceCurve(pcFull) // #512 — race-VDOT preferred (sex-fair, reliable), CS-model fallback; keeps get_metrics in step with the athlete's benchmark card
    const cs = pmodel.criticalSpeed ?? null, dP = pmodel.dPrime ?? null
    const csPace = est?.csPace ?? (cs > 0 ? Math.round(1000 / cs) : null) // VDOT CS sits just above threshold → threshold ≤ CS
    const thr = ss.running?.thresholdPace ?? req.user.runThresholdPace ?? est?.thresholdPace ?? null
    // #512 — on the VDOT read threshold ≤ CS, so the CS/D′ "above-critical" TTE is void → use the observed hold, else
    // the Daniels aerobic ceiling at threshold (~67 min). Never the old fantasy short TTE the coach used to see.
    const tte = tteFromPace(c.distance || [], c.values || [], thr) ?? tteModelPace(thr, cs, dP) ?? tteAtThresholdSec()
    const ef = await efFor('Run')
    out.running = { thresholdPaceSec: thr, csPaceSec: csPace, dPrimeM: dP != null ? Math.round(dP) : null, tteSec: tte, vdot: est?.vdot ?? null, ef, profile: computeAthleteProfile({ sport: 'running', threshold: thr, eftp: csPace, tte, cp: csPace, reserveKj: dP != null ? Math.round(dP) : null, reserveBig: 200, ef: ef.latest, efTrend: ef.trend }) }
  }
  if (sports.includes('swimming') || sports.includes('triathlon')) {
    // #swim-tri — swim CSS (critical speed) + D′ from intervals' swim pace-curve; TTE = longest continuous swim at ~CSS.
    const pcFull = (await icuGet(req.user, `/athlete/${ath}/pace-curves?curves=365d&type=Swim`)) || {}
    const c = (pcFull.list || [])[0] || {}
    const pmodel = (c.paceModels || [])[0] || {}
    const cs = pmodel.criticalSpeed ?? null, dP = pmodel.dPrime ?? null
    const cssPace = cs > 0 ? Math.round(100 / cs) : (ss.swimming?.thresholdPace ?? null) // sec/100 m (manual fallback)
    let tte = null
    const dd = c.distance || [], vv = c.values || []
    if (cssPace) for (let i = 0; i < dd.length; i++) if (dd[i] > 0 && vv[i] >= 900 && (vv[i] / dd[i]) * 100 <= cssPace * 1.06) tte = Math.max(tte || 0, Math.round(vv[i]))
    out.swimming = { cssPaceSec: cssPace, dPrimeM: dP != null ? Math.round(dP) : null, tteSec: tte, swolf: ss.swimming?.swolf ?? null, profile: computeAthleteProfile({ sport: 'swimming', threshold: cssPace, tte, reserveKj: dP != null ? Math.round(dP) : null, reserveBig: 30, swolf: ss.swimming?.swolf ?? null }) } // #629 — swim now contributes to # DEVELOPMENT PRIORITIES
  }
  // #622 — stash the profile FOCUS (the "what would move your numbers" priorities the Stats card shows) on the user
  // so the coach's PLAN BUILD targets the SAME priorities (buildSystemPrompt emits them as # DEVELOPMENT PRIORITIES).
  // The card was disconnected from the plan — it promised coach work the plan didn't contain (SAY=DO). Now one source.
  const pf = {}
  for (const g of ['cycling', 'running', 'swimming']) { const f = out[g]?.profile?.focus; if (Array.isArray(f) && f.length) pf[g] = f }
  if (Object.keys(pf).length && JSON.stringify(pf) !== JSON.stringify(req.user.profileFocus || {})) { req.user.profileFocus = pf; save(store) }
  res.json(out)
})

// #600 — FRAME the review on the activity's OWN terms. The coach was inventing surrounding-day context ("Easy Z2 the
// day after gym" when no gym happened, "coming off Saturday's long ride" unverified). Only reference an ADJACENT session
// when it's confirmed in get_recent_activities / the calendar — never assume it. Shared across all 3 review triggers
// (single-activity, plan, daily pass) so the rule can't drift. Extends the SAY=DO discipline from the future "next" to
// the review's framing. Keep it ONE tight sentence (token-thrift #590 — it ships on every review turn).
const REVIEW_OWN_TERMS = 'FRAME the session on its OWN terms: only mention an adjacent session ("the day after X", "coming off Y", yesterday/tomorrow) when you have VERIFIED it in get_recent_activities or the calendar — NEVER assume surrounding-day context (no "day after gym" unless a gym session is actually on record).'
// #364/#589 — the async coach review of a completed session (best-effort; only if a coach is set up). EXTRACTED so the
// feedback POST *and* the #589 retry (a stuck/failed review — e.g. the coach was down when feedback was saved) share ONE
// trigger. Returns false when there's nothing to run (no coach / no feedback), so the caller can tell the user.
function triggerActivityReview(user, id, fb, icuActivityId) {
  if (!fb || !(user.coachProfile && user.coachProfile.trim())) return false
  const fields = Object.entries(fb.fields || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
  const rid = icuActivityId || id
  const msg = `The athlete just completed a ${fb.sport || 'workout'} on ${fb.date || 'today'} (intervals activity ${rid}). Post-workout feedback — feel: ${fb.feel || '—'}, RPE: ${fb.rpe || '—'}/10${fields ? ', ' + fields : ''}${fb.note ? `, notes: "${fb.note}"` : ''}. Review it: read the activity (get_recent_activities) + recent check-ins, then call save_coach_review (date ${fb.date || ''}, sport "${fb.sport || ''}", activityId "${rid}") with a one-line verdict, 2-4 short takeaways, and what's next (this auto-posts your note to the intervals Notes thread). ALSO give the activity a PUBLIC-safe title + description with set_activity_text (activityId "${rid}") — describe the workout/route/effort only, NO health/score/plan (that stays in the coach note). If the feedback warrants it (pain, "too hard", poor feel, high RPE), adjust the UPCOMING plan + notify. CALIBRATE the verdict to what was ACTUALLY done — match praise to real duration/volume/effort vs their norm; a tiny, very short, partial, or test session is a light opener/test, NOT a "solid"/"strong"/"great" session — name it honestly, never inflate. ${REVIEW_OWN_TERMS} Be concise; decide and act.`
  runCoachTask(user, msg).catch((e) => console.error('[activity-review] ' + (e.message || e)))
  return true
}
function triggerPlanReview(user, plan, fb) {
  if (!fb || !(user.coachProfile && user.coachProfile.trim())) return false
  const fields = Object.entries(fb.fields || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
  const msg = `The athlete just completed their planned ${plan.sport || 'workout'} "${plan.title || ''}" on ${plan.date}. Post-workout feedback — feel: ${fb.feel || '—'}, RPE: ${fb.rpe || '—'}/10${fields ? ', ' + fields : ''}${fb.note ? `, notes: "${fb.note}"` : ''}. Review how it went: read the completed activity (get_recent_activities) and recent check-ins if useful, then call save_coach_review (date ${plan.date}, sport "${plan.sport || ''}", planId "${plan.id}", and activityId if it matched a device activity) with a one-line verdict, 2-4 short takeaways, and what's next (this auto-posts your note to the intervals Notes thread). If it matched a device activity, ALSO set a PUBLIC-safe title + description with set_activity_text (activity id from get_recent_activities) — workout/route/effort only, NO health/score/plan. If the feedback warrants it (pain/niggle, "too hard", poor feel, or RPE well above target), adjust the UPCOMING plan with the tools and use notify to tell them what changed and why. CALIBRATE the verdict to what was ACTUALLY done — match praise to real duration/volume/effort vs their norm; a tiny, very short, partial, or test session is a light opener/test, NOT a "solid"/"strong"/"great" session — name it honestly, never inflate. ${REVIEW_OWN_TERMS} Be concise; don't ask questions — just review and act.`
  runCoachTask(user, msg).catch((e) => console.error('[coach-review] ' + (e.message || e)))
  return true
}
// #589 — RETRY a stuck/failed coach review. When feedback was saved but no review ever landed (e.g. the coach was down),
// the athlete was stuck on "reviewing…" with no recourse. This re-runs the review from the STORED feedback. `id` = an
// intervals activity id (in activityFeedback) OR a plan/gym id (plan.feedback).
app.post('/auth/activity/:id/review-retry', auth, (req, res) => {
  const id = String(req.params.id)
  const afb = (req.user.activityFeedback || {})[id]
  const plan = (req.user.plans || []).find((p) => p.id === id)
  let ok = false
  if (afb) ok = triggerActivityReview(req.user, id, afb)
  else if (plan && plan.feedback) ok = triggerPlanReview(req.user, plan, plan.feedback)
  else return res.status(404).json({ error: 'no saved feedback to review for this session' })
  if (!ok) return res.status(409).json({ error: 'set up your coach first' })
  res.json({ ok: true, retrying: true })
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
  // #76/#589 — fire the async coach review (best-effort, non-blocking; extracted so the #589 retry reuses it).
  triggerPlanReview(req.user, plan, plan.feedback)
})

// #583 — a completed intervals ACTIVITY and the coach PLAN it fulfilled are ONE session for feedback. Map any sport
// label (our ride/run/swim/gym OR an intervals type Ride/Run/Swim/WeightTraining) to a canonical group so they match.
const sportGroupOf = (s) => {
  const t = String(s || '').toLowerCase()
  if (/ride|cycl|bike/.test(t)) return 'ride'
  if (/run/.test(t)) return 'run'
  if (/swim/.test(t)) return 'swim'
  if (/gym|weight|strength|workout/.test(t)) return 'gym'
  return t
}
// resolve the OTHER id of a linked plan↔activity pair (activityLinks[activityId] = planId), either direction.
const siblingFeedbackId = (user, id) => {
  const links = user.activityLinks || {}
  if (links[id]) return links[id] // id is an activity → its plan
  for (const [act, plan] of Object.entries(links)) if (plan === id) return act // id is a plan → its activity
  return null
}
// #273 — post-workout feedback for a COMPLETED intervals ACTIVITY (device rides/runs that have no
// Platyplus plan). Stored per-user keyed by activity id; triggers an async coach review (activityId).
// #583 — feedback on the LINKED plan/activity counts as this session's, so no view re-nags for feedback already given.
app.get('/auth/activity/:id/feedback', auth, (req, res) => {
  const fbs = req.user.activityFeedback || {}
  const id = String(req.params.id)
  const sib = siblingFeedbackId(req.user, id)
  res.json(fbs[id] || (sib && fbs[sib]) || null)
})
// Skip a session's feedback — the athlete doesn't want to log it. Drops it from the "to review" list so it
// stops nagging (a per-user set of activity ids; `incompleteFeedback` filters these out). #review-skip
app.post('/auth/activity/:id/feedback-skip', auth, (req, res) => {
  const id = String(req.params.id)
  req.user.feedbackSkips = Array.from(new Set([...(req.user.feedbackSkips || []), id])).slice(-500)
  save(store)
  res.json({ ok: true })
})
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
  const ath = user.icuAthlete
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

app.post('/auth/activity/:id/feedback', auth, async (req, res) => {
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
  // #583 — a completed activity + the coach PLAN it fulfilled are ONE session. Link them (either direction), MIRROR the
  // feedback onto the sibling id, and target the intervals write-back at the ACTIVITY id even when the athlete gave
  // feedback from the PLANNED view — so no view re-nags for feedback that's already been given (xenia's dup bug).
  req.user.activityLinks = req.user.activityLinks || {}
  const isActId = /^i?\d+$/.test(id)
  let icuActivityId = isActId ? id : null
  let sibling = siblingFeedbackId(req.user, id)
  if (!sibling) {
    if (isActId) { // saved ON the activity → find + link the plan it fulfilled (same local day + sport group)
      const plan = (req.user.plans || []).find((p) => String(p.date).slice(0, 10) === (fb.date || '') && sportGroupOf(p.sport) === sportGroupOf(fb.sport))
      if (plan && req.user.activityLinks[id] === undefined) { req.user.activityLinks[id] = plan.id; sibling = plan.id }
    } else if (req.user.icuKey && req.user.icuAthlete) { // saved ON the plan → find + link the completed activity for its day
      const plan = (req.user.plans || []).find((p) => p.id === id)
      const day = plan ? String(plan.date).slice(0, 10) : (fb.date || '')
      const grp = sportGroupOf(plan ? plan.sport : fb.sport)
      if (day) {
        const acts = await icuGet(req.user, `/athlete/${req.user.icuAthlete}/activities?oldest=${day}&newest=${day}`).catch(() => null)
        const free = (Array.isArray(acts) ? acts : []).filter((a) => req.user.activityLinks[String(a.id)] === undefined)
        // CLONE intervals' own pairing: it attaches a completed activity to the planned event of the SAME DAY + TYPE and
        // exposes it as `paired_event_id`. Our plan was pushed as that event (plan.icuEventId), so reuse intervals' pairing
        // first; fall back to same-day + same-sport-group (the identical criteria) when the plan wasn't pushed / isn't paired.
        const act = (plan?.icuEventId && free.find((a) => String(a.paired_event_id || '') === String(plan.icuEventId)))
          || free.find((a) => sportGroupOf(a.type) === grp)
        if (act) { req.user.activityLinks[String(act.id)] = id; sibling = String(act.id); icuActivityId = String(act.id) }
      }
    }
  } else if (!isActId && /^i?\d+$/.test(sibling)) icuActivityId = sibling // plan saved, its linked activity is the write-back target
  if (sibling) req.user.activityFeedback[sibling] = fb // MIRROR — both ids report the same feedback
  save(store)
  res.json({ ok: true, feedback: fb })
  // #273 BI-DIRECTIONAL: write feel/RPE + custom fields BACK to the intervals activity (as the
  // 1-based indices intervals stores), so it shows up in intervals too. #583 — targets the linked activity
  // even when feedback came from the planned view, so the Review nag (which reads the activity) is satisfied.
  if (req.user.icuKey && icuActivityId) {
    // #288 — make sure the custom fields exist BEFORE writing values (guarded flag → runs once); covers
    // athletes who connected before #288 so the 1-based values have somewhere to land.
    if (!req.user.icuFieldsAt) ensureIcuFields(req.user).catch(() => {})
    const payload = {}
    const fi = ICU_FEEL_LABELS.indexOf(fb.feel); if (fi >= 0) payload.feel = fi + 1
    if (fb.rpe) payload.icu_rpe = fb.rpe
    const fbDefs = fbFieldsFor(fb.sport) // #330 — a run's values map through the RUN option list
    for (const [label, val] of Object.entries(fb.fields || {})) { const def = fbDefs[label]; if (def) { const i = def.opts.indexOf(val); if (i >= 0) payload[def.code] = i + 1 } }
    if (Object.keys(payload).length) icuFetch(req.user, `/activity/${icuActivityId}`, { method: 'PUT', body: JSON.stringify(payload) }).catch((e) => console.error('[icu-feedback-write] ' + (e.message || e)))
    // #287: the free-text comment isn't a field — it lives in the intervals MESSAGE thread. Post it
    // there (deduped) so "Anything else?" shows up in intervals too, not just Platyplus.
    if (fb.note && fb.note.trim()) syncActivityNote(req.user, icuActivityId, fb.note.trim()).catch((e) => console.error('[icu-note-write] ' + (e.message || e)))
  }
  // #364/#589 — async coach review of the activity (best-effort; extracted so the #589 retry reuses it).
  triggerActivityReview(req.user, id, fb, icuActivityId)
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

// #438 — ADMIN BACKLOG triage overlay. The item LIST is built from FEEDBACK-LOG.md (bundled backlog.json);
// this is JM's LIVE triage on top of it — per item number: priority (hi|med|lo), a comment thread, and a
// discard flag. Stored on the admin's own record (JM is the owner) so Claude can read it each session.
const PRIORITIES = ['hi', 'med', 'lo']
const BACKLOG_STATUSES = ['review', 'todo', 'roadmap', 'totest', 'pass', 'done', 'fail', 'discarded'] // JM's status OVERRIDES the .md-derived one; 'review' = a user report awaiting triage; 'roadmap' (#494) = future work to assess/approve later (parked); 'pass' = JM tested-OK on QA (I flip pass→done on prod promote). Old 'build' merged into todo (mapped on read).
const BACKLOG_TYPES = ['bug', 'feature', 'idea'] // #chore removed (JM) — legacy 'chore' rows just display, not settable
const BACKLOG_AREAS = ['admin', 'cycling', 'running', 'gym', 'stats', 'eat', 'today', 'plan', 'coach', 'other'] // JM can OVERRIDE the auto-derived page/area per item
// #438/#440/#466 — the backlog (triage + app-added items + user reports) lives in ONE SHARED FILE that is
// bind-mounted into BOTH the prod and QA containers (/srv/backlog on the same box). So the board is IDENTICAL
// across envs AT ALL TIMES (JM directive: "items in prod = items in QA at all time") — no per-env Postgres copy,
// no sync cron to babysit. Every read/write hits the file directly (writes are atomic via temp+rename).
const BACKLOG_FILE = process.env.BACKLOG_FILE || '/srv/backlog/backlog.json'
const BACKLOG_DIR = BACKLOG_FILE.replace(/\/[^/]*$/, '') || '.'
const readBacklog = () => { try { const b = JSON.parse(readFileSync(BACKLOG_FILE, 'utf8')); return { triage: b.triage || {}, added: b.added || [] } } catch { return { triage: {}, added: [] } } }
// #485 — the generated item LIST, published to the SHARED mount (newest # wins) so QA + prod show the SAME items
// (was bundled per-build → they diverged). The frontend fetches these, falling back to its own bundle if absent/empty.
const ITEMS_FILE = process.env.ITEMS_FILE || '/srv/backlog/items.json'
const readItems = () => { try { const a = JSON.parse(readFileSync(ITEMS_FILE, 'utf8')); return Array.isArray(a) ? a : (Array.isArray(a?.items) ? a.items : []) } catch { return [] } }
const writeBacklog = (bl) => {
  const out = { triage: bl.triage || {}, added: bl.added || [] }
  try { mkdirSync(BACKLOG_DIR, { recursive: true }); const tmp = BACKLOG_FILE + '.tmp'; writeFileSync(tmp, JSON.stringify(out)); renameSync(tmp, BACKLOG_FILE) }
  catch (e) { console.error('[backlog] write failed:', e?.message) }
}
// App-GENERATED items (user reports + admin-adds) live at #1000+ so they can NEVER collide with the
// roadmap numbers (#1..NNN) parsed from FEEDBACK-LOG.md. (#440 bug: reports auto-numbered 439/440 and
// OVERWROTE the real #439/#440 roadmap items in the merge — invisible reports + masked roadmap.)
const REPORT_BASE = 1000
const nextBacklogN = (bl) => Math.max(REPORT_BASE - 1, ...(bl.added || []).map((x) => x.n || 0)) + 1
app.get('/auth/admin/backlog', auth, admin, (req, res) => { const items = readItems(); res.json({ ...readBacklog(), ...(items.length ? { items } : {}) }) })
// #468 — a small SHARED status file so JM can SEE (Admin → Claude panel) what Claude is working on live: which
// batch, progress toward the 10-item bucket, the current item + a note, and how many bugs remain. Claude writes
// this file as it works (same shared /srv/backlog mount, both envs); the Admin panel polls this endpoint.
const CLAUDE_STATUS_FILE = process.env.CLAUDE_STATUS_FILE || '/srv/backlog/claude-status.json'
const readClaudeStatus = () => { try { return JSON.parse(readFileSync(CLAUDE_STATUS_FILE, 'utf8')) } catch { return { active: false, note: 'idle' } } }
// #468 — the worker's rolling recent-outcomes feed (what it did to each item) so JM sees per-item results.
const CLAUDE_RECENT_FILE = process.env.CLAUDE_RECENT_FILE || '/srv/backlog/claude-recent.json'
const readClaudeRecent = () => { try { const a = JSON.parse(readFileSync(CLAUDE_RECENT_FILE, 'utf8')); return Array.isArray(a) ? a.slice(0, 8) : [] } catch { return [] } }
app.get('/auth/admin/claude-status', auth, admin, (req, res) => {
  const st = readClaudeStatus()
  // #468 — the XPS bug-worker writes {where,state,item,dry,at}; normalise to what the panel expects so a running
  // worker actually shows as WORKING (not idle). where distinguishes the two workers: XPS = bugs, Mac = features/ideas.
  const active = st.state === 'working'
  const updatedAt = st.at ? Date.parse(st.at) : (st.updatedAt || 0)
  const where = st.where || (st.state ? 'xps' : null)
  const note = st.note || (active
    ? `Fixing bug #${st.item}${st.dry ? ' · dry run' : ''}`
    : (st.worked ? `Idle — last run handled ${st.worked} item${st.worked === 1 ? '' : 's'}` : 'Idle — waiting for the next bug'))
  // LIVE to-test bucket from the backlog (not a static write) so JM always sees the REAL items to test one-by-one.
  const bl = readBacklog()
  const pending = Object.entries(bl.triage || {}).filter(([, t]) => t && t.status === 'totest').map(([k]) => Number(k)).sort((a, b) => a - b)
  res.json({ active, where, note, item: st.item ?? null, updatedAt, liveTotest: pending.length, pending: pending.slice(0, 15), recent: readClaudeRecent(), trigger: readClaudeTrigger() })
})
// #468 — JM taps "Start next batch" in the panel → drop a request flag (its OWN file so it never races Claude's
// status writes). Claude's watcher polls this + refills on demand, not only at totest==0.
const CLAUDE_TRIGGER_FILE = process.env.CLAUDE_TRIGGER_FILE || '/srv/backlog/claude-trigger.json'
const readClaudeTrigger = () => { try { return JSON.parse(readFileSync(CLAUDE_TRIGGER_FILE, 'utf8')) } catch { return null } }
app.post('/auth/admin/claude-trigger', auth, admin, (req, res) => { try { writeFileSync(CLAUDE_TRIGGER_FILE, JSON.stringify({ requestedAt: Date.now(), by: req.user.username || 'you' })) } catch (e) { return res.status(500).json({ error: 'could not write trigger' }) } res.json({ ok: true }) })
app.put('/auth/admin/backlog/:n', auth, admin, (req, res) => {
  const n = String(Number(req.params.n) || '')
  if (!n || n === '0') return res.status(400).json({ error: 'valid item number required' })
  const bl = readBacklog()
  const prevStatus = bl.triage[n]?.status // #467 — detect the transition INTO 'done' to notify the reporter
  const t = { comments: [], ...bl.triage[n] }
  const b = req.body || {}
  if ('priority' in b) t.priority = PRIORITIES.includes(b.priority) ? b.priority : undefined // null/other → clear
  if ('status' in b) { t.status = BACKLOG_STATUSES.includes(b.status) ? b.status : undefined; delete t.discarded } // status supersedes the old discarded bool
  if ('type' in b) t.type = BACKLOG_TYPES.includes(b.type) ? b.type : undefined
  if ('area' in b) t.area = BACKLOG_AREAS.includes(b.area) ? b.area : undefined // JM overrides the auto-derived page
  if (typeof b.discarded === 'boolean') t.discarded = b.discarded // back-compat
  if (typeof b.comment === 'string' && b.comment.trim()) { t.comments.push({ text: b.comment.trim().slice(0, 800), at: Date.now(), by: req.user.username || 'you' }); if (t.comments.length > 100) t.comments = t.comments.slice(-100) }
  if (b.deleteCommentAt) t.comments = t.comments.filter((c) => c.at !== b.deleteCommentAt)
  if (!t.priority && !t.status && !t.type && !t.area && !t.discarded && !t.comments.length) delete bl.triage[n] // drop empty rows
  else bl.triage[n] = t
  writeBacklog(bl)
  // #467 — when a user's REPORT is marked 'done' (fixed + shipped), push the reporter so they know it's fixed.
  if (t.status === 'done' && prevStatus !== 'done') {
    const rep = (bl.added || []).find((x) => String(x.n) === n)
    const who = rep && rep.reporter && (store.users || []).find((u) => u.username === rep.reporter || u.email === rep.reporter)
    // #5003 — tag it 'report' so the bell shows a green "Your report" (not a purple "Coach update"); no link (reports live in the top-bar megaphone, there's no /reports route).
    if (who && who.id !== req.user.id) { pushNotification(who, { id: 'fixed-' + n, subkind: 'report', title: '✅ Your report is fixed', body: rep.title }); save(store) }
  }
  res.json({ n: Number(n), triage: bl.triage[n] || null })
})
// ADMIN adds a backlog item directly (title + type + priority). App-added items get merged into the .md-derived
// list; Claude folds them into FEEDBACK-LOG.md each session.
app.post('/auth/admin/backlog', auth, admin, (req, res) => {
  const b = req.body || {}
  const title = String(b.title || '').trim()
  if (!title) return res.status(400).json({ error: 'title required' })
  const bl = readBacklog()
  const n = Number(b.n) >= REPORT_BASE ? Number(b.n) : nextBacklogN(bl)
  const item = { n, title: title.slice(0, 200), summary: String(b.summary || '').trim().slice(0, 1000), reporter: req.user.username || 'admin', at: Date.now() }
  bl.added = [item, ...bl.added.filter((x) => x.n !== n)]
  const seed = {}
  if (BACKLOG_TYPES.includes(b.type)) seed.type = b.type
  if (PRIORITIES.includes(b.priority)) seed.priority = b.priority
  bl.triage[String(n)] = { comments: [], ...bl.triage[String(n)], ...seed }
  writeBacklog(bl)
  res.status(201).json({ item, triage: bl.triage[String(n)] || null })
})
// #440 — ANY signed-in user reports a bug/idea → lands in the shared backlog as status 'review' (under review),
// stamped with the reporter + time. Not admin-gated (that's the point — the whole team can report).
app.post('/auth/report', auth, (req, res) => {
  const b = req.body || {}
  const title = String(b.title || '').trim()
  if (!title) return res.status(400).json({ error: 'a short description is required' })
  const type = BACKLOG_TYPES.includes(b.type) ? b.type : 'bug'
  const bl = readBacklog()
  const n = nextBacklogN(bl)
  const item = { n, title: title.slice(0, 200), summary: String(b.summary || '').trim().slice(0, 1000), reporter: req.user.username || req.user.email || 'user', at: Date.now() }
  bl.added = [item, ...bl.added]
  bl.triage[String(n)] = { comments: [], type, status: 'review' }
  writeBacklog(bl) // the report itself → shared backlog file
  // tell the OTHER admins a report came in (not the reporter themselves)
  for (const admU of (store.users || []).filter((u) => u.role === 'admin' && u.id !== req.user.id)) pushNotification(admU, { id: 'report-' + n, title: `${type === 'idea' ? '💡 Idea' : '🐛 Bug'} reported by ${item.reporter}`, body: title.slice(0, 120), link: '/admin' })
  save(store) // persist the admins' in-app bell notifications (backlog already saved to its file above)
  res.status(201).json({ ok: true, n })
})
// #467 — ANY signed-in user sees THEIR OWN reports + current status (so a non-admin like Xenia can tell
// whether her bug was fixed). Scoped to the caller's reports only; admins use the full board instead.
app.get('/auth/my-reports', auth, (req, res) => {
  const bl = readBacklog()
  const me = [req.user.username, req.user.email].filter(Boolean)
  const mine = (bl.added || [])
    .filter((x) => me.includes(x.reporter))
    .map((x) => { const t = bl.triage[String(x.n)] || {}; return { n: x.n, title: x.title, summary: x.summary || '', at: x.at || 0, status: t.status || 'review', type: t.type || 'bug' } })
    .sort((a, b) => (b.at || 0) - (a.at || 0))
  res.json({ reports: mine })
})

// ---- coach API token (shown to its owner only) ---------------------------
// #577 (JM: "I don't want people to use the API, just me or an admin") — obtaining/rotating the Coach API token is
// ADMIN-ONLY. Every user still HAS a token and their coach still uses it SERVER-SIDE to push plans (apiAuth stays
// per-user, so the coach works for everyone) — non-admins just can't fetch it to call /api/* by hand. UI already hides it.
app.get('/auth/token', auth, admin, (req, res) => res.json({ token: req.user.apiToken }))
app.post('/auth/token/rotate', auth, admin, (req, res) => { req.user.apiToken = randomBytes(24).toString('base64url'); save(store); res.json({ token: req.user.apiToken }) })

// The app (session) reads its own plans for the Today merge-by-id.
app.get('/auth/plans', auth, (req, res) => { healMirror(req.user).catch(() => {}); res.json(plansInRange(req.user, req.query.from, req.query.to)) }) // #5026 — sync-on-load: repair the intervals mirror when the athlete opens the plan view (fire-and-forget, cooldown-guarded)
// #528 — fetch ONE plan by id (session auth) so an intervals "Open in Platyplus" deep link works COLD (no prior
// Today load). Owner-scoped: only the authenticated user's own plan; a 404 means it isn't in THIS account
// (e.g. the link was opened in a different user's session — the client shows a clearer message than "not found").
app.get('/auth/plan/:id', auth, (req, res) => {
  const p = (req.user.plans || []).find((x) => x.id === req.params.id)
  return p ? res.json(p) : res.status(404).json({ error: 'not_found' })
})
// Calendar authoring (session): create/update/delete workout plans from the UI
// — same path as the coach API, so it auto-pushes to intervals.
app.post('/auth/plans', auth, async (req, res) => { const r = await upsertPlan(req.user, req.body, 'you'); res.status(r.status).json(r.body) })
// #479 — the athlete flips a planned RIDE between INDOOR (ERG, specific watts) and OUTDOOR (rideable range); we
// re-push so the intervals event + workout steps re-encode (VirtualRide+point vs Ride+band). Owner-scoped.
app.post('/auth/plan/:id/indoor', auth, async (req, res) => {
  const p = (req.user.plans || []).find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'not found' })
  if (p.sport !== 'ride') return res.status(400).json({ error: 'indoor/outdoor applies to rides' })
  p.indoor = !!req.body?.indoor; p.updatedAt = Date.now(); save(store)
  await pushPlanToIcu(req.user, p).catch(() => {}) // prod-only push (IS_STAGING no-op)
  res.json({ ok: true, indoor: p.indoor })
})
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
  // Lingering-A (JM 2026-07-16): widened to 60 days so OLD uncompleted plans (past the coach-reshape window) get
  // silently garbage-collected — the calendar mirrors what actually happened, no month-old ghosts linger.
  const past = (user.plans || []).filter((p) => p.date && p.date < today && p.date >= addDays(today, -60))
  if (!past.length) return res.json({ missed: 0, paired: 0, gc: 0 })
  // completion signals: local logs (by id + day/sport) + the intervals ACTIVITY object per slot (for pairing)
  const logDoneIds = new Set((user.logs || []).map((l) => l.workoutId).filter(Boolean))
  const logSlots = new Set((user.logs || []).map((l) => slotKey(l.date, l.discipline === 'running' ? 'run' : l.discipline === 'cycling' ? 'ride' : 'gym')))
  const actBySlot = {}
  if (user.icuKey) {
    const acts = await icuGet(user, `/athlete/${user.icuAthlete}/activities?oldest=${addDays(today, -60)}&newest=${today}`).catch(() => null)
    for (const a of (Array.isArray(acts) ? acts : [])) { const k = slotKey((a.start_date_local || '').slice(0, 10), eventSport(a.type)); if (!actBySlot[k]) actBySlot[k] = a }
  }
  // Completion with ±1-day tolerance (a session done a day early/late still counts) — so the GC NEVER deletes a
  // plan the athlete actually did on an adjacent day. Uses activities + local logs.
  const isDone = (p) => [-1, 0, 1].some((o) => { const d = addDays(p.date, o), k = slotKey(d, p.sport); return !!actBySlot[k] || logSlots.has(k) }) || logDoneIds.has(p.id) || logDoneIds.has(`plan-${p.id}`)
  let paired = 0
  const missed = [], orphanOld = []
  for (const p of past) {
    const act = actBySlot[slotKey(p.date, p.sport)]
    // #346 — DONE: pair the completed activity to our planned event (idempotent — only if not already paired)
    if (act && p.icuEventId && act.id && act.paired_event_id == null) {
      if (await pairActivityToPlan(user, act.id, p.icuEventId)) { paired++; act.paired_event_id = p.icuEventId }
    }
    const done = isDone(p)
    // #156 — MISSED handling, once per plan: a RECENT no-show → the coach reshapes the week + removes it.
    if (!p.missedHandledAt) {
      p.missedHandledAt = Date.now()
      if (!done && p.date >= addDays(today, -3)) missed.push(p) // recent + truly missed → coach reshapes
    }
    // Lingering-A: an OLDER uncompleted plan is a stale orphan → GC it. Re-checked every run (NOT gated on
    // missedHandledAt) so already-handled stragglers still get cleaned; ±1-day tolerance protects real sessions.
    if (!done && p.date < addDays(today, -3)) orphanOld.push(p)
  }
  // Silent GC of old orphans — deletePlanById also removes the intervals planned event, so intervals mirrors too.
  let gc = 0
  for (const p of orphanOld) { try { await deletePlanById(user, p.id, 'gc-orphan'); gc++ } catch (e) { console.error('[missed-gc] ' + (e.message || e)) } }
  // #535 — remember what was removed for being missed, so the NEXT check-in notification can acknowledge it
  // honestly (what/impact/credit-a-replacement) instead of silently deleting. Keep ~5 days, max 8.
  if (missed.length) {
    const now = Date.now()
    user.recentRemovals = [
      ...missed.map((p) => ({ title: p.title, sport: p.sport, date: p.date, at: now })),
      ...(user.recentRemovals || []),
    ].filter((r) => r && r.at > now - 5 * 864e5).slice(0, 8)
  }
  save(store)
  if (missed.length && user.coachProfile && user.coachProfile.trim()) {
    const list = missed.map((p) => `"${p.title}" (${p.sport}, planned ${p.date}, id ${p.id})`).join('; ')
    const ids = missed.map((p) => p.id).join(', ')
    const msg = `The athlete MISSED ${missed.length} planned session${missed.length > 1 ? 's' : ''} (now past, not completed): ${list}. Reassess the REST OF THIS WEEK (list_schedule): if a missed session still matters for the plan, MOVE it to a free upcoming day that fits their availability + the one-session-per-day rule; if the week's stimulus is already covered or there's no room, DROP it. EITHER WAY, remove each missed workout from the calendar now with remove_workout (ids: ${ids}) so it doesn't linger. Keep easy days easy; never stack two hard days. Do this SILENTLY — do NOT call notify / push (#498, JM 2026-07-15): the athlete gets their ONE coach notification at check-in, so this background cleanup must never send a surprise second morning push. Just fix the calendar and stop. Don't nag or ask questions.`
    runCoachTask(user, msg).catch((e) => console.error('[missed-handler] ' + (e.message || e)))
  }
  res.json({ missed: missed.length, paired, gc })
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
  // exNames/exIds MUST be persisted (#591): bestE1rmByExercise + the by-exercise summary key sets to their
  // exercise by name — dropping them here made every synced gym log show "Exercise N" and starved the 1-RM analytics.
  const log = { sid: newId(), workoutId: b.workoutId || '', title: b.title || '', discipline: b.discipline || '', duration: Number(b.duration) || 0, date: b.date || new Date().toISOString().slice(0, 10), completedAt: b.completedAt || Date.now(), setsCompleted: b.setsCompleted, volume: b.volume, tss: b.tss, sets: b.sets, exNames: b.exNames, exIds: b.exIds, notes: b.notes }
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
const coachIdentity = (name) => `You are ${name}, a personal training & nutrition coach inside the Platyplus app, helping ONE user (the signed-in account) with THEIR own plan. Use ONLY the provided platyplus tools to create or adjust their workouts, rides, runs, meals, mind sessions and notes. You cannot modify the app, read files, run commands, or access any other user. **CONFIDENTIALITY (absolute):** everything about this athlete — their profile, coach-memory, data, plan, and anything they tell you — is STRICTLY PRIVATE to them. NEVER reference, compare to, or bring up ANY other person (another athlete, a family member, another user, "someone else I coach") in your coaching; you have ONLY this athlete's information and you coach ONLY them. What you learn about one person NEVER carries to anyone else. When you schedule or change something, do it with the tools, then confirm in one short sentence what you changed (e.g. "Added a Push day to Thursday."). TITLE + describe every workout by its TRAINING content and purpose ("Full-Body Strength", "Sweet-Spot 3×12", "Easy Aerobic Run") — NEVER after the weather or a theme (no "Rain Day", "Hot Day", "Windy Ride"); weather only informs indoor/outdoor + intensity + fuel, it is never the name. Be concise, practical and encouraging.

FORMAT FOR A PHONE (never a wall of text): lead with the answer in one line. If the reply runs beyond ~3 sentences, break it up — use a short **bold** mini-header per topic and hyphen "- " bullets for lists (days, steps, options). Keep bullets to one line each. Markdown renders (**bold**, "- " bullets, "## " headers); don't use tables or code blocks. Prefer 2-4 tight sections over one long paragraph.`

// The coach also helps users configure & use Platyplus itself. These steps require
// taps in the user's browser (the coach guides, it can't do them).
const APP_HELP = `# Helping with Platyplus (configuration & usage)
You can also help the user set up and use the app — guide them in plain steps:
- intervals.icu: Profile → Athlete/Connections → intervals.icu. They paste their Athlete ID and an API key (from intervals.icu → Settings → "Developer settings" → API key). Once connected, planned and completed rides sync into their calendar.
- Strava/Garmin/Coros/Wahoo: DON'T connect these to Platyplus directly — connect them INSIDE intervals.icu (intervals → Settings → connections). Platyplus reads everything through intervals, so their activities + wellness flow in automatically.
- Athlete profile: Profile → Athlete. This is the profile YOU read — goals, sport, weekly hours, FTP/maxes, equipment, constraints, injuries, preferences. Encourage them to keep it current; the more accurate it is, the better you plan.
- Features: Plan (the calendar + daily check-in + the day's sessions; Day/Week/Month/Schedule views — the old "Today" now lives in Plan's Day view), Stats (Fitness/Strength/Progress), Recovery, and this Coach chat. (Eat + Mind are currently deactivated — #491.)
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
  // #534 — strength engine (peer to cycling/running): 1-RM + %1RM zones, GOAL-DEPENDENT volume, concurrent-training.
  { key: 'strength', file: 'coach-engine-strength.md', sports: ['strength', 'gym'], rx: /\b(gym|strength|lift|lifting|weights?|squat|bench|deadlift|hypertroph|1[\s-]?rm|dumbbell|barbell)\b/i },
  // #swim-tri — swimming engine (peer to cycling/running): CSS benchmark + zones + technique/SWOLF + sTSS.
  { key: 'swimming', file: 'coach-engine-swimming.md', sports: ['swimming', 'swim', 'triathlon'], rx: /\b(swim|swimming|css|critical swim|freestyle|backstroke|breaststroke|open[- ]?water|pool)\b/i },
  // #swim-tri — triathlon PLANNING layer (not a benchmark): Friel periodization + weekly 3-sport balance + bricks.
  { key: 'triathlon', file: 'coach-engine-triathlon.md', sports: ['triathlon'], rx: /\b(triathlon|triathlete|ironman|70\.3|\bbrick\b|olympic distance|sprint tri)\b/i },
].map((e) => ({ ...e, text: loadEngine(e.file) }))

// #613 — the athlete's WEEK SHAPE from their profile (pure weekShape() + the user-field plumbing). ONE place so
// the system prompt and the daily-adapt orchestration (sharpen gate) agree on how many quality days this athlete
// gets — no more contradiction between passes.
function athleteWeekShape(user) {
  const isFemale = user && user.sex === 'female'
  const today = localTodayInTz(user && user.icuTimezone)
  const pg = (isFemale && user.info && user.info.pregnant) ? pregnancyStage(user.info, today) : null
  const cycleFresh = !!(user && user.cyclePhaseAt && (Date.now() - new Date(user.cyclePhaseAt + 'T00:00:00Z').getTime()) < 6 * 86400000)
  const age = (user && user.info && user.info.dob) ? Math.floor((Date.now() - new Date(user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null
  return weekShape({
    pregnant: !!(isFemale && user.info && user.info.pregnant), trimester: pg ? pg.trimester : null,
    cyclePhase: user && user.cyclePhase, cycleFresh,
    goalFocus: user && user.info && user.info.goals && user.info.goals.focus,
    goalNotes: user && user.info && user.info.goals && user.info.goals.notes,
    ctl: user && user.ctl, trainingDays: Number(user && user.info && user.info.trainingDays) || 0, ageYears: age,
  })
}

// #615 — ENFORCE the athlete's week-shape intensity ceiling + quality-day COUNT on the plan being saved. The
// prompt-only "0 quality days for pregnancy" was IGNORED by the LLM (it still wrote sweet-spot intervals), so we
// clamp it in code: no ride/run segment may exceed the athlete's ceiling %, and once the Mon–Sun week already has
// its allowed number of moderate/quality days, any further hard session is clamped down to easy endurance. A build
// athlete's ceiling is VO2 (130%) → nothing clamps. Mutates plan.segments (+ relabels a now-inaccurate title).
// #615/#620 — ENFORCE the athlete's week-shape on the plan being saved. The prompt-only "0 quality days for
// pregnancy" was IGNORED by the LLM (it still wrote sweet-spot/tempo intervals), so we clamp it in code. All the pure
// logic (ceiling clamp + moderate-day count + honest relabel) lives in the unit-tested server/shape-enforce.js; here we
// just compute the shape + the same-week ride/run siblings, run it, and log. Mutates plan.segments + plan.title.
function enforceShapeIntensity(user, plan) {
  if (!plan || (plan.sport !== 'ride' && plan.sport !== 'run' && plan.sport !== 'swim')) return
  const shape = athleteWeekShape(user)
  const mon = isoMonday(plan.date), sun = addDays(mon, 6)
  const siblings = (user.plans || []).filter((p) => p && p.date >= mon && p.date <= sun && (p.sport === 'ride' || p.sport === 'run' || p.sport === 'swim'))
  const r = enforceShape(shape, plan, siblings)
  if (r.changed || r.clamped) console.log(`[shape-enforce] ${user.username || ''} "${plan.title}" clamp=${r.clamped} over=${r.overBudget} → ${r.effCeil}% (${shape.loadBand}, ceil ${shape.intensityCeiling})`)
}

// #618 — the save-time clamp only fires on sessions the coach WRITES; stale ride/run sessions from an earlier run
// (created before the shape was enforced) sit untouched and keep a wrong intensity/title. Sweep ALL future ride/run
// plans through the clamp (date order, so the quality-day count builds correctly) at the end of every adapt.
async function reenforceShapeAll(user) {
  const today = localTodayInTz(user && user.icuTimezone)
  const future = (user.plans || []).filter((p) => p && p.date >= today && (p.sport === 'ride' || p.sport === 'run' || p.sport === 'swim')).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const touched = []
  for (const p of future) { const t0 = p.title, seg0 = JSON.stringify(p.segments || []); enforceShapeIntensity(user, p); if (p.title !== t0 || JSON.stringify(p.segments || []) !== seg0) touched.push(p) }
  if (touched.length) {
    save(store)
    // B2 (#620) — a clamped session must also re-push to intervals, else the sweet-spot/threshold version stays on
    // the athlete's Garmin/intervals calendar even though Platyplus relabeled it. prod-only (pushPlanToIcu no-ops on QA).
    for (const p of touched.slice(0, 20)) { try { await pushPlanToIcu(user, p) } catch (e) { console.error('[reenforce-push] ' + (e.message || e)) } }
  }
}

// #620 — CODE-DECIDED VARIETY. weekShape decides the DOSE (how many quality days, what ceiling); this decides the
// FLAVOR (WHICH archetype each of those days is, + rotating easy-day cues), so the coach can't collapse every quality
// day to sweet-spot/threshold and every easy day to "Easy Aerobic X". We assign the exact shapes and hand them over.
function athleteArchetypeBlock(user) {
  const shape = athleteWeekShape(user)
  const qd = (shape.qualityDays || 0) + (shape.moderateDays || 0) // moderate (pregnancy tempo) counts as its 1 slot
  const sports = (user.sports && user.sports.length) ? user.sports : (user.sport ? [user.sport] : [])
  const sport = sports.includes('cycling') ? 'ride' : sports.includes('running') ? 'run' : sports.includes('swimming') ? 'swim' : (sports[0] === 'running' ? 'run' : 'ride')
  const trainingDays = Number(user.info && user.info.trainingDays) || 5
  const easyDays = Math.max(1, Math.min(5, trainingDays - qd - 1)) // rough: the rest of the endurance week is easy
  // recent archetype fingerprint = the last ~14 days of ride/run/swim plan TITLES mapped back to a key
  const today = localTodayInTz(user && user.icuTimezone)
  const from = addDays(today, -14)
  const recentKeys = (user.plans || [])
    .filter((p) => p && p.date >= from && p.date <= today && (p.sport === 'ride' || p.sport === 'run' || p.sport === 'swim'))
    .map((p) => keyFromTitle(p.title)).filter(Boolean)
  const block = assignArchetypeBlock({ sport, qualityDays: qd, easyDays, ceiling: shape.intensityCeiling, recentKeys, weeks: 2 })
  const lines = block.map((wk, i) => {
    const q = wk.quality.length ? wk.quality.map((a) => `${a.label} — ${a.spec}`).join(' · ') : '(none — all easy/endurance)'
    const e = wk.easy.length ? wk.easy.join(' · ') : 'steady easy'
    return `Week ${i + 1}: quality day${wk.quality.length !== 1 ? 's' : ''} → ${q}\n  easy-day cues → ${e}`
  }).join('\n')
  const noun = sport === 'run' ? 'Run' : sport === 'swim' ? 'Swim' : 'Spin'
  return `\n\n# THIS BLOCK'S VARIETY — MANDATORY, GET IT RIGHT THIS PASS. The archetypes below are ASSIGNED per day, not suggestions. Build EACH quality day AS its named archetype — its ACTUAL structure, never a generic sweet-spot/tempo block for all of them (Strides = 6-8 × 20 s relaxed accelerations tacked onto an easy run, NOT a sustained effort; Over-Unders = alternate just-over / just-under threshold; Fartlek = unstructured surges by feel; Hill Reps = short hard uphills; Tempo = one sustained moderate block) — and TITLE each session after its archetype. Give EACH easy day its assigned cue as the title and match the run to it (cadence / trail / conversational / strides) — it is WRONG to name two easy days the same "Easy Aerobic ${noun}". You still author the specific paces / targets / terrain for THIS athlete — that IS the individualization; the DOSE is fixed by THIS WEEK'S SHAPE above, this fixes the FLAVOR.\n${lines}\nBuild these EXACTLY, on THIS pass — a plan where the quality days repeat one shape, or the easy days share one title, is a FAILED plan; do not save it. Space quality days apart with easy between.`
}

function buildSystemPrompt(user) {
  const name = user.coachName || 'Coach'
  const prof = user.coachProfile || ''
  let p = coachIdentity(name)
  // #533 — PLAIN LANGUAGE (vulgarisation, JM 2026-07-16): the athlete is NOT a coach or a lab tech. Never drop a
  // technical term without a quick plain gloss the FIRST time you use it — tempo ("the count for each phase of a
  // rep, e.g. ~3 s lowering"), RIR/RPE ("reps left in the tank" / "effort out of 10"), 1-RM ("the most you could
  // lift once"), FTP ("the power you can hold ~1 h"), VO2max, VDOT, threshold, hypertrophy ("muscle growth"),
  // concurrent training, etc. If explaining a term takes more than a clause, just say the plain thing instead.
  // Prefer everyday words over gym/lab jargon EVERYWHERE the athlete reads you — chat, workout reviews, plan notes.
  p += '\n\n# PLAIN LANGUAGE — the athlete is not a coach. Use everyday words; never use a technical term (tempo, RIR, RPE, 1-RM, FTP, VO2max, VDOT, threshold, hypertrophy, concurrent training, …) without a quick plain-language gloss the FIRST time, or just say the plain thing. This applies to chat, workout reviews, and any plan text they read.'
  // #448 — AUTHORITATIVE "today", in the ATHLETE'S local timezone. Without this the coach inferred the
  // date from its own runtime clock (UTC → a day ahead in the evening), so it treated the athlete's real
  // "today" (e.g. Wednesday) as tomorrow — mislabelling days ("today AND Wednesday") and removing/moving
  // the WRONG day when she said "I'm not available today". Your scheduling tools use this SAME local date.
  const ptz = user.icuTimezone || COACH_TZ
  const todayIso = localTodayInTz(ptz), todayWd = localWeekdayInTz(ptz)
  // #516a — collect VOLATILE blocks (change daily / per-interaction) in a tail buffer and append it
  // AFTER the large STATIC engine, so the engine stays a byte-stable cacheable prefix (fewer tokens
  // re-billed against the subscription limit, faster turns). Same content, just emitted last.
  let tail = ''
  tail += `\n\n# TODAY — it is **${todayWd ? todayWd + ', ' : ''}${todayIso}** in the athlete's local time (${ptz}). This is the ONE source of truth for the date: anchor EVERY "today / tonight / tomorrow / yesterday / this week / next week" to it, and IGNORE any other clock or date you might infer. When they say "today" they mean ${todayIso} (${todayWd}). Your scheduling tools (list_schedule, create/move/delete) operate on this same local date, so a change they ask for "today" must land on ${todayIso}. Before you move or delete a session because they're unavailable, confirm the DATE you're acting on matches ${todayIso} (or the exact day they named) — don't act on the wrong day.`
  // #500 (JM 2026-07-12) — plain language, no jargon, in ANYTHING the athlete reads.
  p += `\n\n# PLAIN LANGUAGE — no jargon: the athlete may NOT be technical, so in everything they read — notify messages, activity titles/descriptions, chat replies — NEVER use abbreviations or coaching shorthand. Do not write "TTE", "CTL", "ATL", "IF", "NP", "VI", "W′", "eFTP", "FTP", "Form", "Z2/Z4", "TSS". Say it in plain words instead: "how fresh you are" (not Form), "your threshold power / the hardest pace you can hold ~an hour" (not FTP/eFTP), "how hard it was compared with your threshold" (not IF), "training load" (not TSS), "easy / hard" (not zone numbers). If a number genuinely helps, describe what it means in the same breath. When you explain a plan CHANGE, be specific and concrete about WHAT you changed and WHY (which day, which session, longer/shorter/easier, the reason) — never a vague "plan updated".`
  p += `\n\n# SAY = DO — your WORDS must match the CALENDAR (the #1 trust rule; the athlete has caught you breaking it). NEVER describe, promise, or agree to a plan you have not ACTUALLY built and then verified. The moment you tell the athlete about a session — in chat, in a review's "next" line, anywhere — that EXACT session (right SPORT, right DAY, right intensity) must already be on their calendar. Concretely:
1. **Do exactly what they ask.** If they say "rest today and a run today or tomorrow", then make today rest (delete/clear the session that's there — even if it was a ride) and create a RUN on the day they meant — NOT a ride, NOT a different day. If their request is ambiguous, pick the sensible reading and state it; do not quietly substitute a different sport or day.
2. **Build it, then READ IT BACK.** After any create/move/delete, call list_schedule and confirm the calendar now matches what you're about to say. If it doesn't, fix it before you reply.
3. **Only describe what is really there.** Before you write "Rest tomorrow, easy spin Sunday, gym Monday, threshold test Wednesday", STOP: is each of those an actual scheduled session you can see in list_schedule? If not, either schedule it now or do NOT say it. A plan you narrate but didn't build is a lie to the athlete — it is the single fastest way to lose their trust.
4. **You may re-plan later** (the plan adapts) — but at the instant you speak, your words = the current calendar. When you say "yes" to a request, the yes means you have DONE it, not that you intend to.`
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
  // #329/#427 — this athlete's CURRENT repro-state block. PREGNANCY overrides everything (there is no
  // cycle); otherwise the menstrual cycle phase (from intervals, stashed by /auth/readiness) biases the PLAN.
  if (isFemale && user.info && user.info.pregnant) {
    const pg = pregnancyStage(user.info, todayIso) // #448 local today, not UTC
    const wk = pg && pg.weeks != null ? `~week ${pg.weeks} (trimester ${pg.trimester})` : 'trimester unknown — ASK her due date (EDD) or last-period date to tailor by trimester; use first-trimester defaults until then'
    tail += `\n\n# PREGNANCY — she is PREGNANT (${wk}). This OVERRIDES cycle-phase logic: there is NO menstrual cycle now, do NOT program by cycle phase. Apply the pregnancy protocol in your female-athlete guidance (§6). Core rules: goal is MAINTAIN health & fitness, never build/PR/max efforts. **SHAPE the week as MAINTENANCE, not a build: MOST sessions are EASY / endurance + her strength work; AT MOST ONE lightly-moderate session per week (a short tempo by RPE + talk test — NOT a structured sweet-spot / threshold / VO2 interval block). NEVER two "quality" days in a week — two sweet-spots or thresholds is a BUILD stimulus, which pregnancy is not.** Gauge intensity by RPE + the TALK TEST, not heart rate (pregnancy raises resting HR ~10-20 bpm); her in-app **Freshness/readiness already DOWN-WEIGHTS the HR-derived load ratio** (ACWR) for exactly this reason (#536), so trust that score + her RPE/check-in over raw load numbers — a MID Freshness on a light day is normal maintenance, not a warning; do not chase a "low" load reading with more volume; no Valsalva/breath-holding (exhale on the effort, keep ~2-3 reps in reserve); ${pg && pg.trimester >= 2 ? 'NO supine (flat-on-back) work, use incline/side-lying/upright versions, and watch for abdominal doming; ' : ''}avoid overheating (cool + hydrate, especially hot-humid days), fall/contact/collision risk, and sprinting; keep pelvic-floor + deep-core awareness. DEFER to her clinician / pelvic-floor PT. If she reports any STOP sign (vaginal bleeding, fluid leak, calf pain or swelling, chest pain, dizziness/faintness, a headache that won't clear, regular contractions, reduced fetal movement) tell her to STOP and contact her clinician. Frame everything on health & function, never weight or "getting the body back". **PRIVACY — pregnancy is PRIVATE: NEVER write "pregnancy/pregnant/trimester/prenatal/expecting/baby/bump" or anything implying it in a workout TITLE, a DESCRIPTION, a plan name, or the public activity text (set_activity_text). It must not appear ANYWHERE others could see. Apply the adjustments SILENTLY and name sessions by their normal training content ("Easy Aerobic Run", "Z2 Endurance"), never by the reason.**`
  } else if (isFemale) {
    const fresh = user.cyclePhaseAt && (Date.now() - new Date(user.cyclePhaseAt + 'T00:00:00Z').getTime()) < 6 * 86400000
    const cc = fresh ? cycleContext({ phase: user.cyclePhase }) : null
    if (cc) tail += `\n\n# CYCLE PHASE — currently **${cc.phase}** (as of ${user.cyclePhaseAt}). ${cc.guidance} When you plan or adjust this week, apply a load bias of ~×${cc.loadModifier} for this phase (push intensity in the follicular/ovulatory green window; ease top-end + add recovery/Z2 + carbs/sleep in late-luteal/PMS if symptomatic). Don't over-medicalise it — many train through; adapt to how SHE reports feeling. Their late-luteal RHR/HRV naturally shift, so don't read that as poor recovery.`
    else if (!user.cyclePhase) tail += `\n\n# CYCLE PHASE — unknown. If it would help tailor load/recovery and she's open to it, ASK for her last period start date + typical cycle length (or connect it in intervals), then factor the phase into planning. Never assume; ask once, respect a "no".`
  }
  // #534 — GYM FOCUS: the coach adapts strength to the athlete's MAIN sport + objective (concurrent training).
  const doesGymNow = sports.some((s) => ['strength', 'gym'].includes(s)) || /\b(gym|strength|lift|weights?)\b/i.test(prof)
  if (doesGymNow) {
    const ms = user.info && user.info.mainSport
    const obj = ((user.info && user.info.goals && user.info.goals.notes) || '').trim()
    tail += `\n\n# GYM FOCUS — main sport: ${ms || 'none set'}. Sports: ${sports.join(', ') || '—'}. Objective: ${obj ? `"${obj.slice(0, 240)}"` : 'not stated — ask what they want from the gym'}. Derive the gym focus per coach-engine-strength.md: an ENDURANCE main sport with NO muscle intent → pure SUPPORT (maintenance dose, minimal effective volume, kept clear of key rides/runs — never treat low gym volume as a deficit); an ENDURANCE main sport who ALSO wants muscle → SUPPORT+BUILD, i.e. **concurrent hypertrophy** (you CAN build lean muscle while the sport stays #1 — give a real but MODERATE dose ~6–12 hard sets/muscle/wk, dosed and scheduled around key sessions; don't wreck the sport, don't shame them for cycling-first); a MUSCLE goal with gym as the main event → full hypertrophy (10–20 sets/muscle/wk); a strength/1-RM goal → strength (heavy, >85% 1RM, low volume). Match volume, %1RM intensity, and scheduling to that focus AND the current phase — in a big endurance block, dial the gym down.`
  }
  // #swim-tri — TRIATHLON: multi-sport planning layer. Apply Friel periodization keyed to the athlete's stated A-race.
  if (sports.includes('triathlon')) {
    const tgoal = ((user.info && user.info.goals && user.info.goals.notes) || '').trim()
    tail += `\n\n# TRIATHLON — this athlete races triathlon (swim + bike + run as ONE season). Plan per coach-engine-triathlon.md.
- **A-RACE & PHASE:** ${tgoal ? `Their goal, in their words: "${tgoal.slice(0, 300)}". Read the race DATE + DISTANCE from it (sprint / Olympic / 70.3 / Ironman).` : 'They have NOT stated a race yet — ASK for their A-race date + distance so you can periodize; until then hold a general base.'} Count back from race day and set the Friel phase (Prep → Base → Build → Peak → Race → Transition). Tell them which phase they're in and why.
- **WEEKLY BALANCE:** program all THREE sports each week, biased to the athlete's LIMITER (weakest/most-race-costly discipline) and the race's demands — not an even split. Swim technique is high-frequency + low-load; bike carries the most training load; run is the most injury-costly so cap hard-run frequency. Each session goes to ITS OWN zones (ride % FTP, run pace off threshold, swim pace off CSS).
- **BRICKS:** schedule bike→run bricks in Build/Peak to train the transition (legs off the bike). Keep the run portion controlled early in the block.
- **TOTAL LOAD:** the three sports SHARE one recovery budget — sum load across all of them against the weekly band + this athlete's day/week caps; don't let three "moderate" days stack into an overload. Strength is periodized support (Hagerman): heavier in base, maintenance in build/peak, cut in race week.
Use create_swim / create_ride / create_run / create_workout, each to its own zones, balanced to total load and periodized to the A-race.`
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
  const css = user.sportSettings?.swimming?.thresholdPace // #swim-tri — CSS in sec/100 m
  if (css > 0) { const m = Math.floor(css / 60), s = String(Math.round(css % 60)).padStart(2, '0'); stats.push(`swim CSS ${m}:${s}/100 m`) }
  const rhr = user.sportSettings?.running?.maxHr
  if (rhr && rhr !== user.maxHR) stats.push(`running max HR ${rhr} bpm`)
  if (user.sleepNeed) stats.push(`sleep need ~${user.sleepNeed} h`)
  // #256 port — per-athlete LEARNED baselines (their own 60d norm). Interpret a reading as a
  // DEVIATION from these, not against textbook absolutes. (Stashed by /auth/readiness.)
  const bl2 = []
  if (user.hrvBaseline?.mean) bl2.push(`HRV baseline ~${user.hrvBaseline.mean} ms${user.hrvBaseline.cv7 != null ? ` (7-day variability ${user.hrvBaseline.cv7}%)` : ''}`)
  if (user.rhrBaseline?.mean) bl2.push(`resting HR baseline ~${user.rhrBaseline.mean}±${user.rhrBaseline.sd} bpm`)
  if (bl2.length) p += `\n\n# THIS ATHLETE'S LEARNED BASELINES (their OWN ~60-day norm) — ${bl2.join(', ')}.\nInterpret today's HRV/resting-HR as a DEVIATION from these, never as textbook absolutes: a clear HRV drop or resting-HR rise vs baseline (beyond ~1 SD, especially multi-day) signals accumulating fatigue, poor sleep, or oncoming illness → ease off; within the normal band → train as planned. Rising 7-day HRV variability is itself a fatigue flag. Always cross-check with their check-in and Form before deciding.`
  if (stats.length) p += `\n\n# THIS ATHLETE'S BENCHMARKS — ${stats.join(', ')}.\nJudge how hard a session is FOR THEM against these: prescribe ride intensities as % of THEIR FTP, RUN intensities as a pace off THEIR threshold pace (Daniels E/M/T/I/R), SWIM sets as a pace off THEIR CSS (zone 3 = CSS pace — pass it to create_swim as cssPace100), set HR zones off THEIR max HR, and gym loads by reps (the app fills the weight). Their sleep NEED is ~${user.sleepNeed || 8} h — score sleep against that, not a generic 8 h.`
  // #497 — the anchors are only as good as the last quality effort behind them; when one is UNCONFIRMED, have the
  // coach proactively work in a single targeted refining effort (NOT an all-out test — JM's rule). Heuristic-based:
  // the coach already reads recent activities, so it can judge "no recent hard effort" without any confidence plumbing.
  if (stats.length) p += `\n\n# KEEP THE ANCHORS SHARP — those benchmarks are only as good as the last quality effort behind them, and everything you prescribe scales from them, so keep them honest. When one looks UNCONFIRMED — check get_recent_activities and if you don't see a recent effort that would set it (e.g. weeks of only easy rides so the threshold power is really a guess, no recent tempo/threshold run, no heavy low-rep set) — proactively fold in ONE targeted refining effort rather than waiting for a formal test: cycling → the EASIEST read needs NO formal test: one hard sustained effort up a climb or a hard segment when they're fresh (8–15 min all-out — intervals derives eFTP straight from it); offer a structured 2×8 min only if they want a cleaner number, and never demand a dreaded 20-min all-out; running → a hard 20 min or a 5k / parkrun; gym → a heavy 3–5 rep top set. One quality effort is enough — NEVER prescribe an all-out max test or stack hard days to chase a number, and place it on a day they're fresh, within their weekly training-day + recovery limits. Tell them in plain words WHY ("let's do one harder 20-minute stretch so I can dial in the hardest pace you can hold") — never "to update your FTP".`
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
  if (freq > 0) p += `\n\n# WEEKLY TRAINING DAYS — HARD CAP of ${freq}/week (JM directive): the athlete trains on AT MOST ${freq} distinct days per calendar week (Mon–Sun). This is a HARD limit set in their profile, NOT a target to pad toward — NEVER schedule training on more than ${freq} days in any week, not even an "optional" or "bonus" extra. FEWER is fine when recovery or life calls for it; MORE is never allowed. Before you add a session, count the week's already-planned training days: if it's already at ${freq}, do NOT add a new day — MOVE an existing session instead, or combine into a day that's already training. If they explicitly ask for an extra day beyond ${freq}, tell them it would exceed their weekly cap and to raise it in their profile first. (Server enforces this too — a create that would exceed ${freq} is rejected.)`
  // #345 — most athletes train ONCE a day. Never stack two sessions (e.g. a gym + a run) on the same
  // calendar day beyond this cap unless the athlete explicitly opts into doubles.
  const maxPerDay = Math.max(1, Number(user.info?.maxPerDay) || 1)
  p += `\n\n# ONE SESSION PER DAY (max ${maxPerDay}/day): the athlete trains at most ${maxPerDay} session${maxPerDay > 1 ? 's' : ''} per calendar day. ${maxPerDay === 1 ? 'Do NOT schedule two workouts on the same day (no gym + run, no ride + run together) — spread sessions across different days. If two efforts must share a day because time is tight, ask first or fold them into ONE combined session.' : `Never exceed ${maxPerDay} on any single day, and only double up when it genuinely serves the plan (e.g. AM/PM split).`} Respect their weekly availability + rest days when spacing them.`
  // #613 — THE WEEK'S SHAPE is decided in CODE (single source of truth), so the coach BUILDS to it instead of
  // reconciling contradictory prompt blocks (pregnancy vs "a build needs 2 quality days"). Pregnancy /
  // consistency / teen / cycle-phase all fold into this one function → one authoritative quality-day count.
  const shape = athleteWeekShape(user)
  tail += `\n\n# THIS WEEK'S SHAPE — computed for THIS athlete; BUILD the plan to match it (do NOT add quality beyond this or exceed the ceiling): **${shape.qualityDays} structured quality day${shape.qualityDays !== 1 ? 's' : ''}/week${shape.moderateDays ? ` + up to ${shape.moderateDays} light-moderate (tempo) day` : ''}, intensity CEILING = ${shape.intensityCeiling} (never program harder than this), load band = ${shape.loadBand}.** ${shape.rationale} Space any quality days apart (easy days between); everything else is easy/endurance + their strength; leave genuine rest days blank.`
  tail += athleteArchetypeBlock(user) // #620 — code-assigned archetype rotation (the FLAVOR of each quality/easy day)
  // #622 — DEVELOPMENT PRIORITIES: the SAME "what would move your numbers" focus the Stats card shows (stashed from
  // /api/athlete-metrics), so the PLAN targets it instead of the card promising quality the plan lacks (SAY=DO). Only
  // when there IS a quality budget to spend (skips pregnancy/maintenance, where the shape already forces easy).
  if (shape.qualityDays > 0) {
    const pfAll = user.profileFocus || {}
    const pfKey = (user.sports || []).includes('cycling') ? 'cycling' : (user.sports || []).includes('running') ? 'running' : (user.sports || []).includes('swimming') ? 'swimming' : Object.keys(pfAll)[0]
    const pf = pfKey && Array.isArray(pfAll[pfKey]) ? pfAll[pfKey].filter((f) => f && !/mostly the efforts ARE the data/i.test(f)) : []
    if (pf.length) tail += `\n\n# DEVELOPMENT PRIORITIES — computed from THIS athlete's OWN numbers (TTE / W′ / EF); this is the exact focus they see on their Stats page, so the PLAN must reflect it. Spend the week's quality-day budget on THESE, and choose the # THIS BLOCK'S VARIETY archetypes to serve them (don't schedule generic quality that ignores their limiter):\n- ${pf.slice(0, 4).join('\n- ')}`
  }
  // #626 — PERIODIZATION: where this week sits in the meso-cycle, so the coach PROGRESSES load week-over-week
  // (build → build → peak → recovery) + TAPERS into an A-race. Skip for maintenance (pregnancy) — not a build.
  let per = null
  if (shape.loadBand !== 'maintenance') {
    const thisMon = isoMonday(todayIso)
    const anchorMon = isoMonday(user.onboardedAt ? new Date(user.onboardedAt).toISOString().slice(0, 10) : '2024-01-01')
    const weeksSinceAnchor = Math.max(0, Math.floor((Date.parse(thisMon) - Date.parse(anchorMon)) / (7 * 86400000)))
    const rd = user.info && user.info.raceDate
    const weeksToRace = (rd && /^\d{4}-\d{2}-\d{2}$/.test(rd) && rd >= todayIso) ? Math.floor((Date.parse(isoMonday(rd)) - Date.parse(thisMon)) / (7 * 86400000)) : null
    const ageYears = (user.info && user.info.dob) ? Math.floor((Date.now() - new Date(user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null
    per = periodizationPhase({ ctl: user.ctl, weeksSinceAnchor, weeksToRace, ageYears })
    const raceBit = weeksToRace != null ? ` Their A-race${user.info && user.info.raceName ? ` (${user.info.raceName})` : ''} is ~${weeksToRace} week${weeksToRace !== 1 ? 's' : ''} out.` : ''
    tail += `\n\n# THIS BLOCK'S PROGRESSION — the plan is PERIODIZED, NOT the same every week: this is a **${per.phase.toUpperCase()} week**${per.weekInCycle ? ` (week ${per.weekInCycle} of a 4-week build→peak→recovery block)` : ''}.${raceBit} ${per.note}${per.target ? ` Aim ≈ **${per.target} TSS** this week.` : ''} PROGRESS week-over-week — compare to last week (get_session_history / list_schedule) and nudge the build weeks UP, pull the recovery week DOWN; never ship an identical week.`
    // #627 (gap 2/4) — PROGRESS toward the GOAL, measured. Especially on the recovery week: is it actually working?
    tail += `\n\n# PROGRESS CHECK — is the training actually MOVING them toward their goal?${per.phase === 'recovery' ? ' **This is a RECOVERY week — the moment to assess it.**' : ''} Read get_metrics + get_wellness and compare their key numbers now (threshold power/pace, TTE, EF, CTL, and for runners/swimmers CS·D′/CSS) to a few weeks ago. Judge plainly whether they're progressing at the rate their goal needs. If a number has STALLED, CHANGE the stimulus next block — a stalled threshold ⇒ more time-at-threshold; a flat top end ⇒ more VO₂; a falling EF ⇒ more easy base + check recovery/fuel; a shrinking W′/D′ ⇒ short near-max work. If it's climbing, keep the thread. Fold the conclusion into how you shape the NEXT block, and it's what the review's objective talk (# next) should reference — the athlete should always be able to see their training is working.`
  }
  // #375/#613/#626 — the TSS target now comes from THE PROGRESSION above (periodized), not a flat band.
  const budget = weeklyLoadBudget(user.ctl)
  tail += shape.loadBand === 'build'
    ? `\n\n# WEEKLY LOAD BUDGET: aim for THIS week's periodized target${per && per.target ? ` (≈${per.target} TSS, the ${per.phase} week — see # THIS BLOCK'S PROGRESSION)` : ''}. A productive BUILD or PEAK week dips Form into the GREEN zone (~−10 to −20); a RECOVERY week should let Form rise back toward grey — that's correct, not junk. ${budget ? `Reference band (CTL≈${user.ctl}): flat ≈ ${budget.sustainable}, build ≈ ${budget.build}, peak ≈ ${budget.hard}, cap ≈ ${budget.cap} TSS.` : `Read CTL with get_wellness: flat ≈ CTL×7, build ≈ CTL×9-11.`} After planning, sum the week's TSS and check the Form forecast matches the phase.`
    : `\n\n# WEEKLY LOAD BUDGET — this is a ${shape.loadBand.toUpperCase()} week, NOT a build: hold load around ${budget ? `~${budget.sustainable} TSS (CTL≈${user.ctl}×7)` : 'CTL×7 (flat)'}. Do NOT chase Form into the −10..−20 build zone and do NOT add quality beyond the shape above — a mid/grey Form on an easy/maintenance week is CORRECT, not junk. Keep easy days genuinely easy.`
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
  // #491 — Eat & Mind deactivated: tell the coach up-front so it plans training+recovery only (the server also
  // hard-rejects meal/mind/supplement items). Placed before the DIET/FUEL/MIND blocks so it overrides them for planning.
  if (EAT_MIND_OFF) p += `\n\n# EAT & MIND ARE DEACTIVATED right now (the app was simplified). Do NOT schedule OR suggest meals, recipes, supplements, or mind / meditation / yoga sessions — the server rejects those calendar items and they'd be orphaned with no section to show them. Plan TRAINING + RECOVERY only. Treat any DIET / FUEL-TARGET / MIND guidance below as reference for chat answers ONLY, never as a cue to create calendar items. (You may still answer a nutrition or mindfulness question briefly in chat.)`
  const diet = String(user.info?.diet || '').toLowerCase()
  if (!EAT_MIND_OFF && (diet === 'vegetarian' || diet === 'vegan')) p += `\n\n# DIET: the athlete is ${diet.toUpperCase()}.\nEVERY meal you pick or suggest MUST be ${diet}. search_recipes already returns ONLY ${diet}-compatible recipes for this athlete, so pick from those — never recommend a meal outside their diet, and don't suggest meat${diet === 'vegan' ? ', fish, dairy, eggs, or honey' : ' or fish'}. (They set this in Settings → Preferences.)`
  // #265 — daily FUEL TARGETS (mirror src/nutrition.ts: Mifflin-St Jeor BMR → TDEE → goal calories + protein).
  const fKg = Number(user.weight) || null, fCm = Number(user.info?.heightCm) || null
  const fAge = user.info?.dob ? Math.floor((Date.now() - new Date(user.info.dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000)) : null
  if (!EAT_MIND_OFF && user.sex && fKg && fCm && fAge && fAge > 12 && fAge < 100) { // #491 — no fuel targets while Eat is off
    const bmr = Math.round(10 * fKg + 6.25 * fCm - 5 * fAge + (user.sex === 'female' ? -161 : 5))
    const days = Number(user.info?.trainingDays) || 0
    const act = days >= 7 ? 1.9 : days >= 5 ? 1.725 : days >= 3 ? 1.55 : 1.375
    const tdeeV = Math.round(bmr * act)
    const goal = ['lose', 'gain', 'maintain'].includes(user.info?.fuelGoal) ? user.info.fuelGoal : 'maintain'
    const cal = Math.round(tdeeV * (goal === 'lose' ? 0.82 : goal === 'gain' ? 1.1 : 1))
    const protein = Math.round(fKg * (goal === 'lose' ? 2.2 : goal === 'gain' ? 2.0 : 1.8))
    tail += `\n\n# DAILY FUEL TARGETS — ~${cal} kcal/day (goal: ${goal}), protein ~${protein} g (BMR ${bmr} · TDEE ${tdeeV}). When you pick meals/portions, aim the DAY near these and hit the protein — it's the priority. Fuel UP on hard/long days (more carbs around the session) and trim on rest days. These are estimates; adapt to how their weight/energy actually trend.`
  }
  p += '\n\n' + APP_HELP
  // #256 port — durable COACH MEMORY: consult it EVERY session, then keep it current.
  if (user.coachMemory && user.coachMemory.trim()) {
    tail += `\n\n# YOUR COACH MEMORY for this athlete (what you've LEARNED works/fails + how they like to be coached — apply it, don't repeat past mistakes)\n${user.coachMemory.trim()}\n\nLEARN ACTIVELY: after EVERY meaningful interaction with this athlete — a chat, a completed-workout review, a check-in, a plan change they reacted to, anything they tell you about their life/preferences/constraints — ask "what did I just learn about coaching THIS person?" and UPDATE this with save_coach_memory (rewrite the full memory, keep it tight — dated bullets, mark rules active/retired). Every session should make you better at coaching THEM specifically, not start fresh. This is separate from their profile (the profile is WHO they are, the memory is HOW to coach THEM), and it is STRICTLY PRIVATE to this athlete — it exists only to tailor THEIR coaching and is never shared with or mentioned to anyone else.`
  } else {
    tail += `\n\n# COACH MEMORY — you have none for this athlete yet. Learn from EVERY interaction (chat, workout review, check-in, what they tell you) and start one with save_coach_memory (tight dated bullets) so you improve every session instead of starting fresh. It is STRICTLY PRIVATE to this athlete — only ever used to tailor THEIR coaching, never shared with or mentioned to anyone else.`
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
  p += tail // #516a — append the VOLATILE tail after the stable, cacheable prefix
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
    const killer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('coach task timeout')) }, 600000) // #608 — match the chat-helper: a strength adapt's full rebuild (many search_exercises + creates) needs >240s
    proc.stdout.on('data', () => {}); proc.stderr.on('data', () => {}) // drain
    proc.on('error', (e) => { clearTimeout(killer); cleanup(); reject(e) })
    proc.on('close', () => { clearTimeout(killer); cleanup(); resolve() })
  })
}

// #353 — a human phrase for the tool the coach is calling, shown as "Reviewing your …" in the UI.
const TOOL_LABEL = { get_wellness: 'your wellness data', get_checkins: 'your check-ins', get_recent_activities: 'your recent activity', get_session_history: 'your recent sessions', list_schedule: 'your schedule', get_weather: 'the weather', check_connections: 'your connections', search_exercises: 'the exercise library', search_recipes: 'recipes', create_workout: 'a gym session', create_ride: 'a ride', create_run: 'a run', schedule_recovery: 'recovery', schedule_supplement: 'supplements', save_coach_review: 'your review', set_activity_text: 'your activity notes', set_athlete_profile: 'your profile', set_thresholds: 'your thresholds', set_weekly_target: 'your week', save_coach_memory: 'your coaching notes', schedule_meal: 'a meal', schedule_mind: 'a mind session', notify: 'a note for you' }
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

// #580 — MECHANICAL SAY=DO GUARANTEE. The coach's PROSE can drift from the calendar (it once narrated a plan it never
// built). So whenever the coach talks about the plan, the APP appends the REAL calendar — computed deterministically
// from the store (which already reflects any create/move/delete the coach just did) — as an authoritative block. A
// session the coach invented simply won't be in it; a promised session that IS built will be. The athlete always sees
// ground truth, right under the coach's words. Pure read of user.plans; best-effort.
const PLAN_TALK_RX = /\b(plan\w*|schedul\w*|rest day|tomorrow|today|(?:mon|tues|wednes|thurs|fri|satur|sun)day|next (?:session|week|ride|run|swim|workout|day|few days)|this week|upcoming|(?:i've|i have|i'll|i will) (?:scheduled|set|added|planned|put|booked))/i
async function upcomingPlanSummary(user, days = 7) {
  const today = await athleteToday(user)
  const end = addDays(today, days)
  const plans = (user.plans || []).filter((p) => p && p.date >= today && p.date <= end).sort((a, b) => a.date.localeCompare(b.date))
  const line = (p) => {
    const d = new Date(p.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const sp = ({ ride: 'Ride', run: 'Run', gym: 'Gym', swim: 'Swim' })[p.sport] || p.sport || 'Session'
    const mins = Array.isArray(p.segments) && p.segments.length ? Math.round(p.segments.reduce((s, x) => s + (Number(x.duration) || 0), 0) / 60) : null
    return `• ${d} — ${p.title || sp}${mins ? ` · ~${mins} min` : ''}`
  }
  const header = '\n\n———\n📋 **Your actual plan** — straight from your calendar (this is what is really scheduled; if anything above isn\'t here, it isn\'t booked):\n'
  return plans.length ? header + plans.map(line).join('\n') : header + `• Nothing scheduled in the next ${days} days.`
}

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
  // #428 — if the client leaves (mobile back button mid-answer), DON'T abort the coach: keep generating so
  // the full turn completes + persists to the thread; just stop writing to the dead socket. On return, the
  // #363 thread sync shows the finished answer. (Was: res close → reader.cancel → only a partial/empty reply saved.)
  let clientGone = false
  res.on('close', () => { clientGone = true })
  const send = (o) => { if (clientGone) return; try { res.write(`data: ${JSON.stringify(o)}\n\n`) } catch { clientGone = true } }
  send({ coach: req.user.coachName || 'Coach' })

  // QA/prod: the container can't run the glibc claude → proxy to the host helper.
  if (CHAT_HELPER_URL) {
    let pdone = false, reply = ''
    const pend = () => { if (pdone) return; pdone = true; persistChat(req.user, message, reply); send({ done: true }); if (!clientGone) res.end() }
    try {
      const hr = await fetch(CHAT_HELPER_URL + '/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-chat-secret': CHAT_HELPER_SECRET },
        body: JSON.stringify({ message, token: req.user.apiToken, coach: req.user.coachName || 'Coach', systemPrompt: buildSystemPrompt(req.user), sessionId: thread.sessionId }),
      })
      if (!hr.ok || !hr.body) { send({ error: 'coach unavailable (' + hr.status + ')' }); return pend() }
      const reader = hr.body.getReader(); const dec = new TextDecoder(); let hbuf = ''
      const killer = setTimeout(() => { try { reader.cancel() } catch { /* */ } }, 200000) // #428 net for a truly hung coach; a client disconnect NO LONGER cancels (we finish + persist)
      try {
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
      } finally { clearTimeout(killer) }
    } catch (e) { send({ error: 'coach unavailable: ' + (e.message || e) }) }
    // #580 — append the authoritative real-calendar block when the coach talked about the plan.
    if (reply && PLAN_TALK_RX.test(reply)) { try { const b = await upcomingPlanSummary(req.user); if (b) { reply += b; send({ delta: b }) } } catch { /* best-effort */ } }
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
  if (!['gym', 'ride', 'run', 'swim'].includes(b.sport)) return "sport must be 'gym' | 'ride' | 'run' | 'swim'" // #614 — swim was rejected here → create_swim was dead
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
    const segs = normalizeRamps(clampEasyEfforts(plan.title, plan.segments || []).segments) // #331c + #384 last-line guard on the push (flat cool-downs; covers pre-guard plans on re-sync)
    // #479 — INDOOR ride = VirtualRide (ERG holds a SPECIFIC watt); OUTDOOR = Ride (a rideable power RANGE/band you
    // self-regulate). Same as intervals' own indoor flag → Garmin/trainer treat it right. Default (indoor unset) = outdoor.
    ev.type = plan.sport === 'ride' ? (plan.indoor ? 'VirtualRide' : 'Ride') : 'Run'
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
    // #479 — RIDES render steady targets as a RIDEABLE min–max RANGE (outdoor you self-regulate to a band); this shapes
    // ONLY the displayed workout (text + doc), AFTER plannedTss above, so the load is unchanged (band averages to target).
    // #479 — band steady targets into a RIDEABLE RANGE for OUTDOOR only; an INDOOR (ERG) ride keeps the SPECIFIC point.
    const dispSegs = (plan.sport === 'ride' && !plan.indoor) ? bandSteadyPower(segs) : segs
    const native = nativeWorkoutText(dispSegs, isRun)
    if (!isRun && dispSegs.length) ev.workout_doc = { steps: dispSegs.flatMap((s) => encodeStep(s, false)) }
    // #588 — Platyplus owns the plan: label it so the athlete edits in Platyplus, not here (a change made in intervals is reverted on the next sync). Re-composed each push, so it never accumulates.
    ev.description = [native, stripDerivedWorkout(stripPlatyplusLinks(plan.notes)), shortCoachNote(plan), '📋 Planned in Platyplus — edit it there (changes made here are replaced).'].filter(Boolean).join('\n\n')
  } else if (plan.sport === 'swim') {
    // #swim-tri — swim plans are distance sets (create_swim precomputes duration/distance/sTSS). No power/pace
    // workout_doc (intervals' swim model differs); push a Swim event carrying the LOAD so Form/CTL counts it.
    ev.type = 'Swim'
    const dur = Number(plan.moving_time) || 0
    if (dur > 0) { ev.moving_time = dur; ev.time_target = dur }
    if (Number(plan.distanceM) > 0) ev.distance = Number(plan.distanceM)
    const stss = Number(plan.icu_training_load) || 0
    if (stss > 0) ev.icu_training_load = stss
    const link = `${ORIGIN}/coach/${encodeURIComponent(plan.id)}`
    ev.description = [`🏊 Open workout in Platyplus → ${link}`, stripPlatyplusLinks(plan.notes), brief].filter(Boolean).join('\n\n')
  } else {
    ev.type = 'WeightTraining'
    // #434 — push a gym LOAD (+ duration) so intervals' Form/CTL COUNTS strength work (was 0 → gym ignored).
    // Gym has no segments, so plannedTss can't; estimate from the exercises + the KB Friel factor.
    const gsec = estimateGymSeconds(plan)
    if (gsec > 0) { ev.moving_time = gsec; ev.time_target = gsec }
    const gtss = plannedGymTss(plan)
    if (gtss > 0) ev.icu_training_load = gtss
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
  const ath = user.icuAthlete
  if (!ath) return [] // #456 — no athlete → never fall back to the seed (i28814); block
  try {
    const r = await icuFetch(user, `/athlete/${ath}/events?oldest=${plan.date}&newest=${plan.date}`)
    if (!r.ok) return []
    const events = await r.json()
    return (events || []).filter((e) => eventMatchesPlan(plan, e))
  } catch { return [] }
}
// #5026 — "today" MUST be the ATHLETE's local date (their `icuTimezone`), NOT the server's UTC date. Otherwise a
// Western athlete in the evening (server already on the next UTC day) has their ACTUAL-today plan treated as "past"
// and deleted from intervals (JM, America/Toronto, 20:29 Jul 14 → server UTC Jul 15 → his Jul 14 ride stripped).
const icuToday = (user) => localDate(new Date(), user?.icuTimezone || COACH_TZ)
const stripIcuInstance = (s) => String(s || '').replace(/:\d{4}-\d{2}-\d{2}$/, '')
// Mirror a plan to intervals — self-healing, Platyplus is the MASTER (#150):
//   • COLLAPSE duplicates: events carrying our external_id (incl. intervals' ":date" instance
//     copy) are the same session pushed twice → keep ONE, delete the extras.
//   • PAST: keep NO planned event in the past — delete ours; never create.
//   • else update our event (or adopt a foreign one — the other coach's — without duplicating).
async function pushPlanToIcu(user, plan) {
  if (!user.icuKey) return { skipped: 'no intervals key' }
  if (!user.icuAthlete) { console.warn(`[icu] blocked ${user.username || user.id}: no intervals athlete — refusing to touch the seed calendar (#456)`); return { skipped: 'no intervals athlete' } }
  if (IS_STAGING) return { skipped: 'staging (read-only toward intervals — only prod mirrors, #381)' }
  const ath = user.icuAthlete
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
  if (!user.icuKey || !user.icuAthlete || !plan?.icuEventId) return // #456 — no athlete → never DELETE on the seed calendar
  try { await icuFetch(user, `/athlete/${user.icuAthlete}/events/${plan.icuEventId}`, { method: 'DELETE' }) } catch { /* best effort */ }
}
// #5026 (JM: "it has to be a PERFECT MIRROR") — READ-REPAIR: re-push any current/future Platyplus plan that never
// reached intervals (no icuEventId). The write-through push (upsertPlan) is the primary path; this heals the ones that
// failed transiently or (pre-tz-fix) were wrongly skipped as "past" at the UTC day-boundary. Idempotent + convergent
// (keyed by external_id, no dupes). Triggered ON APP LOAD (`/auth/plans`) so it's responsive — the athlete opens the app
// and the mirror repairs within that request — plus the daily tick as a slow backstop. Prod-only + a per-user cooldown
// so a rapid-fire client can't spam intervals. Only the un-synced few are pushed (usually zero → instant no-op).
async function healMirror(user) {
  if (IS_STAGING || !user.icuKey || !user.icuAthlete) return
  const now = Date.now()
  if (user._mirrorHealAt && now - user._mirrorHealAt < 60_000) return // cooldown: at most once/min per user
  const today = icuToday(user)
  const broken = (user.plans || []).filter((p) => p.date && p.date >= today && (p.origin || 'platyplus') === 'platyplus' && !p.icuEventId)
  if (!broken.length) return
  user._mirrorHealAt = now
  for (const p of broken) { try { await pushPlanToIcu(user, p) } catch (e) { console.error('[mirror-heal] ' + (e.message || e)) } }
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
  let i = user.plans.findIndex((p) => p.id === body.id)
  // #371 — ENFORCE the athlete's max sessions/day for COACH-created plans (the UI path uses actor 'you' and
  // is exempt — a person can double-book if they want). Instruction alone drifted: the coach was stacking two
  // same-sport rides on a day (max 1). REJECT a NEW session on a day already at the cap → it must COMBINE into
  // the existing session (same id = update) or move to a free day. Doesn't block updates (same id).
  // #371/#454/#5014 — ENFORCE the athlete's max-sessions/day + weekly-training-days caps for COACH plans (the UI path
  // uses actor 'you' and is exempt). Fire on a CREATE (i<0) AND on a coach MOVE onto another day (i≥0 with a changed
  // date) — the #5014 gap was that the old guard only ran on create, so the coach could MOVE a session onto a full day
  // and stack two (JM: "2 exercices on jul 11 while max is 1"). A same-day UPDATE (id + same date) stays exempt.
  if (actor === 'coach') {
    const cur = i >= 0 ? user.plans[i] : null
    const isCoachMove = !!(cur && cur.date !== body.date)
    if (i < 0 || isCoachMove) {
      // #431 — on CREATE only, a same date+sport plan is a RE-PLAN → reuse its id (in-place update, no duplicate/orphan).
      // A MOVE keeps its own id (it IS an existing plan), so we skip the reuse and just cap-check it against the target day.
      const sameSlot = i < 0 ? (user.plans || []).find((p) => p.date === body.date && p.sport === body.sport) : null
      if (sameSlot) { body = { ...body, id: sameSlot.id }; i = user.plans.findIndex((p) => p.id === body.id) }
      else {
        const cap = planCapViolation(user.plans, body, user.info) // pure + unit-tested; EXCLUDES body.id so a move is checked vs the OTHER sessions
        if (cap) return cap
      }
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
      : body.sport === 'swim'
      ? { segments: Array.isArray(body.segments) ? body.segments : [], moving_time: Number(body.moving_time) || undefined, distanceM: Number(body.distanceM) || undefined, icu_training_load: Number(body.icu_training_load) || undefined } // #614 — carry swim's time/distance/load so the push path (swim TSS) isn't silently dropped
      : { ftp: Number(body.ftp) || undefined, segments: Array.isArray(body.segments) ? body.segments : [], indoor: body.indoor != null ? !!body.indoor : (i >= 0 ? user.plans[i]?.indoor : undefined) }), // #479 indoor(ERG=specific) vs outdoor(range); kept across updates unless the body sets it
  }
  // #331c — HARD guard: never persist an "easy/recovery/warm-up"-labelled run/ride segment at near-threshold
  // effort (95% is NEVER easy — any sport). Fixes it at the source so the DB, the app view, AND the intervals
  // push are all sane, even when the coach fat-fingers the %.
  enforceShapeIntensity(user, plan) // #615 — ENFORCE the week-shape ceiling + quality-day count IN CODE (the prompt was ignored)
  if ((plan.sport === 'ride' || plan.sport === 'run') && Array.isArray(plan.segments) && plan.segments.length) { // #614 — power/pace clamp is for ride/run only, not swim
    const g = clampEasyEfforts(plan.title, plan.segments)
    if (g.clamped) { plan.segments = g.segments; console.log(`[clampEasyEfforts] ${user.username} "${plan.title}" — clamped ${g.clamped} easy segment(s) below ${'threshold'}`) }
    plan.segments = normalizeRamps(plan.segments) // #384 — flat cool-downs + warm-ups ramp up, so intervals never shows a backwards "150-117" range
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
  const sport = (ev.type === 'Ride' || ev.type === 'VirtualRide') ? 'ride' : ev.type === 'Run' ? 'run' : ev.type === 'Swim' ? 'swim' : 'gym' // #479 VirtualRide = indoor ride
  const plan = { id: ev.external_id || `icu-${ev.id}`, date, sport, title: ev.name || 'Workout', notes: stripDerivedWorkout(stripPlatyplusLinks(ev.description || '')), origin: 'icu', icuEventId: ev.id, updatedAt: Date.now() }
  if (ev.type === 'VirtualRide') plan.indoor = true // #479 — preserve the indoor flag on import
  if (sport === 'ride' || sport === 'run') {
    plan.segments = flattenIcuStepsSrv(ev.workout_doc?.steps || [])
  } else {
    plan.rounds = 1; plan.exercises = [] // gym structure stays in notes; the client parses it
  }
  return plan
}
async function reconcileFromIcu(user, from, to) {
  if (!user.icuKey) return { skipped: 'no intervals key' }
  if (!user.icuAthlete) { console.warn(`[icu] blocked ${user.username || user.id}: no intervals athlete — refusing to touch the seed calendar (#456)`); return { skipped: 'no intervals athlete' } }
  const ath = user.icuAthlete
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
  let imported = 0, refreshed = 0, gcDeleted = 0, reverted = 0
  const orphanCandidates = [] // #414 — our pushed events that no plan claims; deleted AFTER the loop, fail-safe-guarded
  const revertMoves = [] // #588 — Platyplus-origin plans a user MOVED in intervals; re-pushed to their owned date AFTER the loop
  for (const ev of events || []) {
    if (ev.category && ev.category !== 'WORKOUT') continue
    if (!['Ride', 'Run', 'Swim', 'WeightTraining'].includes(ev.type)) continue
    if (ownedIcuIds.has(ev.id)) {
      // We already have this event as a plan — REFRESH its derived fields from intervals so
      // edits to the workout (and the #217 power_zone fix) propagate. icu-origin ONLY:
      // platyplus-origin plans are master and never overwritten. Completion/feedback untouched.
      const existing = user.plans.find((p) => p.icuEventId === ev.id)
      if (existing) {
        // #588 (SUPERSEDES #380 "intervals-move-wins") — Platyplus OWNS the plan; a user must NOT manipulate it in
        // intervals. If they MOVED a PLATYPLUS-origin planned event to another day there, REVERT it (re-push to its
        // Platyplus date after the loop — prod-only). An intervals-ORIGIN plan (the user made it in intervals) still
        // adopts the move. Content stays Platyplus-owned either way (icu-origin still refreshes below).
        const icuDate = String(ev.start_date_local || '').slice(0, 10)
        if (icuDate && icuDate !== existing.date) {
          if (userMovedPlatyplusPlan(existing, icuDate)) revertMoves.push(existing) // revert the user's move (re-push below)
          else { existing.date = icuDate; existing.updatedAt = Date.now(); refreshed++ } // intervals-origin plan: adopt
        }
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
    const sport = ev.type === 'Ride' ? 'ride' : ev.type === 'Run' ? 'run' : ev.type === 'Swim' ? 'swim' : 'gym'
    if (planKeys.has(planKey(date, sport, ev.name))) continue
    // #377/#414 — an event WE pushed (external_id = a Platyplus plan id; gym also carries the "Open workout in
    // Platyplus" deep-link) that reached HERE means no current plan claims it — not by icuEventId (1773), not by
    // external_id/id (1795), not by day+sport+title (1799). That's an ORPHAN: a leftover from a move/re-plan whose
    // cleanup (deleteIcuEvent) never fired. Gym → renders as an empty-exercise shell (Xenia's bug); any sport →
    // would re-import as a PHANTOM plan below. Collect it now; the DELETE happens after the loop, fail-safe-guarded
    // (JM warned: a user's workouts can be 100% coach-made, so this matches ALL their events — never mass-delete).
    // Either way DON'T re-import it as a plan. Genuine intervals-origin workouts (athlete-created, NO external_id)
    // fall through and import normally below.
    if (isPlatyplusPushedEvent(ev)) { orphanCandidates.push(ev); continue }
    const plan = icuEventToPlan(ev)
    user.plans.push(plan); imported++
    planIds.add(plan.id); planKeys.add(planKey(plan.date, plan.sport, plan.title)) // guard against dups within this batch too
  }
  // #414 — ORPHAN GC, made FAIL-SAFE. JM: a user's planned workouts can be 100% coach-made, so
  // isPlatyplusPushedEvent matches ALL their events → the ONLY thing keeping a real UPCOMING session alive is the
  // "a plan claims it" logic above. So NEVER mass-delete: (a) do nothing if NO plans are loaded (a stale/empty
  // load must not read as "everything is orphaned"), and (b) CAP deletions per run — a genuine move/re-plan leaves
  // 1-2 orphans; a large batch signals a bad plan state, so skip + warn rather than delete. PROD-only.
  // #423 SAFETY — the orphan-GC DELETED Xenia's legit upcoming gym events: a coach re-push (create_workout on the
  // same id) transiently broke the plan↔event link, the event momentarily looked orphaned, the GC deleted it, and
  // the deletion-mirror then dropped the plan → real workouts lost. Until the GC can tell a true orphan from a
  // mid-re-push transient (e.g. only sweep PAST events, or require the plan to have been gone across TWO reconciles),
  // it is **LOG-ONLY — it never deletes**. (Original empty-shell orphans are cleaned by hand instead.)
  // #414/#423/#429/#431 — orphan GC, re-enabled SAFELY. An orphan = a Platyplus-PUSHED event that NO plan
  // claims by icuEventId. Two real cases seen: (1) JM's DUPLICATE rides — an OLD event from a prior plan left
  // behind after the coach re-planned the SAME day (a NEW plan+event now owns the slot); (2) a rest-day
  // LEFTOVER — the plan was removed but its event wasn't. The Xenia regression to AVOID was a mid-re-push
  // transient: create_workout on the same plan momentarily broke the plan↔event link (plan still there, just
  // not linked to a live event). So delete an orphan ONLY when it's provably safe:
  //   • NO plan for its day+sport → genuine leftover (a re-push keeps the plan, so "no plan" is never the
  //     transient) → delete; OR
  //   • a plan for its day+sport is linked to a DIFFERENT, LIVE event → the orphan is a duplicate → delete.
  //   • else (a plan exists but isn't linked to a live different event) → could be mid-re-push → SKIP.
  // Plus: plans must be loaded (a stale/empty load ≠ "all orphaned"), and cap the batch (a big one = bad
  // plan state → skip + warn). PROD-only.
  if (!IS_STAGING && orphanCandidates.length && user.plans.length) {
    // #446 — delete a MOVE/RE-PLAN LEFTOVER (its slot re-taken by a different live plan, OR the same session now
    // lives on another day = same sport+title, live) while KEEPING a legit lost-link session (unique title, no
    // live plan owns its slot). Fixes the cross-day-move orphan the old slot-only rule was blind to, without
    // re-introducing #431/#377 (deleting JM's real gym). Pure + tested in icu-dedup.test.ts.
    const safe = orphanCandidates.filter((ev) => orphanIsMoveLeftover(ev, { liveIds: liveIcuIds, plans: user.plans }))
    if (safe.length > 8) {
      console.warn(`[reconcile GC] ${user.username}: ${safe.length} orphan candidates — too many, SKIPPING (bad plan state?).`)
    } else if (safe.length) {
      for (const ev of safe) { await deleteIcuEvent(user, { icuEventId: ev.id }); gcDeleted++ }
      console.warn(`[reconcile GC] ${user.username}: deleted ${safe.length} orphan event(s) [${safe.map((e) => e.id).join(',')}] — leftover/duplicate, no owning plan.`)
    }
  }
  // #588 — Platyplus OWNS the plan: a user MOVED a Platyplus-origin planned event in intervals → REVERT it by re-pushing
  // to its OWNED date (pushPlanToIcu finds the moved event by icuEventId + updates it back, no duplicate). PROD-only
  // (pushPlanToIcu skips on staging). Capped fail-safe. Net effect: intervals is a read-only mirror — a move snaps back.
  if (!IS_STAGING && revertMoves.length) {
    for (const p of revertMoves.slice(0, 12)) { try { await pushPlanToIcu(user, p); reverted++ } catch (e) { console.error('[revert-move] ' + (e.message || e)) } }
    console.warn(`[reconcile revert] ${user.username}: reverted ${reverted}/${revertMoves.length} user move(s) done in intervals — Platyplus owns the plan (#588).`)
  }
  // Deletion mirror (#150) + replaced-plan cleanup (#185): drop a stored plan whose
  // intervals mirror is gone — icu-origin always, platyplus-origin ONLY when a live
  // (replacement) WORKOUT event now occupies the same day+sport (the coach republished
  // it under a new title). A pure intervals deletion with no replacement is kept, so
  // Platyplus stays master for plans it solely owns. See planDroppedByReconcile.
  // #431 B1 — a platyplus-origin plan counts as REPLACED only when a DIFFERENT plan owns a LIVE event in its
  // slot, NOT merely because "some event exists there" (the old `liveSlots` dropped the legit old plan on a
  // retitle/re-plan → the lost-gym bug). ownedSlots = slots a live-backed plan holds; the plan being checked
  // has a DEAD event (else kept above), so a hit means a genuine replacement plan owns the day.
  const ownedSlots = new Set(user.plans.filter((p) => p.icuEventId && liveIcuIds.has(p.icuEventId)).map((p) => slotKey(p.date, p.sport)))
  const before = user.plans.length
  // #431 B3 — staging is READ-ONLY toward intervals (it never re-pushes), so it must NEVER drop stored plans
  // (a wrongly-dropped QA plan is unrecoverable). The deletion-mirror is prod-only, like push + the orphan-GC.
  if (!IS_STAGING) user.plans = user.plans.filter((p) => !planDroppedByReconcile(p, { liveIds: liveIcuIds, ownedSlots, from, to }))
  const dropped = before - user.plans.length
  if (imported || dropped || gcDeleted || reverted) audit(user, { actor: 'sync', action: 'Synced from intervals', target: '', detail: [imported && `${imported} imported`, dropped && `${dropped} removed`, gcDeleted && `${gcDeleted} orphan${gcDeleted > 1 ? 's' : ''} cleaned`, refreshed && `${refreshed} refreshed`, reverted && `${reverted} move${reverted > 1 ? 's' : ''} reverted`].filter(Boolean).join(' · '), kind: 'sync' }) // #232/#414/#588
  if (imported || dropped || refreshed || gcDeleted || reverted) save(store)
  return { imported, dropped, refreshed, gcDeleted, reverted, scanned: (events || []).length }
}

// ---- calendar items (meal/mind/note) — shared by the UI (/auth) and API (/api).
function itemsInRange(user, from, to) {
  let items = user.items || []
  if (EAT_MIND_OFF) items = items.filter((x) => !DEACTIVATED_ITEM_TYPES.includes(x.type)) // #517/#518 — never surface parked meal/mind/supplement/recovery items
  if (from) items = items.filter((x) => x.date >= from)
  if (to) items = items.filter((x) => x.date <= to)
  return items.sort((a, b) => (a.date < b.date ? -1 : 1))
}
function validateItem(b) {
  if (!b || typeof b !== 'object') return 'body must be a JSON object'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return 'date (YYYY-MM-DD) is required'
  if (!['meal', 'mind', 'note', 'supplement'].includes(b.type)) return "type must be 'meal' | 'mind' | 'note' | 'supplement'" // #JM 2026-07-15 — 'recovery' items removed (parked → roadmap); recovery lives as the workout's recovery TEXT now
  return null
}
function upsertItem(user, b) {
  const err = validateItem(b); if (err) return { status: 400, body: { error: err } }
  // #491 — Eat/Mind deactivated: hard-reject any meal/mind/supplement so the coach can't leave orphan calendar items.
  if (EAT_MIND_OFF && ['meal', 'mind', 'supplement'].includes(b.type))
    return { status: 409, body: { error: `'${b.type}' is deactivated right now (Eat & Mind are off). Only ride / run / gym / recovery / note are schedulable — plan training + recovery instead.` } }
  user.items = user.items || []
  // #451 — RECOVERY as a first-class activity: structured insight (why today) + steps (the routine) + sleep note.
  const steps = Array.isArray(b.steps) ? b.steps.slice(0, 12).map((s) => ({ name: String(s?.name || '').slice(0, 120), dose: String(s?.dose || '').slice(0, 60), cue: String(s?.cue || '').slice(0, 200) })).filter((s) => s.name) : undefined
  const item = { id: b.id || newId(), date: b.date, type: b.type, title: b.title || '', refId: b.refId || '', mealType: b.mealType || '', kind: b.kind || '', kcal: b.kcal, minutes: b.minutes, notes: b.notes || '', why: typeof b.why === 'string' ? b.why : '', insight: typeof b.insight === 'string' ? b.insight.slice(0, 600) : '', steps, sleep: typeof b.sleep === 'string' ? b.sleep.slice(0, 300) : '', updatedAt: Date.now() }
  const i = user.items.findIndex((x) => x.id === item.id)
  if (i >= 0) user.items[i] = item; else user.items.push(item)
  save(store)
  return { status: i >= 0 ? 200 : 201, body: item }
}
function deleteItemById(user, id) {
  user.items = (user.items || []).filter((x) => x.id !== id); save(store)
}
// #517/#518 — idempotent boot purge of parked item types while Eat/Mind + recovery are OFF, so no orphan
// meal / recovery blocks linger in anyone's calendar. A no-op once clean; skipped entirely if Eat is re-enabled.
function sweepDeactivatedItems() {
  if (!EAT_MIND_OFF) return
  let n = 0
  for (const u of store.users || []) {
    const before = (u.items || []).length
    if (!before) continue
    u.items = u.items.filter((x) => !DEACTIVATED_ITEM_TYPES.includes(x.type))
    n += before - u.items.length
  }
  if (n) { save(store); console.log(`[boot] swept ${n} parked meal/mind/supplement/recovery item(s) (Eat/Mind off)`) }
}
// #519 — one-time athlete-profile migration lives in server/migrations.js, run via runMigrations() in start().

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
// #416 — search-result RANK: a demo WITH VIDEO always outranks an image-only one (free-exercise-db `fedb-*` are
// image-only; Centr `e-*` / MuscleWiki `mw-*` carry video for the same move), then exact/prefix name, then a
// tighter (shorter) name. So the coach picks video demos at the source — no more "no video" gym sessions. Pure.
export function rankExerciseHit(e, q) {
  const name = String(e?.name || '').toLowerCase()
  let s = 0
  if (e?.video) s += 1000
  if (name === q) s += 400
  else if (name.startsWith(q)) s += 200
  s += Math.max(0, 60 - name.length)
  return s
}
function searchExercises(q, limit, equipment) {
  const n = String(q || '').trim().toLowerCase()
  const eq = equipment ? String(equipment).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : null
  // #416 — TOKEN match (all significant query words present, any order) instead of a strict substring, so a video
  // demo named "Dumbbell SEATED shoulder press" still matches "dumbbell shoulder press" (the substring filter missed
  // it → the coach only saw the image-only free-exercise-db entry). Fall back to any-token when all-token finds
  // nothing. Then rank VIDEO-first so the coach picks a demo WITH a clip whenever the exact movement has one.
  const toks = n.split(/[^a-z0-9]+/).filter((t) => t.length > 1)
  // #420 — COMPLETE pool only (JM): only exercises that have a real VIDEO demo (~image comes with it). We have ~4k,
  // plenty complete — never serve an image-less row.
  let list = EXERCISES.filter((e) => e.video)
  if (eq) list = list.filter((e) => e.equipment && eq.includes(e.equipment.toLowerCase())) // owned-equipment filter
  if (toks.length) {
    // Rank by WHOLE-WORD overlap so "arm" matches the word "arm", NOT "w-arm-up", and a 2-word hit ("dumbbell row")
    // beats a 1-word one ("arm circles"). Then exact/prefix/shorter-name as the tiebreak (rankExerciseHit). Keep only
    // rows with ≥1 word matched — so "one-arm dumbbell row" (no exact video) still surfaces a video "Dumbbell Row".
    const words = (name) => new Set(String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    list = list.map((e) => { const w = words(e.name); return { e, ov: toks.filter((t) => w.has(t)).length } })
      .filter((x) => x.ov > 0)
      .sort((a, b) => (b.ov - a.ov) || (rankExerciseHit(b.e, n) - rankExerciseHit(a.e, n)))
      .map((x) => x.e)
  }
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
// #614 — compact SESSION-HISTORY digest for VARIETY (the look-back). Returns recent + upcoming PLANNED sessions as
// {date, sport, title, when} ONLY — not the full exercise/segment blobs — so the coach can cheaply see which
// ARCHETYPES it already used (titles are the archetype signal) and deliberately pick a DIFFERENT one. This is the
// mechanism that ends formulaic plans (the repeated "Easy Aerobic Spin"); much cheaper than diffing list_schedule.
app.get('/api/session-history', apiAuth, (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 21))
  const today = localTodayInTz(req.user.icuTimezone)
  const from = addDays(today, -days), to = addDays(today, 16)
  const sessions = (req.user.plans || [])
    .filter((p) => p.date && p.date >= from && p.date <= to)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((p) => ({ date: p.date, sport: p.sport, title: p.title || '', zone: p.zone || undefined, when: p.date < today ? 'past' : p.date === today ? 'today' : 'upcoming' }))
  res.json({ from, to, note: 'archetype signal = titles; vary the next session vs these', sessions })
})
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
  const ath = user.icuAthlete
  const acts = await icuGet(user, `/athlete/${ath}/activities?oldest=${date}&newest=${date}`)
  if (!Array.isArray(acts)) return null
  const want = /ride|cycl|bike/i.test(sport) ? /ride|cycl|bike/i : /run/i.test(sport) ? /run/i : /weight|strength|workout/i
  return acts.find((a) => want.test(String(a.type || ''))) || null
}
async function icuUploadTcx(user, tcx, name) {
  const ath = user.icuAthlete
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
  const ath = user.icuAthlete
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
  const data = await icuGet(req.user, `/athlete/${req.user.icuAthlete}/wellness?oldest=${icuDay(days)}&newest=${icuDay(0)}`)
  if (!data) return res.json({ connected: false, wellness: [] })
  const wellness = (Array.isArray(data) ? data : []).map((d) => ({
    // #597 — Form matches intervals: ONE decimal (CTL−ATL), NOT integer-rounded. Math.round turned −3.5 into −4
    // while intervals + the rest of the app (round1) show −3.5, so prod disagreed with intervals by a whole point.
    date: d.id, fitness: d.ctl, fatigue: d.atl, form: d.ctl != null && d.atl != null ? Math.round((d.ctl - d.atl) * 10) / 10 : null,
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
  const ath = user.icuAthlete
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
  // #581 — default to the athlete's LOCAL today (was icuDay(0) = UTC, wrong near midnight). And hand the coach the
  // WEEKDAY + whether it's today/tomorrow/yesterday, computed SERVER-SIDE, so it never mislabels days itself (JM: the
  // coach said "tomorrow Fri" on a Saturday). The coach must relay these labels, not compute the day-of-week.
  const today = await athleteToday(req.user)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : today
  const weekday = (() => { try { return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) } catch { return null } })()
  const diff = Math.round((new Date(date + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000)
  const relative = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff === -1 ? 'yesterday' : diff > 0 ? `in ${diff} days` : `${-diff} days ago`
  const loc = await athleteLatLon(req.user).catch(() => null)
  if (!loc) return res.json({ available: false, needsLocation: true, reason: 'No location yet — ask the athlete where they train (city), or it fills in from their next GPS activity.' })
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${date}&end_date=${date}`
    const r = await fetch(url, { headers: { 'user-agent': 'platyplus/1.0' } })
    if (!r.ok) return res.json({ available: false, reason: `weather service ${r.status}` })
    const j = await r.json()
    // #581 (JM: "use my LOCATION for the timezone") — Open-Meteo resolves the IANA tz for the lat/lon; capture it as
    // the athlete's tz when intervals hasn't set one, so "today" is right even without an intervals timezone.
    if (j.timezone && !req.user.icuTimezone) { req.user.icuTimezone = j.timezone; save(store) }
    const d = j.daily || {}
    const at = (k) => (Array.isArray(d[k]) ? d[k][0] : null)
    const g = weatherGuidance({ tMax: at('temperature_2m_max'), tApparentMax: at('apparent_temperature_max'), tMin: at('temperature_2m_min'), precipProb: at('precipitation_probability_max'), windMax: at('wind_speed_10m_max') })
    res.json({ available: true, date, weekday, relative, isToday: diff === 0, todayLocal: today, ...g })
  } catch (e) { res.json({ available: false, reason: (e && e.message) || 'weather fetch failed' }) }
})

app.get('/api/intervals/activities', apiAuth, async (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 14))
  const today = await athleteToday(req.user) // #5019 — athlete's LOCAL today, to label each activity's relative day
  const data = await icuGet(req.user, `/athlete/${req.user.icuAthlete}/activities?oldest=${icuDay(days)}&newest=${icuDay(0)}`)
  if (!data) return res.json({ connected: false, activities: [] })
  const activities = (Array.isArray(data) ? data : []).map((a) => {
    // #5019 — pre-compute the relative day (calendar-day diff of local dates), so the coach NEVER mislabels a
    // 2-days-ago ride as "yesterday". Both are the athlete's local YYYY-MM-DD → a clean date subtraction, tz-safe.
    const date = (a.start_date_local || '').slice(0, 10)
    const daysAgo = date ? Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) / 86400000) : null
    const when = daysAgo == null ? null : daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo < 0 ? `in ${-daysAgo} day${daysAgo === -1 ? '' : 's'}` : `${daysAgo} days ago`
    return {
    id: a.id, // #437 — the intervals activity id, so the coach can review/annotate THIS activity (save_coach_review activityId, set_activity_text). Was missing → the coach couldn't reliably get the id from the read (#436 caveat).
    date, daysAgo, when, // #5019 — `when`/`daysAgo` are authoritative: use them for "today/yesterday/N days ago", don't eyeball
    type: a.type, indoor: a.trainer === true || /virtual/i.test(a.type || ''),
    minutes: a.moving_time ? Math.round(a.moving_time / 60) : null, km: a.distance ? +(a.distance / 1000).toFixed(1) : null,
    avgHR: a.average_heartrate ? Math.round(a.average_heartrate) : null, avgW: a.icu_average_watts ? Math.round(a.icu_average_watts) : null,
    load: a.icu_training_load ?? null, intensity: a.icu_intensity ?? null, rpe: a.icu_rpe ?? null, feel: a.feel ?? null, name: a.name,
    reviewed: a.coach_tick != null, coachTick: a.coach_tick ?? null, // #437 — the reviewed/NOT-reviewed tracker: has the coach ticked this activity yet (coach_tick 1-5)?
  } })
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
// #534 — the COACH sets the athlete's weekly sets/muscle TARGET (JM: "why don't the coach define the target and we
// use that?"). It drives the Stats "sets per muscle" band + status. setsLow=0 (or omitted) clears it → app falls
// back to the frequency-scaled default. Base it on their sport/goal/phase AND their realistic gym frequency.
app.put('/api/gym-target', apiAuth, (req, res) => {
  req.user.info = req.user.info || {}
  const n = (v) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(30, Math.max(0, x)) : 0 }
  const low = n(req.body?.setsLow), high = Math.max(low, n(req.body?.setsHigh) || low)
  if (!low) req.user.info.gymTarget = undefined
  else req.user.info.gymTarget = { setsLow: low, setsHigh: high, note: String(req.body?.note || '').slice(0, 160) || undefined, at: Date.now() }
  save(store); res.json({ ok: true, gymTarget: req.user.info.gymTarget || null })
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
async function connectionsFor(user) {
  const intervals = !!user.icuKey
  const strava = userStravaConnected(user)
  let recentActivities = 0, lastActivity = null, wellness = { hrv: false, sleep: false, restingHR: false }
  const sources = []
  if (intervals) {
    const ath = user.icuAthlete
    const acts = await icuGet(user, `/athlete/${ath}/activities?oldest=${icuDay(21)}&newest=${icuDay(0)}`).catch(() => null)
    if (Array.isArray(acts)) {
      recentActivities = acts.length
      const sorted = acts.filter((a) => a.start_date_local).sort((a, b) => (a.start_date_local < b.start_date_local ? 1 : -1))
      if (sorted[0]) lastActivity = { date: sorted[0].start_date_local.slice(0, 10), type: sorted[0].type || null, source: sorted[0].source || sorted[0].device_name || null }
      for (const a of acts) { const s = a.source || a.device_name; if (s && !sources.includes(s)) sources.push(s) }
    }
    const well = await icuGet(user, `/athlete/${ath}/wellness?oldest=${icuDay(14)}&newest=${icuDay(0)}`).catch(() => null)
    if (Array.isArray(well)) wellness = {
      hrv: well.some((w) => w.hrv != null || w.hrvSDNN != null),
      sleep: well.some((w) => w.sleepSecs != null || w.sleepScore != null),
      restingHR: well.some((w) => w.restingHR != null),
    }
  }
  return { intervals, strava, recentActivities, lastActivity, deviceSources: sources.slice(0, 6), wellness }
}
app.get('/api/connections', apiAuth, async (req, res) => res.json(await connectionsFor(req.user)))
// #450 — session version so the onboarding checklist can AUTO-detect "rides syncing to intervals" (JM: don't
// make me manually ack Strava — check it yourself). recentActivities>0 ⇒ activities ARE flowing (any source).
app.get('/auth/connections', auth, async (req, res) => res.json(await connectionsFor(req.user)))

// Calendar items (meal / mind / note) — Platyplus-only, no intervals push.
app.get('/api/items', apiAuth, (req, res) => res.json(itemsInRange(req.user, req.query.from, req.query.to)))
app.post('/api/items', apiAuth, (req, res) => { const r = upsertItem(req.user, req.body || {}); res.status(r.status).json(r.body) })
app.delete('/api/items/:id', apiAuth, (req, res) => { deleteItemById(req.user, req.params.id); res.json({ ok: true }) })

// Exercise catalog search — resolve a name to a real exId (with demo media).
// Coach-activity notification: the coach posts a short note of what it just did
// (created/adjusted the plan, reviewed a workout). Surfaces in the user's bell.
// #457 — send a notification to the user's PHONE(S) via Web Push, gated by their per-type prefs. Prunes
// dead subscriptions (404/410). Fire-and-forget from pushNotification so it never blocks the in-app write.
async function sendWebPush(user, n) {
  if (!PUSH_ENABLED || !(user.pushSubs || []).length) return
  const prefs = user.info?.pushPrefs || { planChanges: true, reviews: true, reminders: false }
  const kind = n.subkind === 'review' ? 'reviews' : n.subkind === 'reminder' ? 'reminders' : 'planChanges' // #463
  if (prefs[kind] === false) return // opted out of this type (reminders default OFF → opt-in)
  const payload = JSON.stringify({ title: n.title, body: n.body || (n.items && n.items[0]) || '', link: n.link || '/', tag: n.subkind || 'coach' })
  const dead = []
  await Promise.all((user.pushSubs || []).map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload)
    .catch((e) => { if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); else console.warn('[webpush] ' + (e.statusCode || '') + ' ' + (e.message || e)) })))
  if (dead.length) { user.pushSubs = (user.pushSubs || []).filter((s) => !dead.includes(s.endpoint)); save(store) }
}
function pushNotification(u, { title, body, items, subkind, link, score, id, date }) {
  if (!u.notifications) u.notifications = []
  const t = String(title || '').trim().slice(0, 120)
  if (!t) return null
  audit(u, { actor: 'coach', action: 'Notified you', target: t, detail: String(body || '').slice(0, 140), kind: 'notify' }) // #232
  const n = {
    id: id || ('coach-' + randomBytes(6).toString('base64url')),
    kind: 'coach',
    subkind: (subkind === 'review' || subkind === 'report') ? subkind : undefined, // #233 review vs update; #5003 'report' = the user's own bug/idea report update
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
  sendWebPush(u, n).catch(() => {}) // #457 — also buzz the phone (fire-and-forget, prefs-gated inside)
  return n
}
// #457 — Web Push subscription management (session-auth). The client subscribes its device; we fan
// pushNotification out to all a user's devices. Config exposes the VAPID public key + current prefs.
app.get('/auth/push/config', auth, (req, res) => res.json({
  supported: PUSH_ENABLED,
  publicKey: PUSH_ENABLED ? VAPID_PUBLIC : null,
  subscribed: (req.user.pushSubs || []).length > 0,
  prefs: req.user.info?.pushPrefs || { planChanges: true, reviews: true, reminders: false },
}))
app.post('/auth/push/subscribe', auth, (req, res) => {
  const s = req.body?.subscription || req.body
  if (!s || typeof s.endpoint !== 'string' || !s.keys?.p256dh || !s.keys?.auth) return res.status(400).json({ error: 'invalid subscription' })
  req.user.pushSubs = (req.user.pushSubs || []).filter((x) => x.endpoint !== s.endpoint)
  req.user.pushSubs.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, ua: String(req.headers['user-agent'] || '').slice(0, 200), at: Date.now() })
  req.user.info = req.user.info || {}
  if (!req.user.info.pushPrefs) req.user.info.pushPrefs = { planChanges: true, reviews: true, reminders: false }
  save(store); res.json({ ok: true, subscribed: true, prefs: req.user.info.pushPrefs })
})
app.post('/auth/push/unsubscribe', auth, (req, res) => {
  const ep = req.body?.endpoint
  req.user.pushSubs = ep ? (req.user.pushSubs || []).filter((x) => x.endpoint !== ep) : []
  save(store); res.json({ ok: true, subscribed: (req.user.pushSubs || []).length > 0 })
})
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
    const ath = req.user.icuAthlete
    const name = `Weekly target${target.hours ? ` · ${target.hours}h` : ''}${target.load ? ` · ${target.load} load` : ''}`
    const desc = [target.focus, target.note].filter(Boolean).join('\n\n')
    icuFetch(req.user, `/athlete/${ath}/events`, { method: 'POST', body: JSON.stringify({ category: 'TARGET', start_date_local: `${weekStart}T00:00:00`, name, description: desc }) }).catch((e) => console.error('[weekly-target-mirror] ' + (e.message || e)))
  }
})

// #394 — the coach AUTHORS/adjusts the multi-week LOAD periodization (build/peak/recovery blocks). Stored as
// `user.info.loadPlan` — the TOP-priority source the 4-week Load&Form forecast reads (#393), so the projection
// reflects the coach's plan immediately. Also returns an OVER-CAP flag: a week beyond ~×12 CTL (weeklyLoadBudget.cap)
// is an intentional overload that must be NAMED, not accidental — the coach should justify or ease it (#375 band).
// Prod-only mirror: write `load_target` onto a Platyplus-managed weekly TARGET event per week (idempotent via
// external_id so a re-POST updates, never duplicates); QA is READ-ONLY toward intervals (IS_STAGING).
app.post('/api/coach/load-plan', apiAuth, async (req, res) => {
  const weeks = Array.isArray(req.body?.weeks) ? req.body.weeks : []
  const norm = weeks
    .map((w) => ({
      weekStart: /^\d{4}-\d{2}-\d{2}$/.test(String(w?.weekStart || '').slice(0, 10)) ? isoMonday(String(w.weekStart).slice(0, 10)) : null,
      target: Math.max(0, Math.round(Number(w?.target ?? w?.load) || 0)),
      phase: typeof w?.phase === 'string' ? w.phase.trim().slice(0, 16) : undefined,
      focus: typeof w?.focus === 'string' ? w.focus.trim().slice(0, 300) : undefined,
    }))
    .filter((w) => w.weekStart && w.target > 0)
  const byWeek = {}; for (const w of norm) byWeek[w.weekStart] = w // dedup by week, last wins
  const plan = Object.values(byWeek).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)).slice(0, 26)
  if (!plan.length) return res.status(400).json({ error: 'weeks required: [{ weekStart (a Monday, YYYY-MM-DD), target (weekly TSS), phase?, focus? }]' })
  req.user.info = req.user.info || {}
  req.user.info.loadPlan = plan
  const budget = weeklyLoadBudget(req.user.ctl)
  const cap = budget?.cap ?? null
  const overCap = cap ? plan.filter((w) => w.target > cap).map((w) => ({ weekStart: w.weekStart, target: w.target })) : []
  save(store)
  res.status(201).json({ ok: true, weeks: plan, ctl: req.user.ctl ?? null, capPerWeek: cap, band: budget ? { sustainable: budget.sustainable, build: budget.build, hard: budget.hard, cap } : null, overCap })
  // NOTE: the 4-week Load&Form forecast reads `info.loadPlan` as its TOP-priority source (#393), so the
  // projection reflects this immediately — no intervals write needed for the in-app value. Mirroring
  // `load_target` back onto the athlete's intervals ATP is a deferred follow-up: it needs idempotent
  // upsert (Platyplus tracks event ids to UPDATE, a plain POST would duplicate on re-POST) + IS_STAGING gating.
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
  if (typeof req.body.description === 'string') {
    // Always sign the public description with the brand tagline (JM 2026-07-16), idempotently.
    let d = req.body.description.slice(0, 3960).trimEnd()
    if (d && !/powered by platyplus/i.test(d)) d = `${d}\n\nPowered by Platyplus`
    payload.description = d
  }
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
  // #436 — SET the native intervals "coach's tick" (an INTEGER 1-5 rating, shown as the Coach ✓ on the
  // calendar/activity). It is NOT a boolean — {coach_tick:true} is rejected (Jackson can't parse a bool into
  // the int field); it wants 1-5 (coachTick maps our /10 score, null → neutral 3). Posting the note alone
  // does NOT set it — this write is what actually checks the box (#436, verified by round-trip on prod).
  await icuFetch(user, `/activity/${id}`, { method: 'PUT', body: JSON.stringify({ coach_tick: coachTick(score) }) }).catch((e) => console.error('[coach-tick] ' + (e.message || e)))
}
app.get('/api/exercises', apiAuth, (req, res) => {
  // #612 — BATCH search: `qs` = pipe-separated queries → one call returns a { query: results[] } map, so the coach
  // looks up a WHOLE gym session's moves in ONE round-trip instead of 20-30 (the big adapt-speed win).
  if (req.query.qs != null && String(req.query.qs).length) {
    const queries = String(req.query.qs).split('|').map((s) => s.trim()).filter(Boolean).slice(0, 40)
    const out = {}
    for (const q of queries) out[q] = searchExercises(q, req.query.limit || 6, req.query.equipment)
    return res.json(out)
  }
  res.json(searchExercises(req.query.q, req.query.limit, req.query.equipment))
})
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
  let path = req.originalUrl.replace(/^\/icu/, '')
  // #453 — FORCE the /athlete/<id> segment to the AUTHENTICATED user's own athlete. The client picks the
  // athlete id from a device-local setting that defaults to the seed athlete (JM's i28814), so on a shared
  // or not-yet-synced browser another user (Xenia, athlete i628280) was fetching JM's activities and never
  // saw her own (e.g. her Jul-7 strength session). This is a personal app — each user only ever reads their
  // OWN athlete, so pinning it here is authoritative and immune to stale client state.
  // #456 — if this is an athlete-scoped call and the user has NO athlete, BLOCK with a clear error rather
  // than proxying the seed athlete's data (never leak/serve JM's i28814 to a user without their own).
  if (!req.user.icuAthlete && /\/athlete\/i\d+/i.test(path)) return res.status(409).json({ error: 'No intervals.icu athlete connected — connect it in Settings.' })
  if (req.user.icuAthlete) path = path.replace(/(\/athlete\/)i\d+/i, `$1${req.user.icuAthlete}`)
  const url = ICU + path
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
// #496 — build-version endpoint the SW CAN'T cache (it's not a precached asset, so the service worker passes it
// straight to the network). The client polls it to DETECT a new deploy reliably even when the SW is serving a stale
// shell, then offers a real one-tap "update" (unregister SW + clear caches + reload). Returns the DEPLOYED main bundle.
let _verCache = { at: 0, bundle: '' }
app.get('/version', (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    if (Date.now() - _verCache.at > 30000) {
      const html = readFileSync(join(STATIC_DIR, 'index.html'), 'utf8')
      const m = html.match(/\/assets\/index-[A-Za-z0-9_]+\.js/)
      _verCache = { at: Date.now(), bundle: m ? m[0] : '' }
    }
  } catch { /* fall through with whatever we have */ }
  res.json({ bundle: _verCache.bundle })
})
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
// #610 (JM 2026-07-20) — SKELETON REMOVED. #516's code-computed skeleton cut coach cost but handed EVERY athlete
// the same generic threshold/sweet-spot/VO2 rotation and told the coach to "apply it", which destroyed the
// per-athlete individualization the coach used to do (pre-#516). Per JM's token-thrift rule (#590), NEVER trade
// quality for tokens — so the coach OWNS the plan again and BUILDS each session individualized to the athlete.
function dailyAdaptMsg(today, pass, cov) {
  const head = pass === 'refine'
    ? `Daily auto-adaptation — REFINE pass (${today}). Their overnight HRV/sleep/resting-HR has now LANDED in intervals — read it (get_wellness) + their check-in (get_checkins). If it changes today's readiness vs earlier, refine; if nothing meaningful changed, don't churn the plan.`
    : `Daily auto-adaptation — EARLY pass (${today}). Overnight HRV/sleep from their watch usually ISN'T synced this early, so decide from their FRESHNESS / Form (CTL−ATL, always available — get_wellness) + their latest check-in (get_checkins). You'll get a refine pass later once HRV/sleep lands.`
  const gap = cov && cov.tail >= 3
    ? ` **HORIZON — DO THIS FIRST (non-negotiable):** keep ~${DAILY_HORIZON} days planned ahead. The plan currently REACHES only ${cov.last || 'today'} — ${cov.tail} days SHORT of the ~2-week end (${cov.end}). EXTEND it to ~${cov.end}: add sessions from ${cov.firstEmpty} through ${cov.end}, UP TO (never beyond) their HARD weekly training-days cap + availability — leave genuine REST days blank.`
    : ''
  return `${head}${gap} Then BUILD + adapt their plan for the NEXT ${DAILY_HORIZON} DAYS (list_schedule first). **INDIVIDUALIZE every session to THIS athlete — YOU own the plan, there is no template to copy.** Use their full profile + your per-sport & female-athlete engines: their SPORT(S) — only sports they actually do (a runner gets runs, a swimmer pool/CSS sets, a lifter gym; NEVER program a session they can't do, e.g. a ride for someone with no bike); SEX; AGE (a teen = technique + no maximal loading; masters = extra recovery); repro-state — if PREGNANT, coach MODERATE / MAINTAIN by RPE + talk test, trimester-adjusted, never max or to-exhaustion (apply your female-athlete pregnancy guidance), otherwise factor menstrual phase; their GOALS; fitness/experience; equipment. **Follow the computed # THIS WEEK'S SHAPE (in your system prompt) EXACTLY — its quality-day count + intensity ceiling are authoritative; never add a quality/hard day beyond it (this is how pregnancy stays maintenance).** Match load to how they're recovering + their weekly frequency/availability; keep ~${DAILY_HORIZON} days populated (never double-book / exceed max-per-day / exceed the HARD weekly training-days cap). Author each ride/run/swim as STRUCTURED steps (warmup/work/cooldown with real targets) so it's followable on their device.
**VARY IT — MANDATORY, RIGHT THIS PASS:** your system prompt's **# THIS BLOCK'S VARIETY** block ASSIGNS the exact archetype for each quality day + the cue for each easy day. Build EACH day AS its assignment — its real structure + a title naming it — do NOT make every quality day the same shape and do NOT give two easy days the same title. Call **get_session_history** first to confirm you're not repeating the recent past either. This is a done-right-the-first-time build: no second pass will fix it, so vary + dose + individualize it correctly NOW. **Be efficient with tool calls** — read get_wellness + get_checkins + get_session_history + **get_metrics** in parallel, and look up ALL a gym session's moves in ONE search_exercises(\`queries=[…]\`) call, never one at a time.
**PRESCRIBE FROM THE FULL PROFILE (get_metrics), not just one threshold number** — coach the WHOLE athlete's physiology: use their **TTE** (time they can hold threshold) to size interval DURATION — short TTE ⇒ shorter reps + extensive-threshold work (3×15–20 @ 90–95%) and ease their threshold toward the modelled value; long TTE ⇒ they can hold longer efforts, so raise the ceiling; use **W′ / D′** (anaerobic reserve) to size near-max reps/sprints; use the **EF trend** to judge whether the aerobic base is responding (rising EF ⇒ base is working, hold course). Combine this with their objective, sport, sex, age and repro-state (all in your prompt). This is what turns their numbers into the RIGHT session, and it's exactly the # DEVELOPMENT PRIORITIES above.
**WORKOUT DESCRIPTION — YOU are the single author of every cue, so keep them CONSISTENT and never contradictory (a fuelling cue here must not clash with one anywhere else). Write the description for THIS session ONLY, in exactly this shape — three parts, nothing else:**
• **Objective** — what this session is FOR, tied to THEIR own numbers/goal (e.g. "lift the hardest power you can hold about an hour", "grow how long you can hold your threshold pace"). One plain sentence.
• **Success criteria** — what doing it RIGHT looks like: the concrete targets to hit (duration, interval structure, target power/pace/effort) + how it should feel, so they KNOW whether they nailed it.
• **Fuelling** — what to eat/drink FOR this session (before/during, sized to the session) — a short, concrete cue.
NOTHING ELSE in the description: NO recovery talk, NO meal-plan / "Eat" section, and NO mention of any PAST or FUTURE session — describe only the session in front of them. Plain language, concrete, no vague "easy / hard / Z2 endurance" label. Name the session by its purpose too (not a bare intensity word).
This pass is ONLY the WORKOUT plan (no activity reviews / meals / mind / separate recovery items — Eat/Mind + standalone recovery blocks are OFF/parked). It is SILENT (#498): make the changes with the tools but do NOT notify / push — they already got their one check-in ping today; never send a second. If genuinely uncertain, make the sensible conservative choice rather than asking — never push a question. Decide and act. Be concise.`
}
// #439 — FOCUSED horizon-fill (no reviews / fuel / mind distraction) so the coach actually populates the back
// half of the ~2-week window. Used to re-drive it when one adapt pass left the horizon short.
function horizonFillMsg(today, cov) {
  return `HORIZON FILL — focused, non-negotiable. Your plan REACHES only ${cov.last || 'today'}, ${cov.tail} days short of the ~${DAILY_HORIZON}-day window end (${cov.end}). In THIS pass do ONE thing: EXTEND the plan out to ~${cov.end} — add training sessions across the days from ${cov.firstEmpty} through ${cov.end}, UP TO (never beyond) their HARD weekly training-days cap + availability, leaving genuine REST days blank (don't force a session onto every day). Use list_schedule to see how far it reaches, then create the sessions (ride/run/gym per their sports + how the block is shaping up; keep intensity sane + spaced). Do NOT review activities, add meals/mind/recovery, or churn existing sessions now — just extend the back half of the horizon. Be concise.`
}
// #439 (JM idea) — SEPARATE focused pass per topic beats one giant prompt (the coach gave each partial
// attention + ran out). REVIEWS pass:
function reviewMsg(today) {
  return `Daily REVIEW pass (${today}) — do ONLY activity reviews now. get_recent_activities flags each activity's \`reviewed\` status + its \`id\`: for any completed activity in the last week with \`reviewed:false\`, REVIEW it — save_coach_review with that exact \`id\` (a score + one-line verdict + 2-4 takeaways; ticks the Coach box + posts your note) and give it a public-safe title/description via set_activity_text. SKIP anything already \`reviewed:true\` (never re-review); cap at the few most recent so nothing piles up. WHAT'S NEXT = the OBJECTIVE, NOT the next workouts (JM 2026-07-21, reverses #580): end the review by connecting THIS session to what the athlete is BUILDING TOWARD — their goal + the number/quality this work moves (e.g. "this threshold work is growing how long you can hold your hardest effort, which is the limiter for your event"). Do NOT list, name, or preview their upcoming/scheduled sessions — "Today: Z2 spin … Tomorrow: Threshold 4×10 …" is exactly WRONG — and do NOT add recovery / sleep / logistics here. Keep the \`next\` field purely about the OBJECTIVE and how this session moves them toward it; nothing about tomorrow's calendar. Don't CHANGE the plan in this pass, just reflect it truthfully. CALIBRATE each verdict to what was ACTUALLY done — match praise to real duration/volume/effort vs their norm; a tiny, very short, partial, or test session is a light opener/test, NOT a "solid"/"strong"/"great" session — name it honestly, never inflate. Be concise.`
}
// ROUND-OUT pass — FUEL / MIND / RECOVERY around the (already-set) plan:
function roundOutMsg(today) {
  if (EAT_MIND_OFF) return `Daily RECOVERY pass (${today}) — Eat & Mind are OFF right now, so add ONLY recovery around the plan (the workouts are already set; don't change them). After the hardest / longest days, put a RECOVERY session where it genuinely helps THIS athlete (schedule_recovery — mobility / sauna / easy walk, given STRUCTURED: insight = why today + steps = the routine with doses + a sleep note, NOT one text blob — it opens as its own activity view). Don't drop one onto every day. Do NOT schedule meals, supplements, or mind/meditation sessions (those sections are deactivated — the server rejects them). Be concise.`
  return `Daily ROUND-OUT pass (${today}) — add FUEL, MIND and RECOVERY around the plan (the workouts are already set; don't change them). On TODAY and each clearly demanding day (hard / long / quality), schedule a fitting meal or two (schedule_meal — a real recipe fitting their diet + daily fuel targets, more carbs around hard work, lighter on rest days, one-line why); add a MIND session (schedule_mind) where it earns its place (a wind-down after a hard/high-stress day, longer on a rest day); put RECOVERY (schedule_recovery — mobility / sauna / easy walk) after the hardest days, given STRUCTURED (insight = why + steps = the routine with doses + sleep note, NOT one text blob — it opens as its own activity view). ONLY where it genuinely adds value for THIS athlete on THIS day — don't drop one onto every slot, and don't churn what they've got. Be concise.`
}
// #508 (JM: "coach must review the metrics OFTEN in a SEPARATE prompt + fold what to sharpen into the plan — ideally
// not all-out tests, just enough — CRITICAL") — a FOCUSED daily pass: review each benchmark's freshness and, for the
// stalest one, fold ONE low-cost refining effort into the rolling horizon. Single-topic (own pass), never demands a
// dreaded max test. Mirrors the # KEEP THE ANCHORS SHARP system-prompt block but runs it as an active daily job.
function sharpenMsg(today) {
  return `Daily METRICS-SHARPEN pass (${today}) — keep the athlete's benchmarks HONEST, without demanding tests. Their threshold power / pace, CP·W′ (or CS·D′), VO₂max, TTE and max-HR are in your profile; each is only as good as the last quality effort behind it, and EVERYTHING you prescribe scales from them. Review freshness: get_recent_activities and, for EACH anchor, ask "is there a recent effort that would set it?" — a tempo/threshold effort for the threshold; a hard ~5-min effort for VO₂max/MAP; short near-max reps for W′/D′; an all-out finish for max-HR. For any anchor with NO recent effort behind it (e.g. weeks of only easy rides → the threshold is really a guess), fold ONE targeted, LOW-COST refining effort into the rolling ${DAILY_HORIZON}-day plan (list_schedule → create_ride/run/workout) — NEVER an all-out max test, never a dreaded 20-min: cycling → one 8–15 min hard sustained effort up a climb/segment when fresh (intervals reads eFTP straight from it), or a structured 2×8 only if they'd like a cleaner number; running → a hard 20 min or a 5 k / parkrun; gym → a heavy 3–5 rep top set. Just ENOUGH to re-read the anchor. Rules: at most ONE such effort per pass — pick the STALEST, most important anchor; place it on a day they're FRESH, within their weekly training-day + recovery limits, and never stacked against another hard day; if every anchor already has a recent effort behind it, change nothing. This pass is SILENT (background upkeep — no push; the athlete gets only their one check-in ping). When you DO add one, its title/description explains WHY in plain words ("one harder 15-minute stretch so I can dial in the hardest pace you can hold"), never "to update your FTP". Be concise.`
}
async function runDailyAdapt(user, pass) {
  try {
    const today = await athleteToday(user)
    // #610/#612 — the coach BUILDS + individualizes the plan in ONE pass (skeleton removed #516; multi-pass fill
    // loop removed #612 — it was spawning up to 5 EXTRA coach runs = minutes wasted). The single pass owns the full
    // ~2-week horizon (its prompt makes filling to the window end the first job); at most ONE fallback top-up if it
    // still comes up badly short, never a 5-deep loop.
    const covOf = () => horizonCoverage((user.plans || []).map((p) => p.date), today, DAILY_HORIZON)
    await runCoachTask(user, dailyAdaptMsg(today, pass, covOf()))
    if (covOf().tail >= 4) await runCoachTask(user, horizonFillMsg(today, covOf())) // single top-up only
    // 2) REVIEWS + 3) ROUND-OUT — their OWN focused passes, ONCE/day (dedup) so we don't re-spawn the coach
    //    for them on both the early AND refine passes.
    user.dailyAdapt = user.dailyAdapt || {}
    if (user.dailyAdapt.extras !== today) {
      user.dailyAdapt.extras = today; save(store)
      // #613 — the sharpen pass INJECTS a hard effort; SKIP it on a maintenance week (pregnancy / consistency
      // block with 0 quality days) so it can't stack a quality day the shape deliberately excluded.
      if (athleteWeekShape(user).qualityDays > 0) await runCoachTask(user, sharpenMsg(today)) // #508 — review benchmarks + fold ONE refining effort into the plan
      await runCoachTask(user, reviewMsg(today))
      // #JM 2026-07-15 — round-out (recovery/fuel/mind) pass REMOVED: Eat & Mind are off and recovery ITEMS are parked.
      // #629 — and per #623 recovery is NO LONGER written on the workout either (the description is objective + success +
      // fuelling only; the `recovery`/`mind` shell fields are unused + unrendered). So no recovery channel runs right now;
      // if one returns it's its own decision, not a silent workout-text ride. (roundOutMsg kept for the roadmap.)
    }
  } catch (e) { console.error(`[daily-adapt ${pass}] ${user.username || ''} ${e.message || e}`) }
  // #620 — the shape ENFORCEMENT runs in its OWN try, ALWAYS, even if an LLM pass above threw (a coach-service
  // hiccup must NEVER leave stale sweet-spot / over-budget sessions on a maintenance athlete's plan). This is the
  // safety net; it's pure + fast (no LLM) so it's cheap to guarantee.
  try { await reenforceShapeAll(user) } catch (e) { console.error(`[reenforce ${user.username || ''}] ${e.message || e}`) }
}
// One scheduler tick: fire the due pass for each coached athlete. Called every ~30 min.
// #463 — DAILY REMINDER phone push (opt-in via pushPrefs.reminders, default OFF). Once/day in the athlete's
// local morning, nudge them to check in + see today's plan — SKIP if they already checked in today. Any
// subscribed user (not gated on the coach), and fine on QA + prod (it only sends a push, never touches intervals).
function dailyReminderPush(user, today, hour) {
  if (!user.info?.pushPrefs?.reminders || !(user.pushSubs || []).length) return
  if (hour < 7 || hour >= 11) return // local morning window only
  if (user.dailyReminded === today) return // once per day
  if ((user.checkins || []).some((c) => c.date === today)) return // already engaged today
  user.dailyReminded = today; save(store)
  sendWebPush(user, { subkind: 'reminder', title: '⏰ Ready to train?', body: 'Check in and see what your coach has planned for you today.', link: '/' }).catch(() => {})
}
async function dailyAdaptTick() {
  for (const user of store.users || []) {
    const tz = user.icuTimezone || COACH_TZ
    const today = localTodayInTz(tz), hour = localHourInTz(tz)
    // #463 — daily reminder runs for ANY opted-in subscribed user (independent of the coach auto-adapt below).
    try { dailyReminderPush(user, today, hour) } catch (e) { console.error('[reminder] ' + (e.message || e)) }
    if (IS_STAGING) continue // #381 — coach auto-adapt is PROD-only (shared athlete); the reminder above is fine on both
    await healMirror(user) // #5026 — backstop read-repair (the primary trigger is sync-on-load, below)
    // #606 (JM 2026-07-20) — coaching does NOT require intervals. The old `!user.icuKey` gate SKIPPED any athlete
    // without a personal intervals key, so their 14-day horizon never got (re)built — while `handle-missed` STILL
    // removed their stale/missed sessions, leaving them with an empty plan (Xenia's plans died at Jul 17: cleanup ran,
    // rebuild was gated off). The planner is intervals-OPTIONAL: the skeleton is coded, readiness degrades to the
    // check-in scores when there's no wellness, and pushPlanToIcu no-ops without an athlete — so a check-in-only
    // athlete still gets a full plan. Gate on the COACH being set up, not on intervals.
    if (!user.coachProfile || !String(user.coachProfile).trim()) continue
    user.dailyAdapt = user.dailyAdapt || {}
    try {
      // #469 (JM 2026-07-10) — ONE adapt per day, AFTER the check-in. The old everyday ~4am MORNING pass was
      // REMOVED: adapting BEFORE the check-in has no readiness context, so it didn't make sense. Run once the
      // athlete has checked in today — their Sleep/Freshness/Energy + whatever overnight wellness landed give the
      // coach real signal to adapt on. (No check-in today ⇒ no adapt; the next check-in fills/adjusts the horizon.)
      if (user.dailyAdapt.done !== today && hour >= 5 && hour < 23 && (user.checkins || []).some((c) => c.date === today)) {
        user.dailyAdapt.done = today; save(store); runDailyAdapt(user, 'refine')
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
  sweepDeactivatedItems() // #517/#518 — purge any leftover parked meal/mind/supplement/recovery items
  runMigrations(store, { persist: save, log: (m) => console.log(m) }) // #519 — apply pending run-once data migrations
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
