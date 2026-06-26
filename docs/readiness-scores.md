# Readiness scores — Sleep · Freshness · Energy (our own WHOOP)

**Source:** JM's deep-research doc *"Algorithmic Frameworks for Wearable Health Metrics: Computing
Sleep, Freshness, and Energy Scores"* (Google Drive, created 2026-06-26). Full text verbatim below.
**Goal (#158/#159):** auto-derive the Today check-in's **Sleep, Freshness, Energy** as a personalized
1–5 — Platyplus's own readiness engine — while the manual tap always overrides.

---

## Platyplus assessment & build plan (what WE do with it)

**We already have most of the data** (intervals.icu wellness + activities + the daily check-in), so
Freshness and Energy are computable NOW; Sleep is computable at MVP and upgrades with device data.

### Data we have → maps to the research's inputs
| Research input | Platyplus source |
|---|---|
| Daily TSS, CTL (42d), ATL (7d), TSB/Form | **intervals** (`/wellness` ctl/atl, or compute from activity TSS) |
| Overnight **HRV (RMSSD)**, **resting HR** | **intervals** `/wellness` (`hrv`, `restingHR`) — we already show HRV/RestHR chips |
| **Sleep** score or hours | **intervals** `/wellness` (`sleepScore`, `sleepSecs/hours`) — today's `sleepTo5` |
| **Subjective** (soreness/motivation/stress) | the **daily check-in** (energy/sleep/soreness 1–5) |
| Age / sex (for sleep/HRV norms) | profile (sex via intervals; age = add to profile) |
| Rolling **baselines** (28–90d), z-scores, SWC=0.5σ | compute from intervals wellness history (server) |

### The three scores — how we compute each
- **Freshness (1–5) — buildable NOW, fully objective.** From `ACWR = ATL/CTL` + `TSB = CTL−ATL`.
  Map via the research's table: ACWR `<0.8` & TSB`>+10` → 5; `0.8–1.0`/`0–+10` → 4; `1.0–1.3`/`−15–0` →
  3; `1.3–1.5`/`−30–−15` → 2; `>1.5`/`<−30` → 1. Interpolate continuously; if TSB is very negative,
  apply a downward override (deep volume block). → replaces the manual **Freshness** tap with an auto value.
- **Energy (1–5) — buildable NOW (minimum dataset = HRV + sleep).** Weighted:
  `0.35·HRV + 0.35·Sleep + 0.15·RHR + 0.15·Subjective`, where HRV/RHR are **z-scores vs the personal
  baseline** (use `lnRMSSD`), Sleep imports the Sleep 0–100, Subjective = the check-in. Then the
  piecewise map to 1–5 (below). Guard the **parasympathetic-saturation** edge case (HRV high *and* RHR
  up = still fatigued) with the RHR term.
- **Sleep (1–5) — MVP now, upgrades with device data.** Full = duration 40% (vs **personal** age-adjusted
  need — this is #159, NOT fixed hour bins), efficiency 20%, deep+REM architecture 25%, continuity 15%
  → 0–100 → piecewise 1–5. MVP with what we have: prefer the device **sleepScore** (already personalized
  → /20→1–5); else **hours ÷ personal sleep-need** (default 8h, per-user setting). Add efficiency/
  architecture when intervals exposes stages.

### The 0–100 → 1–5 piecewise map (shared by Sleep & Energy)
`<60 → 1.0+s/60` · `60–70 → 2.0+(s−60)/10` · `70–80 → 3.0+(s−70)/10` · `80–100 → 4.0+(s−80)/20`.
(e.g. 85/100 → 4.25.)

### Cross-metric insights → coach signals (second-order)
- **Freshness-Energy paradox:** Freshness rising (deload) while Energy drops = immune rebound / latent
  illness → DON'T prescribe hard. Surface as a coach warning.
- **Poor-sleep nullifies gains:** high load (Freshness↓) + sustained Sleep <3 → non-functional
  overreaching; the fitness math lies. Warn.
- **HRV volatility (CV↑) over 7d** = struggling to hold homeostasis → pre-emptively lower Energy.

### Build plan (phased)
1. **Server `readiness.js`** (pure, unit-tested): `freshness(ctl,atl)`, `energy({hrvZ,sleep100,rhrZ,subjective})`,
   `sleep100(...)`, `to1_5(score100)`, baseline helpers (EWMA mean/σ, z, SWC). Mirror the research formulas.
2. **Wire to intervals wellness**: fetch HRV/RHR/sleep/CTL/ATL history → baselines → today's z-scores.
3. **Today check-in**: show Freshness + Energy auto-derived (like Sleep "from tracker"), with the manual
   tap overriding + an ⓘ explaining the inputs. Personal **sleep-need** setting (#159).
4. **Coach**: feed the scores + the cross-metric insights into reviews/adaptation.
- Keep it honest: label auto values, always allow manual override, fall back gracefully when a signal is missing.

> ⚠️ The research is a FRAMEWORK, not gospel — adopt the formulas we can support with our data, label
> estimates, and let JM's manual tap win. Pairs with [[platyplus-readiness-model]] memory + the
> `platyplus-readiness-scores` skill.

---

## Full research (verbatim)

# Algorithmic Frameworks for Wearable Health Metrics: Computing Sleep, Freshness, and Energy Scores

## The Paradigm of Physiological Modeling in Wearable Technology

The proliferation of wearable sensor technology has fundamentally transformed athletic training, recovery monitoring, and wellness tracking. Devices capture high-resolution biometric signals — PPG for heart rate and HRV, multi-axis accelerometry for movement, thermometry for peripheral temperature. But raw data (an RMSSD of 45 ms, a TSS of 120) holds little value without contextualization. The core challenge: translate noisy, individualized time-series into intuitive, actionable metrics — percentage indices or Likert-style scales.

This report computes three interrelated indices on a continuous 1–5 scale. **Sleep** quantifies nocturnal recovery, architecture, and autonomic repair. **Freshness** is a mechanical/metabolic readiness metric from cumulative load and the acute-to-chronic workload ratio (ACWR). **Energy** is holistic systemic readiness — the autonomic nervous system's capacity to absorb physiological and psychological stress. For each: the minimum viable dataset, the ideal dataset, demographic individualization (age, sex, sleep need), and the explicit formula mapping continuous biometrics → a discrete 1–5.

## Foundational Principles of Biometric Data Standardization

Biometric signals are volatile (circadian rhythm, hydration, stress, temperature, artifacts), so absolute values can't be applied universally — an RMSSD of 50 ms may be peak recovery for a 60-yr-old yet severe suppression in a 20-yr-old elite. Algorithms must build **rolling personal baselines** — an EWMA or rolling mean over 28–90 days. Meaningfulness is judged by the **Smallest Worthwhile Change** and the Coefficient of Variation. `SWC = 0.5 × σ_baseline`. Standardize inputs with **Z-scores**: `Z = (X_today − μ_baseline) / σ_baseline`. Z≈0 = optimal homeostasis; large deviations trigger penalties. RMSSD is log-transformed (**lnRMSSD**) because raw RMSSD is exponentially distributed.

## The Sleep Score: Quantifying Nocturnal Recovery

Sleep is the primary mechanism for metabolic repair, memory consolidation, and ANS regulation. A robust score aggregates four dimensions: **duration** (vs the user's physiological requirement), **efficiency** (sleep time / time in bed; penalize onset latency + WASO), **architecture** (Deep/slow-wave for physical restoration + GH secretion; REM for cognitive/emotional recovery), **continuity** (awakenings/micro-arousals fragment restoration even at full duration).

### Demographic Adjustments: Age, Sex, Baseline Needs
A universal target is biologically inaccurate. **Deep sleep declines ~2%/decade after 30**; older adults have more WASO + lighter fragmentation → lower the deep-sleep benchmark + raise acceptable wake frequency for them. **Women** record higher REM; luteal-phase + menopause transitions raise basal temp + RHR while suppressing REM and increasing fragmentation → rely on rolling personal baselines, not static population averages. Though 7–9h is the general guideline, individual genetic variance dictates exact need → adjust target from the user's historical patterns associated with high subjective wellness + optimal HRV.

### Datasets
- **Minimum:** Accelerometry, Total Sleep Time, Age → duration + basic efficiency; no real physiological restoration insight.
- **Ideal:** Continuous PPG (HRV+RHR), accelerometry, respiration, SpO2, skin temp, age, sex → accurate Light/Deep/REM staging, autonomic-recovery eval, sub-clinical disturbance detection.

### Math (1–5 Sleep Score)
Compute a 0–100 base across weighted sub-components, then piecewise-map. **Duration 40%** vs age-adjusted target (undersleep penalized hard via direct ratio; oversleep penalized lightly — body clearing debt). **Efficiency 20%** linear on sleep/time-in-bed, 85% baseline. **Composition 25%** Deep+REM vs age-specific targets (young ~20% deep; seniors ~10% for max). **Continuity 15%** subtract for awakenings beyond the age-adjusted norm.

Map 0–100 → 1.0–5.0:
```
<60      → 1.0 + Score/60
60–70    → 2.0 + (Score−60)/10
70–80    → 3.0 + (Score−70)/10
80–100   → 4.0 + (Score−80)/20
```
(85/100 → 4.25, a solid "4 — Good".)

## The Freshness Score: Managing Training Load and Readiness

Freshness quantifies mechanical/metabolic/neurological fatigue from activity — how prepared the musculoskeletal + cardiovascular systems are to generate power/volume. Correlates with Form / Training Stress Balance.

### TSS as the foundational input
`TSS = (t × NP × IF) / (FTP × 3600) × 100` — t in seconds, NP weights high-intensity surges, IF = NP/FTP. One hour at threshold = 100 TSS. No power meter → HR-TSS or **RPE-based** estimate (moderate ≈ 50–60 TSS/h, exhaustive intervals ≈ 100 TSS/h).

### Fitness, Fatigue, Form (EWMA)
```
CTL_today = CTL_yest × e^(−1/42) + TSS_today × (1 − e^(−1/42))   # fitness, 42-day
ATL_today = ATL_yest × e^(−1/7)  + TSS_today × (1 − e^(−1/7))    # fatigue, 7-day
TSB (Form) = CTL − ATL                                           # +ve = fresh/tapered; −ve = fatigued
```

### ACWR
`ACWR = ATL / CTL` — proportional fatigue (a TSB of −20 is dangerous for a novice CTL=30, trivial for a pro CTL=130). Zones: `<0.8` under-training/taper (fresh, detrain risk if sustained); `0.8–1.3` sweet spot (productive, low injury); `1.3–1.5` caution (high fatigue); `>1.5` danger (spike → injury/overtraining). Prefer **uncoupled** ratios (separate the acute week from chronic) over coupled (spurious correlation).

### Datasets
- **Minimum:** subjective duration + RPE (1–10) → estimated TSS, basic fitness/fatigue trends, high error.
- **Ideal:** continuous power/HR + auto threshold detection → accurate NP/IF/TSS → precise ACWR + TSB.

### Map → 1–5 Freshness (blend ACWR + absolute TSB)
| Score | Status | ACWR | TSB | Interpretation |
|--|--|--|--|--|
| 5.0 | Very Fresh | <0.8 | >+10 | Fully recovered; glycogen replete; peak/race-day. |
| 4.0 | Fresh | 0.8–1.0 | 0 to +10 | Absorbed training; ready for high intensity/volume. |
| 3.0 | Optimal | 1.0–1.3 | −15 to 0 | In the sweet spot; positive adaptation; maintain. |
| 2.0 | Fatigued | 1.3–1.5 | −30 to −15 | Overreaching; active recovery/rest. |
| 1.0 | Exhausted | >1.5 | <−30 | Acute load outpaced fitness; stop intense activity. |

Interpolate continuously (ACWR 1.15 → between 3 and 4). If absolute TSB is highly negative, apply a **downward override** capping freshness (prevent over-prescription during a big volume block).

## The Energy Score: Synthesizing Autonomic + Behavioral Data

Energy reflects the systemic ANS state (vs Freshness = muscle mechanics). An athlete can be Freshness 5 (3 rest days) yet Energy 1 (virus / severe stress). It's the ultimate daily readiness / allostatic-load capacity.

### HRV + RHR
Core engine = **HRV (RMSSD)** → parasympathetic (rest-and-digest) activity; log-transform to lnRMSSD. Compare to rolling baseline; a drop below SWC = sympathetic dominance (stress, illness, alcohol, fatigue). **RHR** is the inverse, unfakeable signal — 5–10 bpm above baseline = incomplete recovery / immune activation / sleep debt.

### Are HRV + Sleep enough?
**Yes — minimum viable** (sleep = behavioral input/mechanism; overnight HRV = physiological output/success of recovery). 8h sleep but HRV suppressed 25% → recovery was blocked (late eating, alcohol, illness) → lower Energy. BUT relying on only these risks **parasympathetic saturation** (massive overload drives HRV artificially high while profoundly fatigued) → add RHR + subjective to avoid a false-high.

### Datasets
- **Minimum:** overnight HRV (RMSSD) + total sleep duration → baseline readiness; saturation risk.
- **Ideal:** continuous HRV, lowest overnight RHR, sleep architecture (Sleep Score), respiration, skin temp, daily subjective 1–5 → eliminates edge cases; detects illness ≤3 days early via temp/respiration; subjective bridges signal↔perceived capability.

### Math (1–5 Energy)
`Energy_Raw = 0.35·HRV + 0.35·Sleep + 0.15·RHR + 0.15·Subjective`
- HRV 35%: z-score of daily lnRMSSD vs baseline; full contribution if ≥ normal, scales down below −1σ.
- Sleep 35%: imports the 0–100 Sleep Score.
- RHR 15%: z-score of daily RHR; lower = max points, >+1σ heavily penalized.
- Subjective 15%: user-reported soreness/motivation/stress. (Autonomic + subjective drastically outperforms physiology-only at predicting readiness.)
Then the same piecewise 0–100 → 1–5 map as Sleep.

| Score | Status | Interpretation |
|--|--|--|
| 5.0 | Optimal | High HRV, low RHR, excellent sleep — ANS primed for maximal strain. |
| 4.0 | Good | Mild deviations; homeostasis maintained. |
| 3.0 | Fair | Functional but loaded; maintenance, not peak. |
| 2.0 | Compromised | HRV down, RHR up; fighting stress/illness; active recovery. |
| 1.0 | Depleted | Severe ANS disruption (sleep debt, fever, alcohol); complete rest. |

## Behavioral & Lifestyle Variables (ideal dataset)
- **Sleep consistency/bedtime timing** is often MORE predictive than duration — irregular sleep-wake misaligns circadian rhythm (↑RHR, ↑HRV volatility). Add a "sleep regularity" factor.
- **Exercise timing** — late high-intensity sessions delay parasympathetic onset → suppressed overnight HRV, ↑RHR, penalized sleep+energy.
- **Sedentary time / step distribution** — prolonged sitting (>4h uninterrupted) suppresses HRV; steps lower RHR + raise deep sleep, but distribution matters (break up sitting every 30–60 min).

## Cross-Metric Integration (second-order insights)
- **Freshness-Energy paradox:** recovery week → Freshness 2→5 as ACWR drops <0.8, yet Energy can plummet to 2 — immune rebound: high chronic load suppressed immunity; when load drops, parasympathetic tone returns, immune suppression lifts, latent infection manifests (↑RHR, ↓HRV). Don't prescribe hard on Freshness alone — observe both.
- **Mechanical cost of poor sleep:** fitness is built in the supercompensation phase during Deep Sleep. High load (Freshness 2) + Sleep <3 for nights → CTL math rises but biological adaptation fails → warn of non-functional overreaching.
- **Variability coefficient as a predictive lever:** stable baseline + low 7-day CV of HRV = absorbing load well. Baseline normal but CV rising = wild swings (hyper-recovery ↔ suppression) = losing homeostasis → pre-emptively lower Energy days before a performance drop or injury.

By integrating these, the app becomes a predictive physiological engine, not a data logger.

### Sources (63)
Garmin (HRV Status, Sleep Tracking, Training Readiness, Body Battery), WHOOP (Recovery, HRV, API, member averages), Oura (Readiness, Sleep Score), Google Health (Sleep/Readiness), intervals.icu (Training Monitor), TrainingPeaks (ATL/CTL/TSB, TSS, NP/IF), ACWR research (Griffin; Athlytics; Sams), HRV reviews (PMC, AHA, Elite HRV, HRV4Training, Morpheus), Ultrahuman Sleep 2.0, and others. Full list in the Drive original.
