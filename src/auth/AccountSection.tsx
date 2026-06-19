import { useEffect, useRef, useState } from 'react'
import { Fingerprint, Trash2, Camera, Copy, RefreshCw } from 'lucide-react'
import { authApi } from './api'
import { useAuth } from './AuthContext'

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

export default function AccountSection() {
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
  const [token, setToken] = useState(''); const [tkMsg, setTkMsg] = useState('')
  useEffect(() => { authApi.getToken().then((r) => setToken(r.token)).catch(() => {}) }, [])
  async function rotate() { if (!confirm('Rotate the token? Your coach must update it.')) return; try { const r = await authApi.rotateToken(); setToken(r.token); setTkMsg('✓ Rotated') } catch (e) { setTkMsg('✗ ' + (e as Error).message) } }
  function copyToken() { navigator.clipboard?.writeText(token); setTkMsg('Copied to clipboard') }

  const avatarNode = user.avatar ? <img src={user.avatar} alt="" /> : user.username.slice(0, 2).toUpperCase()

  return (
    <>
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
      <input className="search" type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <input className="search" type="password" placeholder="New password" value={nw} onChange={(e) => setNw(e.target.value)} />
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

      <div className="section-title">intervals.icu (your account)</div>
      <p className="meta" style={{ marginTop: -4 }}>{user.hasIcuKey ? '✓ Key stored on your account — syncs on every device.' : 'Paste your API key once; it follows your account.'}</p>
      <input className="search" type="password" placeholder={user.hasIcuKey ? '•••••• (saved) — paste to replace' : 'API key'} value={icuKey} onChange={(e) => setIcuKey(e.target.value)} />
      <input className="search" placeholder="Athlete id" value={icuAth} onChange={(e) => setIcuAth(e.target.value)} />
      <button className="btn" onClick={saveIcu} disabled={!icuKey && icuAth === user.icuAthlete}>Save to account</button>
      {icuMsg && <p className="meta" style={{ marginTop: 8 }}>{icuMsg}</p>}

      <div className="section-title">Coach API</div>
      <p className="meta" style={{ marginTop: -4 }}>For your cyclingcoach to push plans. <a href="/api/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Open API docs ↗</a></p>
      <input className="search" readOnly value={token} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: 'monospace', fontSize: 13 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn--ghost" onClick={copyToken} style={{ width: 'auto', padding: '8px 14px' }}><Copy size={16} /> Copy token</button>
        <button className="btn btn--ghost" onClick={rotate} style={{ width: 'auto', padding: '8px 14px' }}><RefreshCw size={16} /> Rotate</button>
      </div>
      {tkMsg && <p className="meta" style={{ marginTop: 8 }}>{tkMsg}</p>}
    </>
  )
}
