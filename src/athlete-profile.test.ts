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
    expect(p.reads.find((r) => r.k === 'TTE')?.r).toMatch(/biggest lever/i)
    expect(p.reads.find((r) => r.k === 'EF')?.r).toMatch(/rising/i)
    // #508 — explicit strength / weakness for a punchy profile
    expect(p.strength.lead).toMatch(/power at threshold/i)
    expect(p.weakness.lead).toBe('Staying power')
    expect(p.weakness.body).toMatch(/12:00/) // references the real short TTE
  })
  it('#508 running punchy: strength = speed, weakness = staying power', () => {
    const p = athleteProfile({ sport: 'running', threshold: 297, eftp: 297, tte: 900, cp: 321, reserveKj: 72, reserveBig: 200 })
    expect(p.strength.lead).toBe('Speed at threshold')
    expect(p.weakness.lead).toBe('Staying power')
  })
  it('#508 running: a manual TTE override flips the profile + coach focus (insight tracks the in-use value)', () => {
    const base = { sport: 'running' as const, threshold: 297, eftp: 297, cp: 321, reserveKj: 72, reserveBig: 200 }
    const short = athleteProfile({ ...base, tte: 900 })  // 15 min → punchy
    const long = athleteProfile({ ...base, tte: 3000 })  // 50 min → not punchy
    expect(short.type).toBe('Punchy threshold')
    expect(long.type).not.toBe('Punchy threshold')                 // the read flips with the value
    expect(short.strength.lead).not.toBe(long.strength.lead)       // strength/weakness follow
    expect(short.focus.join('|')).not.toBe(long.focus.join('|'))   // "what your coach will work on" follows too
  })
  it('#464: a decimal eFTP/threshold renders as WHOLE watts (no 240.27774 W anywhere)', () => {
    const p = athleteProfile({ sport: 'cycling', threshold: 240.27774, eftp: 235.51825, tte: 720, cp: 248, reserveKj: 17.1, reserveBig: 20 })
    expect(p.reads.find((r) => r.k === 'FTP')?.v).toBe('240 W') // rounded, not "240.27774 W"
    expect(JSON.stringify(p)).not.toMatch(/\d\.\d{2,}\s*W/) // no multi-decimal watt in reads OR focus
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
