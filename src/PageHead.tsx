import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// #525 — contextual back for the big `.page-head` title. Tab ROOTS (Stats/Train/More) and section pages
// (Eat/Exercises/Programs) intentionally have NO back when they're your entry point — that's correct mobile IA
// (you switch tabs via the bottom bar). But DEEP-LINKING into one from another screen (e.g. Profile →
// "See full stats" → Stats) left you stranded with no way back. React Router stamps `history.state.idx` on every
// in-app navigation; idx > 0 means there IS a screen behind us in THIS session, so we surface a `‹` back then —
// and only then, so a root stays clean when it's where you started. navigate(-1) returns you to exactly the
// previous screen you were on ("the previous where the user was"), the best-practice behaviour.
export default function PageHead({ title, sub }: { title: ReactNode; sub: ReactNode }) {
  const navigate = useNavigate()
  const canBack = (((window.history.state as { idx?: number } | null)?.idx) ?? 0) > 0
  return (
    <div className="page-head" style={canBack ? { display: 'flex', alignItems: 'center', gap: 12 } : undefined}>
      {canBack && <button className="icon-btn" aria-label="Back" onClick={() => navigate(-1)} style={{ flex: 'none' }}>‹</button>}
      <div style={{ minWidth: 0 }}><h1>{title}</h1><p>{sub}</p></div>
    </div>
  )
}
