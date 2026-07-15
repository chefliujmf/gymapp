import { useEffect, useState } from 'react'
import { getPushConfig, isSubscribedHere, enablePush, pushSupported, iosNeedsInstall, permission, nudgeAction } from './push'

// #457 — one-time opt-in nudge on Today: turn on phone notifications for plan changes. Dismiss = never nag
// again (localStorage). Hidden if unsupported, already subscribed here, push not configured, or blocked.
const KEY = 'push-nudge-dismissed'

export default function PushNudge() {
  const [show, setShow] = useState(false)
  const [pubKey, setPubKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const iosInstall = iosNeedsInstall()

  useEffect(() => {
    if (!pushSupported() || localStorage.getItem(KEY) || permission() === 'denied') return
    ;(async () => {
      try {
        // #5026 (JM: "turn-on-notifications banner comes back though it was approved before") — a service-worker update
        // (every deploy) or expiry DROPS this device's push subscription, so `isSubscribedHere()` goes false again even
        // though the athlete already granted permission. `nudgeAction` decides: already-granted → RE-subscribe SILENTLY
        // (no nag, also restores server-side delivery); only a genuinely-never-asked ('default') browser gets the banner.
        const subHere = await isSubscribedHere()
        const c = await getPushConfig()
        if (!c.supported || !c.publicKey) return
        const action = nudgeAction(permission(), subHere)
        if (action === 'skip') return
        if (action === 'resubscribe') { try { await enablePush(c.publicKey) } catch { /* transient — retry next load */ } return }
        setPubKey(c.publicKey)
        setShow(true)
      } catch { /* ignore */ }
    })()
  }, [])

  if (!show) return null
  const dismiss = () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode */ } setShow(false) }
  const turnOn = async () => {
    if (busy || !pubKey) return
    setBusy(true)
    try { if (await enablePush(pubKey)) setShow(false) } finally { setBusy(false) }
  }

  return (
    <div className="push-nudge">
      <h3>🔔 Never miss a plan change</h3>
      <p>{iosInstall
        ? 'Add Platyplus to your Home Screen (Share → Add to Home Screen), then turn on notifications in Settings.'
        : 'Get a heads-up on your phone when your coach adapts your week or reviews a workout — even when the app is closed.'}</p>
      <div className="push-nudge__row">
        {!iosInstall && <button className="btn" onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on notifications'}</button>}
        <button className="btn btn--ghost" onClick={dismiss}>{iosInstall ? 'Got it' : 'Not now'}</button>
      </div>
    </div>
  )
}
