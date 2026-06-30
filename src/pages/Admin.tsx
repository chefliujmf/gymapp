import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { authApi, type User } from '../auth/api'
import { useAuth } from '../auth/AuthContext'

// Simple, admin-only user management. Mobile-first cards + role badges.
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loaded, setLoaded] = useState(false)
  const [u, setU] = useState('')
  const [em, setEm] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<string | null>(null) // expanded user id (#261)
  const [pw, setPw] = useState('')

  const list = async () => { try { setUsers(await authApi.listUsers()) } finally { setLoaded(true) } }
  useEffect(() => { list() }, [])

  if (user && user.role !== 'admin') return <div className="empty"><div className="big">🔒</div>Admins only.</div>

  async function add() {
    setMsg('')
    try { const r = await authApi.addUser(u, em, role); setU(''); setEm(''); setMsg(`✓ Added ${r.user.username}. Temp password: ${r.tempPassword}${r.emailed ? ' (emailed)' : ''}`); list() }
    catch (e) { setMsg('✗ ' + (e as Error).message) }
  }
  async function reset(id: string) {
    if (!confirm('Reset this user’s password to a new temporary one?')) return
    try { const r = await authApi.resetUser(id); setMsg(`Temp password: ${r.tempPassword}${r.emailed ? ' (emailed)' : ''}`) }
    catch (e) { setMsg('✗ ' + (e as Error).message) }
  }
  async function setPassword(id: string, name: string) {
    if (pw.trim().length < 6) { setMsg('✗ Password must be at least 6 characters'); return }
    try { await authApi.setUserPassword(id, pw.trim()); setMsg(`✓ Password set for ${name}`); setPw(''); setOpen(null) }
    catch (e) { setMsg('✗ ' + (e as Error).message) }
  }
  function toggle(id: string) { setOpen((o) => (o === id ? null : id)); setPw(''); setMsg('') }
  async function del(id: string) { if (!confirm('Remove this user? This cannot be undone.')) return; await authApi.deleteUser(id); list() }

  const badge = (r: string) => ({ background: r === 'admin' ? '#b98cff22' : '#34e07d22', color: r === 'admin' ? '#b98cff' : '#34e07d', padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700 })

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>Admin</h1>
        <p>Manage who can access Platyplus</p>
      </div>

      <div className="section-title">Users · {users.length}</div>
      <div className="stack">
        {users.map((x) => (
          <div key={x.id} className="card" style={{ padding: 0 }}>
            <div className="card-row" style={{ padding: '12px 14px', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }} onClick={() => toggle(x.id)}>
              <div style={{ minWidth: 0 }}>
                <strong>{x.username}</strong>
                <div className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={badge(x.role)}>{x.role}</span>
                <span className="meta" style={{ fontSize: 16 }}>{open === x.id ? '⌄' : '›'}</span>
              </div>
            </div>
            {open === x.id && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid #ffffff14' }}>
                <div className="meta" style={{ margin: '10px 0 6px' }}>Set a password for {x.username}</div>
                <input className="search" type="text" placeholder="New password (min 6)" value={pw} autoCapitalize="none" autoCorrect="off" onChange={(e) => setPw(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn" style={{ width: 'auto', flex: 1 }} onClick={() => setPassword(x.id, x.username)} disabled={pw.trim().length < 6}>Set password</button>
                  <button className="btn btn--ghost" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => reset(x.id)}>Random reset</button>
                  {x.id !== user?.id && <button className="icon-btn" onClick={() => del(x.id)} aria-label="Remove"><Trash2 size={16} /></button>}
                </div>
              </div>
            )}
          </div>
        ))}
        {!loaded && <p className="meta">Loading…</p>}
        {loaded && !users.length && <p className="meta">No users yet.</p>}
      </div>

      <div className="section-title">Add user</div>
      <input className="search" placeholder="Username" value={u} autoCapitalize="none" onChange={(e) => setU(e.target.value)} />
      <input className="search" placeholder="Email" value={em} autoCapitalize="none" onChange={(e) => setEm(e.target.value)} />
      <div className="chips">
        {(['user', 'admin'] as const).map((r) => <button key={r} className={'chip' + (role === r ? ' chip--active' : '')} onClick={() => setRole(r)}>{r}</button>)}
      </div>
      <button className="btn" onClick={add} disabled={!u || !em}>Add user</button>
      {msg && <p className="meta" style={{ marginTop: 8, wordBreak: 'break-all' }}>{msg}</p>}
    </div>
  )
}
