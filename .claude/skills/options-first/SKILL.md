---
name: options-first
description: Before implementing any UX / visual / layout / interaction change, present 2-3 distinct options WITH ASCII mockups and get the user's pick FIRST. Use whenever a change affects what the user sees or how they interact — never implement-then-iterate.
---

# Options + mockups first

**Rule (JM directive):** do NOT implement a UX/visual/interaction change and let the user react. Present **2-3 distinct options, each with an ASCII mockup**, get the pick, THEN build only that one.

**Companion rule — log every feedback (JM directive 2026-06-23):** the moment JM gives ANY feedback/idea, **append it as a numbered entry to the END of `gymapp/FEEDBACK-LOG.md`** before/while acting on it, and **build the OPEN queue in order, to the T**, unless JM says otherwise (one-offs are fine; keep the queue intact). Keep statuses current (⬜→🔨→✅). See memory `feedback-log-discipline`. This prevents losing UX feedback across long sessions.

## How
1. **Research first** — current best practice + how leading apps solve it (see the platyplus-ops skill's UX rule). Research shapes the options; cite sources.
2. **Surface constraints** — the user holds constraints you can't infer (e.g. "the check-in can't be collapsed — I'll forget to fill it in"). Options-first flushes these out before code.
3. **Present with `AskUserQuestion`** — one option per choice, each carrying a clear ASCII **mockup** in the `preview` field (side-by-side compare). Make options genuinely different (not three shades of the same), and put a recommendation first.
4. **Build only the chosen option.** If the user says "other"/tweaks, fold it in and re-confirm if it's a big shift.

## When this applies
Any change to layout, components, controls, copy hierarchy, spacing, color/contrast, flows, or "where does X live". NOT needed for pure logic/backend/infra with no visible change.

## Mockup format
Plain monospace ASCII in the `preview` field — boxes, rows, labels, the key interaction. Show the DEFAULT state and (if relevant) the after-action state. Keep it faithful to real footprint so size trade-offs are visible.

Companion memory: `show-options-and-mockups-first`. Pairs with the "always research best practice first" UX rule in the platyplus-ops skill.
