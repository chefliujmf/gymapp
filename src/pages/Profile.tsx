import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { REQUIRED_FIELDS, requiredProfileGaps } from '../profile-fields'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'
import { authApi, type User } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import Availability from '../Availability'
import EquipmentPicker from '../EquipmentPicker'
import CoachKnowledge from '../CoachKnowledge'
import OnboardReturnBar from '../OnboardReturnBar'
import { fetchAthleteSex } from '../intervals'
import { dataGaps } from '../dataGaps'

// #491 — Meditation (Mind) removed from the picker while Eat/Mind are deactivated. Yoga/Pilates STAY (they're
// logged physical activities that count for the day dot). To restore Mind: re-add ['meditation', 'Meditation'].
// #JM 2026-07-15 — Yoga + Pilates removed from the selectable sports for now (nothing can be added to the calendar for
// them yet) → parked for the roadmap. Existing users who had them keep the data; they just can't newly pick them.
const SPORTS: [string, string][] = [['cycling', 'Cycling'], ['running', 'Running'], ['swimming', 'Swimming'], ['triathlon', 'Triathlon'], ['strength', 'Strength']]


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
  const info = (user.info || {}) as { cycleStart?: string; cycleLength?: number; pregnant?: boolean; postpartumSince?: string; trimester?: number; dueDate?: string }
  const [start, setStart] = useState(info.cycleStart || '')
  const [len, setLen] = useState<number>(info.cycleLength || 28)
  const [ppSince, setPpSince] = useState(info.postpartumSince || '') // #631 — recent birth date → graded return
  const [due, setDue] = useState(info.dueDate || '') // #759/#4 — optional exact due date
  const [saved, setSaved] = useState(false)
  const save = (patch: { cycleStart?: string; cycleLength?: number; pregnant?: boolean; postpartumSince?: string; trimester?: number; dueDate?: string }) => { authApi.saveProfile(patch).then(() => { refresh().catch(() => {}); setSaved(true); setTimeout(() => setSaved(false), 1500) }).catch(() => {}) }
  const pregnant = !!info.pregnant
  const tri = Number(info.trimester) || 0
  const ph = cyclePhaseOf(start, len)
  // #422 — if intervals wellness already gives us the phase (she logs her period there), SHOW it and
  // don't prompt her to re-enter. Manual fields stay as a fallback for athletes who don't log it.
  const icuPhase = user.cyclePhase ? String(user.cyclePhase).replace(/_/g, ' ') : null
  return (
    <div style={{ marginTop: 6 }} id="ob-cycle">
      <div className="section-title" style={{ fontSize: 13 }}>Cycle &amp; pregnancy <span className="meta" style={{ fontWeight: 400 }}>· optional{saved ? ' · Saved ✓' : ''}</span></div>
      {/* #427 — Pregnant toggle: switches the coach to pregnancy mode + pauses menstrual-cycle tracking. Private (never shown on workouts). */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '2px 2px 8px' }}>
        <input type="checkbox" checked={pregnant} onChange={(e) => save({ pregnant: e.target.checked })} style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
        <span style={{ color: 'var(--text)', fontSize: 14 }}>Pregnant</span>
      </label>
      {pregnant ? (
        <>
          <p className="meta" style={{ margin: '2px 2px 8px', color: 'var(--accent)' }}>Your coach is adapting your training for pregnancy — health &amp; function first, and menstrual-cycle tracking is paused. This stays private: it's never shown on your workout titles or descriptions.</p>
          {/* #759/#4 — OPTIONAL, low-disclosure stage. You're never required to share a date; pick a trimester (or add a date) only to fine-tune. Default without either = the gentlest, safest envelope. */}
          <div className="meta" style={{ margin: '0 2px 6px' }}>Which trimester? <span style={{ fontWeight: 400 }}>Optional — helps tailor the plan. Skip it and your coach keeps you in the gentlest, safest range. Always private.</span></div>
          <div className="chips" style={{ margin: '0 2px 8px' }}>
            {([[1, '1st'], [2, '2nd'], [3, '3rd']] as [number, string][]).map(([v, label]) => (
              <button key={v} className={'chip' + (tri === v ? ' chip--active' : '')} onClick={() => save({ trimester: tri === v ? 0 : v })}>{label} trimester</button>
            ))}
          </div>
          <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '0 2px 4px' }}>Or an exact due date <span style={{ fontWeight: 400 }}>(optional — most precise; private)</span>
            <input type="date" className="search" style={{ maxWidth: 160 }} value={due} onChange={(e) => { setDue(e.target.value); save({ dueDate: e.target.value }) }} />
          </label>
        </>
      ) : (
        <>
          {icuPhase && (
            <p className="meta" style={{ margin: '2px 2px 8px', color: 'var(--accent)' }}>Read from intervals.icu: currently <b>{icuPhase}</b>{user.cyclePhaseAt ? ` (as of ${user.cyclePhaseAt})` : ''}. Your coach adapts load, recovery &amp; fuelling automatically — no need to enter anything below.</p>
          )}
          {/* #631 — postpartum: a graded return (maintenance → build over ~12 weeks), pelvic-floor first. Private. */}
          <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '0 2px 8px' }}>Recently gave birth? <span style={{ fontWeight: 400 }}>(date — your coach ramps you back gradually, pelvic-floor first; clear it once you're back to full training)</span>
            <input type="date" className="search" style={{ maxWidth: 160 }} value={ppSince} onChange={(e) => { setPpSince(e.target.value); save({ postpartumSince: e.target.value }) }} />
          </label>
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

// #265 / #505(roadmap) — capture the athlete's HEIGHT + BIRTH DATE (used for age-based training stats like an
// age max-HR and VO₂max; they also sync from intervals). The calorie/macro fuel TARGETS were REMOVED 2026-07-13
// (JM: "too complicated" — Eat is deactivated so the coach can't use them to plan, and showing a weight-loss cut
// is wrong, especially during pregnancy). The engine (src/nutrition.ts) is kept for the parked roadmap item #505.
function FuelFields({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  const info = (user.info || {}) as { heightCm?: number; dob?: string }
  const [heightCm, setHeightCm] = useState<number | ''>(info.heightCm || '')
  const [dob, setDob] = useState(info.dob || '')
  const [saved, setSaved] = useState(false)
  const save = (patch: Record<string, unknown>) => { authApi.saveProfile(patch).then(() => { refresh().catch(() => {}); setSaved(true); setTimeout(() => setSaved(false), 1500) }).catch(() => {}) }
  return (
    <div style={{ marginTop: 6 }}>
      <div className="section-title" style={{ fontSize: 13 }}>Height & birth date <span className="meta" style={{ fontWeight: 400 }}>· for your training stats{saved ? ' · Saved ✓' : ''}</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>Height (cm)
          {/* #424 — type freely; clamp to [100,230] + save on BLUR (clamping per keystroke made 175 impossible to type). */}
          <input type="number" inputMode="numeric" min={100} max={230} className="search" style={{ maxWidth: 92, textAlign: 'center' }} value={heightCm}
            onChange={(e) => setHeightCm(e.target.value === '' ? '' : Math.round(Number(e.target.value)))}
            onBlur={() => { if (heightCm === '') return; const v = Math.max(100, Math.min(230, Number(heightCm))); setHeightCm(v); save({ heightCm: v }) }} /></label>
        <label className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>Birth date
          <input type="date" className="search" style={{ maxWidth: 160 }} value={dob} onChange={(e) => { setDob(e.target.value); save({ dob: e.target.value }) }} /></label>
      </div>
      <p className="meta" style={{ margin: '6px 2px 0' }}>Used to personalise your training stats — e.g. an age-based max HR when you haven't hit a real one. These also sync from intervals when it's connected.</p>
    </div>
  )
}

// #759 (audit — Profile flow) — the 5 gate basics were scattered across positions 6/8/9/10/13. Group them into ONE
// "The basics" card at the TOP, in identity → sport → goal → availability order, each with a ✓/Add cue that deep-links to
// its exact section below (the real edit surface stays; this is the overview + prominence the audit asked for). When
// everything's set it stays as a compact all-✓ card so a returning user sees "basics done" at a glance.
function ProfileBasics({ user }: { user: User | null | undefined }) {
  const gaps = new Set(requiredProfileGaps(user))
  const info = (user?.info || {}) as Record<string, unknown>
  const left = gaps.size
  const val = (k: string): string => {
    if (k === 'sex') return user?.sex === 'female' ? 'Female' : user?.sex === 'male' ? 'Male' : ''
    if (k === 'dob') return String(info.dob || '')
    if (k === 'mainSport') { const s = String(info.mainSport || (Array.isArray(user?.sports) ? user!.sports![0] : '') || ''); return s ? s[0].toUpperCase() + s.slice(1) : '' }
    if (k === 'trainingDays') return info.trainingDays ? `${info.trainingDays} days / week` : ''
    if (k === 'goal') { const g = (info.goals || {}) as { focus?: string; notes?: string }; return (g.notes || g.focus || (user as { coachProfile?: string } | undefined)?.coachProfile || '').slice(0, 60) }
    return ''
  }
  return (
    <div className={'card pbasics' + (left ? ' pbasics--todo' : '')}>
      <div className="pbasics__head"><b>The basics</b><span className={'pbasics__pill' + (left ? '' : ' done')}>{left ? 'needed for your plan' : 'complete ✓'}</span></div>
      <p className="pbasics__sub">Your coach scales dose, zones &amp; load from these. Everything below is optional.</p>
      {REQUIRED_FIELDS.map((f) => {
        const missing = gaps.has(f.key)
        return (
          <Link key={f.key} to={'/profile' + (f.section ? `#${f.section}` : '')} className={'pbasics__row' + (missing ? ' miss' : '')}>
            <span className="pbasics__ic">{f.icon}</span>
            <span className="pbasics__b"><b>{f.label}</b><span>{missing ? f.hint : val(f.key)}</span></span>
            {missing ? <span className="pbasics__add">Add ›</span> : <span className="pbasics__chk">✓</span>}
          </Link>
        )
      })}
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const gaps = dataGaps(user)
  // #742/#759 — a deep-link like /profile#ob-sport (from the "finish your profile" pointer or a nudge) must land ON that
  // section, not the page top. Scroll the hash target into view once the page has painted.
  useEffect(() => {
    const id = window.location.hash?.replace('#', '')
    if (!id) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // #1002 (JM: "my coach name under profile was removed") — the field read ONLY the device-local cache, so a cleared/
  // other/synced-late browser showed BLANK though the server still holds it (JM's is "Tadej"). Fall back to the SERVER
  // value (`user.coachName`, the source of truth) whenever the local cache is empty — the name can never look "removed".
  const localCoachName = useLiveQuery(() => getSetting('coachName'))
  const coachName = localCoachName ?? user?.coachName ?? ''
  const [coachSaved, setCoachSaved] = useState(false)
  const [sportSaved, setSportSaved] = useState(false)

  // Sex from intervals (gates the female-athlete coaching module) — optional.
  useEffect(() => {
    if (user && !user.sex && user.hasIcuKey) fetchAthleteSex().then((s) => { if (s) authApi.saveProfile({ sex: s }).then(() => refresh()).catch(() => {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sex, user?.hasIcuKey])

  // #570 — Triathlon is an umbrella: picking it auto-selects swim+bike+run and stars it as the main sport; they stay
  // selected while it's on (deselecting a discipline drops triathlon too — you can't be a triathlete without all 3).
  const toggleSport = (v: string) => {
    const cur = user?.sports || []
    const TRI = ['swimming', 'cycling', 'running']
    const curMain = (user?.info as { mainSport?: string } | undefined)?.mainSport
    let next: string[]
    const extra: Record<string, unknown> = {}
    if (v === 'triathlon') {
      if (cur.includes('triathlon')) { next = cur.filter((x) => x !== 'triathlon'); if (curMain === 'triathlon') extra.mainSport = '' } // keep the 3 disciplines; user can remove individually
      else { next = Array.from(new Set([...cur, 'triathlon', ...TRI])); extra.mainSport = 'triathlon' } // add tri + all 3, star it
    } else if (cur.includes('triathlon') && TRI.includes(v) && cur.includes(v)) {
      next = cur.filter((x) => x !== v && x !== 'triathlon'); if (curMain === 'triathlon') extra.mainSport = '' // can't drop one leg of a triathlon → drop the umbrella too
    } else {
      next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    }
    authApi.saveProfile({ sports: next, ...extra }).then(() => { refresh(); setSportSaved(true); setTimeout(() => setSportSaved(false), 1500) }).catch(() => {})
  }

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
  // #534 — the (optional, single) MAIN sport. Tap the current ★ again to clear it (empty string → no main).
  const mainSport = (user?.info as { mainSport?: string } | undefined)?.mainSport
  const setMain = (v: string) => { authApi.saveProfile({ mainSport: mainSport === v ? '' : v }).then(() => refresh()).catch(() => {}) }

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

      {/* #759 (audit) — the 5 required basics, grouped + FIRST, each deep-linking to its exact section below. */}
      <ProfileBasics user={user} />

      {/* Unlock nudge — turn missing-data dead-ends into a clear to-do (dataGaps.ts) */}
      {gaps.length > 0 && (
        <div className="card gapcard">
          <div className="gapcard__h">⚡ Unlock more from your data</div>
          {gaps.map((g) => (
            <div key={g.key} className="gapcard__row"><b>{g.label}</b><span> → {g.unlocks}</span></div>
          ))}
          <div className="gapcard__hint">Each opens where you set it{!user?.hasIcuKey ? ' — connecting intervals.icu in Settings fills most automatically' : ''}.</div>
        </div>
      )}


      <div className="section-title" id="ob-coach">Your coach {coachSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <input
        className="search" placeholder="e.g. Tadej" value={coachName ?? ''}
        onChange={(e) => { setSetting('coachName', e.target.value); setCoachSaved(false) }}
        onBlur={(e) => { authApi.saveProfile({ coachName: e.target.value.trim() }).then(() => { setCoachSaved(true); setTimeout(() => setCoachSaved(false), 2500) }).catch(() => {}) }}
      />
      <p className="meta" style={{ margin: '6px 2px 4px' }}>What your coach goes by in chat — saved when you tap away.</p>

      {/* #521 — grouped coach-facing card: goal selections + coach-notes narrative (coachProfile) + learning toggle */}
      <CoachKnowledge />

      <div className="section-title">⚙️ Setup &amp; about you</div>
      <div className="section-title" id="ob-sport" style={{ marginTop: 6 }}>Sports you do {sportSaved && <span className="meta" style={{ fontWeight: 400 }}>· Saved ✓</span>}</div>
      <div className="chips">
        {SPORTS.map(([v, label]) => {
          const on = does(v)
          const multi = (user?.sports || []).length >= 2
          const isMain = mainSport === v
          return (
            // #534 (A5) — a right-side ★ marks the MAIN sport (optional, exactly one). Tap the label to
            // select the sport; tap ☆ to set it main; tap the current ★ again to clear (back to no main).
            <span key={v} className={'chip' + (on ? ' chip--active' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <span onClick={() => toggleSport(v)}>{label}</span>
              {on && multi && <span role="button" aria-label={isMain ? 'Main sport — tap to clear' : `Set ${label} as main sport`} title={isMain ? 'Main sport — tap to clear' : 'Set as main sport'} onClick={(e) => { e.stopPropagation(); setMain(v) }} style={{ fontSize: 15, lineHeight: 1, cursor: 'pointer', color: isMain ? '#ffd24a' : 'rgba(6,32,18,.5)' }}>{isMain ? '★' : '☆'}</span>}
            </span>
          )
        })}
      </div>
      <p className="meta" style={{ margin: '6px 2px 4px' }}>Pick all that apply — tunes your nav & coach.{(user?.sports || []).length >= 2 ? <> Tap <b style={{ color: '#ffd24a' }}>★</b> to set your <b>main sport</b> (optional) — your coach prioritizes it and dials the others to support it.</> : ' Cycling/Running unlock the endurance method & Fitness page.'}</p>

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

      {/* #524 — height + birth date + diet live WITH "About you" (who you are), not scattered lower. */}
      <FuelFields user={user!} refresh={refresh} />

      {/* #688 — Diet section removed (Eat is deactivated, won't be used). */}

      {/* #329 — optional cycle tracking → the coach adapts load/recovery by phase (uses intervals' phase
          first; this is the fallback + for those not syncing it). Only shown for female athletes. */}
      {user?.sex === 'female' && <CycleFields user={user} refresh={refresh} />}

      {/* #341/#268 — location for weather-aware coaching + local time (bi-directionally synced w/ intervals) */}
      <LocationField />

      <Availability />{/* #ob-avail anchor is on Availability's own section-title */}

      {/* #320 — equipment is a coaching input (like sports/diet), so it lives here on Profile, not Settings. */}
      <EquipmentPicker />

      {/* #521 — goals + coach-notes + learn-from-check-ins moved UP into the CoachKnowledge card.
          Benchmarks (VO₂max, FTP, threshold pace, zones) still live in ONE place — Stats (#337b). */}
      {/* #511 — Notifications moved to Settings → Notifications (JM 2026-07-14). */}

    </div>
  )
}
