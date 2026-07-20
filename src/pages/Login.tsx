import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../PasswordInput'

type Mode = 'login' | 'forgot' | 'reset'

export default function Login() {
  const { apply } = useAuth()
  const passkeySupported = typeof window !== 'undefined' && !!window.PublicKeyCredential
  const [mode, setMode] = useState<Mode>('login')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  // Passkey-first: keep the password field hidden behind a link unless there's
  // no passkey support, so the passkey is the obvious primary path.
  const [usePassword, setUsePassword] = useState(!passkeySupported)

  async function doPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!usePassword) { doPasskey(); return }
    setErr(''); setBusy(true)
    try { await apply(await authApi.login(login, password)) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function doPasskey() {
    // Usernameless: the device offers its passkeys for this site — no username.
    setErr(''); setBusy(true)
    try { await apply(await authApi.passkeyLoginDiscoverable()) }
    catch (e) {
      // #587 — on the LOGIN screen, EVERY passkey failure resolves the same way: this device has no
      // passkey to offer (yours may live on another device), the OS cross-device lookup failed (Android
      // shows a confusing "server not available"), or the dialog was cancelled → just use the password,
      // then we offer to add a passkey ON THIS device (PasskeyPrompt). So don't surface the scary raw
      // OS message — give ONE clear line. AbortError = the user dismissed the sheet on purpose → stay quiet.
      const name = (e as { name?: string }).name
      if (name !== 'AbortError') setErr('No passkey on this device yet — sign in with your password below, then we’ll set one up for this device.')
      setUsePassword(true)
    } finally { setBusy(false) }
  }
  async function doForgot(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const r = await authApi.forgot(email); setNote(r.emailSent ? 'If that email exists, a reset code was sent.' : 'Ask your admin to reset your password.'); setMode('reset') }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function doReset(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await authApi.reset(email, code, password); setNote('Password updated — sign in.'); setMode('login') }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo"><img src="/favicon.svg?v=6" alt="" style={{ width: 38, height: 38, borderRadius: 9, verticalAlign: '-8px', marginRight: 9 }} />platy<span style={{ color: 'var(--accent)' }}>plus</span></div>

        {mode === 'login' && (
          <form onSubmit={doPassword} className="auth-form">
            {passkeySupported && !usePassword && (
              <>
                <button type="button" className="btn auth-passkey" disabled={busy} onClick={doPasskey}>
                  <Fingerprint size={18} /> Sign in with fingerprint / passkey
                </button>
                <button type="button" className="auth-link" onClick={() => setUsePassword(true)}>Use password instead</button>
              </>
            )}
            {usePassword && (
              <>
                <input className="search" placeholder="Username or email" value={login} autoCapitalize="none" onChange={(e) => setLogin(e.target.value)} />
                <PasswordInput value={password} onChange={setPassword} placeholder="Password" autoComplete="current-password" />
                <p className="meta" style={{ margin: '-2px 2px 0', fontSize: 12 }}>Username &amp; email aren’t case-sensitive — your <b>password is</b>.</p>
                <button className="btn" disabled={busy || !login || !password}>Sign in</button>
                {passkeySupported && (
                  <button type="button" className="auth-link" onClick={() => setUsePassword(false)}>Use a passkey instead</button>
                )}
              </>
            )}
            <button type="button" className="auth-link" onClick={() => { setErr(''); setNote(''); setMode('forgot') }}>Forgot password?</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={doForgot} className="auth-form">
            <p className="meta">Enter your account email to get a reset code.</p>
            <input className="search" placeholder="Email" value={email} autoCapitalize="none" onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" disabled={busy || !email}>Send reset code</button>
            <button type="button" className="auth-link" onClick={() => setMode('login')}>Back to sign in</button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={doReset} className="auth-form">
            <input className="search" placeholder="Email" value={email} autoCapitalize="none" onChange={(e) => setEmail(e.target.value)} />
            <input className="search" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <PasswordInput value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" />
            <button className="btn" disabled={busy || !email || !code || !password}>Set new password</button>
            <button type="button" className="auth-link" onClick={() => setMode('login')}>Back to sign in</button>
          </form>
        )}

        {note && <p className="auth-note">{note}</p>}
        {err && <p className="auth-err">{err}</p>}
      </div>
    </div>
  )
}
