import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'
import { authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import Availability from '../Availability'
import EquipmentPicker from '../EquipmentPicker'
import GoalsPicker from '../GoalsPicker'
import OnboardReturnBar from '../OnboardReturnBar'
import SleepNeed from '../SleepNeed'
import { fetchAthleteSex } from '../intervals'
import { dataGaps } from '../dataGaps'

const SPORTS: [string, string][] = [['cycling', 'Cycling'], ['running', 'Running'], ['strength', 'Strength'], ['yoga', 'Yoga'], ['pilates', 'Pilates'], ['meditation', 'Meditation']]
const DIETS: [string, string][] = [['vegetarian', 'vegetarian'], ['vegan', 'vegan'], ['no preference', 'no preference']]


export default function Profile() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const gaps = dataGaps(user)
  const coachName = useLiveQuery(() => getSetting('coachName'))
  const [coachSaved, setCoachSaved] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)
  const [dietSaved, setDietSaved] = useState(false)

  // Sex from intervals (gates the female-athlete coaching module) — optional.
  useEffect(() => {
    if (user && !user.sex && user.hasIcuKey) fetchAthleteSex().then((s) => { if (s) authApi.saveProfile({ sex: s }).then(() => refresh()).catch(() => {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sex, user?.hasIcuKey])

  const toggleSport = (v: string) => {
    const cur = user?.sports || []
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    authApi.saveProfile({ sports: next }).then(() => { refresh(); setSportSaved(true); setTimeout(() => setSportSaved(false), 1500) }).catch(() => {})
  }
  const diet = (user?.info as { diet?: string } | undefined)?.diet ?? 'no preference'
  const setDiet = (v: string) => { setSetting('diet', v); authApi.saveProfile({ diet: v }).then(() => refresh()).catch(() => {}); setDietSaved(true); setTimeout(() => setDietSaved(false), 1500) }

  const connected = !!user?.hasIcuKey
  // #337b — per-sport stat inputs + Daniels zones/predictions moved to Stats (single place). Profile
  // keeps only preferences.
  const avatar = user?.avatar
    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
    : (user?.username || '?').slice(0, 2).toUpperCase()

  const does = (s: string) => (user?.sports || []).includes(s)

  return (
    <div>
      <OnboardReturnBar />
      <div className="sub-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="sub-head-t"><h1>Profile</h1><p>You & your coaching</p></div>
      </div>

      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="card-row" style={{ gap: 12, alignItems: 'center' }}>
          <span className="acct__avatar acct__avatar--lg">{avatar}</span>
          <div style={{ flex: 1 }}><strong>{user?.username}</strong><div className="meta">{user?.email} · {user?.role}</div></div>
        </div>
      </div>

      {/* Unlock nudge — turn missing-data dead-ends into a clear to-do (dataGaps.ts) */}
      {gaps.length > 0 && (
        <div className="card gapcard">
          <div className="gapcard__h">⚡ Unlock more from your data</div>
          {gaps.map((g) => (
            <div key={g.key} className="gapcard__row"><b>{g.label}</b><span> → {g.unlocks}</span></div>
          ))}
          <div className="gapcard__hint">Set these below{!user?.hasIcuKey ? ' — connecting intervals.icu fills most of them automatically' : ''}.</div>
        </div>
      )}

      <div className="section-title">Sleep</div>
      <SleepNeed />

      <div className="section-title" id="ob-coach">Your coach {coachSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <input
        className="search" placeholder="e.g. Tadej" value={coachName ?? ''}
        onChange={(e) => { setSetting('coachName', e.target.value); setCoachSaved(false) }}
        onBlur={(e) => { authApi.saveProfile({ coachName: e.target.value.trim() }).then(() => { setCoachSaved(true); setTimeout(() => setCoachSaved(false), 2500) }).catch(() => {}) }}
      />
      <p className="meta" style={{ margin: '6px 2px 4px' }}>What your coach goes by in chat — saved when you tap away.</p>
      <Link to="/profile/athlete" className="btn btn--ghost" style={{ marginTop: 8 }}>🏷️ Athlete profile — what your coach knows about you ›</Link>

      <div className="section-title" id="ob-sport">Sports you do {sportSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {SPORTS.map(([v, label]) => (
          <button key={v} className={'chip' + (does(v) ? ' chip--active' : '')} onClick={() => toggleSport(v)}>{label}</button>
        ))}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Pick all that apply — tunes your nav & coach. Cycling/Running unlock the endurance method & Fitness page.</p>

      {/* #308 — biological sex is a VISIBLE, settable step (was silent from intervals). Gates the coach's
          female-athlete module (cycle-aware fuelling, recovery, RED-S). Prefilled from intervals when linked. */}
      <div className="section-title" id="ob-about">About you</div>
      <div className="chips">
        {([['male', '♂︎ Male'], ['female', '♀︎ Female']] as [string, string][]).map(([v, label]) => (
          <button key={v} className={'chip' + (user?.sex === v ? ' chip--active' : '')} onClick={() => authApi.saveProfile({ sex: v }).then(() => refresh()).catch(() => {})}>{label}</button>
        ))}
      </div>
      {user?.sex === 'female'
        ? <p className="meta" style={{ margin: '6px 2px 4px', color: 'var(--accent)' }}>💚 Coaching adjusted for female physiology — cycle-aware fuelling, recovery & load.</p>
        : <p className="meta" style={{ margin: '6px 2px 4px' }}>Tunes fuelling & recovery.{connected ? ' Prefilled from intervals.' : ''}</p>}

      {/* #323 — rich goals/identity capture (what makes coaching personal) */}
      <GoalsPicker />

      <Availability />{/* #ob-avail anchor is on Availability's own section-title */}

      {/* #320 — equipment is a coaching input (like sports/diet), so it lives here on Profile, not Settings. */}
      <EquipmentPicker />

      <div className="section-title">Diet {dietSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {DIETS.map(([v, label]) => <button key={v} className={'chip' + (diet === v ? ' chip--active' : '')} onClick={() => setDiet(v)}>{label}</button>)}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Your coach picks ONLY meals that match — vegetarian shows veg + vegan; vegan shows vegan only.</p>

      {/* #337b — Profile is PREFERENCES. Your benchmarks (VO₂max, FTP, threshold pace, zones, predictions)
          live in ONE place — Stats — with the Manual/Auto/Computed picker. No duplicate UX here. */}
      <div className="section-title" id="ob-numbers">Your data</div>
      <Link to="/stats" className="btn btn--ghost" style={{ marginBottom: 8 }}>📊 Benchmarks, VO₂max, zones & trends — open Stats ›</Link>
      {/* #235 — turn the readiness self-learning on/off */}
      <label className="toggle-row">
        <span className="toggle-row__t"><b>Learn from my check-ins</b><span className="meta">Auto-adapt your Sleep/Freshness/Energy scores toward how you actually rate them over time.</span></span>
        <input type="checkbox" className="toggle-row__cb" checked={user?.learnReadiness !== false} onChange={(e) => authApi.saveProfile({ learnReadiness: e.target.checked }).then(() => refresh()).catch(() => {})} />
      </label>


    </div>
  )
}
