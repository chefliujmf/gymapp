import { useState } from 'react'
import { MoreVertical, Repeat, Trash2, X } from 'lucide-react'

/** Compact ⋯ button that opens a bottom action sheet. Big, well-separated tap
 * targets so Remove can't be fat-fingered — mobile-first. Used by every entry
 * card (calendar + Today) for Substitute / Remove. */
export function EntryMenu({ title, onSubstitute, onRemove }: { title?: string; onSubstitute?: () => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false)
  if (!onSubstitute && !onRemove) return null
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }
  return (
    <>
      <button className="entry-kebab" onClick={(e) => { stop(e); setOpen(true) }} aria-label="Edit" title="Edit"><MoreVertical size={18} /></button>
      {open && (
        <div className="sheet-overlay" onClick={(e) => { stop(e); setOpen(false) }}>
          <div className="sheet sheet--actions" onClick={stop}>
            <div className="sheet-head"><strong>{title || 'Edit'}</strong><button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setOpen(false)}><X size={18} /></button></div>
            {onSubstitute && <button className="act-row" onClick={() => { setOpen(false); onSubstitute() }}><Repeat size={20} /> Substitute</button>}
            {onRemove && <button className="act-row act-row--del" onClick={() => { setOpen(false); onRemove() }}><Trash2 size={20} /> Remove</button>}
          </div>
        </div>
      )}
    </>
  )
}
