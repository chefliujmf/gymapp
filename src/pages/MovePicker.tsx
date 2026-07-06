import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { moveShortcuts, weekStrip, startOfWeek, addDays } from '../move-dates'
import { iconFor } from './AddSheet'

// #379 — the "quick picker" bottom sheet: MOVE a planned session to another day, fast + mobile-first.
// Faithful to mockups/move-activity.html: header, one-tap QUICK row, an "or pick a day" strip with
// This-week / Next-week tabs, amber dots on full days, an inline full-day confirm, and (from the
// caller) an Undo bar after the move. All date math lives in the pure `move-dates` helper.

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // strip order (Mon-start)
// "Sat · Jul 11" — the mock's middot form (weekday · month day), locale-aware for the month.
const fmtChip = (iso: string) => {
  const d = new Date(iso + 'T00:00')
  const wd = d.toLocaleDateString(undefined, { weekday: 'short' })
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${wd} · ${md}`
}
const dayNum = (iso: string) => Number(iso.slice(8, 10))

export interface MovePickerProps {
  title: string
  /** sport/kind for the header icon (ride|run|gym|meal|mind|…). */
  kind: string
  /** the session's current day (YYYY-MM-DD). */
  fromISO: string
  /** today (YYYY-MM-DD) — anchors the relative shortcuts. */
  todayISO: string
  /** set of day-keys that already hold a session (for the "full day" amber dot / warn). */
  busyDays: Set<string>
  /** max sessions/day (user.info.maxPerDay, default 1) — a day is "full" at this count. */
  maxPerDay: number
  onMove: (newDateISO: string) => void
  onClose: () => void
}

export function MovePicker({ title, kind, fromISO, todayISO, busyDays, maxPerDay, onMove, onClose }: MovePickerProps) {
  const [week, setWeek] = useState<'this' | 'next'>('this')
  // The full-day confirm: the day the user tapped that already has a session (null = no prompt).
  const [confirmDay, setConfirmDay] = useState<string | null>(null)

  const shortcuts = useMemo(() => moveShortcuts(fromISO, todayISO), [fromISO, todayISO])
  // "This week" = the session's own week; "Next week" = 7 days on.
  const thisMon = useMemo(() => startOfWeek(fromISO), [fromISO])
  const strip = useMemo(() => weekStrip(week === 'this' ? thisMon : addDays(thisMon, 7)), [week, thisMon])

  const isFull = (iso: string) => iso !== fromISO && busyDays.has(iso)
  // Any day (of the two weeks we can pick) that's full → drives the warn note.
  const fullInStrip = strip.filter(isFull)

  // Tapping a day / shortcut: a free day moves immediately; a full day asks first (combine/bump).
  const choose = (iso: string) => {
    if (iso === fromISO) return // no-op: it's already there
    if (busyDays.has(iso)) { setConfirmDay(iso); return }
    onMove(iso)
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet mv" onClick={(e) => e.stopPropagation()}>
        <div className="mv-h">
          <span className={'cal-chip cal-chip--grad cal-chip--' + (kind === 'cycling' ? 'ride' : kind === 'running' ? 'run' : kind)}>{iconFor(kind)}</span>
          <div className="mv-h__t"><b>Move “{title}”</b><small>currently {fmtChip(fromISO)}</small></div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {confirmDay ? (
          // Inline full-day confirm (kept lightweight — warn + proceed/cancel; no full combine flow yet).
          // #371/#379: a richer "combine into that day's session" flow could replace "Move anyway" later.
          <div className="mv-block">
            <div className="mv-confirm">
              <p className="mv-confirm__q"><b>{fmtChip(confirmDay)}</b> already has a session.<br />Combine or move it to a free day? <span className="mv-dim">(max {maxPerDay}/day)</span></p>
              <div className="mv-confirm__acts">
                <button className="mv-btn mv-btn--ghost" onClick={() => setConfirmDay(null)}>Cancel</button>
                <button className="mv-btn mv-btn--go" onClick={() => onMove(confirmDay)}>Move anyway</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mv-block">
            <div className="mv-lbl">Quick — one tap</div>
            <div className="mv-quick">
              {shortcuts.map((s, i) => (
                <button key={s.key} className={'mv-qbtn' + (i === 0 ? ' star' : '')} onClick={() => choose(s.date)}>
                  <span className="mv-qt">{s.label}</span>
                  <span className="mv-qd">{fmtChip(s.date)}</span>
                </button>
              ))}
            </div>

            <div className="mv-orday"><i /><span>or pick a day</span><i /></div>
            <div className="mv-wktabs">
              <button className={week === 'this' ? 'on' : ''} onClick={() => setWeek('this')}>This week</button>
              <button className={week === 'next' ? 'on' : ''} onClick={() => setWeek('next')}>Next week</button>
            </div>
            <div className="mv-strip">
              {strip.map((iso, i) => {
                const cur = iso === fromISO
                const full = isFull(iso)
                return (
                  <button
                    key={iso}
                    className={'mv-dcell' + (cur ? ' cur' : '') + (full ? ' full' : '')}
                    disabled={cur}
                    onClick={() => choose(iso)}
                  >
                    <span className="mv-dn">{DOW[i]}</span>
                    <span className="mv-dd">{dayNum(iso)}</span>
                  </button>
                )
              })}
            </div>
            {fullInStrip.length > 0 && (
              <div className="mv-note warn">● {fullInStrip.map((d) => `${new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' })} ${dayNum(d)}`).join(', ')} already {fullInStrip.length > 1 ? 'have' : 'has'} a session — picking {fullInStrip.length > 1 ? 'one' : 'it'} asks to <b>combine or bump</b> (max {maxPerDay}/day).</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
