import { ICU_FIELDS, ICU_FIELD_CODES } from './icu-fields'
import type { IcuActivity } from './intervals'

// #340 — how COMPLETE is the athlete's feedback on a finished session? Full = how it felt + RPE + the
// intervals fields (Legs Before/After, Fuel/GI, Pain, …). The banner flags what's still missing so the
// coach gets the full picture. Pure + unit-tested (feedbackGaps.test.ts).
export interface FeedbackStatus { complete: boolean; done: number; total: number; missing: string[] }

const filled = (v: unknown): boolean => {
  if (v == null || v === '') return false
  if (typeof v === 'number') return v > 0
  return true
}

export function feedbackStatus(a: IcuActivity | null | undefined): FeedbackStatus {
  const rec = (a || {}) as unknown as Record<string, unknown>
  const parts: [string, boolean][] = [
    ['how it felt', filled(rec.feel)],
    ['RPE', filled(rec.icu_rpe)],
    ...ICU_FIELDS.map(([label]): [string, boolean] => [label, filled(rec[ICU_FIELD_CODES[label]])]),
  ]
  const done = parts.filter(([, d]) => d).length
  const missing = parts.filter(([, d]) => !d).map(([l]) => l)
  return { complete: missing.length === 0, done, total: parts.length, missing }
}

/** Completed activities whose feedback is NOT yet full — oldest first, so nothing goes stale. */
export function incompleteFeedback(acts: IcuActivity[]): { act: IcuActivity; status: FeedbackStatus }[] {
  return acts
    .map((act) => ({ act, status: feedbackStatus(act) }))
    .filter((x) => !x.status.complete && x.status.done < x.status.total) // some info missing
    .sort((a, b) => String((a.act as unknown as { start_date_local?: string }).start_date_local || '').localeCompare(String((b.act as unknown as { start_date_local?: string }).start_date_local || '')))
}
