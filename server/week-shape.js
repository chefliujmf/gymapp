// #613 (JM 2026-07-20) — WEEK SHAPE, decided in CODE. The coach used to resolve contradictory prompt blocks
// ("pregnant = maintain, ≤1 quality" vs an ungated "a build needs 2 quality days") in its head, and got it
// wrong (a pregnant athlete got 2 sweet-spot days). This pure function is the SINGLE SOURCE OF TRUTH for the
// week's SHAPE — how many quality days, the intensity ceiling, and the load band — keyed to the athlete's
// profile. buildSystemPrompt emits it as "# THIS WEEK'S SHAPE" and the coach BUILDS the sessions to match;
// the conflicting load/sharpen guidance is gated on it. Pure + unit-tested (src/week-shape.test.ts).
//
// The coach still authors the actual sessions (variety, structure, exercise choice) — code only sets the frame.

// intensity ceiling, low → high (matches plan-skeleton ZONES + the sport engines' zone names)
export const CEILINGS = ['recovery', 'endurance', 'tempo', 'sweetspot', 'threshold', 'vo2']
const CEIL_RANK = Object.fromEntries(CEILINGS.map((c, i) => [c, i])) // #5 — order for "ease the ceiling one notch"
// ceiling → max % of threshold (FTP / threshold-pace). Used by the SERVER-SIDE clamp so a maintenance/pregnancy
// athlete physically can't be saved a session above their ceiling, no matter what the coach writes (#615 —
// the prompt-only "0 quality days" was ignored by the LLM; this ENFORCES it). Build athletes: vo2=120 → nothing clamps.
export const CEILING_PCT = { recovery: 60, endurance: 75, tempo: 85, sweetspot: 93, threshold: 102, vo2: 130 }

/** Is this athlete on a MAINTENANCE shape (no structured quality) — pregnancy / consistency-with-0-quality? */
export function isMaintenance(shape) { return !!shape && shape.loadBand === 'maintenance' }

/**
 * @param {object} p profile-derived inputs (all optional; sensible defaults)
 *   pregnant        boolean
 *   trimester       1|2|3|null
 *   cyclePhase      string|null   (non-pregnant female; only used if cycleFresh)
 *   cycleFresh      boolean       (cyclePhase is recent enough to trust)
 *   goalFocus       string[]      (info.goals.focus)
 *   goalNotes       string
 *   trainingDays    number        (weekly HARD cap)
 *   ageYears        number|null
 * @returns {{ loadBand, qualityDays, moderateDays, intensityCeiling, rationale }}
 *   loadBand: 'maintenance'|'flat'|'build'
 *   qualityDays: # of STRUCTURED quality days (sweet-spot/threshold/VO2) the week should contain
 *   moderateDays: # of LIGHT-moderate (tempo, RPE-capped) days allowed on top (0 for most)
 *   intensityCeiling: the HARDEST zone allowed this week
 */
export function weekShape(p = {}) {
  const {
    pregnant = false, trimester = null, postpartumWeeks = null,
    cyclePhase = null, cycleFresh = false,
    goalFocus = [], goalNotes = '',
    trainingDays = 0, ageYears = null, sports = [],
  } = p // NB: no `ctl` — fitness is NOT a classification here; it drives VOLUME via weeklyLoadBudget, not the week's shape
  const cap = (q) => (trainingDays > 0 ? Math.min(q, Math.max(1, trainingDays - 1)) : q) // never spend the whole week on quality

  // ── POSTPARTUM: a GRADED return, not a snap back to a build (#631). Pregnancy=false must NOT jump straight to 2 VO2
  //    days the week after birth — the deconditioned / pelvic-floor-vulnerable window needs a ramp. ────────────────
  // #10 (audit) — the return runs to ~16 wk (NOT a hard 12-wk cliff into a full VO2 build). Three tiers: <6 (no impact),
  // 6-12 (walk-run), 12-16 (intermediate — up to threshold, full impact, but not a full VO2 build yet). It only snaps to
  // the normal goal-driven band after ~16 wk + symptom-free.
  if (!pregnant && postpartumWeeks != null && postpartumWeeks >= 0 && postpartumWeeks < 16) {
    const early = postpartumWeeks < 6
    const mid = postpartumWeeks >= 12 // 12-16 wk — the ramp BACK, so the ceiling doesn't jump endurance→vo2 in one week
    return {
      loadBand: early ? 'maintenance' : 'flat',
      qualityDays: early ? 0 : 1,
      moderateDays: early ? 1 : 0,
      intensityCeiling: early ? 'endurance' : mid ? 'threshold' : 'sweetspot',
      // #713 (audit) — the REAL early-postpartum risk is ground-reaction IMPACT (pelvic floor), not aerobic intensity.
      // Impact directive: NONE <6wk (walk / bike / swim / elliptical), WALK-RUN 6-12wk, NORMAL from 12wk. Code-enforced
      // in shape-enforce (a <6wk run is forced to a walk at save).
      impact: early ? 'none' : mid ? null : 'walk_run',
      rationale: `POSTPARTUM (~${Math.round(postpartumWeeks)} wk) — a GRADED RETURN, not a build. ${early ? 'First ~6 weeks: rebuild base + PELVIC FLOOR + deep core, mostly EASY, no impact/rush, cleared by her clinician first (esp. after a C-section).' : mid ? 'Weeks 12–16: ramping BACK — up to threshold + full impact, but NOT a full VO2 build yet; add intensity only while symptoms stay clear.' : 'Weeks 6–12: gradually reintroduce ONE quality day + impact as pelvic floor + core allow.'} Progress by how she FEELS + clinician guidance; watch for leaking, heaviness/pressure, or abdominal doming and back off if they appear. Ramp to a full build only after ~16 weeks and symptom-free.`,
    }
  }

  // ── PREGNANCY overrides everything: MAINTAIN, never build. ──────────────────────────────────────────
  if (pregnant) {
    // #748 (audit) FAIL-SAFE: an UNKNOWN trimester defaults to the MOST conservative envelope (T3), never the least
    // (the old `|| 1` gave an athlete who may be in T2/T3 a T1 allowance). The profile gate makes the date mandatory;
    // this is the backstop when it's still missing.
    const t = trimester || 3
    const tLabel = trimester ? `trimester ${trimester}` : 'trimester unknown → coached to the most conservative envelope'
    return {
      loadBand: 'maintenance',
      qualityDays: 0, // NO structured sweet-spot / threshold / VO2 intervals, ever
      moderateDays: t >= 3 ? 0 : 1, // at most ONE short light tempo (T1/T2); T3 self-selects down to easy
      intensityCeiling: t >= 3 ? 'endurance' : 'tempo',
      rationale: `PREGNANCY (${tLabel}) — MAINTENANCE, not a build. Most sessions EASY endurance + her strength (2–3 modified sessions/wk) + daily pelvic-floor. ${t >= 3 ? 'ZERO' : 'AT MOST ONE'} short light-moderate cardio session (tempo by RPE + the talk test); NEVER a structured sweet-spot/threshold/VO2 block, NEVER two quality days. Volume + intensity self-taper by trimester. Gauge by RPE + talk test, never HR.`,
    }
  }

  const goalText = `${Array.isArray(goalFocus) ? goalFocus.join(' ') : ''} ${goalNotes || ''}`.toLowerCase()
  const wantsBuild = /ftp|faster|race|marathon|\bpr\b|performance|stronger|\bbuild\b|watts|vo2|threshold|hypertroph|compete|podium|personal best|\bpeak\b/.test(goalText)
  const wantsMaintain = /consist|stay fit|maintain|\btone\b|health|general fitness|feel good|habit/.test(goalText)
  // #710 (JM 2026-07-22) — EXPLICIT beginner/new-athlete signal from the athlete's OWN words (NOT an inferred data-gate —
  // JM removed the ctl<25 bucket; experience is captured explicitly). If they say they're new, RAMP IN conservatively
  // regardless of an ambitious goal — you build a base before structured quality. This keeps dose goal/word-driven.
  const wantsBeginner = /\bbeginner\b|\bnovice\b|new to (this|training|running|cycling|the gym|lifting|fitness|exercise|working ?out)|just start|starting out|never (trained|lifted|ran|run|exercised)|first[- ]?time|getting back into|returning to (running|training|cycling|the gym|fitness|exercise)|been a while|out of shape|couch ?to|complete(ly)? new|haven'?t (trained|run|exercised)/.test(goalText)
  const teen = ageYears != null && ageYears < 18
  const masters = ageYears != null && ageYears >= 55

  // ── goal-driven band ─────────────────────────────────────────────────────────────────────────────
  let loadBand, qualityDays, intensityCeiling
  if (wantsBeginner) { loadBand = 'flat'; qualityDays = 1; intensityCeiling = 'tempo' } // #710 — a STATED beginner OVERRIDES an ambitious goal → ramp in (checked FIRST)
  else if (wantsBuild) { loadBand = 'build'; qualityDays = 2; intensityCeiling = 'vo2' } // #744 — a build/performance band requires an EXPLICIT signal (race/faster/FTP/PR/stronger/…)
  // #6 (audit) — EVERYTHING that isn't an explicit BUILD goal (maintain · health · general-fitness · blank)
  // gets the CONSERVATIVE base: 1 quality day, ceiling = TEMPO (not sweet-spot). A "general fitness"/beginner athlete
  // must NOT be handed a real 93%-of-threshold structured quality day; a sweet-spot+ ceiling is EARNED by stating a build
  // goal. (Not a fitness bucket — it keys off the athlete's stated GOAL, per JM's "numbers not categories".)
  else { loadBand = 'flat'; qualityDays = 1; intensityCeiling = 'tempo' }

  // #3 (audit; JM "follow the books/science") — a TRIATHLETE needs a KEY quality session in EACH discipline (Friel's
  // triathlon periodization: swim technique/CSS + a bike key + a run key + a brick), not a single global 2-quality budget
  // that silently deletes the 3rd discipline's intensity. On a BUILD week, allow ~1 per discipline (capped by the
  // training-days budget). Maintenance/flat stay conservative; teen/masters caps below still apply on top.
  const isTriathlete = (Array.isArray(sports) && (sports.includes('triathlon') || ['swimming', 'cycling', 'running'].every((s) => sports.includes(s)))) || /\btriathlon\b/.test(goalText)
  if (isTriathlete && loadBand === 'build') qualityDays = cap(3)

  // NO fitness "beginner/advanced" CLASSIFICATION (JM 2026-07-20): don't bucket athletes. Everything is already
  // RELATIVE to their own numbers — zones are % of THEIR threshold (88% of a low FTP is appropriately easy), and
  // weekly VOLUME scales from THEIR CTL (weeklyLoadBudget). The plan's job is simply to improve those numbers; the
  // right progression is IMPLICIT in training relative to where they actually are. So quality-day COUNT is goal-driven,
  // intensity is relative, volume is CTL-driven — a lower-fitness athlete just has lower absolute numbers, not a label.

  // ── age adjustments ──────────────────────────────────────────────────────────────────────────────
  if (teen) { qualityDays = Math.min(qualityDays, 1); intensityCeiling = 'threshold' } // technique-first, submaximal, NO maximal loading
  // #1 (audit-critical SAFETY) — a TEEN must NEVER be programmed for weight loss / an energy deficit (RED-S, growth,
  // bone health; distance runners especially). If a teen's goal mentions losing weight/leaning out, HARD-override the
  // shape to conservative health (never extra load "to burn calories") and flag it so the coach redirects to FUELLING +
  // performance, not the scale. Code-enforced, not prompt-only. `wantsWeightLoss` is also surfaced for the coach block.
  const wantsWeightLoss = /lose (weight|fat|\d+\s?(kg|lbs?|pounds?))|weight ?loss|lean out|leaner|slim down|drop (weight|pounds|lbs|kg|fat)|cut(ting)? (weight|fat)|burn fat|shred|get shredded|calorie deficit|\bdeficit\b|get skinny|thinner/.test(goalText)
  const teenWeightLossRedirect = teen && wantsWeightLoss
  if (teenWeightLossRedirect) { loadBand = 'flat'; qualityDays = Math.min(qualityDays, 1); intensityCeiling = 'tempo' }
  // #5 (audit) — MASTERS (55+) get code-enforced extra recovery + an easier top end on EVERY band, not just build (a
  // health-goal 60yo previously got the SAME shape as a 30yo). Ease the ceiling one notch below vo2 and cap quality at 1
  // on non-build weeks so recovery is real, not just a rationale string.
  if (masters) {
    if (CEIL_RANK[intensityCeiling] > CEIL_RANK.threshold) intensityCeiling = 'threshold' // never a full vo2 grind
    if (loadBand !== 'build') qualityDays = Math.min(qualityDays, 1) // extra recovery on flat/health weeks
  }

  // ── menstrual-cycle bias (non-pregnant female, fresh phase) ──────────────────────────────────────
  // #719 (audit) — only ease in LATE-LUTEAL / PMS (progesterone high, thermoregulation + perceived effort up). Do NOT
  // cut a quality day for the MENSTRUAL phase: cycle.js rates it near-neutral and the low-hormone window is actually a
  // GREEN LIGHT for hard work / PRs (contradiction the old /menstrual/ match created). Symptomatic menses is handled by
  // her own check-in (readiness), not a blanket shape cut.
  if (cycleFresh && cyclePhase && /late[-_ ]?luteal|pms|premenstr/.test(String(cyclePhase).toLowerCase())) {
    qualityDays = Math.max(1, qualityDays - 1) // ease the top end in late-luteal/PMS
    if (loadBand === 'build') loadBand = 'flat'
  }

  qualityDays = cap(qualityDays)
  const bandWord = loadBand === 'build' ? 'BUILD' : 'MAINTAIN / consistency'
  return {
    loadBand,
    qualityDays,
    moderateDays: 0,
    intensityCeiling,
    perSportQuality: isTriathlete, // #5 — a triathlete's quality budget is PER DISCIPLINE (keep 1 swim + 1 bike + 1 run), not a global count the bike can eat
    teenWeightLossRedirect, // #1 — a teen stated a weight-loss goal → the coach must redirect to fuelling+performance
    rationale: `${bandWord} week — ${qualityDays} structured quality day${qualityDays !== 1 ? 's' : ''} (ceiling: ${intensityCeiling}), never back-to-back, easy days between; everything else easy/endurance + their strength. All intensities are % of THEIR own threshold and volume scales to THEIR fitness — the plan works to improve those numbers.${teen ? ' TEEN: technique-first, submaximal — no maximal/1-RM loading, no VO2 grinding.' : ''}${masters ? ' MASTERS: extra recovery, ease the very top end.' : ''}${teenWeightLossRedirect ? ' TEEN + weight-loss goal → REDIRECTED to health/maintenance: never program a deficit; coach fuelling + performance, not the scale.' : ''}`,
  }
}
