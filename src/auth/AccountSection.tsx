import { useEffect, useState } from 'react'
import { Fingerprint, Trash2, LogOut } from 'lucide-react'
import { authApi, type User } from './api'
import { useAuth } from './AuthContext'

export default function AccountSection() {
  const { user, apply, refresh, logout } = useAuth()
  if (!user) return null
  const passkeySupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

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

  return (
    <>
      <div className="section-title">Account</div>
      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="card-row" style={{ justifyContent: 'space-between' }}>
          <div><strong>{user.username}</strong><div className="meta">{user.email} · {user.role}</div></div>
          <button className="btn btn--ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={logout}><LogOut size={16} /> Log out</button>
        </div>
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

      {user.role === 'admin' && <AdminUsers onChange={refresh} selfId={user.id} />}
    </>
  )
}

function AdminUsers({ onChange, selfId }: { onChange: () => void; selfId: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [u, setU] = useState(''); const [em, setEm] = useState(''); const [role, setRole] = useState<'user' | 'admin'>('user')
  const [msg, setMsg] = useState('')
  const list = async () => { try { setUsers(await authApi.listUsers()) } catch { /* not admin / dev */ } }
  useEffect(() => { list() }, [])

  async function add() {
    setMsg('')
    try { const r = await authApi.addUser(u, em, role); setU(''); setEm(''); setMsg(`✓ Added ${r.user.username}. Temp password: ${r.tempPassword}${r.emailed ? ' (emailed)' : ''}`); list(); onChange() }
    catch (e) { setMsg('✗ ' + (e as Error).message) }
  }
  async function reset(id: string) { try { const r = await authApi.resetUser(id); setMsg(`Temp password: ${r.tempPassword}${r.emailed ? ' (emailed)' : ''}`) } catch (e) { setMsg('✗ ' + (e as Error).message) } }
  async function del(id: string) { if (!confirm('Remove this user?')) return; await authApi.deleteUser(id); list() }

  return (
    <>
      <div className="section-title">Admin · Users</div>
      <div className="stack">
        {users.map((x) => (
          <div key={x.id} className="card card-row" style={{ padding: '10px 14px', justifyContent: 'space-between' }}>
            <div><strong>{x.username}</strong> <span className="meta">{x.email} · {x.role}</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn--ghost" style={{ width: 'auto', padding: '6px 10px' }} onClick={() => reset(x.id)}>Reset</button>
              {x.id !== selfId && <button className="icon-btn" onClick={() => del(x.id)} aria-label="Remove"><Trash2 size={16} /></button>}
            </div>
          </div>
        ))}
      </div>
      <input className="search" placeholder="New username" value={u} autoCapitalize="none" onChange={(e) => setU(e.target.value)} />
      <input className="search" placeholder="Email" value={em} autoCapitalize="none" onChange={(e) => setEm(e.target.value)} />
      <div className="chips">
        {(['user', 'admin'] as const).map((r) => <button key={r} className={'chip' + (role === r ? ' chip--active' : '')} onClick={() => setRole(r)}>{r}</button>)}
      </div>
      <button className="btn" onClick={add} disabled={!u || !em}>Add user</button>
      {msg && <p className="meta" style={{ marginTop: 8, wordBreak: 'break-all' }}>{msg}</p>}
    </>
  )
}
