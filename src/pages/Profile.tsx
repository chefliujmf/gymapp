import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { fetchAthleteSex } from '../intervals'

const SPORTS: [string, string][] = [['cycling', 'Cycling'], ['running', 'Running'], ['strength', 'Strength'], ['yoga', 'Yoga'], ['pilates', 'Pilates'], ['meditation', 'Meditation']]

// #207 Phase 2: an editable athlete-stat field (autosaves on blur).
function StatInput({ label, unit, value, lo, hi, step, onSave }: { label: string; unit?: string; value?: number | null; lo: number; hi: number; step: number; onSave: (v: number | null) => void }) {
  const [v, setV] = useState<string>(value != null ? String(value) : '')
  useEffect(() => { setV(value != null ? String(value) : '') }, [value])
  return (
    <label className="stat-edit">
      <span className="stat-edit__l">{label}{unit ? <span className="stat-edit__u"> ({unit})</span> : null}</span>
      <input className="stat-edit__i" type="number" inputMode="decimal" min={lo} max={hi} step={step} value={v} placeholder="—"
        onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v.trim() === '' ? null : Number(v))} />
    </label>
  )
}

export default function Profile() {
  const { user, refresh } = useAuth()
  const logs = useLiveQuery(() => db.logs.toArray())
  const ftp = useLiveQuery(() => getSetting('ftp'))
  const coachName = useLiveQuery(() => getSetting('coachName'))
  const [coachSaved, setCoachSaved] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)
  const [statSaved, setStatSaved] = useState(false)
  const saveStat = (patch: Record<string, unknown>) => authApi.saveProfile(patch).then(() => { refresh(); setStatSaved(true); setTimeout(() => setStatSaved(false), 1500) }).catch(() => {})

  // Sex isn't asked here — read it from intervals.icu (if connected) to gate the
  // female-athlete coaching module. Optional: gating falls back without it.
  useEffect(() => {
    if (user && !user.sex && user.hasIcuKey) {
      fetchAthleteSex().then((s) => { if (s) authApi.saveProfile({ sex: s }).then(() => refresh()).catch(() => {}) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sex, user?.hasIcuKey])

  const toggleSport = (v: string) => {
    const cur = user?.sports || []
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    authApi.saveProfile({ sports: next }).then(() => { refresh(); setSportSaved(true); setTimeout(() => setSportSaved(false), 1500) }).catch(() => {})
  }
  const totalMin = (logs ?? []).reduce((s, l) => s + l.duration, 0)
  const avatar = user?.avatar
    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
    : (user?.username || '?').slice(0, 2).toUpperCase()

  return (
    <div>
      <div className="page-head"><h1>Profile</h1><p>You & your coaching</p></div>

      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="card-row" style={{ gap: 12, alignItems: 'center' }}>
          <span className="acct__avatar acct__avatar--lg">{avatar}</span>
          <div style={{ flex: 1 }}><strong>{user?.username}</strong><div className="meta">{user?.email} · {user?.role}</div></div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
        <div className="stat"><div className="v">{logs?.length ?? 0}</div><div className="k">workouts</div></div>
        <div className="stat"><div className="v">{Math.round(totalMin / 60)}h</div><div className="k">trained</div></div>
        <div className="stat"><div className="v">{user?.ftp ?? (ftp ? Number(ftp) : 260)}</div><div className="k">FTP (W)</div></div>
      </div>

      <div className="section-title">Your coach {coachSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <input
        className="search" placeholder="e.g. Tadej" value={coachName ?? ''}
        onChange={(e) => { setSetting('coachName', e.target.value); setCoachSaved(false) }}
        onBlur={(e) => { authApi.saveProfile({ coachName: e.target.value.trim() }).then(() => { setCoachSaved(true); setTimeout(() => setCoachSaved(false), 2500) }).catch(() => {}) }}
      />
      <p className="meta" style={{ margin: '6px 2px 4px' }}>What your coach goes by in chat — saved when you tap away.</p>
      <Link to="/profile/athlete" className="btn btn--ghost" style={{ marginTop: 8 }}>🏷️ Athlete profile — what your coach knows about you ›</Link>

      <div className="section-title">Sports you do {sportSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {SPORTS.map(([v, label]) => (
          <button key={v} className={'chip' + ((user?.sports || []).includes(v) ? ' chip--active' : '')} onClick={() => toggleSport(v)}>{label}</button>
        ))}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Pick all that apply — tunes your nav & coach. Cycling/Running unlock the endurance method & Fitness page.</p>

      <div className="section-title">Your stats {statSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <p className="meta" style={{ margin: '2px 2px 8px' }}>Personalises your readiness & coach — sleep need tunes your <strong>Sleep</strong> score, and FTP / max-HR / VO₂max tell the coach how hard a session is <em>for you</em>. Leave blank to use defaults.</p>
      <div className="stat-edit-grid">
        <StatInput label="Sleep need" unit="h" value={user?.sleepNeed} lo={4} hi={12} step={0.5} onSave={(v) => saveStat({ sleepNeed: v })} />
        <StatInput label="Max HR" unit="bpm" value={user?.maxHR} lo={120} hi={230} step={1} onSave={(v) => saveStat({ maxHR: v })} />
        <StatInput label="FTP" unit="W" value={user?.ftp ?? (ftp != null ? Number(ftp) : null)} lo={50} hi={600} step={1} onSave={(v) => { saveStat({ ftp: v }); setSetting('ftp', String(v ?? 260)) }} />
        <StatInput label="VO₂max" value={user?.vo2max} lo={20} hi={95} step={0.1} onSave={(v) => saveStat({ vo2max: v })} />
      </div>
    </div>
  )
}
