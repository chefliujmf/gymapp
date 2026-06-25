import { useEffect, useRef, useState } from 'react'
import { Fingerprint, Trash2, Camera, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { authApi } from './api'
import { useAuth } from './AuthContext'
import PasswordInput from '../PasswordInput'

/** Center-crop + resize an image file to a square data URL. */
function resizeImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = size; c.height = size
      const ctx = c.getContext('2d')!
      const s = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

export default function AccountSection({ only }: { only?: 'account' | 'connections' } = {}) {
  const { user, apply } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  if (!user) return null
  const passkeySupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

  // profile picture
  const [avMsg, setAvMsg] = useState('')
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setAvMsg('Uploading…')
    try { await apply(await authApi.saveAvatar(await resizeImage(f, 256))); setAvMsg('✓ Updated') }
    catch (err) { setAvMsg('✗ ' + (err as Error).message) }
  }
  async function removeAvatar() { await apply(await authApi.saveAvatar('')); setAvMsg('') }

  // change password
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [pwMsg, setPwMsg] = useState('')
  async function changePw() {
    setPwMsg('')
    try { await authApi.changePassword(cur, nw); setCur(''); setNw(''); setPwMsg('✓ Password changed') }
    catch (e) { setPwMsg('✗ ' + (e as Error).message) }
  }

  // passkeys
  const [pkMsg, setPkMsg] = useState('')
  async function addPasskey() {
    setPkMsg('')
    try { await apply(await authApi.passkeyRegister(navigator.userAgent.includes('Android') ? 'Phone' : 'This device')); setPkMsg('✓ Passkey added') }
    catch (e) { setPkMsg('✗ ' + (e as Error).message) }
  }
  async function delPasskey(id: string) { await apply(await authApi.passkeyDelete(id)) }

  // intervals.icu (account-level)
  const [icuKey, setIcuKey] = useState(''); const [icuAth, setIcuAth] = useState(user.icuAthlete || 'i28814'); const [icuMsg, setIcuMsg] = useState('')
  async function saveIcu() {
    setIcuMsg('Saving…')
    try { await apply(await authApi.saveIcu(icuKey, icuAth)); setIcuKey(''); setIcuMsg('✓ Saved to your account') }
    catch (e) { setIcuMsg('✗ ' + (e as Error).message) }
  }

  // coach API token
  const [token, setToken] = useState(''); const [tkMsg, setTkMsg] = useState(''); const [showToken, setShowToken] = useState(false)
  useEffect(() => { authApi.getToken().then((r) => setToken(r.token)).catch(() => {}) }, [])
  async function rotate() { if (!confirm('Rotate the token? Your coach must update it.')) return; try { const r = await authApi.rotateToken(); setToken(r.token); setTkMsg('✓ Rotated') } catch (e) { setTkMsg('✗ ' + (e as Error).message) } }
  function copyToken() { navigator.clipboard?.writeText(token); setTkMsg('Copied to clipboard') }

  // Strava — per-user OAuth "Connect with Strava" (no API key for the user).
  const [strava, setStrava] = useState<{ available?: boolean; connected?: boolean; scope?: string } | null>(null)
  const [stravaMsg, setStravaMsg] = useState('')
  useEffect(() => {
    fetch('/auth/strava/status', { credentials: 'same-origin' }).then((r) => r.json()).then(setStrava).catch(() => {})
    const p = new URLSearchParams(location.search).get('strava')
    if (p === 'connected') setStravaMsg('✓ Strava connected')
    else if (p === 'denied') setStravaMsg('Connection cancelled')
    else if (p === 'error') setStravaMsg('✗ Connection failed — try again')
  }, [])
  async function disconnectStrava() {
    if (!confirm('Disconnect Strava?')) return
    await fetch('/auth/strava/disconnect', { method: 'POST', credentials: 'same-origin' })
    setStrava((s) => ({ ...s, connected: false })); setStravaMsg('Disconnected')
  }

  const avatarNode = user.avatar ? <img src={user.avatar} alt="" /> : user.username.slice(0, 2).toUpperCase()

  return (
    <>
      {(!only || only === 'account') && <>
      <div className="section-title">Account</div>
      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="card-row" style={{ gap: 12, alignItems: 'center' }}>
          <button className="acct-edit" onClick={() => fileRef.current?.click()} aria-label="Change picture">
            <span className="acct__avatar acct__avatar--lg">{avatarNode}</span>
            <span className="acct-edit__cam"><Camera size={12} /></span>
          </button>
          <div style={{ flex: 1 }}><strong>{user.username}</strong><div className="meta">{user.email} · {user.role}</div></div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        {(avMsg || user.avatar) && (
          <div className="card-row" style={{ marginTop: 8, gap: 10 }}>
            {avMsg && <span className="meta">{avMsg}</span>}
            {user.avatar && <button className="auth-link" style={{ padding: 0 }} onClick={removeAvatar}>Remove photo</button>}
          </div>
        )}
      </div>

      <div className="section-title">Change password</div>
      <PasswordInput value={cur} onChange={setCur} placeholder="Current password" autoComplete="current-password" />
      <PasswordInput value={nw} onChange={setNw} placeholder="New password" autoComplete="new-password" />
      <button className="btn" onClick={changePw} disabled={!cur || !nw}>Update password</button>
      {pwMsg && <p className="meta" style={{ marginTop: 8 }}>{pwMsg}</p>}

      <div className="section-title">Passkeys (fingerprint / Face)</div>
      <p className="meta" style={{ marginTop: -4 }}>Add this device once, then sign in with your fingerprint.</p>
      <div className="stack">
        {user.passkeys.map((p) => (
          <div key={p.id} className="card card-row" style={{ padding: '10px 14px', justifyContent: 'space-between' }}>
            <span><Fingerprint size={16} /> {p.label}</span>
            <button className="icon-btn" onClick={() => delPasskey(p.id)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
        {!user.passkeys.length && <p className="meta">No passkeys yet.</p>}
      </div>
      {passkeySupported
        ? <button className="btn btn--ghost" onClick={addPasskey}><Fingerprint size={18} /> Add a passkey on this device</button>
        : <p className="meta">This browser doesn't support passkeys (use Chrome/Edge).</p>}
      {pkMsg && <p className="meta" style={{ marginTop: 8 }}>{pkMsg}</p>}
      </>}

      {(!only || only === 'connections') && <>
      <div className="section-title">intervals.icu (your account)</div>
      {user.hasIcuKey ? (
        <p className="meta" style={{ marginTop: -4 }}>✓ Key stored on your account — syncs on every device.</p>
      ) : (
        <p className="meta" style={{ marginTop: -4 }}>
          Get your key: <a href="https://intervals.icu/settings" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>intervals.icu → Settings ↗</a> → <b>Developer Settings</b> → API Key → <b>(view)</b>, then paste it below. Your Athlete ID is shown right there too.
        </p>
      )}
      <input className="search" type="password" placeholder={user.hasIcuKey ? '•••••• (saved) — paste to replace' : 'API key'} value={icuKey} onChange={(e) => setIcuKey(e.target.value)} />
      <input className="search" placeholder="Athlete id" value={icuAth} onChange={(e) => setIcuAth(e.target.value)} />
      <button className="btn" onClick={saveIcu} disabled={!icuKey && icuAth === user.icuAthlete}>Save to account</button>
      {icuMsg && <p className="meta" style={{ marginTop: 8 }}>{icuMsg}</p>}

      <div className="section-title">Strava</div>
      {strava?.available === false ? (
        <p className="meta" style={{ marginTop: -4 }}>Strava isn't set up on this server yet.</p>
      ) : strava?.connected ? (
        <>
          <p className="meta" style={{ marginTop: -4 }}>✓ Connected{strava.scope ? ` · ${strava.scope}` : ''}</p>
          <button className="btn btn--ghost" onClick={disconnectStrava}>Disconnect Strava</button>
        </>
      ) : (
        <>
          <p className="meta" style={{ marginTop: -4 }}>One tap — no API key needed.</p>
          <a className="btn" href="/auth/strava/connect" style={{ background: '#fc4c02', color: '#fff' }}>Connect with Strava</a>
        </>
      )}
      {stravaMsg && <p className="meta" style={{ marginTop: 8 }}>{stravaMsg}</p>}

      <div className="section-title">Coach API</div>
      <p className="meta" style={{ marginTop: -4 }}>For your cyclingcoach to push plans. <a href="/api/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Open API docs ↗</a></p>
      <div style={{ position: 'relative' }}>
        <input
          className="search" readOnly type={showToken ? 'text' : 'password'} value={token}
          onFocus={(e) => showToken && e.currentTarget.select()}
          style={{ fontFamily: 'monospace', fontSize: 13, paddingRight: 44 }}
        />
        <button
          type="button" onClick={() => setShowToken((v) => !v)} aria-label={showToken ? 'Hide token' : 'Show token'}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 6 }}
        >
          {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn--ghost" onClick={copyToken} style={{ width: 'auto', padding: '8px 14px' }}><Copy size={16} /> Copy token</button>
        <button className="btn btn--ghost" onClick={rotate} style={{ width: 'auto', padding: '8px 14px' }}><RefreshCw size={16} /> Rotate</button>
      </div>
      {tkMsg && <p className="meta" style={{ marginTop: 8 }}>{tkMsg}</p>}
      </>}
    </>
  )
}
