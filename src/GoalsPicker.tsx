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
  const info = (user?.info as { raceDate?: string; raceName?: string } | undefined) || {}
  const [focus, setFocus] = useState<string[]>(g.focus || [])
  const [notes, setNotes] = useState<string>(g.notes || '')
  const [raceDate, setRaceDate] = useState<string>(info.raceDate || '')
  const [raceName, setRaceName] = useState<string>(info.raceName || '')
  const [saved, setSaved] = useState(false)
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  const save = (next: Goals) => authApi.saveProfile({ goals: { focus, notes, ...next } }).then(() => { flash(); refresh().catch(() => {}) }).catch(() => {})
  const toggle = (v: string) => { const next = focus.includes(v) ? focus.filter((x) => x !== v) : [...focus, v]; setFocus(next); save({ focus: next }) }
  // #628 (gap 3/4) — the A-race DATE drives periodization + the taper into race week. Saved top-level on info.
  const saveRace = (d: string, n: string) => authApi.saveProfile({ raceDate: d || undefined, raceName: n || undefined }).then(() => { flash(); refresh().catch(() => {}) }).catch(() => {})

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
      {focus.includes('race') && (
        <div style={{ marginTop: 10 }}>
          <p className="meta" style={{ margin: '0 2px 4px' }}>🏁 Your target event — the coach periodizes toward it and tapers you into race week.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="search" type="date" value={raceDate} style={{ flex: '0 0 auto' }}
              onChange={(e) => setRaceDate(e.target.value)} onBlur={(e) => saveRace(e.target.value, raceName)} />
            <input className="search" type="text" value={raceName} placeholder="Event name (optional)" style={{ flex: 1, minWidth: 140 }}
              onChange={(e) => setRaceName(e.target.value)} onBlur={(e) => saveRace(raceDate, e.target.value.trim())} />
          </div>
        </div>
      )}
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Saved when you tap away — your coach reads it and adapts every plan.</p>
    </>
  )
}
