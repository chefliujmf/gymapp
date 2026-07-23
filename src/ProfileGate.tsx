import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { REQUIRED_FIELDS, requiredProfileGaps } from './profile-fields'

// #A (audit #743/#748, JM 2026-07-22) — the coach won't build a plan on missing basics. Shown on the Plan page instead of
// a plan until the 5 non-sensitive basics are set. #759 (JM 2026-07-23) — a LIGHT "finish your profile" pointer (no scary
// "Required" badges), each missing row deep-links to its EXACT Profile section (#742). A private/medical field (pregnancy
// date) is NEVER a gate: a pregnant user is never blocked (safe envelope by default), the date is an optional fine-tune.
export default function ProfileGate() {
  const { user } = useAuth()
  const gaps = new Set(requiredProfileGaps(user))
  const info = (user?.info || {}) as Record<string, unknown>
  const pregnant = !!info.pregnant
  const fields = REQUIRED_FIELDS
  const done = fields.filter((f) => !gaps.has(f.key)).length
  const left = fields.length - done
  const val = (k: string): string => {
    if (k === 'sex') return user?.sex === 'female' ? 'Female' : user?.sex === 'male' ? 'Male' : ''
    if (k === 'dob') return String(info.dob || '')
    if (k === 'mainSport') return String(info.mainSport || (Array.isArray(user?.sports) ? user!.sports![0] : '') || '')
    if (k === 'trainingDays') return info.trainingDays ? `${info.trainingDays} days` : ''
    if (k === 'goal') { const g = (info.goals || {}) as { focus?: string; notes?: string }; return g.notes || g.focus || (user as { coachProfile?: string } | undefined)?.coachProfile?.slice(0, 40) || '' }
    return ''
  }
  const to = (f: { section?: string }) => '/profile' + (f.section ? `#${f.section}` : '')
  return (
    <div className="pgate">
      <div className="pgate__hero">
        <h2>Finish your profile to get your plan 🎯</h2>
        <p>Your coach needs a few basics to plan <b>safely</b> — dose, zones and load all scale from them.</p>
        <div className="pgate__prog"><div className="track"><i style={{ width: `${Math.round((done / fields.length) * 100)}%` }} /></div><b>{done} of {fields.length}</b></div>
      </div>
      {fields.map((f) => {
        const missing = gaps.has(f.key)
        return (
          <Link key={f.key} to={to(f)} className={'pgate__f' + (missing ? ' miss' : ' done')}>
            <span className="pgate__ic">{f.icon}</span>
            <span className="pgate__b"><b>{f.label}</b><span>{missing ? f.hint : val(f.key) || 'set'}</span></span>
            {missing ? <span className="pgate__add">Add in Profile ›</span> : <span className="pgate__chk">✓</span>}
          </Link>
        )
      })}
      {left > 0 && (
        <Link to={to(fields.find((f) => gaps.has(f.key)) || {})} className="btn pgate__cta" style={{ width: '100%', textAlign: 'center', marginTop: 8 }}>
          Finish {left} more to build your plan →
        </Link>
      )}
      <div className="pgate__discl">
        <b>Note:</b> Platyplus gives general fitness coaching, not medical advice. If you're pregnant, postpartum, injured, or have a health condition, check with your doctor before starting.
        {pregnant && <><br /><b>Pregnancy:</b> once your basics are in, your plan defaults to a gentle, pregnancy-safe envelope — no date needed. Add your trimester in Profile any time to fine-tune (optional, always private).</>}
      </div>
    </div>
  )
}
