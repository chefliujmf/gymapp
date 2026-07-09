import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { calApi, type CalItem } from '../calendar'

// #451 — recovery as a FIRST-CLASS activity (JM: "treat it as an activity, don't wall-of-text the why").
// Renders the coach's STRUCTURED content: a "why today" insight + the routine as numbered steps + a sleep note.
// Falls back to the free-text `why` when an item predates the structured fields (until the coach re-generates it).
const RECOVERY_EMOJI: Record<string, string> = { sauna: '🔥', cold: '🧊', massage: '💆', mobility: '🧎', foam: '🪵', walk: '🚶' }
const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function RecoveryDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const [item, setItem] = useState<CalItem | null>((loc.state as { item?: CalItem } | null)?.item || null)
  const [loading, setLoading] = useState(!item)

  useEffect(() => {
    if (item) return
    const now = new Date(), from = new Date(now), to = new Date(now)
    from.setDate(from.getDate() - 90); to.setDate(to.getDate() + 90)
    calApi.items(iso(from), iso(to)).then((its) => setItem(its.find((x) => x.id === id && x.type === 'recovery') || null)).catch(() => {}).finally(() => setLoading(false))
  }, [id, item])

  if (loading) return <div className="empty"><div className="big">🛌</div>Loading…</div>
  if (!item) return <div className="empty"><div className="big">🛌</div>Recovery not found.<button className="btn" style={{ marginTop: 12, width: 'auto', padding: '8px 16px' }} onClick={() => nav('/')}>Back to Today</button></div>

  const steps = item.steps || []
  const insight = item.insight || item.why || ''
  const fmtDate = (d: string) => { try { return new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) } catch { return d } }

  return (
    <div>
      <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 16, marginBottom: 6 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#2a2f3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flex: '0 0 56px' }}>{RECOVERY_EMOJI[item.kind || ''] || '🛌'}</div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, letterSpacing: '-.01em' }}>{item.title}</h1>
          <div className="chips" style={{ marginTop: 6 }}>
            {item.minutes ? <span className="chip">{item.minutes} min</span> : null}
            {item.kind ? <span className="chip">{item.kind}</span> : null}
            <span className="chip">🛌 recovery</span>
          </div>
        </div>
      </div>
      <div className="meta" style={{ margin: '0 2px 14px' }}>{fmtDate(item.date)}</div>

      {insight && (
        <>
          <div className="section-title sec-ico">💡 Why today</div>
          <div style={{ background: '#8aa0ff10', border: '1px solid #8aa0ff2e', borderLeft: '3px solid #8aa0ff', borderRadius: 10, padding: '11px 13px', whiteSpace: 'pre-wrap', lineHeight: 1.55, color: '#c4cad4', fontSize: 13.5 }}>{insight}</div>
        </>
      )}

      {steps.length > 0 && (
        <>
          <div className="section-title sec-ico">🧘 The routine</div>
          <div className="stack">
            {steps.map((s, i) => (
              <div key={i} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 13px' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2a2f3a', color: 'var(--accent)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 26px' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14.5 }}>{s.name}</h3>
                  {s.dose && <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, marginTop: 1 }}>{s.dose}</div>}
                  {s.cue && <div className="meta" style={{ fontSize: 12, marginTop: 2 }}>{s.cue}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {item.sleep && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#ffb45411', border: '1px solid #ffb4542e', borderRadius: 10, padding: '11px 13px', marginTop: 14 }}>
          <span style={{ fontSize: 20 }}>😴</span><div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{item.sleep}</div>
        </div>
      )}

      {/* remove lives HERE (on the activity's own page), not as a stray trash icon on Today */}
      <button className="btn btn--ghost" style={{ marginTop: 22, width: 'auto', padding: '8px 14px', color: '#ff8f8f', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={async () => { if (confirm('Remove this recovery from your plan?')) { await calApi.delItem(item.id); nav('/') } }}>
        <Trash2 size={15} /> Remove from plan
      </button>
    </div>
  )
}
