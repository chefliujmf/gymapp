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
 *   ctl             number|null   (fitness — for the TSS band)
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
    pregnant = false, trimester = null,
    cyclePhase = null, cycleFresh = false,
    goalFocus = [], goalNotes = '',
    trainingDays = 0, ageYears = null,
  } = p
  const cap = (q) => (trainingDays > 0 ? Math.min(q, Math.max(1, trainingDays - 1)) : q) // never spend the whole week on quality

  // ── PREGNANCY overrides everything: MAINTAIN, never build. ──────────────────────────────────────────
  if (pregnant) {
    const t = trimester || 1 // unknown trimester → first-trimester defaults
    return {
      loadBand: 'maintenance',
      qualityDays: 0, // NO structured sweet-spot / threshold / VO2 intervals, ever
      moderateDays: t >= 3 ? 0 : 1, // at most ONE short light tempo (T1/T2); T3 self-selects down to easy
      intensityCeiling: t >= 3 ? 'endurance' : 'tempo',
      rationale: `PREGNANCY (trimester ${t}) — MAINTENANCE, not a build. Most sessions EASY endurance + her strength (2–3 modified sessions/wk) + daily pelvic-floor. ${t >= 3 ? 'ZERO' : 'AT MOST ONE'} short light-moderate cardio session (tempo by RPE + the talk test); NEVER a structured sweet-spot/threshold/VO2 block, NEVER two quality days. Volume + intensity self-taper by trimester. Gauge by RPE + talk test, never HR.`,
    }
  }

  const goalText = `${Array.isArray(goalFocus) ? goalFocus.join(' ') : ''} ${goalNotes || ''}`.toLowerCase()
  const wantsBuild = /ftp|faster|race|marathon|\bpr\b|performance|stronger|\bbuild\b|watts|vo2|threshold|hypertroph|compete|podium|personal best|\bpeak\b/.test(goalText)
  const wantsMaintain = /consist|stay fit|maintain|\btone\b|health|general fitness|feel good|habit/.test(goalText)
  const teen = ageYears != null && ageYears < 18
  const masters = ageYears != null && ageYears >= 55

  // ── goal-driven band ─────────────────────────────────────────────────────────────────────────────
  let loadBand, qualityDays, intensityCeiling
  if (wantsMaintain && !wantsBuild) { loadBand = 'flat'; qualityDays = 1; intensityCeiling = 'sweetspot' } // consistency: 1 quality, keep fit
  else { loadBand = 'build'; qualityDays = 2; intensityCeiling = 'vo2' } // default/build: 2 quality

  // ── age adjustments ──────────────────────────────────────────────────────────────────────────────
  if (teen) { qualityDays = Math.min(qualityDays, 1); intensityCeiling = 'threshold' } // technique-first, submaximal, NO maximal loading
  if (masters && loadBand === 'build') { intensityCeiling = 'threshold' } // more recovery, ease the very top end

  // ── menstrual-cycle bias (non-pregnant female, fresh phase) ──────────────────────────────────────
  if (cycleFresh && cyclePhase && /luteal|pms|menstrual|premenstrual/.test(String(cyclePhase).toLowerCase())) {
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
    rationale: `${bandWord} week — ${qualityDays} structured quality day${qualityDays !== 1 ? 's' : ''} (ceiling: ${intensityCeiling}), never back-to-back, easy days between; everything else easy/endurance + their strength.${teen ? ' TEEN: technique-first, submaximal — no maximal/1-RM loading, no VO2 grinding.' : ''}${masters ? ' MASTERS: extra recovery, ease the very top end.' : ''}`,
  }
}
