import { describe, it, expect } from 'vitest'
import { bmr, tdee, calorieTarget, proteinTarget, macroSplit, fiberTarget, waterTarget, ageFromDob } from './nutrition'

// #265 — fuelling math.
describe('bmr (Mifflin-St Jeor)', () => {
  it('male: 10w+6.25h-5a+5', () => {
    // 80kg, 180cm, 30y → 800 + 1125 - 150 + 5 = 1780
    expect(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780)
  })
  it('female: 10w+6.25h-5a-161', () => {
    // 61kg, 165cm, 35y → 610 + 1031.25 - 175 - 161 = 1305.25 → 1305
    expect(bmr({ sex: 'female', weightKg: 61, heightCm: 165, age: 35 })).toBe(1305)
  })
  it('missing any input → null', () => {
    expect(bmr({ sex: 'male', weightKg: 80, heightCm: 180 })).toBeNull()
    expect(bmr({})).toBeNull()
  })
})

describe('tdee', () => {
  it('uses baseline + actual training kcal when provided', () => {
    expect(tdee(1780, { activeKcal: 600 })).toBe(Math.round(1780 * 1.15 + 600)) // 2647
  })
  it('falls back to an activity multiplier with no training kcal', () => {
    expect(tdee(1780, { activity: 'moderate' })).toBe(Math.round(1780 * 1.55))
  })
  it('null bmr → null', () => { expect(tdee(null)).toBeNull() })
})

describe('calorieTarget', () => {
  it('cut ≈ -18%, gain ≈ +10%, maintain = tdee', () => {
    expect(calorieTarget(2500, 'lose')).toBe(2050)
    expect(calorieTarget(2500, 'gain')).toBe(2750)
    expect(calorieTarget(2500, 'maintain')).toBe(2500)
  })
})

describe('proteinTarget', () => {
  it('higher g/kg on a cut than maintain', () => {
    expect(proteinTarget(61, 'lose')).toBe(Math.round(61 * 2.2))
    expect(proteinTarget(61, 'maintain')).toBe(Math.round(61 * 1.8))
    expect(proteinTarget(0)).toBeNull()
  })
})

describe('macroSplit', () => {
  it('protein+fat fixed, carbs take the remainder; non-negative', () => {
    const m = macroSplit(2000, 61, 'maintain')!
    expect(m.protein).toBe(Math.round(61 * 1.8))
    expect(m.fat).toBe(Math.round(61 * 0.9))
    expect(m.carbs).toBeGreaterThan(0)
    // carbs never negative when protein+fat already exceed kcal
    expect(macroSplit(200, 61, 'lose')!.carbs).toBe(0)
  })
})

describe('fiber + water', () => {
  it('fiber ≈ 14g/1000kcal, water ≈ 0.033 L/kg', () => {
    expect(fiberTarget(2000)).toBe(28)
    expect(waterTarget(61)).toBe(2) // 61*0.033 = 2.013 → 2.0
  })
})

describe('ageFromDob', () => {
  it('computes whole years before/after birthday', () => {
    expect(ageFromDob('1990-01-01', '2026-06-30')).toBe(36)
    expect(ageFromDob('1990-12-31', '2026-06-30')).toBe(35) // birthday not reached this year
  })
  it('null/invalid → null', () => {
    expect(ageFromDob(null)).toBeNull()
    expect(ageFromDob('not-a-date')).toBeNull()
  })
})
