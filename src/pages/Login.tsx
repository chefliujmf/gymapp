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
      // #266 (option C): give CLEAR feedback instead of looking like "nothing happened".
      // A fresh device has no passkey to offer, or the OS dialog was cancelled → guide to
      // password, after which we offer to set one up (PasskeyPrompt).
      const name = (e as { name?: string }).name
      const noCred = name === 'NotAllowedError' || name === 'AbortError' || /no passkey|not recognised|unknown|expired/i.test((e as Error).message || '')
      setErr(noCred
        ? 'No passkey on this device yet. Sign in with your password below — then we’ll offer to set one up.'
        : ((e as Error).message || 'Passkey sign-in failed — use your password.'))
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
        <div className="auth-logo"><img src="/favicon.svg?v=5" alt="" style={{ width: 38, height: 38, borderRadius: 9, verticalAlign: '-8px', marginRight: 9 }} />platy<span style={{ color: 'var(--accent)' }}>plus</span> <span style={{ color: 'var(--text-dim, #9298a6)', fontWeight: 900 }}>➕</span></div>

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
