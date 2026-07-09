import { useEffect, useState } from 'react'
import { getPushConfig, isSubscribedHere, enablePush, pushSupported, iosNeedsInstall, permission } from './push'

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
        if (await isSubscribedHere()) return
        const c = await getPushConfig()
        if (!c.supported) return
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
