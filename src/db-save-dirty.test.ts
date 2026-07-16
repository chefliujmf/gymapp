import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { buildUserPayload, hashPayload, dirtyUsers } from '../server/db.js'

// Incremental save: we only write users whose serialized state changed. These tests pin
// the pure change-detector — the whole safety story is "any real change flips the hash,
// so a changed user is never skipped (never silently dropped)".
const mkUser = (over: Record<string, unknown> = {}) => ({
  id: 'u1', username: 'jm', role: 'user',
  plans: [], logs: [], items: [], notifications: [], coachReviews: [], passkeys: [], checkins: [],
  info: { maxPerDay: 1 }, ...over,
})
const h = (u: Record<string, unknown>) => hashPayload(buildUserPayload(u))

describe('db incremental save — change detection', () => {
  it('identical state hashes identically (clean users are skippable)', () => {
    expect(h(mkUser())).toBe(h(mkUser()))
  })

  it('is insensitive to key order (no spurious writes on reorder)', () => {
    expect(h(mkUser({ info: { a: 1, b: 2 } }))).toBe(h(mkUser({ info: { b: 2, a: 1 } })))
  })

  it('detects a changed plan title', () => {
    const a = mkUser({ plans: [{ id: 'p1', date: '2026-07-16', title: 'Easy ride' }] })
    const b = mkUser({ plans: [{ id: 'p1', date: '2026-07-16', title: 'Hard ride' }] })
    expect(h(a)).not.toBe(h(b))
  })

  it('detects a new check-in', () => {
    expect(h(mkUser())).not.toBe(h(mkUser({ checkins: [{ date: '2026-07-16', energy: 4 }] })))
  })

  it('detects a removed top-level (doc) field', () => {
    expect(h(mkUser({ runPaceEst: 240 }))).not.toBe(h(mkUser()))
  })

  it('dirtyUsers flags ONLY the user that changed', () => {
    const prime = dirtyUsers(new Map(), { users: [mkUser({ id: 'a' }), mkUser({ id: 'b' })] })
    const next = dirtyUsers(prime.hashes, { users: [mkUser({ id: 'a', info: { energy: 5 } }), mkUser({ id: 'b' })] })
    expect([...next.dirty]).toEqual(['a'])
  })

  it('with no prior state, every user is dirty (correct first-save / post-boot behavior)', () => {
    const { dirty } = dirtyUsers(new Map(), { users: [mkUser({ id: 'a' }), mkUser({ id: 'b' })] })
    expect(dirty.size).toBe(2)
  })

  it('re-running against a matching hash map yields no writes', () => {
    const store = { users: [mkUser({ id: 'a' }), mkUser({ id: 'b' })] }
    const { hashes } = dirtyUsers(new Map(), store)
    expect(dirtyUsers(hashes, store).dirty.size).toBe(0)
  })
})
