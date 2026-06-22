import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown } from 'lucide-react'
import { db, getSetting, setSetting, clearLogs } from '../db'
import AccountSection from '../auth/AccountSection'

/** A chip-group setting that autosaves on tap and flashes "Saved ✓". */
function ChipSetting({ title, hint, value, options, onPick }: {
  title: string; hint?: string; value: string; options: [string, string][]; onPick: (v: string) => void
}) {
  const [saved, setSaved] = useState(false)
  const pick = (v: string) => { onPick(v); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  return (
    <>
      <div className="section-title">{title}{saved && <span className="meta" style={{ fontWeight: 400 }}> · Saved ✓</span>}</div>
      <div className="chips">{options.map(([v, label]) => <button key={v} className={'chip' + (value === v ? ' chip--active' : '')} onClick={() => pick(v)}>{label}</button>)}</div>
      {hint && <p className="meta" style={{ margin: '6px 2px 4px' }}>{hint}</p>}
    </>
  )
}

/** A collapsible settings category — scan the headers, expand only what you need. */
function Collapsible({ title, subtitle, defaultOpen = false, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="settings-group">
      <button className="settings-group__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="settings-group__t"><strong>{title}</strong>{subtitle && <span className="meta">{subtitle}</span>}</span>
        <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: 'none' }} />
      </button>
      {open && <div className="settings-group__body">{children}</div>}
    </div>
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

      <Collapsible title="Account & security" subtitle="Photo, password, passkeys">
        <AccountSection only="account" />
      </Collapsible>

      <Collapsible title="Connections" subtitle="intervals.icu · Strava · Coach API">
        <AccountSection only="connections" />
      </Collapsible>

      <Collapsible title="Preferences" subtitle="Diet, units, calendar, demos" defaultOpen>
        <ChipSetting title="Diet" value={diet ?? 'vegetarian'} onPick={(v) => setSetting('diet', v)}
          options={[['vegetarian', 'vegetarian'], ['vegan', 'vegan'], ['no preference', 'no preference']]} />
        <ChipSetting title="Units" value={units ?? 'metric'} onPick={(v) => setSetting('units', v)}
          options={[['metric', 'metric'], ['imperial', 'imperial']]} />
        <ChipSetting title="Calendar starts on" value={calView ?? 'month'} onPick={setCalView}
          options={[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['schedule', 'Schedule']]} />
        <ChipSetting title="Exercise demos" value={stills ?? '0'} onPick={(v) => setSetting('exerciseStills', v)}
          hint="Stills save data and load instantly; tap a video in a workout to pause it." options={[['0', 'Video'], ['1', 'Stills only']]} />
      </Collapsible>

      <Collapsible title="Data" subtitle="Clear cached data on this device">
        <button className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={clearData}>Clear cached data on this device</button>
      </Collapsible>
    </div>
  )
}
