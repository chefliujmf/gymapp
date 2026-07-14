import { useEffect, useState } from 'react'
import { getPushConfig, isSubscribedHere, enablePush, disablePush, savePushPrefs, pushSupported, iosNeedsInstall, permission, type PushPrefs } from './push'

// #457 — Settings → Notifications. Per-type phone push (Web Push). Master switch subscribes THIS device;
// the sub-toggles pick which coach events buzz the phone. iOS needs the app installed to the Home Screen.
const TYPES: { key: keyof PushPrefs; label: string; hint: string; soon?: boolean }[] = [
  { key: 'planChanges', label: 'Plan changes', hint: 'When your coach adapts your plan.' },
  { key: 'reviews', label: 'Coach reviews', hint: 'When a completed workout gets reviewed.' },
  { key: 'reminders', label: 'Daily reminder', hint: 'A morning nudge to check in + see today’s plan.' },
]

function Sw({ on, dim }: { on: boolean; dim?: boolean }) {
  return <span role="switch" aria-checked={on} className={'push-sw' + (on ? ' on' : '') + (dim ? ' dim' : '')} />
}

export default function NotificationsSettings() {
  const [supported] = useState(pushSupported())
  const [here, setHere] = useState(false)
  const [prefs, setPrefs] = useState<PushPrefs>({ planChanges: true, reviews: true, reminders: false })
  const [pubKey, setPubKey] = useState<string | null>(null)
  const [avail, setAvail] = useState<boolean | null>(null) // server has VAPID configured
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getPushConfig().then((c) => { setAvail(c.supported); setPubKey(c.publicKey); if (c.prefs) setPrefs(c.prefs) }).catch(() => setAvail(false))
    isSubscribedHere().then(setHere).catch(() => {})
  }, [])

  const toggleMaster = async () => {
    if (busy) return
    setMsg(''); setBusy(true)
    try {
      if (here) { await disablePush(); setHere(false) }
      else {
        if (!pubKey) { setMsg('Push isn’t configured on the server yet.'); return }
        const ok = await enablePush(pubKey)
        setHere(ok)
        if (!ok) setMsg(permission() === 'denied' ? 'Notifications are blocked — enable them for Platyplus in your browser/phone settings.' : 'Couldn’t turn on notifications on this device.')
      }
    } catch { setMsg('Something went wrong turning notifications on.') } finally { setBusy(false) }
  }

  const toggleType = (key: keyof PushPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    savePushPrefs({ [key]: next[key] }).catch(() => {})
  }

  return (
    <div>
      {/* #511 — title comes from the Settings "Notifications" Collapsible now (moved from Profile, JM 2026-07-14). */}
      {!supported ? (
        <p className="meta" style={{ margin: '2px 2px 10px' }}>Phone notifications aren’t supported in this browser.</p>
      ) : avail === false ? (
        <p className="meta" style={{ margin: '2px 2px 10px' }}>Phone notifications aren’t available yet.</p>
      ) : (
        <>
          <p className="meta" style={{ margin: '2px 2px 8px' }}>Get a heads-up on your phone when your coach changes your plan or reviews a workout — even when the app is closed.</p>
          {iosNeedsInstall() && (
            <div className="push-hint">
              <span className="push-hint__i">📲</span>
              <span><b>On iPhone:</b> add Platyplus to your Home Screen first (Share → <b>Add to Home Screen</b>), then turn this on. Safari tabs can’t get notifications.</span>
            </div>
          )}
          <div className="card push-card">
            <div className="push-row" onClick={toggleMaster} style={{ cursor: 'pointer' }}>
              <span className="push-row__t"><b>Phone notifications</b><span className="meta">Master switch — turn on to allow the ones below.</span></span>
              <Sw on={here} />
            </div>
            {here && TYPES.map((t) => (
              <div key={t.key} className="push-row push-row--sub" onClick={t.soon ? undefined : () => toggleType(t.key)} style={{ cursor: t.soon ? 'default' : 'pointer' }}>
                <span className="push-row__t"><b>{t.label}{t.soon ? ' · soon' : ''}</b><span className="meta">{t.hint}</span></span>
                <Sw on={!!prefs[t.key]} dim={t.soon} />
              </div>
            ))}
          </div>
          {msg && <p className="meta" style={{ margin: '6px 2px 0', color: '#f6b73c' }}>{msg}</p>}
        </>
      )}
    </div>
  )
}
