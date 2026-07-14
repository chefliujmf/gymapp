---
name: platyplus-charts
description: The Platyplus chart standard — EVERY graph must have X+Y axes with labels, crisp (never stretched) text, and a plain-language insight; build ONE shared reusable chart and use it everywhere. Use whenever adding or changing any chart/graph/trend/timeline.
---

# Platyplus chart standard (JM directive 2026-06-30)

**JM, repeatedly, across the whole Stats build:** "you keep creating graphs I cannot use — no X or Y axis, no insights. Make it useful for ALL graphs and be consistent." A bare sparkline is NOT acceptable for anything presented as a chart.

## The standard — every chart MUST have
1. **Y axis** — labelled with units, and **DENSE enough to read values off** (JM 2026-07-01: "not enough Y ticks, can't see shit" — min/mid/max is NOT enough). **Tick count scales with height** (~1 per 22px → a tall chart gets 8-9 gridlines). `TrendChart` does this via `niceTicks(min,max, round(H/22))`. Gutter ≥50px so labels aren't cramped.
2. **X axis** — labelled AND dense. For an activity **timeline use ROUND-MINUTE marks** (0m · 10m · 20m … · h:mm), not raw even-fraction times like 16:46/33:33 (JM: "x axis barely data"). Pass explicit `xTicks={[{frac,label}]}` to `TrendChart`; it draws faint **vertical gridlines** at each so you can read across. Never an unlabelled line.
3. **Crisp text** — NEVER font-stretch. If the geometry SVG uses `preserveAspectRatio="none"` (+ `vector-effect="non-scaling-stroke"` on lines), then **all text is an HTML overlay** positioned by %, or a properly-scaled `<svg>`. (The Wellness `WTrend` in `src/pages/Wellness.tsx` is the reference implementation.)
4. **An insight** — a one-line plain-language takeaway under the chart (like Fitness's `fitnessInsight`/`formInsight`: "📈 Fitness is climbing (+4) — consistency is paying off"). A chart without a "so what" is half-done.
5. **Where it fits the metric:** a **moving average** line over the noisy daily series, and a **min–max band** (Wellness option B). Min/max labels go top/bottom-right INSIDE the plot, never on the x-axis row (they collide).

## Consistency — don't reinvent per page
- There should be **ONE shared trend-chart component** (generalise `WTrend`), used by Wellness, the per-sport pages, the activity timeline, etc. When you touch charts, move toward that — don't hand-roll another axis-less `<polyline>`.
- Use the shared **`DateRangeFilter`** (`src/DateRange.tsx`) for the range control (presets prefill the always-visible From/To). Per-context presets: recovery 7/30/60 d, training 6 wk–1 yr.
- **Only exception:** a tiny non-interactive **card thumbnail** (e.g. the workout mini-profile) may omit axes — it's an icon, not a chart. Anything labelled/read as a chart gets the full treatment.

## Filters are STANDARD on every stats/trend page (JM 2026-06-30: "I don't see date filters as per requirements")
- **Date range** — EVERY stats/trend page MUST have the shared **`DateRangeFilter`** (`src/DateRange.tsx`): always-visible
  From/To + presets that prefill them. No hardcoded "8 wk". (Progress, Fitness, Wellness, per-sport, History — all of them.)
- **Domain filters** where a list/page has dimensions — by **type / muscle group / equipment / search**, etc. (e.g. the
  Exercises list filters by equipment incl. "bands"; History filters by sport). Add the relevant ones, don't ship a bare list.

## When adding/changing a chart/stats page — checklist
- [ ] Y labels (min/mid/max + unit) · [ ] X labels · [ ] crisp text (HTML overlay) · [ ] insight line · [ ] **DateRangeFilter** ·
  [ ] domain filters (type/muscle/equipment/search) where relevant · [ ] reuse the shared chart · [ ] no horizontal scroll, mobile-first.

## INSIGHTS EVERYWHERE (JM 2026-07-02 — a core product principle, not just charts)
"The coach must be proactive and add insights almost everywhere that brings a lot of value for an athlete to improve." Platyplus is a coach, not a dashboard — **every place data appears is a chance to coach**:
- every chart → an insight line (below); every stats section/card → a short coach read (💡);
- pre-workout → actionable targets (suggested weight + est 1RM + last/trend for gym; target zones / what-to-expect / cues for rides); lists/history → trends, PRs, "faster than 8 wks ago", streaks.
- the COACH volunteers insight/tip/next-step proactively (reviews, plans, chat) — never a bare data dump.
Prefer COMPUTED insights for app surfaces (deterministic, always present); the coach's authored prose lives in the verdict/notes. **Test before shipping any data view: "what's the *so what*?"** If none is on screen, it's half-done. One crisp useful line per surface — not obvious noise. Memory `platyplus-insights-everywhere`.

## Activity view "spirit" (post- AND pre-workout — JM 2026-07-01, #286/#280)
The completed-activity detail (`ActivityDetail`) is the reference for BOTH post- and pre-workout. Same spirit everywhere:
- **Thumbnail** = `PowerBlocks` (zone-coloured bars binned from the REAL power stream), NOT the planned segments — plan segments can be degenerate (a 0-W main block renders garbage). For pre-workout (no actuals yet) use the planned SegmentProfile, same clean treatment.
- **Stats** = hero + chips (4 headline tiles + the rest as compact chips), grouped/scannable, not a 14-tile wall.
- **A coach insight line under EVERY section** (`.act-ins`) — chart, stats, zones. Computed from the metrics in a coaching tone (the coach's *authored* prose stays in the verdict card / from intervals messages, see [[intervals-feedback-data-model]]).
- **Charts to the dense standard above.** Pre-workout mirrors this: planned power/pace SHAPE chart + "what to expect" + coach cues per section.
Memory: `platyplus-activity-view`.

## Known retrofit debt (axis-less today — fix to this standard)
DONE: Activity **TimelineProfile** (#54/#286 — dense axes + round-minute time x + insight per track). Remaining: Mind weekly bars, Running pace trend, per-sport mini charts. Tracked in FEEDBACK-LOG.

Pairs with `options-first` (mock charts before building) and memory `platyplus-chart-standard`.

## Duration / season curve (#508, 2026-07-13)
`DurationCurve` (`src/charts.tsx`) is the power/pace-duration curve. Render the **FITTED model** `value(t)=asymptote+
reserve/t` (CP+W′/t · CS+D′/t) — a SMOOTH glide to the CP/CS floor — NOT the raw mean-max (jagged + cliffs where long
efforts run out; JM: "wtf are those graphs / too thick / NO Y AXIS"). Non-negotiable: **Y-axis labels** (watts, or pace as
m:ss via `fmt`), 1.8px line, faint gridlines, asymptote dashed + labelled. Running values are passed as SPEED (1000/pace) so
faster reads higher; `fmt` converts back to pace. ONE curve per page: `SeasonCompare` IS the curve (fitted `DurationCurve` +
a `compare` prop for a 2nd season's line + a This/vs-Last/vs-All-time toggle); the standalone Pace/PowerCurveCard were
removed (JM: "why 2 curves"). ALWAYS screenshot the mock (`mockups/curve-*.html`) and eyeball it BEFORE pushing — this
curve shipped broken multiple times.

**CORRECTION:** the season-compare curve is the REAL mean-max overlay (`PowerCurveChart`/`PaceCurveChart`) — full 1s-1h
range + `niceTicks` round Y-axis — NOT the fitted `DurationCurve`. Fitted lines fit identical CP/W′ across seasons and
overlap (invisible compare); the season delta is in the sprints the model window hides. `DurationCurve` = single-season
capacity only. Render with REAL athlete data before pushing.
