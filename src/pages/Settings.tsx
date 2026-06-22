import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, clearLogs } from '../db'
import AccountSection from '../auth/AccountSection'

/** A chip-group setting that autosaves on tap and flashes "Saved ✓" — the standard
 * field-save pattern across Profile/Settings (no Save buttons, never silent). */
function ChipSetting({ title, hint, value, options, onPick }: {
  title: string; hint?: string; value: string; options: [string, string][]; onPick: (v: string) => void
}) {
  const [saved, setSaved] = useState(false)
  const pick = (v: string) => { onPick(v); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  return (
    <>
      <div className="section-title">{title}{saved && <span className="meta" style={{ fontWeight: 400 }}> · Saved ✓</span>}</div>
      <div className="chips">
        {options.map(([v, label]) => (
          <button key={v} className={'chip' + (value === v ? ' chip--active' : '')} onClick={() => pick(v)}>{label}</button>
        ))}
      </div>
      {hint && <p className="meta" style={{ margin: '6px 2px 4px' }}>{hint}</p>}
    </>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const diet = useLiveQuery(() => getSetting('diet'))
  const units = useLiveQuery(() => getSetting('units'))
  const calView = useLiveQuery(() => getSetting('calView'))
  const stills = useLiveQuery(() => getSetting('exerciseStills'))
  const setCalView = (v: string) => { setSetting('calView', v); try { localStorage.setItem('calView', v) } catch { /* ignore */ } }

  async function clearData() {
    if (!confirm('Clear all your logs and progress (on every device)? This cannot be undone.')) return
    await clearLogs(); await db.enrollments.clear(); await db.activeSession.clear()
  }

  return (
    <div>
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Settings</h1><p>Account, connections & app preferences</p></div>
      </div>

      {/* Account & security + connections (intervals.icu, Strava, Coach API) live here. */}
      <AccountSection />

      <div className="section-title" style={{ marginTop: 18, opacity: 0.6, fontSize: 12, letterSpacing: 1 }}>PREFERENCES</div>
      <ChipSetting title="Diet" value={diet ?? 'vegetarian'} onPick={(v) => setSetting('diet', v)}
        options={[['vegetarian', 'vegetarian'], ['vegan', 'vegan'], ['no preference', 'no preference']]} />
      <ChipSetting title="Units" value={units ?? 'metric'} onPick={(v) => setSetting('units', v)}
        options={[['metric', 'metric'], ['imperial', 'imperial']]} />
      <ChipSetting title="Calendar starts on" value={calView ?? 'month'} onPick={setCalView}
        options={[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['schedule', 'Schedule']]} />
      <ChipSetting title="Exercise demos" value={stills ?? '0'} onPick={(v) => setSetting('exerciseStills', v)}
        hint="Stills save data and load instantly; tap a video in a workout to pause it."
        options={[['0', 'Video'], ['1', 'Stills only']]} />

      <div className="section-title">Data</div>
      <button className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={clearData}>
        Clear cached data on this device
      </button>
    </div>
  )
}
