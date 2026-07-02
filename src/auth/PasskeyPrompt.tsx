import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { authApi } from './api'
import { useAuth } from './AuthContext'

// #266 (option A) — one-time, dismissible prompt to set up a passkey right after the user
// is in. Shows only when WebAuthn is supported AND the account has NO passkey on this device
// (a passkey login would already have one), and only until added or dismissed on this device.
const DISMISS_KEY = 'pk-prompt-dismissed'

export default function PasskeyPrompt() {
  const { user, apply } = useAuth()
  const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!supported || !user || (user.passkeys?.length ?? 0) > 0 || dismissed) return null

  function close() { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }
  async function add() {
    setErr(''); setBusy(true)
    try { await apply(await authApi.passkeyRegister(navigator.userAgent.includes('Android') ? 'Phone' : 'This device')); close() }
    catch (e) { setErr((e as Error).message || 'Could not add a passkey here.') } finally { setBusy(false) }
  }

  return (
    <div className="pk-prompt__wrap" role="dialog" aria-modal="true" aria-label="Set up a passkey">
      <div className="pk-prompt">
        <div className="pk-prompt__ic"><Fingerprint size={30} /></div>
        <h3>Faster sign-in next time?</h3>
        <p>Add a passkey on this device — then sign in with your fingerprint / Face ID, no password to type.</p>
        {err && <p className="auth-err" style={{ margin: '0 0 10px' }}>{err}</p>}
        <button className="btn" disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add a passkey'}</button>
        <button className="btn auth-link" style={{ marginTop: 8 }} onClick={close}>Not now</button>
      </div>
    </div>
  )
}
