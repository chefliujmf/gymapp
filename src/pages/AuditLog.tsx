import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, type AuditEvent } from '../auth/api'

// #232 — Activity & changes log (option A, feed). A timestamped trail of what changed — plan edits,
// coach actions, syncs — so you can investigate when something looks off. Mobile-first: a vertical,
// day-grouped feed (no horizontal scroll). Reached from Settings.
const ACTOR: Record<string, { label: string; cls: string }> = {
  you: { label: 'You', cls: 'you' }, coach: { label: 'Coach', cls: 'coach' },
  sync: { label: 'Sync', cls: 'sync' }, system: { label: 'System', cls: 'sys' },
}
const ICON: Record<string, string> = { plan: '📋', checkin: '📝', feedback: '💬', notify: '🔔', review: '💚', sync: '🔄', other: '•' }
const iconFor = (e: AuditEvent) => (e.action.startsWith('Created') ? '➕' : e.action.startsWith('Removed') ? '🗑️' : e.action.startsWith('Updated') || e.action.startsWith('Edited') ? '✏️' : ICON[e.kind || 'other'] || '•')

const dayKey = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const timeOf = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

export default function AuditLog() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  useEffect(() => { authApi.audit().then(setEvents).catch(() => setEvents([])) }, [])

  // group consecutive events by day (already newest-first from the server)
  const groups: { day: string; items: AuditEvent[] }[] = []
  for (const e of events || []) {
    const d = dayKey(e.at)
    const g = groups[groups.length - 1]
    if (g && g.day === d) g.items.push(e); else groups.push({ day: d, items: [e] })
  }

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Activity log</h1><p>What changed — plan edits, coach actions, syncs</p></div>
      </div>

      {events === null ? <p className="meta">Loading…</p>
        : !events.length ? <p className="meta">Nothing logged yet. Plan edits, coach actions, and syncs will show here as they happen.</p>
        : groups.map((g) => (
          <div key={g.day} style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ fontSize: 12 }}>{g.day}</div>
            <div>{g.items.map((e, i) => {
              const a = ACTOR[e.actor] || ACTOR.system
              return (
                <div key={i} className="audit-ev">
                  <span className="audit-ev__t">{timeOf(e.at)}</span>
                  <span className="audit-ev__i">{iconFor(e)}</span>
                  <div className="audit-ev__b">
                    <div className="audit-ev__a"><span className={'audit-who audit-who--' + a.cls}>{a.label}</span>{e.action}{e.target ? <> · <b>{e.target}</b></> : null}</div>
                    {e.detail ? <div className="audit-ev__d">{e.detail}</div> : null}
                  </div>
                </div>
              )
            })}</div>
          </div>
        ))}
    </div>
  )
}
