# Strength analytics — the science (#448)

The strength Progress/Stats page is grounded in the resistance-training literature, the same way running
uses Daniels (VDOT) and cycling uses Coggan (TSS/FTP). Every number on the page traces to a formula or a
published landmark below. Pure functions live in `src/strength.ts` (unit-tested `src/strength.test.ts`); this
doc is the coach KB + the "why" behind each figure.

## 1. Estimated 1-rep max (working max)
The headline per-lift number. We never ask for a true 1RM test (injury risk, rarely trained); we **estimate**
it from the reps you actually did.

- **Formula:** the average of **Epley** (`w·(1 + reps/30)`) and **Brzycki** (`w·36/(37−reps)`). Averaging two
  well-validated equations reduces each one's bias. Accurate in the **2–10 rep** range; beyond ~12 reps the
  extrapolation degrades (reflected in confidence, below).
  - Epley JA. *Poundage Chart.* Boulder Underground, 1985.
  - Brzycki M. *Strength testing—predicting a one-rep max from reps-to-fatigue.* JOPERD, 1993.
  - LeSuer et al. *Accuracy of prediction equations for 1RM.* J Strength Cond Res, 1997 (validates Epley/Brzycki as most accurate for the squat/bench).
- **RPE / RIR adjustment (`e1rmRpe`):** a set stopped at RPE `r` left `10−r` **reps in reserve**, so it is
  equivalent to a set of `reps + (10−r)` taken to failure. A set of 5 @ RPE 8 implies a **higher** max than 5
  to failure. This is Reactive Training Systems / **Tuchscherer's RIR-based RPE**.
  - Tuchscherer M. *The Reactive Training Manual*, 2008. Zourdos et al. *Novel RPE/RIR scale.* JSCR 2016.
- **Honest confidence (`e1rmConfidence`):** same philosophy as our FTP/pace confidence (#497/#5007). Tighter
  from a **heavy low-rep** set (short extrapolation), looser from a **high-rep** set or a **stale** max
  (>6 wk). Never shows false certainty. Four bands: strong / good / need-more / learning.

## 2. Weekly sets per muscle — the volume landmark
The most **actionable** volume metric (replaced raw "total kg", which is a vanity number). Counts **completed
working sets per muscle group per week** (primary mover; averaged over the selected range).

- **Target band 10–20 sets/muscle/week.** Dose-response meta-analysis (Schoenfeld, Ogborn, Krieger 2017,
  *J Sports Sci*): hypertrophy rises with weekly set volume; **≥10 sets/muscle/week** is markedly better than
  <10, with benefit continuing toward ~20. Below ~10 = under-stimulating; much beyond ~20 risks **junk
  volume**/recovery debt for most trainees.
- **MEV / MAV / MRV framing** (Israetel / Renaissance Periodization): Minimum Effective (~8–10) < Maximum
  Adaptive (~12–20) < Maximum Recoverable (individual, 20+). We flag **low** (<10), **ok** (10–20), **high**
  (>20). It's a *hypertrophy* guide; pure-strength blocks trade volume for **intensity (>80% 1RM)**, so the
  page notes when a lift is heavy-but-low-volume rather than penalising it blindly.
  - Schoenfeld BJ, Ogborn D, Krieger JW. *Dose-response relationship between weekly resistance training volume and increases in muscle mass.* J Sports Sci 2017.
  - Baz-Valle et al. *A systematic review of weekly set volume.* 2022 (confirms the 10+ landmark).

## 3. Progression, stalls & next target
- **Stall detection (`exerciseInsight`, #255):** a lift is **stalled** when the est-1RM has sat ≥3 sessions
  (~≥1 wk) below its peak — the practical signal that the current stimulus stopped driving adaptation, so the
  advice is to change it (vary rep range, deload then rebuild). This is textbook **progressive-overload +
  accommodation** (the body adapts to a constant stimulus and stops progressing).
- **Next target (`nextTarget`):** **double progression** — add reps within the target range first, then, once
  you hit the top of the range for the prescribed sets, add the **smallest load increment** (2.5 kg default,
  `roundLoad`). Conservative and repeatable, the standard novice→intermediate model.
  - Rippetoe M. *Starting Strength* (linear + double progression). Helms et al. *The Muscle & Strength Pyramid* (progression models).

## 4. What the page shows (maps science → UI)
| UI element | Backing function | Science |
|---|---|---|
| Working-1RM card + confidence | `e1rmRpe` + `e1rmConfidence` | Epley/Brzycki + RIR + honest confidence |
| "Sets per muscle, target 10–20" | `weeklySetsPerMuscle` | Schoenfeld dose-response / MEV-MAV-MRV |
| Needs-attention (stalled / low-volume / missing muscle) | `strengthDigest` + `exerciseInsight` | progressive overload, volume landmark |
| Wins (PRs, movers) | `strengthDigest` | measured est-1RM deltas |
| Exercise page: est-1RM trend vs target, rep-range table, next target | `exerciseHistory` + `nextTarget` | all of the above |
| Range summary: sessions · time · consistency | `rangeSummary` | honest effort/consistency (not vanity volume) |

Keep this doc in step with `src/strength.ts`; the coach engine references it for prescribing strength work.
