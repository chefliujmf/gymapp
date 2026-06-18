import { useState } from 'react'
import { calApi, type CalItem } from './calendar'
import { localISO } from './date'

// Reusable "add this to the calendar on a chosen day" control. Used by recipes,
// mind sessions, etc. Posts a calendar item via calApi.saveItem.
export default function AddToCalendar({ item, label = 'Add to calendar' }: { item: Partial<CalItem>; label?: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(localISO())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    setBusy(true); setMsg('')
    try {
      await calApi.saveItem({ ...item, date })
      setMsg(`✓ Added to ${date}`); setOpen(false)
    } catch {
      setMsg('Could not add — are you signed in?')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ margin: '14px 0' }}>
      {!open ? (
        <button className="btn" onClick={() => { setOpen(true); setMsg('') }}>📅 {label}</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ padding: 10, borderRadius: 8, background: '#0f0f12', color: '#fff', border: '1px solid #2c2c34', fontSize: 16 }}
          />
          <button className="btn" disabled={busy} onClick={add}>Add</button>
          <button className="btn btn--ghost" onClick={() => { setOpen(false); setMsg('') }}>Cancel</button>
        </div>
      )}
      {msg && <p className="meta" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
