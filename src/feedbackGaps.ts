import { ICU_FIELDS, ICU_FIELD_CODES } from './icu-fields'
import type { IcuActivity } from './intervals'

// #340 — which finished sessions still need feedback? The CORE the coach needs is "how it felt" + RPE;
// the intervals custom fields (Legs, Fuel, Pain, …) add richness but are optional, so they drive the
// progress bar, NOT the nag (else every session flags). An activity "needs feedback" only when the core
// is incomplete. Pure + unit-tested (feedbackGaps.test.ts).
export interface FeedbackStatus {
  needsFeedback: boolean // missing feel or RPE (the essentials)
  missing: string[] // core items still missing (what the chips show)
  done: number // richness numerator (feel + RPE + custom fields filled)
  total: number // richness denominator
  pct: number // 0..100 for the progress bar
}

const filled = (v: unknown): boolean => {
  if (v == null || v === '') return false
  if (typeof v === 'number') return v > 0
  return true
}

export function feedbackStatus(a: IcuActivity | null | undefined): FeedbackStatus {
  const rec = (a || {}) as unknown as Record<string, unknown>
  const feel = filled(rec.feel), rpe = filled(rec.icu_rpe)
  const custom = ICU_FIELDS.map(([label]) => filled(rec[ICU_FIELD_CODES[label]]))
  const done = (feel ? 1 : 0) + (rpe ? 1 : 0) + custom.filter(Boolean).length
  const total = 2 + custom.length
  const missing: string[] = []
  if (!feel) missing.push('how it felt')
  if (!rpe) missing.push('RPE')
  return { needsFeedback: !feel || !rpe, missing, done, total, pct: Math.round((done / total) * 100) }
}

/** Completed activities whose CORE feedback is missing — oldest first, so nothing goes stale. */
export function incompleteFeedback(acts: IcuActivity[]): { act: IcuActivity; status: FeedbackStatus }[] {
  return acts
    .map((act) => ({ act, status: feedbackStatus(act) }))
    .filter((x) => x.status.needsFeedback)
    .sort((a, b) => String((a.act as unknown as { start_date_local?: string }).start_date_local || '').localeCompare(String((b.act as unknown as { start_date_local?: string }).start_date_local || '')))
}
