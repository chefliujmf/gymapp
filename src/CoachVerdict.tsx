import type { CoachReview } from './auth/api'

// #273/#285 — the coach's post-workout verdict card (score chip + prose + takeaways + next).
// Shared by ActivityDetail (device rides/runs) and the gym completion/revisit.
export default function CoachVerdict({ review }: { review: CoachReview }) {
  if (!review || !(review.verdict || review.takeaways?.length || review.execution?.length || review.next)) return null
  return (
    <div className="card pw-verdict">
      <div className="pw-vtop"><span className="pw-vh">💬 Your coach</span>{review.score != null && <span className="pw-score">Score {review.score}/10</span>}</div>
      {review.verdict && <p className="pw-vp">{review.verdict}</p>}
      {(review.takeaways || review.execution || []).slice(0, 4).map((t, i) => <div key={i} className="pw-vli">• {t}</div>)}
      {review.next && <div className="pw-vli">📈 <b>Next:</b> {review.next}</div>}
    </div>
  )
}
