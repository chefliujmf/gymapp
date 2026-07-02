// #319 — ONE shared treatment for every "learned" stat (VO₂max, threshold pace, FTP, maxHR, sleep
// need, energy…). Same idea as sleep (#304) and energy (#315): we start from a value + source, and as
// data accrues we say either "still learning — N more <units>" or "data suggests X — use it". This
// keeps the message identical everywhere instead of each stat inventing its own copy.
export type StatSource = 'manual' | 'intervals' | 'computed' | 'default'

export interface LearnedStatInput {
  source: StatSource
  samplesHave?: number   // e.g. HRV nights / recent runs collected so far
  samplesNeed?: number   // threshold for a trustworthy personal estimate
  suggestion?: number | string | null // a data-driven value that differs from the current one
  unit?: string          // "nights", "runs", "days" — what samplesNeed counts
}

export interface LearnedStatState {
  phase: 'default' | 'learning' | 'suggestion' | 'settled'
  note: string
  tag: string            // short source chip label
  needMore: number       // how many more samples until trustworthy (0 if ready)
}

const TAG: Record<StatSource, string> = { manual: 'yours', intervals: 'intervals', computed: 'est.', default: 'default' }

/** Describe a learned stat's state with consistent copy. Pure — unit-tested in learnedStat.test.ts. */
export function learnedStatState(i: LearnedStatInput): LearnedStatState {
  const have = Math.max(0, i.samplesHave ?? 0)
  const need = Math.max(0, i.samplesNeed ?? 0)
  const needMore = Math.max(0, need - have)
  const unit = i.unit || 'days'
  const tag = TAG[i.source]

  if (i.source === 'default') {
    return { phase: 'default', tag, needMore, note: 'Starting value — confirm it or set your own; it sharpens as we learn from your data.' }
  }
  if (needMore > 0) {
    return { phase: 'learning', tag, needMore, note: `Still learning your baseline — about ${needMore} more ${unit} for a personalised value.` }
  }
  if (i.suggestion != null && i.suggestion !== '') {
    return { phase: 'suggestion', tag, needMore: 0, note: `Your data suggests ${i.suggestion} — tap to use it.` }
  }
  return { phase: 'settled', tag, needMore: 0, note: i.source === 'manual' ? 'Your set value.' : 'Personalised from your data.' }
}
