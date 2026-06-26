import { useState } from 'react'
import { calApi } from './calendar'
import { localISO } from './date'

/** #150 — push every Platyplus plan in the visible window OUT to intervals (dedup-aware):
 *  recovers plans that never pushed + adopts a matching event the athlete's other coach already
 *  made (no duplicates). `compact` = a small inline button for the main page; default = full block. */
export default function ResyncToIntervals({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>()
  async function run() {
    setBusy(true); setMsg(undefined)
    const now = new Date()
    const from = localISO(new Date(now.getTime() - 21 * 864e5)) // ~3 weeks back …
    const to = localISO(new Date(now.getTime() + 70 * 864e5))   // … to ~10 weeks ahead (like Today)
    try {
      const r = await calApi.resyncPlans(from, to)
      if (!('total' in r)) setMsg('Connect intervals.icu first.')
      else setMsg(`${r.total} plans → ${r.created} new · ${r.exists} already there · ${r.updated} updated${r.skipped ? ` · ${r.skipped} past (skipped)` : ''}${r.errors ? ` · ${r.errors} failed` : ''}.`)
    } catch { setMsg('Could not reach intervals — try again.') }
    finally { setBusy(false) }
  }
  return (
    <div style={compact ? { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } : { marginTop: 12 }}>
      <button className="btn btn--ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={run}>{busy ? 'Syncing…' : '↻ Sync to intervals'}</button>
      <p className="meta" style={{ margin: compact ? 0 : '6px 0 0' }}>{msg || (compact ? '' : 'Push your Platyplus plans to intervals.icu — skips any already there (no duplicates).')}</p>
    </div>
  )
}
