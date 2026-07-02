// #194c — Mind stats: minutes / sessions / streak + weekly-minutes trend from logged mind sessions.
// Pure + unit-tested (src/mind-stats.test.ts).

export interface MindLog { date: string; duration: number } // date = ISO yyyy-mm-dd, duration in minutes

// disciplines that count as a "mind" session (logged by MindDetail + any yoga/pilates/meditation).
const MIND_DISC = new Set(['mind', 'meditation', 'yoga', 'pilates', 'breathwork'])
export const isMindDiscipline = (d: string) => MIND_DISC.has((d || '').toLowerCase())

const dayMinus = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)

export interface MindStats {
  minutesMonth: number
  sessionsMonth: number
  streak: number // consecutive days (counts today, or grace if you did it yesterday)
  weeklyMinutes: number[] // 8 buckets, oldest → newest (most recent = last)
}

export function mindStats(logs: MindLog[], today: string): MindStats {
  const month = today.slice(0, 7)
  const inMonth = logs.filter((l) => l.date.slice(0, 7) === month)
  const minutesMonth = inMonth.reduce((a, l) => a + (l.duration || 0), 0)
  const sessionsMonth = inMonth.length

  // streak: consecutive days with ≥1 session, ending today (or yesterday — grace for "not done yet today").
  const days = new Set(logs.map((l) => l.date))
  let streak = 0
  const start = days.has(today) ? 0 : days.has(dayMinus(today, 1)) ? 1 : -1
  if (start >= 0) { let i = start; while (days.has(dayMinus(today, i))) { streak++; i++ } }

  // weekly minutes — eight 7-day buckets ending today; index 0 = most recent, then reversed for the chart.
  const wk = Array(8).fill(0)
  for (const l of logs) { const diff = daysBetween(l.date, today); if (diff >= 0 && diff < 56) wk[Math.floor(diff / 7)] += l.duration || 0 }
  return { minutesMonth, sessionsMonth, streak, weeklyMinutes: wk.reverse() }
}
