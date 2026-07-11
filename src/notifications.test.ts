import { describe, it, expect } from 'vitest'
import { KIND_META, kindForSubkind } from './notifications'

// #5003 — a user's own bug/idea report update (e.g. "✅ Your report is fixed") must surface in the bell
// as its OWN "Your report" kind, NOT mislabelled as a "Coach update" and NOT sharing the coach colour.
describe('notification kinds', () => {
  it('maps the report subkind to its own kind (not coach)', () => {
    expect(kindForSubkind('report')).toBe('report')
    expect(kindForSubkind('review')).toBe('review')
    expect(kindForSubkind('update')).toBe('coach')
    expect(kindForSubkind(undefined)).toBe('coach')
  })

  it('gives "report" a distinct green label + bug icon (separate from coach/review)', () => {
    const r = KIND_META.report
    expect(r.label).toBe('Your report')
    expect(r.icon).toBe('🐛')
    expect(r.color).toBe('#22c55e')
    // must not reuse the coach/review purple — that reuse WAS the bug
    expect(r.color).not.toBe(KIND_META.coach.color)
    expect(r.color).not.toBe(KIND_META.review.color)
  })
})
