import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../auth/api'

// Inline **bold** → <strong>; everything else is plain text (built from React
// nodes, so no HTML injection).
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  )
}

// Tiny markdown render for review: #/##/### headings, - / * bullets, paragraphs.
function Markdown({ md }: { md: string }) {
  const lines = md.replace(/\r/g, '').split('\n')
  return (
    <div className="md">
      {lines.map((ln, i) => {
        if (/^###\s+/.test(ln)) return <h4 key={i}>{inline(ln.replace(/^###\s+/, ''))}</h4>
        if (/^##\s+/.test(ln)) return <h3 key={i}>{inline(ln.replace(/^##\s+/, ''))}</h3>
        if (/^#\s+/.test(ln)) return <h2 key={i}>{inline(ln.replace(/^#\s+/, ''))}</h2>
        if (/^\s*[-*]\s+/.test(ln)) return <div key={i} className="md-li">{inline(ln.replace(/^\s*[-*]\s+/, ''))}</div>
        if (!ln.trim()) return <div key={i} className="md-sp" />
        return <p key={i}>{inline(ln)}</p>
      })}
    </div>
  )
}

export default function AthleteProfile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState('')
  const [draft, setDraft] = useState('')
  const [updatedAt, setUpdatedAt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    authApi.getAthlete()
      .then((r) => { setProfile(r.profile || ''); setUpdatedAt(r.updatedAt || 0) })
      .catch((e) => setErr((e as Error).message || 'Could not load your profile'))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true); setErr('')
    try {
      const r = await authApi.saveAthlete(draft)
      setProfile(r.profile); setUpdatedAt(r.updatedAt); setEditing(false)
    } catch (e) { setErr((e as Error).message || 'Could not save') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Athlete profile</h1><p>What your coach reads about you</p></div>
      </div>

      {loading ? (
        <p className="meta">Loading…</p>
      ) : editing ? (
        <>
          <p className="meta" style={{ margin: '4px 2px 8px' }}>
            Markdown is fine — use <code>#</code> headings and <code>-</code> bullets. Your coach reads this to personalize every plan and answer.
          </p>
          <textarea
            className="athlete-edit" value={draft} onChange={(e) => setDraft(e.target.value)} rows={20}
            placeholder={'# Goals\n- e.g. highest sustainable FTP…\n\n# Training context\n- days/week, weekly hours, equipment\n- constraints, injuries, preferences'}
          />
          {err && <p className="meta" style={{ color: 'var(--danger)' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {err && <p className="meta" style={{ color: 'var(--danger)' }}>{err}</p>}
          {profile.trim() ? (
            <div className="athlete-view"><Markdown md={profile} /></div>
          ) : (
            <div className="athlete-view" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 36 }}>🏷️</div>
              <p>No profile yet. Add your goals, weekly availability, equipment, constraints and injuries so your coach can plan for <em>you</em>.</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <button className="btn" onClick={() => { setDraft(profile); setEditing(true) }}>{profile.trim() ? 'Edit' : 'Add profile'}</button>
            {updatedAt > 0 && <span className="meta">Updated {new Date(updatedAt).toLocaleDateString()}</span>}
          </div>
        </>
      )}
    </div>
  )
}
