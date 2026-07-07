import { describe, it, expect } from 'vitest'
import { athleteProfile } from './athlete-profile'

// #403/#408 — the synthesis: FTP·TTE·CP·W′·EF → athlete type + coach reads + a training focus that leans on normal
// efforts (a benchmark test only when the fit goes stale — not "never", not routine).
describe('athleteProfile', () => {
  it('JM: high FTP + short TTE → punchy threshold, focus on extending TTE (efforts are the data)', () => {
    const p = athleteProfile({ sport: 'cycling', threshold: 260, eftp: 253, tte: 720, cp: 248, reserveKj: 17.1, reserveBig: 20, ef: 1.62, efTrend: 'up' })
    expect(p.type).toBe('Punchy threshold')
    expect(p.focus.some((f) => /extensive threshold/i.test(f))).toBe(true)
    expect(p.focus.some((f) => /eFTP \(253/.test(f))).toBe(true) // nudge FTP toward eFTP
    expect(p.focus.some((f) => /efforts ARE the data/i.test(f))).toBe(true)
    expect(p.focus.some((f) => /only if the fit goes stale/i.test(f))).toBe(true) // #408: not "never", triggered
    expect(p.reads.find((r) => r.k === 'TTE')?.r).toMatch(/big lever/i)
    expect(p.reads.find((r) => r.k === 'EF')?.r).toMatch(/rising/i)
  })
  it('long TTE + small reserve → diesel engine, focus on raising the ceiling', () => {
    const p = athleteProfile({ sport: 'cycling', threshold: 250, eftp: 250, tte: 3000, cp: 249, reserveKj: 12, reserveBig: 20 })
    expect(p.type).toBe('Diesel engine')
    expect(p.focus.some((f) => /raise the ceiling/i.test(f))).toBe(true)
  })
  it('long TTE + big reserve → all-rounder', () => {
    const p = athleteProfile({ sport: 'cycling', threshold: 300, eftp: 300, tte: 3000, cp: 295, reserveKj: 25, reserveBig: 20 })
    expect(p.type).toBe('All-rounder')
  })
  it('running: uses pace units + running-specific focus', () => {
    const p = athleteProfile({ sport: 'running', threshold: 240, eftp: 250, tte: 600, cp: 260, reserveKj: 150, reserveBig: 200 })
    expect(p.reads.find((r) => r.k === 'Threshold')?.v).toBe('4:00/km')
    expect(p.focus.some((f) => /threshold runs/i.test(f))).toBe(true)
  })
})
