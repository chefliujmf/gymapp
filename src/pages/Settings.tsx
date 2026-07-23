import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown } from 'lucide-react'
import { db, getSetting, setSetting, clearLogs } from '../db'
import AccountSection from '../auth/AccountSection'
import OnboardReturnBar from '../OnboardReturnBar'
import NotificationsSettings from '../NotificationsSettings' // #511 — moved here from Profile (JM)

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
function Collapsible({ title, subtitle, defaultOpen = false, id, children }: { title: string; subtitle?: string; defaultOpen?: boolean; id?: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="settings-group" id={id}>
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
  const [params] = useSearchParams()
  // #310 onboarding: coach deep-links here (?onboard=1#ob-…) — open the group it sent you to. #742 — ALSO honor a bare
  // #ob-… hash (the notifications gear links to #ob-notifications) so any deep-link opens + scrolls to its exact section.
  const obHash = (params.get('onboard') ? window.location.hash.replace('#', '') : '') || window.location.hash.replace('#', '')
  useEffect(() => { if (obHash) { const el = document.getElementById(obHash); if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120) } }, [obHash])
  // Diet moved to Profile (#212) — it's a coaching input alongside Sports, not app config.
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
      <OnboardReturnBar />
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Settings</h1><p>Account, connections & app preferences</p></div>
      </div>

      <Collapsible title="Account & security" subtitle="Photo, password, passkeys" id="ob-account" defaultOpen={obHash === 'ob-account'}>
        <AccountSection only="account" />
      </Collapsible>

      <Collapsible title="Connections" subtitle="intervals.icu · Strava · Coach API" id="ob-connect" defaultOpen={obHash === 'ob-connect'}>
        <AccountSection only="connections" />
      </Collapsible>

      <Collapsible title="Preferences" subtitle="Units, calendar, demos" defaultOpen>
        <ChipSetting title="Weight units" value={units ?? 'metric'} onPick={(v) => setSetting('units', v)}
          hint="Switch weights between kilograms and pounds — applies to your gym logs, targets and history." options={[['metric', 'kg'], ['imperial', 'lbs']]} />
        <ChipSetting title="Calendar starts on" value={calView ?? 'month'} onPick={setCalView}
          options={[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['schedule', 'Schedule']]} />
        <ChipSetting title="Exercise demos" value={stills ?? '0'} onPick={(v) => setSetting('exerciseStills', v)}
          hint="Stills save data and load instantly; tap a video in a workout to pause it." options={[['0', 'Video'], ['1', 'Stills only']]} />
      </Collapsible>

      <Collapsible title="Notifications" subtitle="Phone push · check-in reminders · coach updates" id="ob-notifications" defaultOpen={obHash === 'ob-notifications'}>
        <NotificationsSettings />
      </Collapsible>

      <Collapsible title="Data" subtitle="Activity log · clear cached data">
        {/* #232 — a timestamped trail of what changed (plan edits, coach actions, syncs) for investigation */}
        <button className="btn btn--ghost" onClick={() => navigate('/activity-log')}>🗂️ Activity &amp; changes log — what changed, when ›</button>
        <button className="btn btn--ghost" style={{ color: 'var(--danger)', marginTop: 8 }} onClick={clearData}>Clear cached data on this device</button>
      </Collapsible>
    </div>
  )
}
