import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, listTemplates, listRideTemplates, type WorkoutTemplate, type RideTemplate } from '../db'
import { WeekStrip, MiniProfile, DoneStats } from '../ui'
import { fetchEvents, deleteEvent, eventObjective, sportOf, flattenIcuSteps, fetchActivities, fetchActivityStreams, sportOfActivity, type IcuEvent, type IcuActivity } from '../intervals'
import { PowerBlocks, ZoneBlocks } from '../charts'
import { incompleteFeedback } from '../feedbackGaps' // #387 — surface the "to review" count on Today
import { addDays } from '../move-dates' // #758 — horizon end for the "rest-by-default" empty day
import { useAuth } from '../auth/AuthContext' // #review-skip — exclude skipped sessions from the count
import ProfileGate from '../ProfileGate' // #A — gate the plan on a complete profile
import { requiredProfileGaps } from '../profile-fields'
import { setPlanEvents, fetchGymPlans, syncIcuPlans, gymSessionFromPlan, setGymSession, setCoachPlans, type CoachPlan } from '../plan'
import { setCurrentRide } from '../ride'
import { calApi, type CalItem } from '../calendar'
import { recipes, mindSessions } from '../data/catalog'
import type { Recipe } from '../types'
import { localISO } from '../date'
import { Bike, Dumbbell, Footprints, Waves, Target, Salad, Brain, StickyNote, Plus, Check, Flag } from 'lucide-react'
import { EntryMenu } from '../EntryMenu'
import { AddSheet } from './AddSheet'
import { authApi, type Checkin, type Readiness } from '../auth/api'
import { InfoDot } from '../charts'
import SetupChecklist from '../SetupChecklist'
import PushNudge from '../PushNudge'

// Obvious + funny 1–5 faces (wrecked → amazing). One set for every metric since
// all now read higher = better.
const CHECKIN_FACES = ['💀', '😩', '😐', '😀', '🤩']

/** Quick "how do you feel" check-in (energy/sleep/soreness) — a few taps, feeds the coach. */
export function CheckInCard({ day, onChange, compact = false }: { day: string; onChange?: (ci: Checkin | null) => void; compact?: boolean }) { // #488 compact = one-line strip for Plan's week/month/schedule
  const isToday = day === localISO()
  const [ci, setCi] = useState<Checkin | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(false); authApi.checkins(day, day).then((a) => setCi(a[0] || null)).catch(() => {}).finally(() => setLoaded(true)) }, [day])
  useEffect(() => { onChange?.(ci) }, [ci]) // keep the parent (readiness verdict banner) in sync
  const set = (patch: Partial<Checkin>) => {
    const next = { ...(ci || { date: day }), ...patch } as Checkin
    setCi(next)
    // #207 Phase 2b: stamp the auto score shown (display terms) so a real override reads as "edited".
    // PRESERVE each row's existing stamp — only fill a MISSING one from the current derive. Re-stamping
    // every row on each save made an unedited row falsely read "edited" when its auto-derive later
    // drifted (e.g. Freshness 3→5 after the baselines change). JM 2026-07-01.
    const prev = ci?.auto || {}
    const freshNow = calc.soreness != null ? 6 - calc.soreness : undefined
    const auto = {
      energy: prev.energy ?? calc.energy,
      sleep: prev.sleep ?? calc.sleep,
      freshness: prev.freshness ?? freshNow,
    }
    const hasAuto = auto.energy != null || auto.sleep != null || auto.freshness != null
    authApi.checkin(hasAuto ? { ...next, auto } : next).catch(() => {})
  }
  const [editing, setEditing] = useState(false)
  // #195: auto-derive Sleep·Freshness·Energy (1–5) from intervals wellness + personal baselines
  // (server/readiness.js, WHOOP-inspired). Each unanswered row prefills from data + an ⓘ "why";
  // tapping a face overrides. Energy is null on cold start → stays a manual tap. #74 chips below.
  const [rdy, setRdy] = useState<Readiness | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  // #354: derive readiness for the SELECTED day, not just today — a past day (e.g. Jul 3) with a
  // check-in / wellness in intervals must still show its Energy·Sleep·Freshness (JM: "the feedback was
  // there"). The endpoint computes it for any date from that day's wellness + prior baselines. (Future
  // days never mount this card — they show a forecast instead.)
  useEffect(() => { let live = true; setRdy(null); setTouched(new Set()); authApi.readiness(day).then((r) => { if (live) setRdy(r) }).catch(() => {}); return () => { live = false } }, [day])
  // #206: overnight HRV/sleep lands in intervals HOURS late (Coros→intervals lag), so a morning check shows none yet.
  // We re-pull AUTOMATICALLY on app focus/visibility so a later sync appears without a reload. #725 (JM) — the manual
  // ⟳ button was REMOVED: we control the integration and don't want it overused (the auto-refresh + daily pass cover it).
  useEffect(() => {
    if (!isToday) return
    const onVis = () => { if (document.visibilityState === 'visible') authApi.readiness(day).then(setRdy).catch(() => {}) }
    window.addEventListener('focus', onVis); document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', onVis); document.removeEventListener('visibilitychange', onVis) }
  }, [day, isToday])
  // Per-day "why" for the ⓘ — the ACTUAL inputs behind THIS day's score (computed from the
  // wellness data whether or not the row is answered), + the value the data suggests.
  const sgn = (z?: number | null) => (z == null ? '?' : (z > 0 ? '+' : '') + z + 'σ')
  const why: Partial<Record<'energy' | 'sleep' | 'soreness', string>> = {}
  const calc: Partial<Record<'energy' | 'sleep' | 'soreness', number>> = {}
  if (rdy?.connected) {
    if (rdy.sleep) {
      calc.sleep = Math.round(rdy.sleep.score)
      // #159 — lead with the ACTIONABLE basis (hours slept vs your need), THEN the tracker score if any.
      // (Was: only the bare "tracker scored 75/100" when a score existed, which hid the real why.)
      const sp: string[] = []
      if (rdy.sleep.sleepHours != null) sp.push(`${rdy.sleep.sleepHours}h slept vs your ~${rdy.sleepNeed}h need`)
      if (rdy.sleep.sleepScore != null) sp.push(`tracker sleep score ${rdy.sleep.sleepScore}/100`)
      why.sleep = sp.join(' · ') || 'from your check-in'
    }
    if (rdy.energy) { calc.energy = Math.round(rdy.energy.score)
      // #373 — show the ACTUAL numbers: today's HRV/RHR vs the athlete's own known min–max range
      // (falls back to the ± z-score sense until there's enough history for a range).
      const t = rdy.today, b = rdy.baseline
      const hrvTxt = t?.hrv != null && b?.hrvMin != null && b?.hrvMax != null
        ? `HRV ${Math.round(t.hrv)} ms (your range ${b.hrvMin}–${b.hrvMax})`
        : `HRV ${sgn(rdy.energy.hrvZ)} vs your baseline`
      const rhrTxt = t?.restingHR != null && b?.rhrMin != null && b?.rhrMax != null
        ? `resting HR ${Math.round(t.restingHR)} (range ${b.rhrMin}–${b.rhrMax})`
        : `resting HR ${sgn(rdy.energy.rhrZ)}`
      why.energy = rdy.energy.provisional
        ? `first estimate from today's HRV, sleep ${rdy.sleep?.score ?? '—'}/5 & resting HR — I'm still learning your personal baseline (~${rdy.energy.needDays ?? 14} more nights to personalise)`
        : `${hrvTxt}, sleep ${rdy.sleep?.score ?? '—'}/5, ${rhrTxt}${rdy.energy.guard ? ' (HRV high but RHR raised → eased)' : ''}` }
    if (rdy.freshness) {
      calc.soreness = 6 - Math.round(rdy.freshness.score)
      const pz = rdy.freshness.personalZ
      const vsYou = pz == null ? '' : `, ${pz < -0.5 ? 'more loaded than your usual' : pz > 0.5 ? 'fresher than your usual' : 'about your usual'}`
      // #536 — show the RAW training-load numbers with SIGN + a plain word, so a healthy Form (+1) can't be
      // misread as a "1 = wrecked" rating. Form is CTL−ATL (fitness minus fatigue): + = fresh, − = carrying load.
      const tsb = rdy.freshness.tsb, acwr = rdy.freshness.acwr
      const formTxt = tsb == null ? 'Form —' : `Form ${tsb > 0 ? '+' : ''}${tsb} (${tsb >= -5 ? 'fresh' : tsb >= -15 ? 'building load' : 'carrying fatigue'})`
      const acwrTxt = acwr == null ? '' : `, load ratio ${acwr} (${acwr < 0.8 ? 'well rested' : acwr <= 1.3 ? 'balanced' : 'ramping hard'})`
      why.soreness = `training load — ${formTxt}${acwrTxt}${vsYou}`
    }
  }
  // Auto-fill any UNANSWERED row from the data-derived value; tapping a face overrides.
  // NOTE (#536 revert): do NOT live-mutate an ALREADY-answered row here. That re-wrote the stored value on an
  // async race with a stale `ci` closure, desyncing value vs ci.auto → a row the athlete never touched showed
  // "edited" (violated the #207 rule: compare stored value vs stored auto, never the live recompute).
  useEffect(() => {
    if (!loaded || !rdy?.connected) return
    const fill: Partial<Checkin> = {}
    for (const k of ['energy', 'sleep', 'soreness'] as const) if (ci?.[k] == null && calc[k] != null) fill[k] = calc[k]
    // #15 (audit) — only PRE-FILL the display with the derived values; do NOT persist a check-in the athlete never
    // touched (that auto-"completed" check-in was firing the coach's daily-adapt as if they'd actually checked in).
    // The real save happens on their first tap (set() below). If they already have a saved check-in, leave it.
    if (Object.keys(fill).length && !ci) setCi((c) => ({ ...(c || { date: day }), ...fill } as Checkin))
  }, [loaded, rdy]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!loaded) return null
  // Emoji faces, 1–5, ALWAYS visible (JM: must not be hidden or it gets skipped).
  // Consistent direction: best feeling is always the RIGHT face. Soreness is shown
  // as "Freshness" (5 = fresh) so it reads like the others; `invert` converts to the
  // stored soreness value (5 = very sore) the coach reads — display flips, scale doesn't.
  const rows: { key: 'energy' | 'sleep' | 'soreness'; label: string; desc: string; scale: string; invert?: boolean }[] = [
    { key: 'energy', label: 'Energy', desc: 'How ready your body is to train right now', scale: '1 = wiped out · 5 = full of energy' },
    { key: 'sleep', label: 'Sleep', desc: 'How well last night recovered you', scale: '1 = terrible · 5 = perfect rest' },
    { key: 'soreness', label: 'Freshness', desc: 'How recovered you are from training load', scale: '1 = wrecked / very sore · 5 = fresh & recovered', invert: true },
  ]
  // ⓘ text: the per-day WHY (today's actual inputs) on top, then the scale. Falls back to a
  // clear "no data yet" note so the ⓘ is never just a definition.
  const disp = (r: typeof rows[number]) => { const v = ci?.[r.key]; return v == null ? null : (r.invert ? 6 - v : v) }
  // The auto value RECORDED when this check-in was shown (display terms; #207 Phase 2b stores ci.auto
  // as {energy,sleep,freshness}). Compare against THIS, not the live recompute — otherwise a later
  // drift in the model (calibration / recalibration / new wellness data) falsely reads as "edited".
  const autoDisp = (r: typeof rows[number]) => { const a = ci?.auto; if (!a) return null; const v = r.key === 'soreness' ? a.freshness : a[r.key]; return v ?? null }
  const overridden = (r: typeof rows[number]) => { const a = autoDisp(r), s = disp(r); return a != null && s != null && a !== s }
  // #207 Phase 2b: the learned personal-calibration offset for this row (Freshness lives on 'soreness').
  const calOff = (r: typeof rows[number]) => rdy?.calibration?.[r.key === 'soreness' ? 'freshness' : r.key] ?? 0
  const infoFor = (r: typeof rows[number]) => {
    const head = why[r.key]
      ? `Why ${isToday ? 'today' : 'this day'}: ${why[r.key]}.`
      : `No HRV/sleep synced for ${isToday ? 'today' : 'this day'} yet — this is your own read.`
    const delta = overridden(r) ? `\n\nAuto computed ${autoDisp(r)} · you set ${disp(r)}.` : ''
    const off = calOff(r)
    const tuned = off ? `\n\nTuned to you: nudged ${off > 0 ? '+' : ''}${off} because you've consistently rated this ${off > 0 ? 'higher' : 'lower'} than the model.` : ''
    return `${head}${delta}${tuned}\n\n${r.scale}.`
  }
  // "· auto" while the shown value still equals the auto value RECORDED when filled (untouched).
  const isAuto = (r: typeof rows[number]) => !touched.has(r.key) && autoDisp(r) != null && disp(r) === autoDisp(r)
  // Collapse to a one-line summary ONCE all 3 are logged (collapse-after-done is fine —
  // it's collapse-before-filling that gets skipped). Tap Edit to change; History → Logs.
  const verdict = readinessVerdict(ci)
  const vLabel = verdict ? (verdict.tone === 'good' ? 'Fresh' : verdict.tone === 'low' ? 'Run-down' : 'Moderate') : ''
  const checkedIn = rows.every((r) => ci?.[r.key] != null)
  // #488 — compact one-line strip for Plan's week/month/schedule (the FULL card only shows in Day). Tap → edit.
  if (compact && !editing) {
    if (!checkedIn) return <button className="checkin-strip checkin-strip--todo" onClick={() => setEditing(true)}>💬 Check in today<span className="checkin-strip__go">›</span></button>
    return (
      <button className="checkin-strip" onClick={() => setEditing(true)}>
        <span className="checkin-strip__ok">✓ Checked in</span>
        {verdict && <span className={'checkin__verdict checkin__verdict--' + verdict.tone}><span className="checkin__vdot" />{vLabel}</span>}
        <span className="checkin-strip__sc">{rows.map((r) => `${CHECKIN_FACES[(disp(r) as number) - 1]}${disp(r)}`).join(' · ')}</span>
        <span className="checkin-strip__go">Edit ›</span>
      </button>
    )
  }
  if (checkedIn && !editing) {
    return (
      <div className="card checkin checkin--mini">
        <div className="checkin__mhead">
          <span className="checkin__done">✓ Checked in{isToday ? ' today' : ''}{verdict && <span className={'checkin__verdict checkin__verdict--' + verdict.tone}><span className="checkin__vdot" />{vLabel}</span>}</span>
          <button className="checkin__edit" style={{ flex: 'none' }} onClick={() => setEditing(true)}>Edit</button>
        </div>
        <div className="checkin__chips">
          {rows.map((r) => { const v = disp(r) as number; const a = autoDisp(r); const over = overridden(r); return (
            <span key={r.key} className={`mchip mchip--${r.key}${over ? ' mchip--over' : ''}`}>{CHECKIN_FACES[v - 1]} {r.label} {v}{over && <span className="mchip__auto"> · edited (auto {a})</span>} <InfoDot text={infoFor(r)} /></span>
          ) })}
        </div>
        {verdict && (
          <div className="checkin__coach">💬 Your coach has {isToday ? "today's" : 'this'} check-in</div>
        )}
      </div>
    )
  }
  return (
    <div className="card checkin checkin--tight">
      <div className="checkin__t" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>How {isToday ? 'do' : 'did'} you feel{isToday ? ' today' : ''}?{editing && <button className="checkin__edit" onClick={() => setEditing(false)}>Done ✓</button>}</div>
      {rows.map((r) => (
        <div key={r.key} className="checkin__row2">
          <span className="checkin__lbl">{r.label} <InfoDot text={infoFor(r)} />{isAuto(r) ? <span className="checkin__src"> · auto</span> : overridden(r) ? <span className="checkin__src checkin__src--edit"> · edited <span className="checkin__autowas">(auto {autoDisp(r)})</span></span> : null}{calOff(r) ? <span className="checkin__tuned" title="Personalised from your past ratings"> · tuned to you</span> : null}<span className="checkin__desc">{r.desc}</span></span>
          <div className="checkin__faces">
            {[1, 2, 3, 4, 5].map((n) => {
              const stored = r.invert ? 6 - n : n, on = ci?.[r.key] === stored
              return <button key={n} className={'checkin__face' + (on ? ' on' : '')} aria-label={`${r.label} ${n} of 5`} aria-pressed={on} onClick={() => { setTouched((t) => new Set(t).add(r.key)); set({ [r.key]: stored }) }}>{CHECKIN_FACES[n - 1]}</button>
            })}
          </div>
        </div>
      ))}
      {/* #354 — show the wellness source for ANY day (was today-only), so a blank past-day check-in
          EXPLAINS itself (data not synced / not recorded) instead of looking broken. Refresh stays today-only. */}
      {rdy?.connected && (
        <div className="checkin__wchips">
          {rdy.today?.sleepHours != null && <span className="wchip">😴 {rdy.today.sleepHours}h</span>}
          {rdy.today?.hrv != null && <span className="wchip">HRV {Math.round(rdy.today.hrv)}</span>}
          {rdy.today?.restingHR != null && <span className="wchip">Rest HR {Math.round(rdy.today.restingHR)}</span>}
          {(rdy.today?.hrv != null || rdy.today?.restingHR != null || rdy.today?.sleepHours != null)
            ? <span className="wchip wchip--src" title="These values come from intervals.icu"><span className="wchip__up" aria-hidden="true">↑</span> intervals</span>
            : <span className="wchip wchip--wait">{isToday ? 'HRV/sleep not synced yet — auto-fills once your watch syncs' : 'No HRV/sleep for this day — scores are your own read'}</span>}
        </div>
      )}
    </div>
  )
}

// #223 — FUTURE day: no check-in / no live verdict (you can't know how you'll feel). Show an
// EXPECTED freshness forecast projected from planned load. Only Freshness is forecastable;
// Energy & Sleep fill in from that day's check-in.
const FORECAST_FACES = ['💀', '😖', '😐', '🙂', '😎']
const freshLabel = (s: number) => s >= 4.3 ? 'Likely fresh' : s >= 3.4 ? 'Likely fresh enough' : s >= 2.5 ? 'Moderately recovered' : s >= 1.6 ? 'Likely fatigued' : 'Likely wrecked'
function ForecastCard({ day, rev = 0, fmtDay }: { day: string; rev?: number; fmtDay: (s: string) => string }) {
  const [f, setF] = useState<Awaited<ReturnType<typeof authApi.readinessForecast>> | null>(null)
  const [loaded, setLoaded] = useState(false)
  // #595 — re-fetch on `day` AND `rev` (plan/activity reload) so the forecast tracks plan changes + completions.
  useEffect(() => { let live = true; authApi.readinessForecast(day).then((r) => { if (live) { setF(r); setLoaded(true) } }).catch(() => { if (live) setLoaded(true) }); return () => { live = false } }, [day, rev])
  if (!loaded) return null
  if (!f?.connected) return <div className="card forecast forecast--muted">📊 Connect intervals.icu to forecast how recovered you'll be on {fmtDay(day)}.</div>
  if (!f.available || f.freshness == null) return <div className="card forecast forecast--muted">📊 Not enough training data yet to forecast {fmtDay(day)}.</div>
  const s = f.freshness
  const load = f.totalPlannedLoad || 0
  const why = load > 0
    ? `${load} TSS planned between now and then${(f.plannedDays || 0) > 0 ? ` across ${f.plannedDays} session${f.plannedDays! > 1 ? 's' : ''}` : ''} — projected Form ${f.form! > 0 ? '+' : ''}${f.form}.`
    : `No hard sessions planned before then, so you should recover — projected Form ${f.form! > 0 ? '+' : ''}${f.form}.`
  return (
    <div className="card forecast">
      <div className="forecast__h">📊 Expected · {fmtDay(day)} · forecast</div>
      <div className="forecast__big">
        <span className="forecast__face">{FORECAST_FACES[Math.round(s) - 1]}</span>
        <div><div className="forecast__lbl">{freshLabel(s)}</div><div className="forecast__sub">Projected Freshness ~{Math.round(s)}/5 · Form {f.form! > 0 ? '+' : ''}{f.form}</div></div>
      </div>
      <div className="forecast__note"><b>Why:</b> {why}</div>
    </div>
  )
}

// Stable daily pick: same item all day, rotates with the date (+salt for variety).
function pickByDate<T>(arr: T[], dateStr: string, salt = 0): T | undefined {
  if (!arr.length) return undefined
  let h = salt >>> 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

const planIcon = (s: CoachPlan['sport']) => (s === 'ride' ? <Bike strokeWidth={1.75} /> : s === 'run' ? <Footprints strokeWidth={1.75} /> : <Dumbbell strokeWidth={1.75} />)

// #202: a plain-language readiness verdict from the day's check-in (Energy/Sleep/Freshness,
// each 1–5; Freshness = 6 − soreness). Drives the banner on the plan. Null until checked in.
// #770 — `isToday` keeps the verdict from using today-anchored, action-framed copy on a PAST day (JM: viewing Jul 23
// on Jul 24 read "good to train as planned"). A past day reports the check-in as HISTORY, present tense only for today.
function readinessVerdict(ci: Checkin | null, isToday = true): { tone: 'good' | 'mixed' | 'low'; text: string } | null {
  if (!ci) return null
  const fresh = ci.soreness != null ? 6 - ci.soreness : null
  const vals = [ci.energy, ci.sleep, fresh].filter((x): x is number => x != null)
  if (!vals.length) return null
  const min = Math.min(...vals), avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (min <= 2 || avg < 2.8) return { tone: 'low', text: isToday ? 'A bit run-down — keep it easy and listen to your body today.' : 'You read a bit run-down that day.' }
  if (avg >= 3.8 && min >= 3) return { tone: 'good', text: isToday ? "You're fresh — good to train as planned." : 'You were fresh that day.' }
  return { tone: 'mixed', text: isToday ? 'Moderately ready — train, but be ready to ease off.' : 'You were moderately ready that day.' }
}
// #488 — a light per-day check-in STRIP for Plan's week/schedule (Day keeps the full card). Reuses readinessVerdict
// + CHECKIN_FACES. Future days render NOTHING (JM); a past day with no check-in reads "didn't check in"; tap → that day.
const CI_ROWS = [{ key: 'energy' as const }, { key: 'sleep' as const }, { key: 'soreness' as const, invert: true }]
export function DayCheckinStrip({ day, ci, today, onOpen }: { day: string; ci: Checkin | null; today: string; onOpen: () => void }) {
  if (day > today) return null
  const isToday = day === today
  const checkedIn = ci != null && CI_ROWS.every((r) => ci[r.key] != null)
  if (!checkedIn) {
    if (isToday) return <button className="checkin-strip checkin-strip--todo" onClick={onOpen}>💬 Check in today<span className="checkin-strip__go">›</span></button>
    return <div className="checkin-strip checkin-strip--none">— didn't check in —</div>
  }
  const verdict = readinessVerdict(ci)
  const vLabel = verdict ? (verdict.tone === 'good' ? 'Fresh' : verdict.tone === 'low' ? 'Run-down' : 'Moderate') : ''
  const scores = CI_ROWS.map((r) => { const raw = ci![r.key] as number; const d = r.invert ? 6 - raw : raw; return `${CHECKIN_FACES[d - 1]}${d}` }).join(' · ')
  return (
    <button className="checkin-strip" onClick={onOpen}>
      <span className="checkin-strip__ok">✓ Checked in</span>
      {verdict && <span className={'checkin__verdict checkin__verdict--' + verdict.tone}><span className="checkin__vdot" />{vLabel}</span>}
      <span className="checkin-strip__sc">{scores}</span>
      <span className="checkin-strip__go">{isToday ? 'Edit ›' : '›'}</span>
    </button>
  )
}
// #488 — month view: a small verdict dot per day (good/mixed/low), or null when there's no check-in.
export function checkinVerdictTone(ci: Checkin | null): 'good' | 'mixed' | 'low' | null {
  if (!ci || ci.energy == null || ci.sleep == null || ci.soreness == null) return null
  return readinessVerdict(ci)?.tone ?? null
}
const RECOVERY_EMOJI: Record<string, string> = { sauna: '🔥', cold: '🧊', massage: '💆', mobility: '🧎', foam: '🪵', walk: '🚶' }

/** A clean one-liner for a plan CARD — prefer the structured objective; else strip markdown/headers
 *  from the free-text notes and take the opening (the full text lives in the detail). */
function planCardDesc(p: CoachPlan): string {
  if (p.objective && p.objective.trim()) return p.objective.trim()
  const raw = (p.notes || '').replace(/^#+\s*/, '').replace(new RegExp(`^${p.title}\\s*`, 'i'), '') // drop leading "# Title"
  const clean = raw.replace(/#+/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const afterObj = clean.match(/objective:\s*(.+)/i)?.[1] ?? clean
  return afterObj.slice(0, 160)
}

/** A coach-pushed plan that isn't mirrored by an intervals event — runs in-app. */
function CoachPlanCard({ p, showDate, fmtDay, onSwap, onRemove, done, act }: { p: CoachPlan; onRun?: (p: CoachPlan) => void; showDate?: boolean; fmtDay: (s: string) => string; onSwap?: () => void; onRemove?: () => void; done?: boolean; act?: IcuActivity }) {
  const nav = useNavigate()
  const mins = p.sport === 'gym' ? undefined : Math.round((p.segments || []).reduce((s, x) => s + x.duration, 0) / 60)
  const segs = (p.sport === 'ride' || p.sport === 'run') ? (p.segments || []) : []
  const isDone = done || !!act
  return (
    <div className="today-entry">
      <button className={'card' + (isDone ? ' card--done' : '')} style={{ textAlign: 'left', width: '100%' }} onClick={() => nav(act ? '/activity/' + act.id : '/coach/' + p.id)}>
        <div className="card-row">
          {segs.length
            ? <div className="thumb"><MiniProfile segs={segs} /></div>
            : <div className={'thumb thumb--' + (p.sport === 'ride' ? 'ride' : p.sport === 'run' ? 'run' : 'gym')}>{planIcon(p.sport)}</div>}
          <div className="card-body">
            <span className="eyebrow">{p.sport === 'ride' ? 'Ride' : p.sport === 'run' ? 'Run' : 'Gym'} · in-app{showDate ? ` · ${fmtDay(p.date)}` : ''}</span>
            <h3 style={isDone ? { opacity: 0.6 } : undefined}>{p.title}</h3>
            {(p.objective || p.notes) && <div className="plan-desc">{planCardDesc(p)}</div>}
            {act ? <DoneStats a={act} /> : <div className="meta">{mins ? <span>{mins} min</span> : <span>{(p.exercises || []).length} exercises{p.rounds && p.rounds > 1 ? ` · ${p.rounds} rounds` : ''}</span>}{!done && <span className="dot">▶ start</span>}</div>}
          </div>
        </div>
      </button>
      {isDone && <span className="done-badge">✓ Completed</span>}
      {onSwap && onRemove && <EntryMenu title={p.title} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

const iso = localISO
const todayISO = () => localISO()
function weekRange(): [string, string] {
  // Wide window so the WeekStrip ‹ › navigation (past/future weeks) has data loaded.
  const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 21)
  const end = new Date(mon); end.setDate(mon.getDate() + 70)
  return [iso(mon), iso(end)]
}
const sportIcon = (e: IcuEvent) => { const s = sportOf(e); return s === 'cycling' ? <Bike strokeWidth={1.75} /> : s === 'gym' ? <Dumbbell strokeWidth={1.75} /> : e.type === 'Run' ? <Footprints strokeWidth={1.75} /> : <Target strokeWidth={1.75} /> }
const fmtDay = (s: string) => new Date(s + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

function PlanCard({ e, showDate, onSwap, onRemove, done, act }: { e: IcuEvent; showDate?: boolean; onSwap?: () => void; onRemove?: () => void; done?: boolean; act?: IcuActivity }) {
  const obj = eventObjective(e)
  const mins = e.moving_time ? Math.round(e.moving_time / 60) : undefined
  const isDone = done || !!act
  // ATP phase markers from intervals.icu aren't actual workouts — show them as a plan note.
  const atp = /^ATP\b/i.test(e.name) || e.category === 'NOTE'
  // For structured rides/runs, the thumb shows the workout's power profile, not a generic icon.
  const rideSegs = !atp && (sportOf(e) === 'cycling' || e.type === 'Run') ? flattenIcuSteps(e.workout_doc?.steps) : []
  // #326 — a COMPLETED session opens its ANALYSED result (/activity/:id), like intervals; only a
  // still-planned one opens the plan. (Was always /plan/:id → clicking a done workout showed the plan.)
  const to = act ? `/activity/${act.id}` : `/plan/${e.id}`
  return (
    <div className="today-entry">
      <Link to={to} className={'card' + (isDone ? ' card--done' : '')}>
        <div className="card-row">
          {rideSegs.length
            ? <div className="thumb"><MiniProfile segs={rideSegs} /></div>
            : <div className={'thumb thumb--' + (atp ? 'target' : e.category === 'TARGET' ? 'target' : sportOf(e) === 'gym' ? 'gym' : sportOf(e) === 'cycling' ? 'ride' : 'run')}>{atp ? <Flag strokeWidth={1.75} /> : sportIcon(e)}</div>}
          <div className="card-body">
            <span className="eyebrow">{atp ? 'Training block' : e.category === 'TARGET' ? 'Target' : sportOf(e) === 'gym' ? 'Gym' : sportOf(e) === 'cycling' ? 'Ride' : e.type}{showDate ? ` · ${fmtDay(e.start_date_local.slice(0, 10))}` : ''}</span>
            <h3 style={isDone ? { opacity: 0.6 } : undefined}>{e.name}</h3>
            {obj && <div className="plan-desc">{obj}</div>}
            {act ? <DoneStats a={act} /> : mins ? <div className="meta"><span>{mins} min</span>{e.icu_training_load ? <span className="dot">{e.icu_training_load} TSS</span> : null}</div> : null}
          </div>
        </div>
      </Link>
      {isDone && <span className="done-badge">✓ Completed</span>}
      {onSwap && onRemove && <EntryMenu title={e.name} onSubstitute={onSwap} onRemove={onRemove} />}
    </div>
  )
}

// #455 — a COMPLETED intervals activity that has NO matching plan/event (an unplanned workout). Renders
// like a done PlanCard (sport thumb + name + DoneStats), taps through to its analysed result, so a day the
// athlete actually trained never reads "Nothing scheduled". Read-only (no swap/remove — it already happened).
function ActivityCard({ a }: { a: IcuActivity }) {
  const { user } = useAuth()
  const sport = sportOfActivity(a) // 'run' | 'ride' | 'gym' | 'swim'
  const icon = sport === 'ride' ? <Bike strokeWidth={1.75} /> : sport === 'gym' ? <Dumbbell strokeWidth={1.75} /> : sport === 'swim' ? <Waves strokeWidth={1.75} /> : <Footprints strokeWidth={1.75} />
  const label = sport === 'ride' ? 'Ride' : sport === 'gym' ? 'Gym' : sport === 'swim' ? 'Swim' : 'Run'
  // #575 — a completed (unplanned) ride shows its real power profile as zone-blocks; a run/swim shows the SAME zone-
  // blocks from its SPEED stream (anchor = threshold/CSS speed) instead of a generic icon — consistent across sports.
  const [stream, setStream] = useState<(number | null)[] | null>(null)
  useEffect(() => { if (['ride', 'run', 'swim'].includes(sport)) fetchActivityStreams(a.id, [sport === 'ride' ? 'watts' : 'velocity_smooth']).then((st) => setStream((sport === 'ride' ? st.watts : st.velocity_smooth) || [])).catch(() => {}) }, [a.id, sport])
  const hasBlocks = (stream?.filter((v) => v != null).length || 0) >= 9
  const thrPace = (user?.runThresholdPace || (user?.sportSettings as { running?: { thresholdPace?: number } } | undefined)?.running?.thresholdPace) || null
  const cssPace = (user?.sportSettings as { swimming?: { thresholdPace?: number } } | undefined)?.swimming?.thresholdPace || null
  const anchor = sport === 'swim' ? (cssPace ? 100 / cssPace : undefined) : sport === 'run' ? (thrPace ? 1000 / thrPace : undefined) : undefined
  return (
    <div className="today-entry">
      <Link to={`/activity/${a.id}`} className="card card--done">
        <div className="card-row">
          {hasBlocks ? <div className="thumb">{sport === 'ride' ? <PowerBlocks watts={stream!} /> : <ZoneBlocks values={stream!} anchor={anchor} />}</div> : <div className={'thumb thumb--' + sport}>{icon}</div>}
          <div className="card-body">
            <span className="eyebrow">{label} · completed</span>
            <h3 style={{ opacity: 0.6 }}>{a.name || label}</h3>
            <DoneStats a={a} />
          </div>
        </div>
      </Link>
      <span className="done-badge">✓ Completed</span>
    </div>
  )
}

/** An assigned meal / mind / note item on the day — editable like everything else. */
function ItemCard({ it, onSwap, onRemove }: { it: CalItem; onSwap: () => void; onRemove: () => void }) {
  const label = it.type === 'meal' ? 'Meal' : it.type === 'mind' ? 'Mind' : 'Note'
  const sub = it.type === 'meal' ? `${it.mealType || 'meal'}${it.kcal ? ` · ${it.kcal} kcal` : ''}` : it.type === 'mind' ? (it.minutes ? `${it.minutes} min` : 'session') : (it.notes || 'note')
  const icon = it.type === 'meal' ? <Salad strokeWidth={1.75} /> : it.type === 'mind' ? <Brain strokeWidth={1.75} /> : <StickyNote strokeWidth={1.75} />
  const to = it.type === 'meal' && it.refId ? `/recipes/${it.refId}` : it.type === 'mind' && it.refId ? `/mind/${it.refId}` : undefined
  // Carry the visual through: a saved meal only stores refId, so look the recipe's photo back up.
  const thumb = it.type === 'meal' && it.refId ? recipes.find((r) => r.id === it.refId)?.thumbnail : undefined
  const body = (
    <div className="card-row">
      <div className="thumb">{thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : icon}</div>
      <div className="card-body"><span className="eyebrow">{label}</span><h3>{it.title}</h3><div className="meta" style={{ whiteSpace: 'normal' }}>{sub}</div></div>
    </div>
  )
  return (
    <div className="today-entry">
      {to ? <Link to={to} className="card">{body}</Link> : <div className="card">{body}</div>}
      <EntryMenu title={it.title} onSubstitute={onSwap} onRemove={onRemove} />
    </div>
  )
}

// #387/#442b — a compact "sessions to review" HEADLINE on Today (only when there ARE gaps); taps through to
// the DEDICATED /review page (NOT History — JM's directive). Keeps Today clean while making feedback stick.
export function ToReviewCard({ acts }: { acts: IcuActivity[] }) {
  const { user } = useAuth() // #review-skip — the skipped-sessions count must not include what the athlete dismissed
  // #723 — GYM feedback lives in the Platyplus store (invisible to the intervals-based endurance nag), so a completed
  // gym never nagged and the coach reviewed it as "no feedback". The server computes the gym gaps from the real store.
  const [gymGaps, setGymGaps] = useState(0)
  useEffect(() => { authApi.gymReviewGaps().then((g) => setGymGaps(g.length)).catch(() => setGymGaps(0)) }, [])
  const n = incompleteFeedback(acts, new Set((user?.feedbackSkips || []).map(String))).length + gymGaps
  if (!n) return null
  return (
    <Link to="/review" className="fbban" style={{ textDecoration: 'none', color: 'var(--text)', margin: '10px 0 12px' }}>
      <div className="fbban__ic">📝</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fbban__t">{n} session{n > 1 ? 's' : ''} need{n > 1 ? '' : 's'} your feedback</div>
        <div className="fbban__s">Your coach reviews it and adapts your plan, a minute each.</div>
      </div>
      <span className="fbban__cta">Review →</span>
    </Link>
  )
}

export default function Today({ embedded = false, initialDay, onDay }: { embedded?: boolean; initialDay?: string; onDay?: (d: string) => void } = {}) {
  // #302: the setup checklist (SetupChecklist) now owns the "meet your coach" + setup nudges.
  // #488 — embedded=true renders this as Plan's DAY view (no page-head); the selected day is driven by / synced to Plan.
  const { user } = useAuth()
  const gated = requiredProfileGaps(user).length > 0 // #A — plan is blocked until the mandatory basics are set
  const [selDay, setSelDay] = useState(initialDay || todayISO())
  useEffect(() => { if (initialDay && initialDay !== selDay) setSelDay(initialDay) }, [initialDay]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onDay?.(selDay) }, [selDay]) // eslint-disable-line react-hooks/exhaustive-deps
  const dayLogs = useLiveQuery(() => db.logs.where('date').equals(selDay).toArray(), [selDay]) ?? []
  const doneTitles = new Set(dayLogs.map((l) => (l.title || '').toLowerCase().trim()))
  const diet = useLiveQuery(() => getSetting('diet'))
  const [events, setEvents] = useState<IcuEvent[] | null>(null)
  const [activities, setActivities] = useState<IcuActivity[]>([])
  // #595 — bumps whenever the plan/activity data reloads, so the future-day FORECAST re-fetches when the
  // plan changes OR a session is completed (a done event's load flips planned→actual in the same feed).
  const [planRev, setPlanRev] = useState(0)
  const [plans, setPlans] = useState<CoachPlan[]>([])
  const [items, setItems] = useState<CalItem[]>([])
  const [checkin, setCheckin] = useState<Checkin | null>(null) // #202: drives the readiness verdict banner
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<string>()
  // #146: the Add sheet opens IN PLACE on Today (the same shared sheet the Plan page uses).
  const [sheet, setSheet] = useState<{ date: string } | null>(null)
  const [restDays, setRestDays] = useState<string[]>([]) // #735 — deliberate rest days (sticky)
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [rideTemplates, setRideTemplates] = useState<RideTemplate[]>([])
  const [ftp, setFtp] = useState(260)
  const navigate = useNavigate()

  const load = useCallback(() => {
    const [a, b] = weekRange()
    fetchEvents(a, b).then((evs) => { setEvents(evs); setPlanEvents(evs); setPlanRev((r) => r + 1) }).catch((e) => setErr((e as Error).message))
    // Mirror intervals-origin workouts into Platyplus first, THEN read the owned plans.
    syncIcuPlans(a, b).finally(() => fetchGymPlans(a, b).then((pl) => { setPlans(pl); setCoachPlans(pl) }))
    fetchActivities(a, b).then(setActivities).catch(() => setActivities([]))
    calApi.items(a, b).then(setItems).catch(() => setItems([]))
    authApi.restDays().then(setRestDays).catch(() => setRestDays([])) // #735
  }, [])
  useEffect(() => { load() }, [load])
  // #293 one-time: re-reconcile a WIDE window (past 45d → future 30d) so EXISTING plans pick up the
  // corrected segment flattening (repeat blocks were collapsed to a flat 0-W block). Runs once/client.
  useEffect(() => {
    if (localStorage.getItem('plansResync293')) return
    const d = (off: number) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10) }
    syncIcuPlans(d(-45), d(30)).then(() => { localStorage.setItem('plansResync293', '1'); load() }).catch(() => {})
  }, [load])
  useEffect(() => { listTemplates().then(setTemplates); listRideTemplates().then(setRideTemplates); getSetting('ftp').then((v) => { if (v) setFtp(Number(v)) }) }, [])
  // #156 — on open, let the coach handle any recently-MISSED session (reshape the week + remove it +
  // notify). Server-side dedup (missedHandledAt) makes calling every load safe. Refresh if it acted.
  useEffect(() => { authApi.handleMissed().then((r) => { if (r.missed > 0 || (r.paired || 0) > 0) setTimeout(load, 4000) }).catch(() => {}) }, [load])
  // #153 — a PWA left open across midnight captured "today" at mount and never re-anchored (the week
  // strip highlighted the wrong day). On regaining focus, if the date rolled over, re-anchor to the new
  // today — but ONLY if the user was still viewing the old today (don't clobber a manually-picked day).
  const anchoredToday = useRef(todayISO())
  useEffect(() => {
    const reanchor = () => {
      const now = todayISO()
      if (now === anchoredToday.current) return
      setSelDay((cur) => (cur === anchoredToday.current ? now : cur)) // move only if viewing "today"
      anchoredToday.current = now
      load() // refresh the week window + data for the new day
    }
    document.addEventListener('visibilitychange', reanchor)
    window.addEventListener('focus', reanchor)
    return () => { document.removeEventListener('visibilitychange', reanchor); window.removeEventListener('focus', reanchor) }
  }, [load])

  function runPlan(p: CoachPlan) {
    if (p.sport === 'gym') { setGymSession(gymSessionFromPlan(p)); navigate('/gym-session/play') }
    else { setCurrentRide({ title: p.title, sport: p.sport === 'ride' ? 'cycling' : 'running', segments: p.segments || [], ftp: p.ftp || 260, source: p.id }); navigate(p.sport === 'ride' ? '/ride-player' : '/run-player') }
  }

  // Editable here too: Remove deletes (intervals event → writes back; coach plan → local).
  // Substitute jumps to that day's calendar where the full swap sheet lives.
  async function removeEvent(e: IcuEvent) {
    if (!confirm(`Remove “${e.name}” from your intervals calendar?`)) return
    try { await deleteEvent(e.id) } catch { alert('Could not remove that intervals event.'); return }
    load()
  }
  async function removePlan(p: CoachPlan) {
    if (!confirm(`Remove “${p.title}”?`)) return
    await calApi.delPlan(p.id); load()
  }
  async function removeItem(it: CalItem) { await calApi.delItem(it.id); load() }
  // #146: Add/Substitute open the shared Add sheet IN PLACE on Today — no navigating
  // away to /plan (JM disliked the jump). Adds reload via onAdd=load.
  const swapOn = (day: string) => setSheet({ date: day })

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()
  // Dedup a coach/owned plan against its intervals mirror, DATA-AWARE (JM 2026-07-01): show whichever
  // side has real STRUCTURE. A coach plan with segments/exercises/objective → its rich CoachPlanDetail
  // (aim · tempo · what-to-expect · structure). A bare text-blob plan whose intervals event carries the
  // workout_doc → the event card → PlanDetail (which parses the shape). Never show both.
  const eventKey = (e: IcuEvent) => `${e.start_date_local.slice(0, 10)}|${sportOf(e)}|${String(e.name || '').trim().toLowerCase()}`
  const planKey = (p: CoachPlan) => `${p.date}|${p.sport === 'ride' ? 'cycling' : p.sport}|${String(p.title || '').trim().toLowerCase()}`
  const eventForPlan = (p: CoachPlan) => (events ?? []).find((e) => (!!e.external_id && e.external_id === p.id) || (p.icuEventId != null && String(p.icuEventId) === String(e.id)) || eventKey(e) === planKey(p))
  const planHasStructure = (p: CoachPlan) => (p.sport === 'gym' ? (p.exercises?.length ?? 0) > 0 : (p.segments?.length ?? 0) > 0) || !!(p.objective && p.objective.trim())
  const showPlan = (p: CoachPlan) => planHasStructure(p) || !eventForPlan(p) // structured → coach card; else defer to the event
  const dayPlans = plans.filter((p) => p.date === selDay && showPlan(p))
  const hiddenEventIds = new Set(plans.filter(showPlan).map((p) => eventForPlan(p)?.id).filter(Boolean).map(String))
  const hiddenEventKeys = new Set(plans.filter(showPlan).map((p) => eventForPlan(p) ? eventKey(eventForPlan(p)!) : '').filter(Boolean))
  const dayEvents = (events ?? []).filter((e) => e.start_date_local.slice(0, 10) === selDay && !hiddenEventIds.has(String(e.id)) && !hiddenEventKeys.has(eventKey(e)))
  const dayItems = items.filter((it) => it.date === selDay)
  // #202: meals/mind/recovery/supplement get their own sections; notes stay with the workouts.
  const dayMeals = dayItems.filter((it) => it.type === 'meal')
  const dayMindItems = dayItems.filter((it) => it.type === 'mind')
  const daySupps = dayItems.filter((it) => it.type === 'supplement')
  const dayRecovery: typeof dayItems = [] // #JM 2026-07-15 — recovery ITEMS parked (roadmap); recovery now lives as the workout's recovery text, not a calendar block
  const dayNotes = dayItems.filter((it) => it.type === 'note')
  // #455 — completed intervals activities on this day NOT matched to any plan/event (an UNPLANNED workout,
  // e.g. Xenia's strength session done without a prior plan). They already mark a week-strip dot, but the
  // day content rendered ONLY plans → a day she actually trained wrongly read "Nothing scheduled / rest day".
  const normSport = (s: string) => (s === 'cycling' ? 'ride' : s === 'running' ? 'run' : s)
  const coveredSports = new Set<string>([...dayPlans.map((p) => normSport(p.sport)), ...dayEvents.map((e) => normSport(sportOf(e)))])
  const orphanActs = activities.filter((a) => (a.start_date_local || '').slice(0, 10) === selDay && !coveredSports.has(sportOfActivity(a)))
  const hasWorkout = dayEvents.length > 0 || dayPlans.length > 0 || orphanActs.length > 0
  const isFuture = selDay > todayISO() // #223: future days forecast, not a live verdict
  const verdict = isFuture ? null : readinessVerdict(checkin, selDay === todayISO()) // #770 — past days read as history, not "today"
  // The WeekStrip day dot marks ACTIVITY days only — run/ride/gym/yoga/pilates, planned or done (#66).
  // JM 2026-07-11: the dot is for ACTIVITIES, NOT food / meditation / recovery items — so `items` is excluded.
  const markedDays = new Set<string>([
    ...(events ?? []).map((e) => e.start_date_local.slice(0, 10)),
    ...plans.map((p) => p.date),
    ...activities.map((a) => (a.start_date_local || '').slice(0, 10)).filter(Boolean),
  ])
  // Match a completed intervals.icu activity to a planned workout by day + sport.
  const actFor = (day: string, sport: string) => activities.find((a) => a.start_date_local.slice(0, 10) === day && sportOfActivity(a) === (sport === 'cycling' ? 'ride' : sport))

  // Daily fuel (diet-aware) + a mind reset for the selected day.
  const dietOk = (r: Recipe) => {
    const p = diet ?? 'vegetarian'
    if (p === 'no preference') return true
    if (p === 'vegan') return !!r.diet?.includes('vegan')
    return !!(r.diet?.includes('vegetarian') || r.diet?.includes('vegan'))
  }
  // Suggestion logic: diet-filtered + WORKOUT-AWARE. Match fuel to the day's training —
  // endurance burns glycogen → carb-forward; a strength day → protein-forward; rest →
  // balanced & lighter. Includes a snack. (Aligns with the coach's nutrition method.)
  const endEvents = dayEvents.filter((e) => ['cycling', 'run'].includes(sportOf(e)) || e.type === 'Run')
  const endPlans = dayPlans.filter((p) => p.sport === 'ride' || p.sport === 'run')
  const endMins = endEvents.reduce((s, e) => s + (e.moving_time ? e.moving_time / 60 : 0), 0) + endPlans.reduce((s, p) => s + (p.segments || []).reduce((a, x) => a + x.duration, 0) / 60, 0)
  const endTSS = Math.max(0, ...endEvents.map((e) => e.icu_training_load || 0))
  const hasEndurance = endEvents.length > 0 || endPlans.length > 0
  const hasStrength = dayEvents.some((e) => sportOf(e) === 'gym') || dayPlans.some((p) => p.sport === 'gym')
  const bigEndurance = endTSS >= 60 || endMins >= 90
  const fuelMode: 'carb' | 'protein' | 'balanced' = hasEndurance ? 'carb' : hasStrength ? 'protein' : 'balanced'
  const fuelMsg = fuelMode === 'carb' ? `Carb-forward to fuel & refill${bigEndurance ? ' a big endurance day' : ' for endurance'}.` : fuelMode === 'protein' ? 'Protein-forward for strength & recovery.' : 'Balanced, lighter picks for a rest day.'
  const suggestMeal = (cat: Recipe['category'], salt: number) => {
    let pool = recipes.filter((r) => r.category === cat && dietOk(r))
    if (pool.length > 6) {
      const third = Math.max(6, Math.ceil(pool.length / 3))
      if (fuelMode === 'carb') pool = [...pool].sort((a, b) => (b.carbs ?? 0) - (a.carbs ?? 0)).slice(0, third)
      else if (fuelMode === 'protein') pool = [...pool].sort((a, b) => (b.protein ?? 0) - (a.protein ?? 0)).slice(0, third)
      else pool = [...pool].sort((a, b) => (a.kcal ?? 0) - (b.kcal ?? 0)).slice(0, Math.max(6, Math.ceil(pool.length / 2)))
    }
    return pickByDate(pool, selDay, salt)
  }
  const meals = (['breakfast', 'lunch', 'snack', 'dinner'] as const).map((cat, i) => suggestMeal(cat, i + 1)).filter(Boolean) as Recipe[]
  const meditation = pickByDate(mindSessions, selDay, 7)
  async function add(key: string, item: Parameters<typeof calApi.saveItem>[0]) {
    try { await calApi.saveItem(item); load(); setAdded((a) => ({ ...a, [key]: true })); setTimeout(() => setAdded((a) => { const n = { ...a }; delete n[key]; return n }), 1600) }
    catch { alert('Could not add — are you signed in?') }
  }
  const addMealSuggestion = (r: Recipe) => add(r.id, { date: selDay, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal })
  const addMindSuggestion = () => { if (meditation) add('mind:' + meditation.id, { date: selDay, type: 'mind', title: meditation.title, refId: meditation.id, minutes: meditation.duration }) }

  // #202: unify scheduled meals (shown once) vs the algorithmic suggestions into 2-col fuel chips.
  const mealEmoji: Record<string, string> = { breakfast: '🥣', lunch: '🥗', dinner: '🍝', snack: '🍌', meal: '🍽️' }
  type FuelChip = { key: string; tag: string; title: string; kcal?: number; recipeId?: string; thumb?: string; sug?: Recipe }
  const fuelChips: FuelChip[] = dayMeals.length
    ? dayMeals.map((it) => ({ key: it.id, tag: it.mealType || 'meal', title: it.title, kcal: it.kcal, recipeId: it.refId }))
    : meals.map((r) => ({ key: r.id, tag: r.category, title: r.title, kcal: r.kcal, recipeId: r.id, thumb: r.thumbnail, sug: r }))
  const mindItem = dayMindItems[0]
  // DEACTIVATED 2026-07-11 (JM: simplify the app) — no Eat/Mind sections in Today for now (coach still tips in an
  // activity's description). Recovery stays. `: boolean` (not the `false` literal) keeps TS's narrowing intact.
  const SHOW_EAT: boolean = false, SHOW_MIND: boolean = false
  return (
    <div>
      {!embedded && (
        <div className="page-head">
          <span className="eyebrow">{greeting}</span>
          <h1>Ready to train?</h1>
        </div>
      )}

      <SetupChecklist />

      <WeekStrip selected={selDay} onSelect={setSelDay} marked={markedDays} />

      {/* #A — until the mandatory basics are set, the coach won't plan: show the profile gate instead of the check-in + plan. */}
      {gated && <ProfileGate />}

      {/* #223: today = check-in + live verdict; future = freshness FORECAST (no fake "fresh"); past = logged. */}
      {!gated && (isFuture ? <ForecastCard key={selDay} day={selDay} rev={planRev} fmtDay={fmtDay} /> : <CheckInCard key={selDay} day={selDay} onChange={setCheckin} />)}

      {/* #759 — pregnant + never shared a stage: NOT blocked (safe envelope by default), just a soft, optional invite to fine-tune. */}
      {!gated && !!user?.info?.pregnant && !(user.info as { trimester?: number; dueDate?: string; pregnancyStart?: string }).trimester && !(user.info as { dueDate?: string }).dueDate && !(user.info as { pregnancyStart?: string }).pregnancyStart && (
        <Link to="/profile#ob-cycle" className="preg-nudge">
          <span className="preg-nudge__ic">🤍</span>
          <span>You're on a <b>gentle, pregnancy-safe plan</b> by default. Want it tuned to your stage? Add your <b>trimester</b> anytime — optional, and never shown anywhere public.</span>
        </Link>
      )}

      {/* #387 — nudge to review completed sessions still missing feedback (links to the full list on Logs). */}
      {/* #722 — when embedded in the Plan page, the nudge is rendered ONCE at the Calendar level (so it shows on Week/
          Month/Schedule too, not just Day); standalone Today keeps its own. */}
      {!embedded && <ToReviewCard acts={activities} />}
      {/* #457 — one-time opt-in for phone push (plan-change alerts). */}
      <PushNudge />

      {/* #673 — removed the "N logged today — see history" line (JM never asked for it). */}

      {/* #202 Today's plan (workouts + notes) with the readiness verdict banner. #A — the whole plan region is hidden while the profile gate is up. */}
      {!gated && <>
      <div className="cal-day-head" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{selDay === todayISO() ? "Today's plan" : fmtDay(selDay)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* #735 — mark/clear a DELIBERATE rest day (sticky: the coach won't re-fill it). */}
          <button className="btn btn--ghost" style={{ width: 'auto', padding: '8px 12px' }} title="A rest day your coach won't re-fill" onClick={() => authApi.setRestDay(selDay, !restDays.includes(selDay)).then(() => load()).catch(() => {})}>{restDays.includes(selDay) ? 'Clear rest' : '💤 Rest'}</button>
          <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => swapOn(selDay)}><Plus size={16} /> Add</button>
        </div>
      </div>
      {err === 'NO_KEY' ? (
        <p className="meta">Connect intervals.icu in <Link to="/profile">Profile</Link> for your coach's plan — you can still add your own below.</p>
      ) : err ? (
        <p className="meta">Couldn't load plan: {err}</p>
      ) : events === null ? (
        <p className="meta">Loading your plan…</p>
      ) : null}
      {/* #740 (JM) — a deliberate rest day gets a prominent banner (the old marker was too subtle). */}
      {restDays.includes(selDay) && (
        <div className="rest-banner">
          <span className="rest-banner__z">💤</span>
          <div className="rest-banner__t"><b>Rest day</b><span>Recovery is training too — your coach is keeping this day clear.</span></div>
        </div>
      )}
      {hasWorkout && verdict && (
        <div className={'ready-banner ready-banner--' + verdict.tone}><span className="ready-banner__dot" />{verdict.text}</div>
      )}
      {hasWorkout || dayNotes.length > 0 ? (
        <div className="stack">
          {dayEvents.map((e) => <PlanCard key={e.id} e={e} act={actFor(selDay, sportOf(e))} done={doneTitles.has(e.name.toLowerCase().trim())} onSwap={() => swapOn(selDay)} onRemove={() => removeEvent(e)} />)}
          {dayPlans.map((p) => <CoachPlanCard key={p.id} p={p} act={actFor(selDay, p.sport)} done={doneTitles.has(p.title.toLowerCase().trim())} onRun={runPlan} fmtDay={fmtDay} onSwap={() => swapOn(selDay)} onRemove={() => removePlan(p)} />)}
          {orphanActs.map((a) => <ActivityCard key={a.id} a={a} />)}
          {dayNotes.map((it) => <ItemCard key={it.id} it={it} onSwap={() => swapOn(selDay)} onRemove={() => removeItem(it)} />)}
        </div>
      ) : events !== null && !err ? (
        // #758 — no SILENT empty day: within the coach's planned horizon (today…+14d), an unplanned day reads as
        // rest-by-default (recovery is part of the plan) with an invite to Add — so the whole horizon is train-or-rest.
        // A past day, or a day beyond the horizon (not planned yet), keeps the plain "nothing scheduled" copy.
        (selDay >= todayISO() && selDay <= addDays(todayISO(), 14)) ? (
          <div className="rest-banner rest-banner--soft">
            <span className="rest-banner__z">💤</span>
            <div className="rest-banner__t"><b>Rest &amp; recover</b><span>No session planned for this day — recovery is part of the plan. Tap Add if you'd like to train.</span></div>
          </div>
        ) : (
          <p className="meta">Nothing scheduled{selDay > todayISO() ? ' yet' : ''} — tap Add, or enjoy a rest day.</p>
        )
      ) : null}

      </>}
      {/* Eat DEACTIVATED 2026-07-11 (JM: simplify the app) — the coach still gives fuel tips in an activity's
          description; we're just not developing the Eat section in Today for now. Flip `false` to re-enable. */}
      {SHOW_EAT && (fuelChips.length > 0 || daySupps.length > 0) && (
        <>
          <div className="section-title sec-ico">🍽️ Eat <InfoDot text={`${fuelMsg}${dayMeals.length ? '' : ' Tap + to add a meal to your day.'}`} /></div>
          {dayMeals.length === 0 && fuelChips.length > 0 && <p className="meta" style={{ margin: '-2px 2px 8px' }}>{fuelMsg}</p>}
          {fuelChips.length > 0 && (
            <div className="fuel-grid">
              {fuelChips.map((c) => (
                <div key={c.key} className="mealchip">
                  <Link to={c.recipeId ? `/recipes/${c.recipeId}` : '#'} className="mealchip__link">
                    <div className="mealchip__thumb">{c.thumb ? <img src={c.thumb} alt="" /> : <span>{mealEmoji[c.tag] || '🍽️'}</span>}</div>
                    <div className="mealchip__body"><span className="mealchip__tag">{c.tag}</span><div className="mealchip__nm">{c.title}</div>{c.kcal ? <div className="mealchip__mc">{c.kcal} kcal</div> : null}</div>
                  </Link>
                  {c.sug && <button className="mealchip__add" aria-label="Add to this day" onClick={(e) => { e.preventDefault(); addMealSuggestion(c.sug!) }}>{added[c.sug.id] ? <Check size={15} /> : <Plus size={15} />}</button>}
                </div>
              ))}
            </div>
          )}
          {daySupps.length > 0 && (
            <div className="supps">
              <span className="supps__hdr">💊 Supplements</span>
              {daySupps.map((s) => <span key={s.id} className="suppchip">{s.title}<button className="suppchip__x" aria-label={`Remove ${s.title}`} onClick={() => removeItem(s)}>×</button></span>)}
            </div>
          )}
        </>
      )}

      {/* #202 Recovery — sauna / cold / massage / mobility (scheduled blocks) */}
      {dayRecovery.length > 0 && (
        <>
          <div className="section-title sec-ico">🛌 Recovery</div>
          <div className="stack">
            {dayRecovery.map((r) => (
              <div key={r.id} className="today-entry">
                {/* #451 — recovery is a first-class ACTIVITY: tap the card → its own view (why · routine · sleep) */}
                <Link to={`/recovery/${r.id}`} state={{ item: r }} className="card" style={{ display: 'block' }}>
                  <div className="card-row">
                    <div className="thumb" style={{ fontSize: 22 }}>{RECOVERY_EMOJI[r.kind || ''] || '🛌'}</div>
                    <div className="card-body" style={{ flex: 1, minWidth: 0 }}><h3>{r.title}</h3><div className="meta"><span>{r.minutes ? `${r.minutes} min` : 'recovery'}</span>{r.kind ? <span className="dot">{r.kind}</span> : null}{(r.insight || r.why || (r.steps && r.steps.length)) ? <span className="dot" style={{ color: 'var(--accent)' }}>how &amp; why ›</span> : null}</div></div>
                    <span style={{ marginLeft: 'auto', opacity: 0.4, alignSelf: 'center' }}>›</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Mind DEACTIVATED 2026-07-11 (JM: simplify the app) — no recommended mind sessions in Today for now;
          the coach can still tip in an activity's description. Recovery stays. Flip `false` to re-enable. */}
      {SHOW_MIND && (mindItem || meditation) && (
        <>
          <div className="section-title sec-ico">🧠 Mind</div>
          <div className="stack">
            <div className="today-entry">
              <Link to={`/mind/${mindItem?.refId || meditation?.id}`} className="card">
                <div className="card-row">
                  <div className="thumb"><Brain strokeWidth={1.75} /></div>
                  <div className="card-body">
                    <span className="eyebrow">{mindItem ? 'scheduled' : meditation?.kind}</span>
                    <h3>{mindItem?.title || meditation?.title}</h3>
                    <div className="meta"><span>{(mindItem?.minutes || meditation?.duration) ? `${mindItem?.minutes || meditation?.duration} min` : 'audio'}</span>{!mindItem && meditation?.coach ? <span className="dot">{meditation.coach}</span> : null}</div>
                  </div>
                </div>
              </Link>
              {!mindItem && meditation && <button className="entry-kebab" style={{ position: 'absolute', top: 12, right: 12, color: added['mind:' + meditation.id] ? 'var(--accent,#34e07d)' : undefined, borderColor: added['mind:' + meditation.id] ? 'var(--accent,#34e07d)' : undefined }} aria-label="Add to this day" title="Add to this day" onClick={(e) => { e.preventDefault(); addMindSuggestion() }}>{added['mind:' + meditation.id] ? <Check size={18} /> : <Plus size={18} />}</button>}
            </div>
          </div>
        </>
      )}

      {sheet && <AddSheet date={sheet.date} ftp={ftp} templates={templates} rideTemplates={rideTemplates} onClose={() => setSheet(null)} onAdd={load} />}
    </div>
  )
}
