import { describe, it, expect } from 'vitest'
import { nudgeAction } from './push'

// #515 — the opt-in nudge must NOT keep re-appearing after the athlete already approved. When the browser drops the
// device subscription (SW update / expiry) but permission stays 'granted', we re-subscribe silently — never re-nag.
describe('nudgeAction', () => {
  it('subscribed here → skip (whatever the permission)', () => {
    expect(nudgeAction('granted', true)).toBe('skip')
    expect(nudgeAction('default', true)).toBe('skip')
    expect(nudgeAction('denied', true)).toBe('skip')
  })
  it('permission denied → skip (never nag a blocker)', () => {
    expect(nudgeAction('denied', false)).toBe('skip')
  })
  it('#515 — granted but subscription dropped → RE-SUBSCRIBE silently (no banner)', () => {
    expect(nudgeAction('granted', false)).toBe('resubscribe')
  })
  it('never asked (default) + not subscribed → show the nudge', () => {
    expect(nudgeAction('default', false)).toBe('nudge')
  })
})
