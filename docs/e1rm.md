# Estimated 1-rep max (e1RM) — the gym strength anchor

The gym counterpart of FTP (cycling) and threshold pace (running): a single, auto-updating
number per lift that the coach prescribes against and the app fills weights from. Built in
`src/strength.ts`, unit-tested in `src/strength.test.ts` and `src/exercise-insight.test.ts`.

## The formulas (why an average)

We estimate 1RM from a working set of `weight × reps` using the **average of Epley and Brzycki**:

- **Epley:** `1RM = w · (1 + reps/30)`
- **Brzycki:** `1RM = w · 36/(37 − reps)`

Both are validated rep-max equations; each has a slightly different curvature, and averaging
them is more robust across the 2–10 rep range than either alone (Epley reads a touch high at
high reps, Brzycki a touch low). Accuracy is best at **low reps** and degrades as reps climb —
by ~12+ reps the estimate is a rough guide, not a measurement. This is the standard result in
the strength literature (LeSuer et al., 1997; Mayhew et al.) and matches the coaching books.

## RPE / reps-in-reserve adjustment (`e1rmRpe`)

A logged set is rarely taken to true failure. If it stopped at **RPE r**, it left
**RIR = 10 − r** reps in reserve, so the effort equals a set of `reps + RIR` taken to failure
(Tuchscherer's Reactive Training Systems RPE model; Zourdos et al., 2016 validated the RPE↔RIR
mapping). So:

```
e1rmRpe(w, reps, rpe) = e1rm(w, reps + (10 − rpe))
```

5 reps @ RPE 8 (2 in reserve) therefore implies a **higher** 1RM than 5 reps to failure — the
honest read. With no RPE we fall back to the plain formula (treating the set as near-failure),
which is the conservative existing behaviour and never *over*-reads.

> **Wiring status:** the formula is ready, but per-set RPE is not yet captured
> (`SetEntry` in `db.ts` is weight/reps/done; RPE lives at the session level on
> `WorkoutLog.rpe`). Capturing per-set RPE is a small data-model + UI change (mock first)
> — until then `e1rmRpe` is used where a session RPE is available and as the coach's model.

## Honest confidence (`e1rmConfidence`)

The "same concept" as the FTP/pace confidence — the number is only as trustworthy as the
effort behind it. Confidence brackets on the **reps actually performed** (how far the formula
extrapolates from a real set), with RPE and recency as modifiers:

| Reps performed | Read | Base confidence |
|---|---|---|
| ≤ 5 | heavy set | strong |
| 6–8 | moderate | good |
| 9–12 | high reps | needs a heavier set |
| 13+ | extrapolated | rough guide |

**Knowing the RPE raises confidence** (no guessing whether it was to failure), but a large
reps-in-reserve is docked a little (a longer extrapolation to a true 1RM). **Missing RPE** is
penalised outright (we had to assume near-failure). A max older than ~6 weeks is a weaker claim
on today's strength. When confidence is low the coach's move is a **heavier,
lower-rep top set** (a 3–5RM) to pin the number down — the gym version of "do a hard 20-min
effort to firm up your FTP".

## How it updates

`bestE1rmByExercise` takes the best e1RM per lift over a trailing window; `exerciseInsight`
reads the dated e1RM series to call PR / trending-up / stalled and suggests the next jump. So
the anchor updates itself from ordinary logged sets — no separate "test day" required, matching
the cycling/running philosophy of learning benchmarks from real training.
