import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'
import NotificationsSettings from '../NotificationsSettings'
import { authApi, type User } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import Availability from '../Availability'
import EquipmentPicker from '../EquipmentPicker'
import GoalsPicker from '../GoalsPicker'
import OnboardReturnBar from '../OnboardReturnBar'
import { fetchAthleteSex } from '../intervals'
import { dataGaps } from '../dataGaps'
import { bmr, tdee, calorieTarget, macroSplit, ageFromDob, type Goal } from '../nutrition'

// #491 — Meditation (Mind) removed from the picker while Eat/Mind are deactivated. Yoga/Pilates STAY (they're
// logged physical activities that count for the day dot). To restore Mind: re-add ['meditation', 'Meditation'].
const SPORTS: [string, string][] = [['cycling', 'Cycling'], ['running', 'Running'], ['strength', 'Strength'], ['yoga', 'Yoga'], ['pilates', 'Pilates']]
const DIETS: [string, string][] = [['vegetarian', 'vegetarian'], ['vegan', 'vegan'], ['no preference', 'no preference']]


// #341/#268 — LOCATION (weather-aware coaching + local time). Option C: prefill the detected city (from
// intervals), one tap to confirm, or Change to a city field. Bi-directionally synced with intervals (the
// city is written back). No lat/lng UI — the server geocodes + keeps coords for weather.
function LocationField() {
  const [loc, setLoc] = useState<{ name: string | null; source: string | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { authApi.location().then((l) => { setLoc(l); setCity((l.name || '').split(',')[0]) }).catch(() => setLoc({ name: null, source: null })) }, [])
  const submit = (c: string) => {
    const q = c.trim(); if (!q) return
    setBusy(true); setErr('')
    authApi.saveLocation(q).then((r) => { setLoc({ name: r.name, source: 'saved' }); setCity(r.name); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 1500) })
      .catch((e) => setErr((e as Error).message || "Couldn't find that place")).finally(() => setBusy(false))
  }
  return (
    <div style={{ marginTop: 6 }}>
      <div className="section-title" style={{ fontSize: 13 }} id="ob-location">Location <span className="meta" style={{ fontWeight: 400 }}>· weather + local time{saved ? ' · Saved ✓' : ''}</span></div>
      {loc === null ? <p className="meta">Loading…</p>
        : (loc.name && !editing) ? (
          <div className="card" style={{ padding: '11px 13px' }}>
            <div style={{ fontWeight: 750, fontSize: 14 }}>📍 {loc.name}{loc.source === 'intervals' ? <span className="meta" style={{ fontWeight: 400 }}> · from intervals</span> : null}</div>
            <div className="meta" style={{ marginTop: 3 }}>Used for weather-aware coaching + your local time.{loc.source === 'intervals' ? ' Confirm to lock it in (and keep intervals in sync).' : ''}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {loc.source !== 'saved' && <button className="btn" disabled={busy} onClick={() => submit((loc.name || '').split(',')[0])} style={{ flex: 1 }}>Use this ✓</button>}
              <button className="btn btn--ghost" onClick={() => setEditing(true)} style={{ flex: 1 }}>Change</button>
            </div>
          </div>
        ) : (
          <>
            <input className="search" placeholder="City — e.g. Montreal" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(city) }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn" disabled={busy || !city.trim()} onClick={() => submit(city)} style={{ flex: 1 }}>{busy ? 'Finding…' : 'Save location'}</button>
              {loc?.name && <button className="btn btn--ghost" onClick={() => { setEditing(false); setErr('') }}>Cancel</button>}
            </div>
            {err && <p className="meta" style={{ color: 'var(--danger)', marginTop: 6 }}>{err}</p>}
            <p className="meta" style={{ margin: '6px 2px 0' }}>Your coach adjusts for heat/cold/wind, and your local date fixes forecasts. Synced to intervals.</p>
          </>
        )}
    </div>
  )
}

// #329 — optional cycle inputs (last period start + typical length). The coach uses intervals'
// menstrualPhase first; this is the fallback/manual path. Phase readout mirrors server/cycle.js.
function cyclePhaseOf(start?: string, len = 28): { day: number; phase: string } | null {
  if (!start) return null
  const L = Math.max(21, Math.min(40, Number(len) || 28))
  const day = ((Math.floor((Date.now() - new Date(start + 'T00:00:00').getTime()) / 86400000)) % L + L) % L + 1
  const ovul = L - 14
  const phase = day <= 5 ? 'menstrual' : day < ovul ? 'follicular' : day <= ovul + 1 ? 'ovulatory' : day >= L - 2 ? 'late luteal (PMS)' : 'luteal'
  return { day, phase }
}
function CycleFields({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  const info = (user.info || {}) as { cycleStart?: string; cycleLength?: number; pregnant?: boolean }
  const [start, setStart] = useState(info.cycleStart || '')
  const [len, setLen] = useState<number>(info.cycleLength || 28)
  const [saved, setSaved] = useState(false)
  const save = (patch: { cycleStart?: string; cycleLength?: number; pregnant?: boolean }) => { authApi.saveProfile(patch).then(() => { refresh().catch(() => {}); setSaved(true); setTimeout(() => setSaved(false), 1500) }).catch(() => {}) }
  const pregnant = !!info.pregnant
  const ph = cyclePhaseOf(start, len)
  // #422 — if intervals wellness already gives us the phase (she logs her period there), SHOW it and
  // don't prompt her to re-enter. Manual fields stay as a fallback for athletes who don't log it.
  const icuPhase = user.cyclePhase ? String(user.cyclePhase).replace(/_/g, ' ') : null
  return (
    <div style={{ marginTop: 6 }}>
      <div className="section-title" style={{ fontSize: 13 }}>Cycle &amp; pregnancy <span className="meta" style={{ fontWeight: 400 }}>· optional{saved ? ' · Saved ✓' : ''}</span></div>
      {/* #427 — Pregnant toggle: switches the coach to pregnancy mode + pauses menstrual-cycle tracking. Private (never shown on workouts). */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '2px 2px 8px' }}>
        <input type="checkbox" checked={pregnant} onChange={(e) => save({ pregnant: e.target.checked })} style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
        <span style={{ color: 'var(--text)', fontSize: 14 }}>Pregnant</span>
      </label>
      {pregnant ? (
        <p className="meta" style={{ margin: '2px 2px 4px', color: 'var(--accent)' }}>Your coach is adapting your training for pregnancy — health &amp; function first, and menstrual-cycle tracking is paused. This stays private: it's never shown on your workout titles or descriptions.</p>
      ) : (
        <>
          {icuPhase && (
            <p className="meta" style={{ margin: '2px 2px 8px', color: 'var(--accent)' }}>Read from intervals.icu: currently <b>{icuPhase}</b>{user.cyclePhaseAt ? ` (as of ${user.cyclePhaseAt})` : ''}. Your coach adapts load, recovery &amp; fuelling automatically — no need to enter anything below.</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>Last period start
              <input type="date" className="search" style={{ maxWidth: 160 }} value={start} onChange={(e) => { setStart(e.target.value); save({ cycleStart: e.target.value }) }} />
            </label>
            <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>Cycle length
              <input type="number" inputMode="numeric" min={21} max={40} className="search" style={{ maxWidth: 92, textAlign: 'center' }} value={len} onChange={(e) => { const v = Math.max(21, Math.min(40, Math.round(Number(e.target.value) || 28))); setLen(v); save({ cycleLength: v }) }} />
            </label>
          </div>
          {!icuPhase && (ph
            ? <p className="meta" style={{ margin: '6px 2px 4px', color: 'var(--accent)' }}>~Day {ph.day} · likely <b>{ph.phase}</b> — your coach adapts load, recovery &amp; fuelling for it.</p>
            : <p className="meta" style={{ margin: '6px 2px 4px' }}>Log your period in intervals.icu and it's read automatically. Or enter it here as a fallback, and your coach adapts training to your phase.</p>)}
        </>
      )}
    </div>
  )
}

// #265 — daily fuel targets (BMR→TDEE→calories/protein/macros). Captures the missing inputs (height +
// birth date; sex/weight come from About-you/intervals) and shows the athlete their numbers. The coach
// gets the same targets injected server-side so meal picks match.
const ACT_FOR_DAYS = (d?: number): 'light' | 'moderate' | 'active' | 'athlete' => { const n = Number(d) || 0; return n >= 7 ? 'athlete' : n >= 5 ? 'active' : n >= 3 ? 'moderate' : 'light' }
function FuelFields({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  const info = (user.info || {}) as { heightCm?: number; dob?: string; fuelGoal?: Goal; trainingDays?: number; weight?: number }
  const [heightCm, setHeightCm] = useState<number | ''>(info.heightCm || '')
  const [dob, setDob] = useState(info.dob || '')
  const [goal, setGoal] = useState<Goal>(info.fuelGoal || 'maintain')
  const [weight, setWeight] = useState<number | null>(info.weight ?? null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (user.hasIcuKey) authApi.pullIcuAthlete().then((p) => { if (p.weight) setWeight(p.weight) }).catch(() => {}) }, [user.hasIcuKey])
  const save = (patch: Record<string, unknown>) => { authApi.saveProfile(patch).then(() => { refresh().catch(() => {}); setSaved(true); setTimeout(() => setSaved(false), 1500) }).catch(() => {}) }
  const sex = user.sex as 'male' | 'female' | undefined
  const age = ageFromDob(dob)
  const b = bmr({ sex, weightKg: weight || undefined, heightCm: heightCm || undefined, age: age || undefined })
  const td = tdee(b, { activity: ACT_FOR_DAYS(info.trainingDays) })
  const cal = calorieTarget(td, goal)
  const macros = macroSplit(cal, weight, goal)
  const GOALS: [Goal, string][] = [['lose', 'Lose'], ['maintain', 'Maintain'], ['gain', 'Gain']]
  const need = [!sex && 'sex', !weight && 'weight', !heightCm && 'height', !dob && 'birth date'].filter(Boolean)
  return (
    <div style={{ marginTop: 6 }}>
      <div className="section-title" style={{ fontSize: 13 }}>Daily fuel targets <span className="meta" style={{ fontWeight: 400 }}>· BMR/TDEE{saved ? ' · Saved ✓' : ''}</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>Height (cm)
          {/* #424 — DON'T clamp to min on every keystroke (typing "1" jumped straight to 100 → impossible to build 175).
              Type freely; clamp to [100,230] + save on BLUR. */}
          <input type="number" inputMode="numeric" min={100} max={230} className="search" style={{ maxWidth: 92, textAlign: 'center' }} value={heightCm}
            onChange={(e) => setHeightCm(e.target.value === '' ? '' : Math.round(Number(e.target.value)))}
            onBlur={() => { if (heightCm === '') return; const v = Math.max(100, Math.min(230, Number(heightCm))); setHeightCm(v); save({ heightCm: v }) }} /></label>
        <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>Birth date
          <input type="date" className="search" style={{ maxWidth: 160 }} value={dob} onChange={(e) => { setDob(e.target.value); save({ dob: e.target.value }) }} /></label>
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {GOALS.map(([v, label]) => <button key={v} className={'chip' + (goal === v ? ' chip--active' : '')} onClick={() => { setGoal(v); save({ fuelGoal: v }) }}>{label}</button>)}
      </div>
      {cal && macros
        ? <div className="card" style={{ marginTop: 8, padding: '10px 12px' }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>~{cal} kcal/day <span className="meta" style={{ fontWeight: 400 }}>· {goal === 'maintain' ? 'maintain' : goal === 'lose' ? 'lean cut' : 'lean gain'}</span></div>
            <div className="meta" style={{ marginTop: 3, color: 'var(--text)' }}>Protein <b>{macros.protein} g</b> · Fat <b>{macros.fat} g</b> · Carbs <b>{macros.carbs} g</b></div>
            <div className="meta" style={{ marginTop: 3 }}>BMR ~{b} · TDEE ~{td} kcal ({ACT_FOR_DAYS(info.trainingDays)}). Your coach uses these to pick meals.</div>
          </div>
        : <p className="meta" style={{ margin: '8px 2px 4px' }}>Add {need.join(' + ')} to see your daily calorie + protein targets{need.includes('weight') ? ' (weight comes from intervals)' : ''}.</p>}
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const gaps = dataGaps(user)
  const coachName = useLiveQuery(() => getSetting('coachName'))
  const [coachSaved, setCoachSaved] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)
  const [dietSaved, setDietSaved] = useState(false)
  const [dietSel, setDietSel] = useState<string | null>(null) // #5005 — optimistic: reflect the tap immediately, don't wait for the save+refresh round-trip

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
  const diet = dietSel ?? ((user?.info as { diet?: string } | undefined)?.diet ?? 'no preference') // #5005 — optimistic tap, then the server value
  const setDiet = (v: string) => { setDietSel(v); setSetting('diet', v); authApi.saveProfile({ diet: v }).then(() => refresh()).catch(() => setDietSel(null)); setDietSaved(true); setTimeout(() => setDietSaved(false), 1500) }

  const connected = !!user?.hasIcuKey
  // #337b — per-sport stat inputs + Daniels zones/predictions moved to Stats (single place). Profile
  // keeps only preferences.
  const avatar = user?.avatar
    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
    : (user?.username || '?').slice(0, 2).toUpperCase()

  // #5010 — the avatar was display-only. Tap it → pick a photo → center-crop to a 256px square (JPEG) so it's
  // small enough for the server (<400 KB) and needs no manual zoom → save + refresh.
  const avaRef = useRef<HTMLInputElement>(null)
  const [avaBusy, setAvaBusy] = useState(false)
  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setAvaBusy(true)
    const img = new Image()
    img.onload = () => {
      const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S
      const ctx = c.getContext('2d'); const side = Math.min(img.width, img.height)
      ctx?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S)
      const url = c.toDataURL('image/jpeg', 0.85)
      URL.revokeObjectURL(img.src)
      authApi.saveAvatar(url).then(() => refresh()).catch(() => {}).finally(() => setAvaBusy(false))
    }
    img.onerror = () => setAvaBusy(false)
    img.src = URL.createObjectURL(f)
  }

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
          <button className="acct__avatar acct__avatar--lg" onClick={() => avaRef.current?.click()} title="Change photo" style={{ border: 'none', padding: 0, cursor: 'pointer', position: 'relative', overflow: 'visible' }}>{avatar}<span style={{ position: 'absolute', right: -3, bottom: -3, fontSize: 11, background: 'var(--accent)', color: '#08130b', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{avaBusy ? '…' : '📷'}</span></button>
          <input ref={avaRef} type="file" accept="image/*" onChange={onAvatarFile} style={{ display: 'none' }} />
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

      {/* #329 — optional cycle tracking → the coach adapts load/recovery by phase (uses intervals' phase
          first; this is the fallback + for those not syncing it). Only shown for female athletes. */}
      {user?.sex === 'female' && <CycleFields user={user} refresh={refresh} />}

      {/* #341/#268 — location for weather-aware coaching + local time (bi-directionally synced w/ intervals) */}
      <LocationField />

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

      {/* #265 — daily fuel targets (BMR/TDEE/protein) from sex+weight+height+age */}
      <FuelFields user={user!} refresh={refresh} />

      {/* #337b — Profile is PREFERENCES. Your benchmarks (VO₂max, FTP, threshold pace, zones, predictions)
          live in ONE place — Stats — with the Manual/Auto/Computed picker. No duplicate UX here. */}
      <div className="section-title" id="ob-numbers">Your data</div>
      <Link to="/stats" className="btn btn--ghost" style={{ marginBottom: 8 }}>📊 Benchmarks, VO₂max, zones & trends — open Stats ›</Link>
      {/* #235 — turn the readiness self-learning on/off */}
      <label className="toggle-row">
        <span className="toggle-row__t"><b>Learn from my check-ins</b><span className="meta">Auto-adapt your Sleep/Freshness/Energy scores toward how you actually rate them over time.</span></span>
        <input type="checkbox" className="toggle-row__cb" checked={user?.learnReadiness !== false} onChange={(e) => authApi.saveProfile({ learnReadiness: e.target.checked }).then(() => refresh()).catch(() => {})} />
      </label>

      {/* #457 — phone push notifications (per-type) */}
      <NotificationsSettings />

    </div>
  )
}
