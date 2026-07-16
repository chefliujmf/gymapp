# Pregnancy coaching — evidence base (#427)

How Platyplus coaches a **pregnant** athlete. This is the research + provenance behind the runtime
`# PREGNANCY` prompt block (`server/server.js` `buildSystemPrompt`) and §6 of `server/coach-engine-female.md`.
It is **coaching for health and function, never performance** — the app defers to the athlete's clinician.

## How it's wired
- **State:** `user.info.pregnant` (bool) + optionally `user.info.dueDate` (EDD) or `user.info.pregnancyStart`
  (LMP). `pregnancyStage(info, date)` in `server/cycle.js` → `{ weeks, trimester }` (40 wk = 280 d;
  T1 <14 wk, T2 14–27, T3 ≥28). Pure + unit-tested (`src/cycle.test.ts`).
- **Cycle logic is GATED OFF when pregnant** — there is no menstrual cycle in pregnancy, so `/auth/readiness`
  never computes/stashes a `cyclePhase`, and `buildSystemPrompt` emits the `# PREGNANCY` block *instead of*
  the `# CYCLE PHASE` block. (Without this, the coach was told "follicular → push intensity/PRs" while her
  profile said "pregnant → maintain" — a direct contradiction. That was the #427 bug.)
- **Freshness de-weights the load ratio when pregnant (#536).** `/auth/readiness` passes `pregnant` into
  `freshness()`, which multiplies the ACWR (acute:chronic) trust by **0.4**. Rationale: in pregnancy HR is an
  unreliable intensity/load proxy (resting HR rises ~10–20 bpm → HR-derived ATL/ACWR is inflated; gauge by
  **RPE / talk test**, ACOG Committee Opinion 804) AND the goal is **maintain, not overload**, so a load ratio
  must not drive a "Fatigued" readiness on a normal maintenance day. This stacks on the general low-chronic-load
  correction (ACWR is spurious at low CTL — Impellizzeri 2020; a pregnant runner in maintenance typically has a
  low CTL, so both apply). Real case: Xenia (CTL ~13, ACWR ~1.8 on a light day) read "Fatigued 2" → now ~3. The
  absolute-Form (TSB) signal and the subjective check-in still carry the read. See `docs/readiness-scores.md`.
- **Knowledge** lives in `coach-engine-female.md` §6 (trimester-by-trimester); the runtime block gives the
  current week/trimester + the core guardrails and STOP signs.

## The evidence (guidelines)
Grounded in the two standard authorities:
- **ACOG Committee Opinion No. 804** — *Physical Activity and Exercise During Pregnancy and the Postpartum
  Period* (2020, reaffirmed).
- **2019 Canadian Guideline for Physical Activity throughout Pregnancy** (Mottola et al., JOGC / SOGC-CSEP).

**Headlines**
- Absent contraindications, physical activity in pregnancy is **safe and beneficial**; women continue or
  begin it. Previously-active athletes (runners, lifters) generally **continue, modified** — coach with
  confidence, not fear.
- **Dose:** ≥**150 min/week moderate**, spread over ≥3 days (daily is great); a **mix of aerobic +
  resistance**; **daily pelvic-floor (Kegel) work** cuts urinary-incontinence risk; yoga/gentle stretching
  helps.
- **Intensity by RPE + the TALK TEST, not heart rate** — pregnancy raises resting HR ~10–20 bpm and blood
  volume, so HR zones mislead. Moderate = can still hold a conversation.
- **Goal = maintain**, not build/PR/max. No training to exhaustion.

**Universal safety**
- **No Valsalva / breath-holding** under load (spikes BP, can cut uterine perfusion) — exhale on the effort,
  keep ~2–3 reps in reserve. (Newer work on experienced heavy lifters is more permissive, but the
  conservative default stands.)
- **Avoid overheating**, especially T1 (neural-tube window): cool hours/indoors on hot-humid days, hydrate.
  Reassuringly, pregnant women thermoregulate *well* (core temp stays <39 °C even in moderate/HIIT running
  <25 °C) — it's heat + dehydration you manage, not moderate exercise itself.
- **Avoid** fall/contact/collision risk, scuba, and altitude >~6000 ft.

**Trimester specifics**
- **T2 onward: no supine (flat-on-back) work** — the growing uterus compresses the inferior vena cava,
  cutting venous return/cardiac output (orthostatic hypotension). Swap to incline/seated/side-lying/standing.
- **Core:** avoid rectus-dominant crunches/full sit-ups that may widen the inter-recti gap (diastasis);
  watch for **doming/coning** and regress. Train deep core + pelvic floor (bracing, bird-dog, Pallof, side
  plank as tolerated) — this is protective, not off-limits.
- **Running:** experienced runners often continue well into pregnancy; prescribe by **time + effort**, not
  pace/HR. **No sprinting** (trunk force/rotation strains the linea alba). Watch pelvic-floor symptoms
  (leaking, heaviness) → deload/stop.

**Contraindications (need clinician clearance before aerobic exercise)** — flag, don't silently program
around. *Absolute:* significant heart/lung disease, incompetent cervix/cerclage, multiple gestation at
preterm risk, persistent 2nd/3rd-trimester bleeding, placenta previa after 26 wk, preterm labour this
pregnancy, ruptured membranes, pre-eclampsia / PIH, severe anaemia. *Relative:* anaemia, arrhythmia,
poorly-controlled T1 diabetes / hypertension / thyroid / seizures, IUGR, extreme BMI, orthopaedic limits,
heavy smoking.

**STOP and contact clinician:** vaginal bleeding, amniotic-fluid leak, regular painful contractions, chest
pain, calf pain/swelling, dyspnoea before exertion, dizziness/faintness or an unresolving headache, muscle
weakness affecting balance, decreased fetal movement.

**Postpartum:** pelvic-floor + deep-core recovery **before** loading; graded return, ideally cleared by a
clinician/pelvic-floor PT; watch leakage/doming. Messaging stays on health & function, never "getting the
body back."

## Sources
- [ACOG Committee Opinion 804 (news release)](https://www.acog.org/news/news-releases/2020/03/acog-releases-updated-guidance-on-exercise-in-pregnancy-and-postpartum) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/32217980/)
- [2019 Canadian Guideline for Physical Activity throughout Pregnancy (PubMed)](https://pubmed.ncbi.nlm.nih.gov/30297272/)
- [Resistance Training During Pregnancy — benefits & safety (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11193983/)
- [Abdominal + pelvic-floor training does not worsen diastasis (RCT, PubMed)](https://pubmed.ncbi.nlm.nih.gov/38472049/)
- [Thermoregulation during HIIT running in pregnancy — "Cool mama" (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422093/)
