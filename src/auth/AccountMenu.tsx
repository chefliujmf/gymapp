import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { User, LogOut, ChevronDown, Code2, Shield, Settings } from 'lucide-react'
import { useAuth } from './AuthContext'

/** Top-right avatar that opens a small account menu (Profile, Log out). */
export default function AccountMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  if (!user) return null
  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <div className="acct" ref={ref}>
      <button className="acct__trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account">
        <span className="acct__avatar">{user.avatar ? <img src={user.avatar} alt="" /> : initials}</span>
        <ChevronDown size={15} className="acct__chev" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="acct__menu" role="menu">
          <div className="acct__head">
            <strong>{user.username}</strong>
            <span>{user.email}{user.role === 'admin' ? ' · admin' : ''}</span>
          </div>
          <NavLink to="/profile" className="acct__item" role="menuitem" onClick={() => setOpen(false)}><User size={16} /> Profile</NavLink>
          <NavLink to="/settings" className="acct__item" role="menuitem" onClick={() => setOpen(false)}><Settings size={16} /> Settings</NavLink>
          {user.role === 'admin' && <NavLink to="/admin" className="acct__item" role="menuitem" onClick={() => setOpen(false)}><Shield size={16} /> Admin</NavLink>}
          {user.role === 'admin' && <a href="/api/docs" target="_blank" rel="noreferrer" className="acct__item" role="menuitem" onClick={() => setOpen(false)}><Code2 size={16} /> Coach API</a>}
          <button className="acct__item acct__item--danger" role="menuitem" onClick={logout}><LogOut size={16} /> Log out</button>
        </div>
      )}
    </div>
  )
}
