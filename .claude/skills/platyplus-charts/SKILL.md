---
name: platyplus-charts
description: The Platyplus chart standard — EVERY graph must have X+Y axes with labels, crisp (never stretched) text, and a plain-language insight; build ONE shared reusable chart and use it everywhere. Use whenever adding or changing any chart/graph/trend/timeline.
---

# Platyplus chart standard (JM directive 2026-06-30)

**JM, repeatedly, across the whole Stats build:** "you keep creating graphs I cannot use — no X or Y axis, no insights. Make it useful for ALL graphs and be consistent." A bare sparkline is NOT acceptable for anything presented as a chart.

## The standard — every chart MUST have
1. **Y axis** — at least min / mid / max value labels (with units). The reader must know the scale.
2. **X axis** — labelled (dates for trends, mm:ss/distance for an activity timeline). Never an unlabelled line.
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

## Known retrofit debt (axis-less today — fix to this standard)
Activity **TimelineProfile** (#54 power/HR/altitude/cadence — no axes, no values shown until scrub), Mind weekly bars, Running pace trend, per-sport mini charts. Tracked in FEEDBACK-LOG.

Pairs with `options-first` (mock charts before building) and memory `platyplus-chart-standard`.
