import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { mergedProfile, BACKFILL_MARKER, stripProfileMethod } from '../server/profile-backfill.js'
// @ts-expect-error — plain JS server module, no types
import { runMigrations, pendingMigrations, MIGRATIONS } from '../server/migrations.js'

// #519 — athlete-profile migration: move hardcoded specifics into the per-user profile, run ONCE, tracked.

describe('mergedProfile — the pure back-fill', () => {
  it('adds goal + travel rhythm for the known athlete, empty profile', () => {
    const p = mergedProfile('jmfiset@gmail.com', '')
    expect(p).toContain('Goal:')
    expect(p).toContain(BACKFILL_MARKER)
  })
  it('appends to an EXISTING profile without dropping it', () => {
    const p = mergedProfile('jmfiset@gmail.com', 'I ride a gravel bike and hate the trainer.')
    expect(p).toContain('gravel bike')      // existing content preserved
    expect(p).toContain(BACKFILL_MARKER)     // + the back-fill
  })
  it('is idempotent — returns null once the marker is present', () => {
    const once = mergedProfile('jmfiset@gmail.com', '')
    expect(mergedProfile('jmfiset@gmail.com', once)).toBeNull()
  })
  it('ignores unknown athletes (returns null)', () => {
    expect(mergedProfile('someone-else@example.com', '')).toBeNull()
    expect(mergedProfile('', '')).toBeNull()
  })
  it('matches the email case-insensitively', () => {
    expect(mergedProfile('JMFiset@Gmail.com ', '')).toContain('Goal:')
  })
})

describe('stripProfileMethod — remove app/method pollution, keep athlete facts', () => {
  const POLLUTED = [
    '# Athlete Profile',
    '## Training context',
    '- primary goal: best all-round cyclist',
    '- current working FTP: owned by ftp_estimate.md. Working value is 260 W.',
    '- coaching memory preference: wants a durable trace of coach feedback; maintain this in `coach_feedback_memory.md`',
    '- public ride title/description preference: Strava-facing text should be meaningful, human. Avoid abstract titles.',
    '- chat trigger: `COACHCHECK` means perform a full coach check-in.',
    '- left calf tendency: left calf can feel tight.',
    '',
    '## Current project assumptions',
    '- Intervals.icu is the primary source of truth.',
    '- Wahoo ROAM is the execution device.',
    '',
    '## Goal & travel rhythm',
    'Goal: raise FTP toward ~300 W.',
  ].join('\n')
  const cleaned = stripProfileMethod(POLLUTED)

  it('drops the pure-method bullets', () => {
    expect(cleaned).not.toMatch(/coach_feedback_memory/)
    expect(cleaned).not.toMatch(/Strava-facing/)
    expect(cleaned).not.toMatch(/COACHCHECK/)
  })
  it('drops the whole "Current project assumptions" infra section', () => {
    expect(cleaned).not.toMatch(/Current project assumptions/)
    expect(cleaned).not.toMatch(/Wahoo ROAM/)
  })
  it('KEEPS genuine athlete facts', () => {
    expect(cleaned).toMatch(/primary goal/)
    expect(cleaned).toMatch(/260 W/)          // FTP status kept (that bullet isn't pure-method)
    expect(cleaned).toMatch(/left calf/)
    expect(cleaned).toMatch(/Goal & travel rhythm/) // the section AFTER the infra one survives
  })
  it('is idempotent (re-run strips nothing more)', () => {
    expect(stripProfileMethod(cleaned)).toBe(cleaned)
  })
  it('leaves a clean/empty profile untouched', () => {
    expect(stripProfileMethod('- just my goal\n- my equipment')).toBe('- just my goal\n- my equipment')
    expect(stripProfileMethod('')).toBe('')
  })
})

describe('runMigrations — run-once, tracked', () => {
  const freshStore = () => ({ users: [{ email: 'jmfiset@gmail.com', coachProfile: '' }, { email: 'x@y.com', coachProfile: '' }], appliedMigrations: [] })

  it('applies pending migrations once and records them', () => {
    const store = freshStore()
    let saved = 0
    const applied = runMigrations(store, { persist: () => { saved++ } })
    expect(applied).toContain('519_profile_backfill')
    expect(store.appliedMigrations).toContain('519_profile_backfill')
    expect(store.users[0].coachProfile).toContain(BACKFILL_MARKER) // JM back-filled
    expect(store.users[1].coachProfile).toBe('')                   // others untouched
    expect(saved).toBe(1)
  })

  it('is a no-op on the second run (never re-applies)', () => {
    const store = freshStore()
    runMigrations(store, {})
    const profileAfterFirst = store.users[0].coachProfile
    let saved = 0
    const applied2 = runMigrations(store, { persist: () => { saved++ } })
    expect(applied2).toEqual([])                                   // nothing pending
    expect(store.users[0].coachProfile).toBe(profileAfterFirst)    // unchanged
    expect(store.appliedMigrations.filter((m: string) => m === '519_profile_backfill').length).toBe(1) // no dup
    expect(saved).toBe(0)                                          // no persist when nothing changed
  })

  it('pendingMigrations respects appliedMigrations', () => {
    expect(pendingMigrations({ appliedMigrations: [] }).map((m: any) => m.id)).toEqual(MIGRATIONS.map((m: any) => m.id))
    expect(pendingMigrations({ appliedMigrations: MIGRATIONS.map((m: any) => m.id) })).toEqual([])
  })
})
