import { useState } from 'react'
import { CalendarArrowUp, MoreVertical, Repeat, Trash2, X } from 'lucide-react'

/** Compact ⋯ button that opens a bottom action sheet. Big, well-separated tap
 * targets so Remove can't be fat-fingered — mobile-first. Used by every entry
 * card (calendar + Today) for Move / Substitute / Remove. `moveHint` disables the
 * Move row with a reason (e.g. intervals-origin events → "edit this one in intervals"). */
export function EntryMenu({ title, onMove, moveHint, onSubstitute, onRemove }: { title?: string; onMove?: () => void; moveHint?: string; onSubstitute?: () => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false)
  if (!onMove && !moveHint && !onSubstitute && !onRemove) return null
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }
  return (
    <>
      <button className="entry-kebab" onClick={(e) => { stop(e); setOpen(true) }} aria-label="Edit" title="Edit"><MoreVertical size={18} /></button>
      {open && (
        <div className="sheet-overlay" onClick={(e) => { stop(e); setOpen(false) }}>
          <div className="sheet sheet--actions" onClick={stop}>
            <div className="sheet-head"><strong>{title || 'Edit'}</strong><button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setOpen(false)}><X size={18} /></button></div>
            {onMove && <button className="act-row" onClick={() => { setOpen(false); onMove() }}><CalendarArrowUp size={20} /> Move to another day…</button>}
            {!onMove && moveHint && <div className="act-row act-row--disabled"><CalendarArrowUp size={20} /> <span>Move — {moveHint}</span></div>}
            {onSubstitute && <button className="act-row" onClick={() => { setOpen(false); onSubstitute() }}><Repeat size={20} /> Substitute</button>}
            {onRemove && <button className="act-row act-row--del" onClick={() => { setOpen(false); onRemove() }}><Trash2 size={20} /> Remove</button>}
          </div>
        </div>
      )}
    </>
  )
}
