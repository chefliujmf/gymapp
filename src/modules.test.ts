import { describe, it, expect } from 'vitest'
import { userModules, hasModule, MODULES } from './modules'

// #198 — one central module helper; every surface reads it so toggling a sport flips all UI.
describe('userModules — derived umbrellas', () => {
  it('triathlon → cycling + running (+ endurance)', () => {
    const m = userModules(['triathlon'])
    expect(m.has('cycling')).toBe(true)
    expect(m.has('running')).toBe(true)
    expect(m.has('endurance')).toBe(true)
  })
  it('any of yoga/pilates/meditation → mind', () => {
    expect(userModules(['yoga']).has('mind')).toBe(true)
    expect(userModules(['meditation']).has('mind')).toBe(true)
    expect(userModules(['strength']).has('mind')).toBe(false)
  })
  it('cycling or running → endurance; strength alone is not endurance', () => {
    expect(userModules(['cycling']).has('endurance')).toBe(true)
    expect(userModules(['strength']).has('endurance')).toBe(false)
  })
})

describe('hasModule — empty-sports default', () => {
  it('no sports + emptyShowsAll (default) → shown (don\'t hide from undecided users)', () => {
    expect(hasModule([], 'cycling')).toBe(true)
    expect(hasModule([], 'mind')).toBe(true)
  })
  it('no sports + emptyShowsAll:false → not "mine"', () => {
    expect(hasModule([], 'cycling', { emptyShowsAll: false })).toBe(false)
  })
  it('respects the actual selection when set', () => {
    expect(hasModule(['strength'], 'cycling')).toBe(false)
    expect(hasModule(['strength'], 'strength')).toBe(true)
    expect(hasModule(['triathlon'], 'running')).toBe(true)
  })
  it('MODULES lists the toggleable disciplines', () => {
    expect(MODULES).toEqual(['cycling', 'running', 'swimming', 'strength', 'yoga', 'pilates', 'meditation'])
  })
})
