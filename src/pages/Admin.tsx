import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { authApi, type User, type ClaudeStatus } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import AdminBacklog from './AdminBacklog'

// #468 — live "what is Claude working on" panel. Claude writes a shared status file as it runs the bug
// pipeline; this polls it so JM can SEE the current batch, progress toward the 10-item bucket, and bugs left.
function timeAgo(ms: number) { const s = Math.round((Date.now() - ms) / 1000); if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; return Math.round(s / 3600) + 'h ago' }
function ClaudePanel() {
  const [s, setS] = useState<ClaudeStatus | null>(null)
  const [req, setReq] = useState<'idle' | 'sending' | 'sent'>('idle')
  useEffect(() => {
    const load = () => authApi.claudeStatus().then(setS).catch(() => {})
    load(); const t = setInterval(load, 8000); return () => clearInterval(t)
  }, [])
  if (!s) return null
  const trigger = () => { setReq('sending'); authApi.triggerClaude().then(() => { setReq('sent'); setTimeout(() => setReq('idle'), 5000) }).catch(() => setReq('idle')) }
  const stale = s.updatedAt ? Date.now() - s.updatedAt > 6 * 60000 : true // >6 min without an update ⇒ treat as idle
  const active = !!s.active && !stale
  const lt = s.liveTotest ?? s.done ?? 0 // LIVE to-test count (from the backlog), not my static write
  const pct = s.total ? Math.min(100, Math.round((lt / s.total) * 100)) : 0
  return (
    <div className="card" style={{ padding: '13px 15px', marginBottom: 14, border: `1px solid ${active ? '#34e07d66' : '#2a2f3a'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🤖</span><strong style={{ fontSize: 14 }}>Claude</strong>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', padding: '3px 10px', borderRadius: 999, color: active ? '#08130b' : '#9298a6', background: active ? '#34e07d' : '#20242e' }}>{active ? '● WORKING' : 'idle'}</span>
      </div>
      {s.note && <div style={{ fontSize: 13, color: '#c4cad4', marginTop: 8, lineHeight: 1.4 }}>{s.batch ? <b>Batch {s.batch} · </b> : null}{s.note}</div>}
      {s.total ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 8, background: '#0b0e12', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#34e07d,#5be59a)', transition: 'width .5s' }} /></div>
          <div className="meta" style={{ marginTop: 6 }}>{lt}/{s.total} still to review{lt > 0 && s.pending?.length ? <>: <b style={{ color: '#e0a334' }}>{s.pending.map((n) => '#' + n).join(', ')}</b></> : lt === 0 ? ' — bucket clear ✓' : ''}</div>
          {(s.poolBugs != null || s.poolFeatures != null || s.poolIdeas != null) ? (
            <div className="meta" style={{ marginTop: 4 }}>Left → 0: <b style={{ color: '#ff8a8a' }}>{s.poolBugs ?? 0} bug{s.poolBugs === 1 ? '' : 's'}</b> · {s.poolFeatures ?? 0} feature{s.poolFeatures === 1 ? '' : 's'} · {s.poolIdeas ?? 0} idea{s.poolIdeas === 1 ? '' : 's'} <span style={{ opacity: .6 }}>(bugs first)</span></div>
          ) : s.poolRemaining != null ? <div className="meta" style={{ marginTop: 4 }}>{s.poolRemaining} left → 0</div> : null}
        </div>
      ) : null}
      {s.updatedAt ? <div className="meta" style={{ fontSize: 10.5, marginTop: 7 }}>updated {timeAgo(s.updatedAt)}</div> : null}
      {/* #468 — manual trigger: kick off the next batch on demand (not only at the auto totest==0 trigger). */}
      <button className="btn btn--ghost" style={{ width: '100%', marginTop: 11, fontSize: 12.5, padding: '8px' }} disabled={req !== 'idle'} onClick={trigger}>
        {req === 'sent' ? '✓ Requested — Claude will start the next batch shortly' : req === 'sending' ? 'Requesting…' : '▶ Start next batch now'}
      </button>
    </div>
  )
}

// Admin-only: the BACKLOG tracker (#438) + user management. Mobile-first.
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'backlog' | 'users'>('backlog') // #438 — backlog front-and-centre
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
        <p>{tab === 'backlog' ? 'Your live backlog — filter, comment, prioritise, discard' : 'Manage who can access Platyplus'}</p>
      </div>

      <ClaudePanel />
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={'chip' + (tab === 'backlog' ? ' chip--active' : '')} onClick={() => setTab('backlog')}>Backlog</button>
        <button className={'chip' + (tab === 'users' ? ' chip--active' : '')} onClick={() => setTab('users')}>Users</button>
      </div>

      {tab === 'backlog' && <AdminBacklog />}

      {tab === 'users' && (<>
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
      </>)}
    </div>
  )
}
