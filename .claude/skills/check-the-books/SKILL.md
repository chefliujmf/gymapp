---
name: check-the-books
description: When a coaching / physiology / training-science / safety judgment call comes up and you are the least bit UNSURE — is X safe in pregnancy, how long a taper, what rep scheme, is this the right zone, does this cue match the science — DO NOT guess and DO NOT default to JM's own case. Consult Platyplus's own knowledge base (docs/*.md distilled evidence + server/coach-engine-*.md + the primary books in coach-engine-src/knowledge_base/), ground the decision in what the books/guidelines actually say, and cite the source. The coach's whole promise is "reads the books and applies the science correctly to THIS athlete" — so must you. Invoke whenever a decision rests on training physiology, exercise safety, periodization, fuelling, recovery, or repro-state, and the answer isn't already nailed in the code with a citation.
---

# Check the books — ground every coaching call in the knowledge base

**JM directive (2026-07-23):** *"rely on the science and the books as always — that's the expertise. In case of doubt, check with our knowledge base and books."* We are building a **world-class, evidence-based** coach. A guessed physiology answer — or one defaulted from JM's male-cyclist case — is exactly the failure mode this app exists to avoid. When unsure, **read our own source of truth first, then decide, then cite it.**

The trigger that prompted this: the engine gave a pregnant, athletic runner *"6 relaxed 20-second strides"* and I flagged them as possibly too spicy. The books settle it — **ACOG Committee Opinion 804**: an *accustomed* athlete continues her activity gauged by RPE / the talk test; only **maximal / exhaustive** effort is out. Relaxed sub-tempo strides pass that bar → they're fine. That's the move: don't agonise or guess, **look it up**.

## When to invoke (any "am I sure?" on a coaching decision)
- **Safety by repro-state / age:** is this contraindicated in pregnancy / postpartum / for a teen / for a masters athlete? (supine work, plyometrics, intensity, Valsalva, RED-S, load.)
- **Dose & periodization:** taper length for a distance, build/peak/recovery ratios, quality-day count, concurrent-training separation, deload timing.
- **Zones & prescription:** the right zone/effort for a goal, interval length from TTE/W′, rep scheme + %1RM from the goal, run paces (Daniels), swim CSS zones, weekly set-volume (Schoenfeld).
- **Fuelling & recovery:** peri-workout fuelling, iron/RED-S flags, recovery modality — phrase as *reference, not medical advice* (JM: "I don't want to get sued").
- **A cue or description you're about to write** that makes a physiological claim.
If the rule is already in the code WITH a citation (e.g. `week-shape.js`, `periodization.js`, `docs/*`), you're done — reuse it. Only reach for the books when the answer isn't already grounded.

## Where the knowledge base lives (check in this order — fast → deep)
1. **`docs/*.md` — the DISTILLED, cite-able evidence** (fastest, already ours):
   - `pregnancy-coaching.md` (ACOG 804), `readiness-scores.md`, `strength-coaching.md` + `strength-analytics.md` + `e1rm.md`, `swimming-coaching.md`, `triathlon-coaching.md`, `beyond-ftp-metrics.md`, `tte.md`.
2. **`server/coach-engine-*.md` — the shipped, hand-maintained coaching logic** per sport (cycling/running/female/strength/swimming/triathlon). This is what the coach already believes; check it agrees.
3. **`coach-engine-src/knowledge_base/` — the PRIMARY books** (grep/read the relevant one):
   - **Pregnancy / female / cycle:** Stacy Sims *ROAR* + *Next Level*; Lauren Fleshman *Good for a Girl* (female-athlete context). Pair with ACOG 804 in `docs/pregnancy-coaching.md`.
   - **Cycling power / FTP / CTL / TSS:** Coggan & Allen *Training and Racing with a Power Meter*; Friel *The Power Meter Handbook*.
   - **Periodization / triathlon / taper:** Friel *The Cyclist's Training Bible*.
   - **Strength / hypertrophy / functional:** Boyle *New Functional Training for Sports*; Matthews *Beyond Bigger Leaner Stronger* (hypertrophy volume — cross-check Schoenfeld).
   - **Endurance physiology / limits:** Hutchinson *Endure*.
   - **Recovery:** Pete McCall *Smarter Recovery*.
   - **Fuelling:** Bean *Complete Guide to Sports Nutrition*, the Feed Zone / plant-based titles (note: Eat is deactivated — use for reasoning, don't prescribe calories).
   (Books are `.epub/.pdf/.mobi/.azw3`; grep filenames to pick, then extract the relevant passage.)

## How to use it
1. **Name the exact question** (e.g. "relaxed strides in pregnancy for an accustomed runner — OK?").
2. **Check `docs/` first**, then the engine md, then the specific book. Pull the actual guidance, not a vibe.
3. **Decide on the evidence + CITE it** (e.g. "ACOG 804 — accustomed athlete, RPE/talk test → relaxed strides fine"). Put the citation in the commit / comment / reply so the reasoning is auditable.
4. **If the KB genuinely doesn't cover it:** say so, reason from first principles **conservatively (safety-first)**, and flag it to JM rather than inventing a confident number. For anything medical, frame as general reference, not advice.
5. **When the finding is durable, capture it** — a code comment with the citation (like the `scrubSurgeProse` ACOG note), a line in the relevant `docs/*.md`, or a memory — so we don't re-litigate it.

## Don't
- Don't guess a physiology/safety answer, and don't default it from JM's (male cyclist) or any single athlete's case — that's the core failure `validate-athlete-types` guards against.
- Don't over-restrict out of vague caution either (the strides were fine) — the books cut both ways; let the evidence, not nervousness, decide.
- Don't state medical advice; cite guidelines as reference and defer to the athlete's clinician.

Ties: [[validate-athlete-types]] (the persona matrix this feeds), the `server/coach-engine-*.md` engines, `docs/pregnancy-coaching.md` + the other `docs/*`, and `coach-token-thrift` (grep the right source, don't dump whole books).
