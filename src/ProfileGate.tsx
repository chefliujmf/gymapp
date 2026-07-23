import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { REQUIRED_FIELDS, requiredProfileGaps } from './profile-fields'

// #A (audit #743/#748, JM 2026-07-22) — the coach won't build a plan on missing basics. This gate is shown on the Plan
// page instead of a plan until the mandatory fields are set; pregnancy makes the due-date required. Fields are edited in
// Profile (which has the proper pickers) — each row + the CTA deep-link there.
export default function ProfileGate() {
  const { user } = useAuth()
  const gaps = new Set(requiredProfileGaps(user))
  const info = (user?.info || {}) as Record<string, unknown>
  const pregnant = !!info.pregnant
  const fields = REQUIRED_FIELDS.filter((f) => !f.pregnancyOnly || pregnant)
  const done = fields.filter((f) => !gaps.has(f.key)).length
  const left = fields.length - done
  const val = (k: string): string => {
    if (k === 'sex') return user?.sex === 'female' ? 'Female' : user?.sex === 'male' ? 'Male' : ''
    if (k === 'dob') return String(info.dob || '')
    if (k === 'mainSport') return String(info.mainSport || (Array.isArray(user?.sports) ? user!.sports![0] : '') || '')
    if (k === 'trainingDays') return info.trainingDays ? `${info.trainingDays} days` : ''
    if (k === 'goal') { const g = (info.goals || {}) as { focus?: string; notes?: string }; return g.notes || g.focus || (user as { coachProfile?: string } | undefined)?.coachProfile?.slice(0, 40) || '' }
    if (k === 'pregnancyDate') return String(info.dueDate || info.pregnancyStart || '')
    return ''
  }
  return (
    <div className="pgate">
      <div className="pgate__hero">
        <h2>A few basics, then your coach builds your plan 🎯</h2>
        <p>Your coach needs these to plan <b>safely</b> — dose, zones and load all scale from them. It won't guess.</p>
        <div className="pgate__prog"><div className="track"><i style={{ width: `${Math.round((done / fields.length) * 100)}%` }} /></div><b>{done} of {fields.length}</b></div>
      </div>
      {fields.map((f) => {
        const missing = gaps.has(f.key)
        return (
          <Link key={f.key} to="/profile" className={'pgate__f' + (missing ? ' miss' : ' done')}>
            <span className="pgate__ic">{f.icon}</span>
            <span className="pgate__b"><b>{f.label}</b><span>{missing ? f.hint : val(f.key) || 'set'}</span></span>
            {missing ? <span className="pgate__req">Required</span> : <span className="pgate__chk">✓</span>}
          </Link>
        )
      })}
      <Link to="/profile" className={'btn pgate__cta' + (left ? ' dis' : '')} style={{ width: '100%', textAlign: 'center', marginTop: 8 }}>
        {left ? `Complete ${left} more to build your plan →` : 'Build my plan →'}
      </Link>
      <div className="pgate__discl">
        <b>Note:</b> Platyplus gives general fitness coaching, not medical advice. If you're pregnant, postpartum, injured, or have a health condition, check with your doctor before starting.
        {pregnant && <><br /><b>Pregnancy:</b> general activity guidance (ACOG-style principles), not medical advice — get your provider's OK, and the due date stays private (never on a public activity).</>}
      </div>
    </div>
  )
}
