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
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { load, save, newId } from './store.js'

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
const store = load()
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
  save(store)
  console.log('Seeded admin user.')
}
// Backfill api tokens / plan arrays for any user created before these existed.
for (const u of store.users) { if (!u.apiToken) u.apiToken = randomBytes(24).toString('base64url'); if (!u.plans) u.plans = []; if (!u.logs) u.logs = []; if (!u.items) u.items = [] }
save(store)
// Late-seed the admin's intervals.icu key if it wasn't stored yet (idempotent).
const seedKey = process.env.SEED_ICU_KEY
if (seedKey) {
  const a = store.users.find((u) => u.role === 'admin')
  if (a && !a.icuKey) { a.icuKey = seedKey; a.icuAthlete = process.env.SEED_ICU_ATHLETE || a.icuAthlete || 'i28814'; save(store); console.log('Seeded admin intervals.icu key.') }
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
const pub = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, info: u.info || {}, avatar: u.avatar || '', hasIcuKey: !!u.icuKey, icuAthlete: u.icuAthlete || 'i28814', passkeys: (u.passkeys || []).map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt })) })
const findById = (id) => store.users.find((u) => u.id === id)
const findByLogin = (login) => { const l = String(login || '').toLowerCase(); return store.users.find((u) => u.username.toLowerCase() === l || u.email === l) }
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
app.use(express.json())
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
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
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
app.put('/auth/icu', auth, (req, res) => {
  if (typeof req.body.icuKey === 'string') req.user.icuKey = req.body.icuKey.trim()
  if (typeof req.body.icuAthlete === 'string') req.user.icuAthlete = req.body.icuAthlete.trim()
  save(store); res.json(pub(req.user))
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
  save(store); res.json(pub(req.user))
})

// admin: user management
app.get('/auth/users', auth, admin, (req, res) => res.json(store.users.map(pub)))
app.post('/auth/users', auth, admin, async (req, res) => {
  const username = String(req.body.username || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!username || !email.includes('@')) return res.status(400).json({ error: 'username + valid email required' })
  if (findByLogin(username) || findByLogin(email)) return res.status(409).json({ error: 'User already exists' })
  const temp = tempPassword()
  const u = { id: newId(), username, email, role: req.body.role === 'admin' ? 'admin' : 'user', passwordHash: bcrypt.hashSync(temp, 10), passkeys: [], info: {}, icuKey: '', icuAthlete: 'i28814', apiToken: randomBytes(24).toString('base64url'), plans: [], createdAt: Date.now() }
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
app.post('/auth/plans', auth, async (req, res) => { const r = await upsertPlan(req.user, req.body); res.status(r.status).json(r.body) })
app.delete('/auth/plans/:id', auth, async (req, res) => { await deletePlanById(req.user, req.params.id); res.json({ ok: true }) })

// Non-workout calendar items (meal / mind / note) — Platyplus only, no intervals push.
app.get('/auth/items', auth, (req, res) => {
  let items = req.user.items || []
  if (req.query.from) items = items.filter((x) => x.date >= req.query.from)
  if (req.query.to) items = items.filter((x) => x.date <= req.query.to)
  res.json(items.sort((a, b) => (a.date < b.date ? -1 : 1)))
})
app.post('/auth/items', auth, (req, res) => {
  const b = req.body || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' })
  if (!['meal', 'mind', 'note'].includes(b.type)) return res.status(400).json({ error: 'type must be meal|mind|note' })
  req.user.items = req.user.items || []
  const item = { id: b.id || newId(), date: b.date, type: b.type, title: b.title || '', refId: b.refId || '', mealType: b.mealType || '', kcal: b.kcal, minutes: b.minutes, notes: b.notes || '', updatedAt: Date.now() }
  const i = req.user.items.findIndex((x) => x.id === item.id)
  if (i >= 0) req.user.items[i] = item; else req.user.items.push(item)
  save(store); res.status(i >= 0 ? 200 : 201).json(item)
})
app.delete('/auth/items/:id', auth, (req, res) => { req.user.items = (req.user.items || []).filter((x) => x.id !== req.params.id); save(store); res.json({ ok: true }) })

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
// Map a plan to an intervals calendar event. Rides/runs carry a structured
// workout_doc (power steps) so intervals pushes a real interval workout to Wahoo.
function planToIcuEvent(plan) {
  const ev = { start_date_local: plan.date + 'T00:00:00', category: 'WORKOUT', name: plan.title, external_id: plan.id, description: plan.notes || '' }
  if (plan.sport === 'ride' || plan.sport === 'run') {
    const segs = plan.segments || []
    ev.type = plan.sport === 'ride' ? 'Ride' : 'Run'
    ev.moving_time = segs.reduce((s, x) => s + (Number(x.duration) || 0), 0)
    if (segs.length) ev.workout_doc = { steps: segs.map((s) => ({ duration: Number(s.duration) || 0, power: { start: Number(s.powerStart) || 0, end: Number(s.powerEnd) || 0, units: '%ftp' }, ...(s.label ? { text: s.label } : {}) })) }
  } else {
    ev.type = 'WeightTraining'
    ev.description = `[gymapp] ${plan.rounds || 1} rounds\n` + (plan.exercises || []).map((x) => `• ${x.name}${x.exId ? ` [${x.exId}]` : ''} — ${(x.mode || 'reps') === 'timed' ? `${x.seconds || 40}s` : `${x.sets || 3}×${x.reps || 10}`}`).join('\n') + (plan.notes ? `\n\n${plan.notes}` : '')
  }
  return ev
}
// Create or update the mirror event (tracked by plan.icuEventId).
async function pushPlanToIcu(user, plan) {
  if (!user.icuKey) return { skipped: 'no intervals key' }
  const ath = user.icuAthlete || 'i28814'
  const ev = planToIcuEvent(plan)
  try {
    if (plan.icuEventId) {
      const r = await icuFetch(user, `/athlete/${ath}/events/${plan.icuEventId}`, { method: 'PUT', body: JSON.stringify(ev) })
      if (r.ok) return { updated: plan.icuEventId }
      if (r.status !== 404) return { error: `update ${r.status}` }
    }
    const r = await icuFetch(user, `/athlete/${ath}/events`, { method: 'POST', body: JSON.stringify(ev) })
    if (!r.ok) return { error: `create ${r.status}` }
    const created = await r.json()
    plan.icuEventId = created.id; save(store)
    return { created: created.id }
  } catch (e) { return { error: String(e.message || e) } }
}
async function deleteIcuEvent(user, plan) {
  if (!user.icuKey || !plan?.icuEventId) return
  try { await icuFetch(user, `/athlete/${user.icuAthlete || 'i28814'}/events/${plan.icuEventId}`, { method: 'DELETE' }) } catch { /* best effort */ }
}
// Shared upsert/delete for workout plans (used by both the coach API and the UI).
async function upsertPlan(user, body) {
  const err = validatePlan(body); if (err) return { status: 400, body: { error: err } }
  const i = user.plans.findIndex((p) => p.id === body.id)
  const plan = {
    id: body.id, date: body.date, sport: body.sport, title: body.title,
    notes: body.notes || '', updatedAt: Date.now(),
    icuEventId: i >= 0 ? user.plans[i].icuEventId : undefined,
    ...(body.sport === 'gym'
      ? { rounds: Number(body.rounds) || 1, exercises: Array.isArray(body.exercises) ? body.exercises : [] }
      : { ftp: Number(body.ftp) || undefined, segments: Array.isArray(body.segments) ? body.segments : [] }),
  }
  if (i >= 0) user.plans[i] = plan; else user.plans.push(plan)
  save(store)
  const icu = await pushPlanToIcu(user, plan)
  return { status: i >= 0 ? 200 : 201, body: { ...plan, icu } }
}
async function deletePlanById(user, id) {
  const plan = (user.plans || []).find((x) => x.id === id)
  await deleteIcuEvent(user, plan)
  user.plans = (user.plans || []).filter((x) => x.id !== id); save(store)
}

// Upsert a planned session by id (idempotent — re-POST to update).
app.post('/api/plan', apiAuth, async (req, res) => { const r = await upsertPlan(req.user, req.body); res.status(r.status).json(r.body) })
app.get('/api/plans', apiAuth, (req, res) => res.json(plansInRange(req.user, req.query.from, req.query.to)))
app.get('/api/plan/:id', apiAuth, (req, res) => { const p = (req.user.plans || []).find((x) => x.id === req.params.id); return p ? res.json(p) : res.status(404).json({ error: 'not found' }) })
app.delete('/api/plan/:id', apiAuth, async (req, res) => { await deletePlanById(req.user, req.params.id); res.json({ ok: true }) })

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
    res.send(Buffer.from(await r.arrayBuffer()))
  } catch (e) { res.status(502).json({ error: 'intervals.icu proxy failed', detail: String(e.message || e) }) }
})

// ---- static SPA ----------------------------------------------------------
// Self-hosted media (range requests for video seeking + long immutable cache).
app.use('/media', express.static(MEDIA_DIR, { maxAge: '365d', immutable: true }))
app.use(express.static(STATIC_DIR, { index: false, setHeaders: (res, p) => { if (p.endsWith('index.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache') } }))
app.get('*', (req, res) => res.sendFile(join(STATIC_DIR, 'index.html')))

app.listen(PORT, () => console.log(`gymapp listening on :${PORT} (rpID ${RP_ID})`))
