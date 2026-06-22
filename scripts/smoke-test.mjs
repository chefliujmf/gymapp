// Platyplus smoke test — the automated [A] rows of Gate 1 (Dev → QA) in TESTING.md.
// Runs against a live API (default dev :8088). Grow this as features land.
//
// Usage: npm run test:smoke        (expects `npm run dev:full` running)
//        SMOKE_BASE=http://… SMOKE_USER=… SMOKE_PASS=… node scripts/smoke-test.mjs
import assert from 'node:assert'

const BASE = process.env.SMOKE_BASE || 'http://localhost:8088'
const USER = process.env.SMOKE_USER || 'jmfiset'
const PASS = process.env.SMOKE_PASS || 'devpass'

let cookie = ''
const url = (p) => BASE + p
const hdr = () => ({ 'content-type': 'application/json', ...(cookie ? { cookie } : {}) })

let passed = 0
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) } catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1 }
}

// --- 2) API up
await check('API up (GET /auth/config → 200)', async () => {
  const r = await fetch(url('/auth/config'))
  assert.equal(r.status, 200)
})

// --- 3) Auth
await check('login → 200 + session cookie', async () => {
  const r = await fetch(url('/auth/login'), { method: 'POST', headers: hdr(), body: JSON.stringify({ login: USER, password: PASS }) })
  assert.equal(r.status, 200, `login status ${r.status}`)
  const sc = r.headers.get('set-cookie')
  assert.ok(sc, 'no set-cookie')
  cookie = sc.split(';')[0]
})

// --- 4) Account serializer
await check('GET /auth/me has coachName + hasCoachProfile', async () => {
  const u = await (await fetch(url('/auth/me'), { headers: hdr() })).json()
  assert.ok('coachName' in u, 'missing coachName')
  assert.ok('hasCoachProfile' in u, 'missing hasCoachProfile')
})

// --- 5/6) Athlete profile GET + PUT roundtrip (restores original)
await check('athlete profile GET + PUT roundtrip', async () => {
  const before = await (await fetch(url('/auth/profile/athlete'), { headers: hdr() })).json()
  assert.ok('profile' in before && 'updatedAt' in before, 'bad shape')
  const marker = `# smoke ${Date.now()}\n`
  await fetch(url('/auth/profile/athlete'), { method: 'PUT', headers: hdr(), body: JSON.stringify({ profile: marker }) })
  const mid = await (await fetch(url('/auth/profile/athlete'), { headers: hdr() })).json()
  assert.equal(mid.profile, marker, 'PUT not reflected')
  await fetch(url('/auth/profile/athlete'), { method: 'PUT', headers: hdr(), body: JSON.stringify({ profile: before.profile }) }) // restore
})

// --- 7) Coach name persists
await check('coachName PUT persists', async () => {
  const me0 = await (await fetch(url('/auth/me'), { headers: hdr() })).json()
  await fetch(url('/auth/profile'), { method: 'PUT', headers: hdr(), body: JSON.stringify({ coachName: 'SmokeCoach' }) })
  const me1 = await (await fetch(url('/auth/me'), { headers: hdr() })).json()
  assert.equal(me1.coachName, 'SmokeCoach')
  await fetch(url('/auth/profile'), { method: 'PUT', headers: hdr(), body: JSON.stringify({ coachName: me0.coachName || '' }) }) // restore
})

// --- 8) Chat first SSE frame carries the coach (don't wait for the full reply)
await check('chat first SSE frame has {coach}', async () => {
  const ac = new AbortController()
  const r = await fetch(url('/auth/chat'), { method: 'POST', headers: hdr(), body: JSON.stringify({ message: 'ping' }), signal: ac.signal })
  assert.equal(r.status, 200)
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ''
  for (let i = 0; i < 5; i++) {
    const { value, done } = await reader.read(); if (done) break
    buf += dec.decode(value, { stream: true })
    const frame = buf.split('\n\n').find((f) => f.includes('"coach"'))
    if (frame) { ac.abort(); return }
  }
  ac.abort()
  throw new Error('no {coach} frame in first chunks')
})

console.log(`\n${process.exitCode ? '✗ FAIL' : '✓ PASS'} — ${passed} checks passed`)
