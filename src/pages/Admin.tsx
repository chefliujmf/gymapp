import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Rocket } from 'lucide-react'
import { authApi, type User } from '../auth/api'
import { useAuth } from '../auth/AuthContext'

// Simple, admin-only user management. Mobile-first cards + role badges.
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [u, setU] = useState('')
  const [em, setEm] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [msg, setMsg] = useState('')
  const [promo, setPromo] = useState<{ configured: boolean; open?: boolean; number?: number; url?: string } | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')

  const list = async () => { try { setUsers(await authApi.listUsers()) } catch { setUsers([]) } }
  useEffect(() => { list() }, [])
  useEffect(() => { authApi.promoteStatus().then(setPromo).catch(() => setPromo(null)) }, [])

  if (user && user.role !== 'admin') return <div className="empty"><div className="big">🔒</div>Admins only.</div>

  async function promote() {
    if (!confirm('Ship the current dev build to PRODUCTION?\n\nDo this only after you’ve tested it on QA (platyplus-qa.duckdns.org). It ships automatically once CI passes.')) return
    setPromoBusy(true); setPromoMsg('')
    try {
      const r = await authApi.promote()
      setPromoMsg(r.message || (r.upToDate ? 'Prod is already up to date.' : 'Promotion started.'))
      authApi.promoteStatus().then(setPromo).catch(() => {})
    } catch (e) { setPromoMsg('✗ ' + (e as Error).message) }
    finally { setPromoBusy(false) }
  }

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
  async function del(id: string) { if (!confirm('Remove this user? This cannot be undone.')) return; await authApi.deleteUser(id); list() }

  const badge = (r: string) => ({ background: r === 'admin' ? '#b98cff22' : '#34e07d22', color: r === 'admin' ? '#b98cff' : '#34e07d', padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700 })

  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>Admin</h1>
        <p>Manage who can access Platyplus</p>
      </div>

      <div className="section-title">Ship to production</div>
      <div className="card" style={{ padding: '12px 14px' }}>
        <p className="meta" style={{ marginTop: 0 }}>Test on <strong>QA</strong> first, then promote the current <code>dev</code> build to prod. It ships automatically once CI passes — no GitHub needed.</p>
        <button className="btn" onClick={promote} disabled={promoBusy || (promo ? !promo.configured : false)}>
          <Rocket size={16} style={{ marginRight: 6, verticalAlign: '-2px' }} />{promoBusy ? 'Promoting…' : 'Promote dev → prod'}
        </button>
        {promo && !promo.configured && <p className="meta" style={{ marginTop: 8 }}>⚠ Promotion isn’t configured yet (server is missing <code>GITHUB_PROMOTE_TOKEN</code>).</p>}
        {promo?.open && <p className="meta" style={{ marginTop: 8 }}>A promotion PR (<a href={promo.url} target="_blank" rel="noreferrer">#{promo.number}</a>) is open and will merge when CI passes.</p>}
        {promoMsg && <p className="meta" style={{ marginTop: 8, wordBreak: 'break-word' }}>{promoMsg}</p>}
      </div>

      <div className="section-title">Users · {users.length}</div>
      <div className="stack">
        {users.map((x) => (
          <div key={x.id} className="card card-row" style={{ padding: '12px 14px', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <strong>{x.username}</strong>
              <div className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <span style={badge(x.role)}>{x.role}</span>
              <button className="btn btn--ghost" style={{ width: 'auto', padding: '6px 10px' }} onClick={() => reset(x.id)}>Reset</button>
              {x.id !== user?.id && <button className="icon-btn" onClick={() => del(x.id)} aria-label="Remove"><Trash2 size={16} /></button>}
            </div>
          </div>
        ))}
        {!users.length && <p className="meta">No users loaded (sign in as an admin).</p>}
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
