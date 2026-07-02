import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'

// #302 — guided setup checklist for a new (esp. non-technical) user: what's connected vs missing,
// with one-tap fixes. Hides itself once everything's done. Strava-in-intervals can't be auto-detected,
// so it's a manual "I've done this" ack (localStorage).
const ackKey = (k: string) => 'setup:ack:' + k
const getAck = (k: string) => { try { return localStorage.getItem(ackKey(k)) === '1' } catch { return false } }

interface Item { key: string; label: string; hint: string; done: boolean; to?: string; ext?: string; manual?: boolean; cta?: string }

export default function SetupChecklist() {
  const { user } = useAuth()
  const [tick, setTick] = useState(0) // re-render after a manual ack
  if (!user) return null
  const info = (user.info || {}) as { equipment?: unknown[]; availability?: unknown }
  const items: Item[] = [
    { key: 'intervals', label: 'Connect intervals.icu', hint: 'Your data hub — HRV, activities, plans.', done: !!user.hasIcuKey, to: '/settings' },
    { key: 'strava', label: 'Connect Strava — inside intervals', hint: 'So your rides & runs flow in (not in Platyplus — in intervals).', done: getAck('strava'), ext: 'https://intervals.icu/settings', manual: true },
    { key: 'coach', label: 'Meet your coach', hint: 'A 2-minute chat (tap, type, or talk) and it builds your first week around your real life.', done: !!user.hasCoachProfile, to: '/chat?onboard=1', cta: 'Set me up →' },
    { key: 'sport', label: 'Pick your sport(s)', hint: 'Tunes your plan & navigation.', done: (user.sports || []).length > 0, to: '/profile' },
    { key: 'equipment', label: 'Set your equipment', hint: 'The coach only picks gear you have.', done: Array.isArray(info.equipment) && info.equipment.length > 0, to: '/profile' },
    { key: 'availability', label: 'Set weekly availability', hint: 'Hours/day you can train.', done: !!info.availability, to: '/profile' },
  ]
  void tick
  const doneN = items.filter((i) => i.done).length
  if (doneN === items.length) return null // all set → hide entirely
  const ackDone = (k: string) => { try { localStorage.setItem(ackKey(k), '1') } catch { /* quota */ } setTick((t) => t + 1) }

  return (
    <div className="card setup-card">
      <div className="setup-head">
        <div><div className="setup-title">Finish setting up</div><div className="meta" style={{ fontSize: 12 }}>{doneN} of {items.length} done — a few quick steps so your coach can help.</div></div>
        <div className="setup-ring" style={{ ['--p' as string]: `${Math.round((doneN / items.length) * 100)}%` }}>{doneN}/{items.length}</div>
      </div>
      <div className="setup-list">
        {items.map((it) => {
          const inner = (
            <>
              <span className={'setup-mark' + (it.done ? ' on' : '')}>{it.done ? '✓' : ''}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className={'setup-lbl' + (it.done ? ' done' : '')}>{it.label}</div>
                {!it.done && <div className="meta" style={{ fontSize: 11.5 }}>{it.hint}</div>}
              </div>
              {!it.done && (it.manual
                ? <button className="setup-fix" onClick={(e) => { e.preventDefault(); ackDone(it.key) }}>Done</button>
                : <span className={'setup-fix' + (it.cta ? ' setup-fix--cta' : '')}>{it.cta || 'Fix ›'}</span>)}
            </>
          )
          if (it.done) return <div key={it.key} className="setup-row">{inner}</div>
          if (it.ext) return <a key={it.key} className="setup-row" href={it.ext} target="_blank" rel="noreferrer">{inner}</a>
          return <Link key={it.key} className="setup-row" to={it.to!}>{inner}</Link>
        })}
      </div>
    </div>
  )
}
