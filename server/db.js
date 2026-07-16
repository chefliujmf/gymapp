// Postgres-backed store (relational, robust) — DROP-IN for the old JSON-file store.js.
//   loadStore()  rebuilds the in-memory `store` shape ({users:[{...nested arrays}]})
//   save(store)  persists it transactionally (per-user row + child tables)
// Tables: users + child tables plans / logs / calendar_items / notifications /
// coach_reviews / passkeys / checkins (FKs, indexes). Irregular nested fields live
// in a JSONB `doc` per row; queried fields are real columns. Single-instance app, so
// the in-memory cache is the read path and Postgres is the durable, queryable store.
import { randomBytes, createHash } from 'node:crypto'

// pg is loaded LAZILY (dynamic import) + the pool created on first use, so local dev
// and the CI smoke-test can import this module without `pg` installed / a DB around.
// Only the Postgres code paths (DATABASE_URL set) ever touch it.
let pool = null
async function getPool() {
  if (!pool) {
    const pg = (await import('pg')).default
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
    pool.on('error', (e) => console.error('[db] pool error', e.message))
  }
  return pool
}

export const newId = () => randomBytes(9).toString('base64url')

export async function initDb() {
  const pool = await getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY, username text, email text, role text DEFAULT 'user',
      password_hash text, api_token text, icu_key text, icu_athlete text, sex text,
      created_at bigint, doc jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
    CREATE INDEX IF NOT EXISTS idx_users_token ON users (api_token);
    CREATE TABLE IF NOT EXISTS plans (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL, date date, sport text, title text, doc jsonb NOT NULL,
      PRIMARY KEY (user_id, id));
    CREATE INDEX IF NOT EXISTS idx_plans_user_date ON plans (user_id, date);
    CREATE TABLE IF NOT EXISTS logs (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sid text NOT NULL, date date, doc jsonb NOT NULL,
      PRIMARY KEY (user_id, sid));
    CREATE TABLE IF NOT EXISTS calendar_items (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL, date date, doc jsonb NOT NULL,
      PRIMARY KEY (user_id, id));
    CREATE TABLE IF NOT EXISTS notifications (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL, doc jsonb NOT NULL, PRIMARY KEY (user_id, id));
    CREATE TABLE IF NOT EXISTS coach_reviews (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text NOT NULL, doc jsonb NOT NULL, PRIMARY KEY (user_id, id));
    CREATE TABLE IF NOT EXISTS passkeys (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id text PRIMARY KEY, doc jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS checkins (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date date NOT NULL, doc jsonb NOT NULL, PRIMARY KEY (user_id, date));
    -- singleton row holding the store-level fields (sessionSecret, resets) the
    -- file store kept at top level. Losing sessionSecret breaks every JWT.
    CREATE TABLE IF NOT EXISTS app_meta (
      id int PRIMARY KEY DEFAULT 1, doc jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT app_meta_singleton CHECK (id = 1));
  `)
}

// scalar columns we pull OUT of the user object; everything else → doc jsonb.
const COLS = ['id', 'username', 'email', 'role', 'passwordHash', 'apiToken', 'icuKey', 'icuAthlete', 'sex', 'createdAt']
const NESTED = ['plans', 'logs', 'items', 'notifications', 'coachReviews', 'passkeys', 'checkins']
const onlyDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null)

export async function loadStore() {
  await initDb()
  const pool = await getPool()
  const users = []
  const { rows } = await pool.query('SELECT * FROM users')
  for (const r of rows) {
    const u = { ...r.doc, id: r.id, username: r.username, email: r.email, role: r.role, passwordHash: r.password_hash, apiToken: r.api_token, icuKey: r.icu_key, icuAthlete: r.icu_athlete, sex: r.sex, createdAt: r.created_at != null ? Number(r.created_at) : undefined }
    const child = async (table) => (await pool.query(`SELECT doc FROM ${table} WHERE user_id=$1`, [r.id])).rows.map((x) => x.doc)
    u.plans = await child('plans')
    u.logs = await child('logs')
    u.items = await child('calendar_items')
    u.notifications = await child('notifications')
    u.coachReviews = await child('coach_reviews')
    u.passkeys = await child('passkeys')
    u.checkins = await child('checkins')
    users.push(u)
  }
  // store-level fields (sessionSecret signs every JWT; resets holds reset codes)
  const meta = (await pool.query('SELECT doc FROM app_meta WHERE id=1')).rows[0]?.doc || {}
  const sessionSecret = meta.sessionSecret || randomBytes(48).toString('hex')
  const resets = meta.resets || {}
  const backlog = meta.backlog || { triage: {}, added: [] } // #438/#440 — SHARED admin backlog + user reports (global, not per-user)
  return { users, sessionSecret, resets, backlog }
}

// INCREMENTAL SAVE (perf): the old _save rewrote EVERY user's every child table on
// every save() call — O(all data) per write, the hard scaling ceiling. Now we keep a
// per-user content hash and only WRITE the users (+ the app_meta row) whose serialized
// state actually CHANGED since the last successful commit. A typical save() mutates ONE
// user, so this writes ~one user's rows instead of the whole store. save()'s signature
// is unchanged, so all 91 callers keep working untouched. No data can be lost: the hash
// covers the EXACT payload we persist, so any real change is detected; a change we don't
// catch is one we wouldn't have written anyway. (Phase 2, later: pass the changed user to
// save() to also skip the hash-all-users CPU, and per-user locks to drop the global mutex.)
const uniq = (arr, key) => { const m = new Map(); for (const x of arr || []) { const k = key(x); if (k != null) m.set(k, x) } return [...m.values()] }

// deterministic stringify (sorted keys) — a stable change-detector regardless of key order
function stableStringify(v) {
  if (v instanceof Date) return JSON.stringify(v)
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
}

// build the EXACT rows a user save writes (pure): scalar cols + doc jsonb + de-duped
// child __args. Everything persisted for a user is here, so hashing it catches every change.
export function buildUserPayload(u) {
  const doc = {}
  for (const k of Object.keys(u)) if (!COLS.includes(k) && !NESTED.includes(k)) doc[k] = u[k]
  return {
    cols: [u.id, u.username || null, u.email || null, u.role || 'user', u.passwordHash || null, u.apiToken || null, u.icuKey || null, u.icuAthlete || null, u.sex || null, u.createdAt || null, doc],
    plans: uniq(u.plans, (p) => p?.id).map((p) => [p.id, onlyDate(p.date), p.sport || null, p.title || null, p]),
    logs: uniq(u.logs, (l) => (l ? String(l.sid || l.id || '') || null : null)).map((l) => [String(l.sid || l.id), onlyDate(l.date), l]),
    items: uniq(u.items, (it) => it?.id).map((it) => [it.id, onlyDate(it.date), it]),
    notifs: uniq(u.notifications, (n) => n?.id).map((n) => [n.id, n]),
    reviews: uniq(u.coachReviews, (c) => c?.id).map((c) => [c.id, c]),
    passkeys: uniq(u.passkeys, (p) => p?.id).map((p) => [p.id, p]),
    checkins: uniq(u.checkins, (c) => (c?.date ? onlyDate(c.date) : null)).map((c) => [onlyDate(c.date), c]),
  }
}
export const hashPayload = (payload) => createHash('sha1').update(stableStringify(payload)).digest('hex')

// pure change-detector: which user ids differ from the previous hash map. Returns the
// next hash map too, so the caller advances state ONLY after a successful commit.
export function dirtyUsers(prevHashes, store) {
  const hashes = new Map(); const dirty = new Set()
  for (const u of store.users || []) {
    const h = hashPayload(buildUserPayload(u))
    hashes.set(u.id, h)
    if (prevHashes.get(u.id) !== h) dirty.add(u.id)
  }
  return { hashes, dirty }
}

let saving = Promise.resolve()
let savedHashes = new Map()   // userId -> last-committed content hash
let savedMetaHash = null      // last-committed app_meta hash
export function save(store) {
  // serialize saves so concurrent calls don't interleave transactions
  saving = saving.then(() => _save(store)).catch((e) => console.error('[db] save error', e.message))
  return saving
}
async function _save(store) {
  // decide what changed BEFORE opening a connection (pure, fast, no DB held)
  const { hashes: nextHashes, dirty } = dirtyUsers(savedHashes, store)
  const byId = new Map((store.users || []).map((u) => [u.id, u]))
  const metaDoc = { sessionSecret: store.sessionSecret, resets: store.resets || {}, backlog: store.backlog || { triage: {}, added: [] } }
  const metaHash = hashPayload(metaDoc)
  const metaDirty = metaHash !== savedMetaHash
  if (!dirty.size && !metaDirty) return // nothing changed — skip the transaction entirely
  const pool = await getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const id of dirty) await writeUser(client, id, buildUserPayload(byId.get(id)))
    if (metaDirty) await client.query(`INSERT INTO app_meta (id, doc) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc`, [metaDoc])
    await client.query('COMMIT')
    // advance change-detection state ONLY after the commit succeeds — a failed save leaves
    // the old hashes, so the change is retried on the next save (never silently dropped)
    savedHashes = nextHashes
    savedMetaHash = metaHash
  } catch (e) { await client.query('ROLLBACK'); console.error('[db] _save rollback', e.message); throw e } finally { client.release() }
}
async function writeUser(client, id, p) {
  await client.query(
    `INSERT INTO users (id, username, email, role, password_hash, api_token, icu_key, icu_athlete, sex, created_at, doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, email=EXCLUDED.email, role=EXCLUDED.role,
       password_hash=EXCLUDED.password_hash, api_token=EXCLUDED.api_token, icu_key=EXCLUDED.icu_key,
       icu_athlete=EXCLUDED.icu_athlete, sex=EXCLUDED.sex, created_at=EXCLUDED.created_at, doc=EXCLUDED.doc`,
    p.cols,
  )
  const repl = async (table, rows, cols, vals) => {
    await client.query(`DELETE FROM ${table} WHERE user_id=$1`, [id])
    for (const args of rows) await client.query(`INSERT INTO ${table} (user_id, ${cols}) VALUES ($1, ${vals})`, [id, ...args])
  }
  await repl('plans', p.plans, 'id, date, sport, title, doc', '$2,$3,$4,$5,$6')
  await repl('logs', p.logs, 'sid, date, doc', '$2,$3,$4')
  await repl('calendar_items', p.items, 'id, date, doc', '$2,$3,$4')
  await repl('notifications', p.notifs, 'id, doc', '$2,$3')
  await repl('coach_reviews', p.reviews, 'id, doc', '$2,$3')
  await repl('passkeys', p.passkeys, 'id, doc', '$2,$3')
  await repl('checkins', p.checkins, 'date, doc', '$2,$3')
}
