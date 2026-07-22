import type { CoachReview } from './auth/api'
import type { CoachNote, CoachSection } from './intervals'

// #273/#285 — the coach's post-workout verdict card (score chip + prose + takeaways + next).
// Shared by ActivityDetail (device rides/runs) and the gym completion/revisit.
// Data source is EITHER an in-app coach review OR the coach's intervals note (parsed) —
// the latter is the real path for device rides where the coach writes to intervals (#273).

type Norm = { score?: number; verdict?: string; takeaways: string[]; next?: string; rest: CoachSection[] }

function fromReview(r: CoachReview): Norm {
  return { score: r.score ?? undefined, verdict: r.verdict, takeaways: (r.takeaways || r.execution || []).slice(0, 4), next: r.next, rest: [] }
}

// Map the parsed intervals coach note onto the approved compact card, keeping the rest
// (recovery / nutrition / supplements) for the "full note" expander so it isn't bulky.
function fromNote(n: CoachNote): Norm {
  const find = (re: RegExp) => n.sections.find((s) => re.test(s.title))
  const verdictSec = find(/verdict/i), nextSec = find(/^next/i)
  const verdict = verdictSec?.lines[0]?.replace(/^Score:\s*\d+\s*\/\s*10\.?\s*/i, '').trim()
  const takeaways: string[] = []
  for (const re of [/execution/i, /body|recovery exercise/i, /mind/i]) { const s = find(re); if (s?.lines[0]) takeaways.push(s.lines[0]) }
  const shown = new Set([verdictSec, nextSec, find(/execution/i), find(/body|recovery exercise/i), find(/mind/i)])
  const rest = n.sections.filter((s) => !shown.has(s))
  return { score: n.score, verdict, takeaways: takeaways.slice(0, 3), next: nextSec?.lines.join(' '), rest }
}

export default function CoachVerdict({ review, note }: { review?: CoachReview | null; note?: CoachNote | null }) {
  const v: Norm | null = review ? fromReview(review) : note ? fromNote(note) : null
  if (!v || !(v.verdict || v.takeaways.length || v.next || v.rest.length)) return null
  return (
    <div className="card pw-verdict">
      <div className="pw-vtop"><span className="pw-vh">💬 Your coach</span>{v.score != null && <span className="pw-score">Score {v.score}/10</span>}</div>
      {v.verdict && <p className="pw-vp">{v.verdict}</p>}
      {v.takeaways.map((t, i) => <div key={i} className="pw-vli">• {t}</div>)}
      {/* #699 — the "Next:" line is removed (JM): a post-workout review should reflect the session + progress, not
          preview the calendar; the plan lives elsewhere. Coach prompts also stop emitting it. */}
      {v.rest.length > 0 && (
        <details className="pw-more">
          <summary>Recovery &amp; full note</summary>
          {v.rest.map((s, i) => (
            <div key={i} className="pw-msec">
              {s.title && <div className="pw-mst">{s.title}</div>}
              {s.lines.map((l, j) => <div key={j} className="pw-vli">• {l}</div>)}
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
