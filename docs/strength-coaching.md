# Strength coaching engine — the science (#534)

The gym engine is a **peer to cycling (Coggan/FTP) and running (Daniels/VDOT)**: a model, zones, a dose, and
periodization — but with one thing the endurance engines don't need: it **adapts the whole prescription to the
athlete's main sport and objective**. The same logged session means "great maintenance" for a cyclist and "too
light" for a bodybuilder. Numbers/formulas live in pure, unit-tested `src/strength.ts`; this is the KB the coach
(`coach-engine-strength.md`) and the Stats page reason from. Companion: `docs/strength-analytics.md` (1-RM math).

## 1. The model — working 1-RM + %1RM zones
The strength analog of FTP/threshold pace is the **working 1-rep max** per lift (estimated, never tested — see
`docs/strength-analytics.md`: Epley/Brzycki + RIR + honest confidence). From it come the **intensity zones**, the
NSCA/ACSM **rep-max continuum** — the strength analog of power/pace zones:

| Zone | %1-RM | Reps | Trains |
|---|---|---|---|
| **Strength / neural** | 85–100% | 1–5 | max force, rate of force development |
| **Hypertrophy** | 67–85% | 6–12 | muscle size |
| **Endurance / metabolic** | 50–67% | 12–20+ | muscular endurance |

- NSCA. *Essentials of Strength Training and Conditioning*, 4th ed. (load–rep relationship, zone prescription).
- ACSM. *Guidelines for Exercise Testing and Prescription* (rep-max continuum, health minimums).

## 2. The dose — weekly volume is GOAL-DEPENDENT (the crux)
Volume (hard **sets per muscle per week**) is the primary hypertrophy driver, but the *right* amount depends
entirely on the objective. A flat "10–20 sets" band is a **hypertrophy** prescription; applying it to an endurance
athlete who lifts for support wrongly flags them as "low" forever. The engine therefore keys the target to the
athlete's **gym focus**:

| Gym focus | Weekly sets/muscle | Rationale + source |
|---|---|---|
| **Build muscle** (hypertrophy) | **10–20** | Dose-response for growth (Schoenfeld, Ogborn, Krieger 2017; Baz-Valle 2022). MEV≈8–10, MAV≈12–20, MRV higher (Israetel/RP). |
| **Get stronger** | **6–12** (heavier, >85% 1-RM) | Strength is driven more by **intensity** than volume; moderate volume, high load, longer rests (NSCA; Helms *Muscle & Strength Pyramid*). |
| **Support a sport** (endurance-first) | **2–8** (minimal effective dose) | Strength is **maintained** on ~⅓ the volume / as little as 1 session/wk (Hickson 1985; Bickel 2011 maintenance volume). More can **interfere** with endurance (below). Low gym volume is ON-PLAN, not a deficit. |
| **Health & longevity** | **2–12** | Resistance train all major muscle groups ~**2×/week** (ACSM; WHO physical-activity guidelines). |

**Consequence for insights:** "needs attention → volume low" only fires when volume is below the **focus-appropriate**
floor. For a cyclist (support), 3 sets/muscle reads **"maintenance dose ✓"**, never a nag. Goal-independent flags
(a real **stall** on a lift you're trying to progress, a **PR**, a gross **imbalance**) still surface for everyone.

## 3. Concurrent training — why the sport changes everything
When strength and endurance are trained together, high strength/hypertrophy volume can blunt endurance adaptations
and vice-versa (the **interference effect**). Practical, evidence-based rules the coach applies for an
endurance-first athlete:
- **Maintain, don't build, in-season** — strength qualities hold on a small dose; chase gym PRs in the off-season.
- **Separate the hard stuff** — put lifting **after** or on a **different day** from key rides/runs; ≥~6 h between
  a hard session and a hard lift when possible.
- **Legs light before key endurance days** — protect the sport's priority.
- Refs: Hickson 1980 (interference); Wilson 2012 meta-analysis; Coffey & Hawley 2017 (molecular basis); Rønnestad
  & Mujika 2014 (strength *benefits* endurance performance when dosed right).

## 4. Progression & periodization
- **Progressive overload** via **double progression** (add reps to the top of the range, then the smallest load) —
  `nextTarget` in `strength.ts`. Rippetoe *Starting Strength*; Helms *Pyramid*.
- **Periodization**: linear (novice) or undulating (intermediate+); planned **deloads** every ~4–8 weeks.
- **Stall** = est-1-RM flat ≥3 sessions below peak on a lift you're trying to progress → change the stimulus
  (rep range, deload-then-rebuild). Only meaningful when the *focus* is to progress that lift.

## 5. How the coach knows the focus (JM 2026-07-16)
**Inferred, not a toggle.** From (1) the athlete's **MAIN sport** (a primary-sport marker when they do several)
and (2) their **objective text** ("I want to build muscle" → *muscle*; "I want 300 FTP" → endurance → *support*).
`inferGymFocus()` (pure, tested) resolves it; the coach can always override in reasoning. Precedence: an explicit
muscle/strength objective wins; else main-sport endurance → support; strength sport → muscle; else health.

## 6. Maps science → app + coach
| Surface | Uses |
|---|---|
| Stats "Sets per training week" band + status | `weeklySetsPerMuscle(focus)` + `GYM_FOCUS` targets |
| "Needs attention" (goal-aware) | `strengthDigest(focus)` — volume nags only vs the focus floor; stalls/PRs/imbalance always |
| Per-exercise page — zone of each set, next target | `intensityZone()`, `nextTarget()` |
| Coach prescription (sport+goal+phase aware) | `coach-engine-strength.md` + `SPORT_ENGINES` + `buildSystemPrompt` |

Keep this in step with `src/strength.ts` and `coach-engine-strength.md`.
