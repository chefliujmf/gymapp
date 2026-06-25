# Reference: FTP Estimation Methods

> **Source:** "Estimating FTP From Ride Data" (Google Drive doc, owner jmfiset@gmail.com),
> ingested 2026-06-15. This is a coach-owned synthesis for prescription, not a copy of the source.
> It feeds the method in `instructions_fitness_estimation.md` and the value in `ftp_estimate.md`.

FTP can be estimated from ride data without a maximal test, but no single algorithm is "correct" —
each makes different assumptions and fails differently. The coach should treat FTP as a weighted
estimate across methods, knowing each one's bias. Methods, what they need, and how they fail:

## 1. Power-duration / Critical Power curve (Intervals.icu eFTP, Strava, WKO5 mFTP)

- **Mechanism:** map the best maximal effort(s) onto a modeled power-duration curve and read the
  ~60-min asymptote. Intervals/Strava use a single best effort (Morton 3-parameter CP model); WKO5
  fits a 90-day mean-maximal-power curve and reports `mFTP` plus **Time to Exhaustion (TTE)**.
- **Needs:** power only (no HR/age/weight). WKO5 wants the "three pillars" of maximal efforts within
  90 days — short sprint (5–15 s, sets Pmax), medium (2–5 min, sets VO2/FRC), and **long (35+ min,
  sets the aerobic plateau)**.
- **Key bias — effort duration matters enormously.** If the minimum effort duration is set too low
  (e.g. 3 min), the model misreads big short-term anaerobic power as aerobic capacity and
  **overestimates** FTP. The fix is to **restrict the minimum to ≥5–10 min** so the estimate is
  aerobic-dominant. Conversely, if no long maximal effort exists, the curve flattens improperly and
  the model can **suppress/underestimate** mFTP (it reads missing data as missing capability).
- **Blind to:** physiology — age, weight, HR, and *how hard the effort felt* are irrelevant to the
  math, so a submaximal effort is treated as if it were maximal.

## 2. Machine-learning / demographic (TrainerRoad AI FTP)

- **Mechanism:** cluster the athlete against a huge ride database (power, HR, age, weight, RPE,
  trend) and predict the FTP that lets them *complete* a standard threshold workout at ~2% failure
  rate. FTP becomes a software calibration constant, not a measured maximum.
- **Needs:** continuous power+HR, demographics, RPE, and a cold-start minimum (~10 workouts).
- **Bias:** statistical-mean driven; can mis-predict outliers and over-smooths.

## 3. Dynamic signature / breakthrough (Xert MPA)

- **Mechanism:** model Maximal Power Available in real time; when actual power exceeds the model, a
  **"breakthrough"** re-anchors threshold upward. Threshold **decays** when training load drops and
  re-anchors on the next hard effort.
- **Bias:** if Peak Power is set too low, a 4-min effort can spike threshold unrealistically by
  assuming a pure-"diesel" phenotype with no anaerobic reserve — directly relevant to a flat-curve
  rider (see below).

## 4. Autonomic / HRV methods (Firstbeat; DFA α1)

- **Firstbeat (Garmin):** infers VT2/lactate-threshold from HR + HRV-derived respiration deflection;
  needs power+HR and high-fidelity HRV (chest strap).
- **DFA α1 (fractal HRV):** the most direct non-maximal method. The fractal correlation of R-R
  intervals falls as intensity rises; **α1 ≈ 0.75 marks the aerobic threshold (VT1)** and **α1 ≈
  0.50 marks the anaerobic threshold (≈ FTP)**. Estimate FTP by reading the power at which α1 crosses
  0.50, via a **gradual ramp in the first ~30 min** or a **cluster** of sustained efforts near
  threshold (analysis limited to the first ~60 min to avoid cardiac-drift contamination).
  - **Hardware (we have it):** requires pristine R-R data — **Polar H10 chest strap** is the named
    gold standard; optical wrist HR is useless here. The athlete already rides a Polar H10.
  - **Fragility:** reject activities with >5% R-R artifact; heat, dehydration, or life-stress fatigue
    depress α1 prematurely and *underestimate* FTP on a bad day. Use the trend, not one session.

## What this means for THIS athlete (Jean-Manuel)

- **He is a flat-curve diesel** (best 5-min ≈ 289 W, best 12-min ≈ 271 W; ~6% decay). So FTP sits
  close to his 12-min power, and short-effort-derived estimates (eFTP off a 3–5 min effort, or an
  Xert breakthrough) risk **over**-reading him. Always read the curve off ≥10-min efforts.
- **The real gap is a long maximal effort.** He has no genuine maximal 20–40 min effort on record —
  exactly the "long pillar" WKO5 needs — which is why the model FTP (~250) is *extrapolated* and why
  Intervals eFTP (240) reads low (his recent hard efforts were submaximal, RPE 5–6). This is the
  single most valuable data point to collect, and it does not have to be all-out: see DFA α1.
- **DFA α1 is the high-value unlock.** Because he owns the gold-standard Polar H10 and Coros wellness
  already flows into Intervals, we can estimate his anaerobic threshold from a *non-exhausting*
  gradual ramp (α1 → 0.50) instead of a maximal test he dislikes. This is the cleanest way to
  confirm the 250-vs-260 question without burying himself.
- **Detraining decays the estimate.** With CTL fallen to ~32.5, treat the working FTP as the
  fit-state number minus a small decay until a fresh effort re-anchors it (Xert-style).
- **Track TTE, not just watts.** "260 W" should mean "260 W sustainable for ~X min." An algorithmic
  number that supports 4×10 intervals is not proof of 40 continuous minutes — keep the honesty layer.

## Practical method changes adopted from this source

1. Configure/read Intervals power-curve estimates off a **minimum effort duration of ≥10 min**, not
   3–5 min, to suppress anaerobic phenotype bias.
2. Prefer a **long (20–40 min) effort** as the anchor; treat its absence as the main uncertainty.
3. Add **DFA α1 (Polar H10, first ~30–60 min, ≤5% artifact)** as a non-maximal cross-check for
   threshold, via ramp or clustering.
4. Carry a **TTE estimate** alongside the watt value in `ftp_estimate.md`.
5. **Decay** the estimate with detraining and **re-anchor** it on the next genuine hard effort or
   DFA α1 read.
