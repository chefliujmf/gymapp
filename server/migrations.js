// #519 — minimal RUN-ONCE migration runner. For a single-instance app that holds the whole store in memory and
// rewrites it on save(), the only race-free place to mutate data is BEFORE the app serves traffic — i.e. at
// startup, exactly like the existing store.json→Postgres boot migration. Each migration here runs EXACTLY ONCE
// (recorded in store.appliedMigrations) and no-ops on every boot afterward — a real migration system, not a
// re-checked-every-boot patch. Add migrations to MIGRATIONS; never edit an already-applied one (add a new one).
// A data migration carrying its data is normal (that's what migrations are for): the athlete's info still ends up
// in their DB profile, not in the app's runtime logic. Pure + unit-tested (src/migrations.test.ts).

import { mergedProfile, stripProfileMethod } from './profile-backfill.js'

export const MIGRATIONS = [
  {
    id: '519_profile_backfill',
    describe: 'move hardcoded athlete goal/travel-rhythm out of the shared engine into each athlete profile',
    run(store) {
      let n = 0
      for (const u of store.users || []) {
        const merged = mergedProfile(u.email, u.coachProfile || '')
        if (merged == null) continue
        u.coachProfile = merged
        u.coachProfileAt = Date.now()
        n++
      }
      return n
    },
  },
  {
    id: '522_strip_profile_method',
    describe: 'strip app-level/method content (coach-memory upkeep, public-text voice, infra) that polluted athlete profiles',
    run(store) {
      let n = 0
      for (const u of store.users || []) {
        const cur = u.coachProfile || ''
        const cleaned = stripProfileMethod(cur)
        if (cleaned !== cur) { u.coachProfile = cleaned; u.coachProfileAt = Date.now(); n++ }
      }
      return n
    },
  },
]

export function pendingMigrations(store, all = MIGRATIONS) {
  const done = new Set((store && store.appliedMigrations) || [])
  return all.filter((m) => !done.has(m.id))
}

// Apply every pending migration once, record it in store.appliedMigrations, and persist if anything changed.
// Returns the ids applied this run. `persist(store)` is the app's save(); omit it in tests.
export function runMigrations(store, { persist, log = () => {} } = {}, all = MIGRATIONS) {
  if (!store) return []
  store.appliedMigrations = store.appliedMigrations || []
  const pending = pendingMigrations(store, all)
  let changed = false
  for (const m of pending) {
    const n = m.run(store) || 0
    store.appliedMigrations.push(m.id)
    changed = true
    log(`[migrate] ${m.id}: ${m.describe} — applied${n ? ` (${n} record${n > 1 ? 's' : ''})` : ' (no-op)'}`)
  }
  if (changed && persist) persist(store)
  return pending.map((m) => m.id)
}
