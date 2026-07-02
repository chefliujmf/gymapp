import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'

// #323 — capture the RICH goal & identity that make coaching personal (JM: "300 FTP, diesel engine"
// vs his wife "be fit, consistent, NOT gain muscle"). Quick-pick focuses (tap, no typing) + a short
// "in your words" box for what success looks like / what they DON'T want. Stored on info.goals; the
// coach reads it and folds it into the athlete profile. Reuses Profile (Option C), no new page.
const FOCUS: [string, string][] = [
  ['fitter', '💪 Get fitter'], ['consistency', '🔁 Be consistent'], ['weight', '⚖️ Lose weight'],
  ['muscle', '🏋️ Build muscle'], ['tone', '✨ Tone up (not bulk)'], ['race', '🏁 Race / event'],
  ['endurance', '🚴 Endurance'], ['health', '🧬 Health & longevity'], ['stress', '🧘 Stress & sleep'],
]
interface Goals { focus?: string[]; notes?: string }

export default function GoalsPicker() {
  const { user, refresh } = useAuth()
  const g = ((user?.info as { goals?: Goals } | undefined)?.goals) || {}
  const [focus, setFocus] = useState<string[]>(g.focus || [])
  const [notes, setNotes] = useState<string>(g.notes || '')
  const [saved, setSaved] = useState(false)
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  const save = (next: Goals) => authApi.saveProfile({ goals: { focus, notes, ...next } }).then(() => { flash(); refresh().catch(() => {}) }).catch(() => {})
  const toggle = (v: string) => { const next = focus.includes(v) ? focus.filter((x) => x !== v) : [...focus, v]; setFocus(next); save({ focus: next }) }

  return (
    <>
      <div className="section-title" id="ob-goals">Your goals {saved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <p className="meta" style={{ margin: '0 2px 8px' }}>What are you training for? Tap all that fit — your coach builds around this.</p>
      <div className="chips">
        {FOCUS.map(([v, label]) => <button key={v} className={'chip' + (focus.includes(v) ? ' chip--active' : '')} onClick={() => toggle(v)}>{label}</button>)}
      </div>
      <textarea
        className="search" style={{ marginTop: 10, minHeight: 74, resize: 'vertical' }} value={notes}
        placeholder="In your words: what does success look like, and anything you DON'T want? e.g. “stay consistent and lose a bit of weight — I don't want to bulk up”."
        onChange={(e) => setNotes(e.target.value)}
        onBlur={(e) => save({ notes: e.target.value.trim() })}
      />
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Saved when you tap away — your coach reads it and adapts every plan.</p>
    </>
  )
}
