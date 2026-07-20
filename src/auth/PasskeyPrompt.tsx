import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { authApi } from './api'
import { useAuth } from './AuthContext'

// #266 (option A) — one-time, dismissible prompt to set up a passkey right after the user is in.
// Shows only when WebAuthn is supported AND the account has NO passkey on this device.
// #311 — do NOT interrupt ONBOARDING with it (JM: "don't ask for a passkey if there isn't one yet"):
// a new user on Samsung got shoved into a confusing Samsung-account flow mid-setup. Password login is
// enough to finish; the passkey is a nice-to-have they can add later from Settings. So we hold the
// prompt until onboarding is done, and the copy makes clear it's their phone's fingerprint/PIN
// (a platform passkey), fully optional.
const DISMISS_KEY = 'pk-prompt-dismissed'
// #587 — passkeys are PER-DEVICE, so gate this on whether a passkey was added ON THIS DEVICE (a local flag),
// NOT the account-wide passkey count. The old `user.passkeys.length > 0` check meant a user with a passkey on
// their laptop was NEVER offered one on their phone → they were stuck typing the password on Android.
export const PK_ADDED_HERE = 'pk-added-here'

export default function PasskeyPrompt() {
  const { user, apply } = useAuth()
  const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [addedHere, setAddedHere] = useState(() => localStorage.getItem(PK_ADDED_HERE) === '1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // #311: never during onboarding — only once the coach has finished setting them up.
  const onboarded = !!user?.onboardedAt
  if (!supported || !user || !onboarded || addedHere || dismissed) return null

  function close() { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }
  async function add() {
    setErr(''); setBusy(true)
    try { await apply(await authApi.passkeyRegister(navigator.userAgent.includes('Android') ? 'Phone' : 'This device')); localStorage.setItem(PK_ADDED_HERE, '1'); setAddedHere(true); close() }
    catch (e) { setErr((e as Error).message || 'Could not add a passkey here.') } finally { setBusy(false) }
  }

  return (
    <div className="pk-prompt__wrap" role="dialog" aria-modal="true" aria-label="Set up a passkey">
      <div className="pk-prompt">
        <div className="pk-prompt__ic"><Fingerprint size={30} /></div>
        <h3>Faster sign-in next time? <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 13 }}>(optional)</span></h3>
        <p>Use your phone's <b>fingerprint / Face / PIN</b> to sign in — no password to type. It stays on this device; you don't need any extra account.</p>
        {err && <p className="auth-err" style={{ margin: '0 0 10px' }}>{err}</p>}
        <button className="btn" disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Use fingerprint / Face'}</button>
        <button className="btn auth-link" style={{ marginTop: 8 }} onClick={close}>Not now — keep my password</button>
      </div>
    </div>
  )
}
