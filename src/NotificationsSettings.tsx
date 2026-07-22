import { useEffect, useState } from 'react'
import { getPushConfig, isSubscribedHere, enablePush, disablePush, savePushPrefs, pushSupported, iosNeedsInstall, permission, type PushPrefs } from './push'
import { NOTIF_TYPES, inAppPrefs, setInAppPref, type NotifTypeKey } from './notifPrefs' // #733

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
  const [inApp, setInApp] = useState(inAppPrefs()) // #733 — which types show in the bell (per-device)
  const toggleInApp = (key: NotifTypeKey) => { const on = inApp[key] === false; setInAppPref(key, on); setInApp(inAppPrefs()) }

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
      {/* #733 — per-TYPE control: which show in the bell (in-app, this device) and which buzz your phone. */}
      <p className="meta" style={{ margin: '2px 2px 8px' }}>Choose what shows in the bell and what buzzes your phone.</p>
      <div className="card push-card" style={{ marginBottom: 12 }}>
        <div className="notif-pref-head"><span>Type</span><span>In-app</span><span>Phone</span></div>
        {NOTIF_TYPES.map((t) => {
          const phoneOn = t.hasPhone && here && !!prefs[t.key as keyof PushPrefs]
          return (
            <div key={t.key} className="notif-pref-row">
              <span className="push-row__t"><b>{t.label}{t.isNew ? ' ✨' : ''}</b><span className="meta">{t.hint}</span></span>
              <button className="notif-pref-sw" onClick={() => toggleInApp(t.key)} aria-label={`${t.label} in-app`}><Sw on={inApp[t.key] !== false} /></button>
              {t.hasPhone
                ? <button className="notif-pref-sw" disabled={!here} onClick={() => here && toggleType(t.key as keyof PushPrefs)} aria-label={`${t.label} phone`}><Sw on={phoneOn} dim={!here} /></button>
                : <span className="notif-pref-sw meta" style={{ fontSize: 16, opacity: .3 }}>—</span>}
            </div>
          )
        })}
      </div>
      {!here && <p className="meta" style={{ margin: '0 2px 12px', fontSize: 12 }}>Turn on <b>Phone notifications</b> below to enable the phone column.</p>}
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
          {/* #733 — the master phone switch; the per-type phone column above enables once this is on. */}
          <div className="card push-card">
            <div className="push-row" onClick={toggleMaster} style={{ cursor: 'pointer' }}>
              <span className="push-row__t"><b>Phone notifications</b><span className="meta">Master switch — turn on to allow the phone column above.</span></span>
              <Sw on={here} />
            </div>
          </div>
          {msg && <p className="meta" style={{ margin: '6px 2px 0', color: '#f6b73c' }}>{msg}</p>}
        </>
      )}
    </div>
  )
}
