---
name: options-first
description: Before implementing any UX / visual / layout / interaction change, present 2-3 distinct options WITH rendered HTML mockups (opened in the browser) and get the user's pick FIRST. Use whenever a change affects what the user sees or how they interact — never implement-then-iterate.
---

# Options + mockups first

**Rule (JM directive):** do NOT implement a UX/visual/interaction change and let the user react. Present **2-3 distinct options as a rendered HTML mockup** — write a self-contained HTML file to `gymapp/mockups/` and `open` it in the browser (JM reads HTML far better than ASCII; a sport/variant toggle in one file lets him compare). Get the pick, THEN build only that one.

**Companion rule — log every feedback, build in ORDER (JM directive 2026-06-23):** the moment JM gives ANY feedback/idea, **append it as its OWN numbered entry at the END of `gymapp/FEEDBACK-LOG.md`** (never merge onto a prior item). **Then LOGGING IS NOT WORKING IT — resume the current in-order item; do NOT jump to the fresh feedback.** Build the OPEN queue strictly top-to-bottom, **to the T**, unless JM EXPLICITLY reprioritizes or asks a one-off. The newest idea is the LAST to build, not the first. Keep statuses current (⬜→🔨→✅). See memory `feedback-log-discipline`. (JM caught me twice jumping ahead — hold the line.)

## How
1. **Research first** — current best practice + how leading apps solve it (see the platyplus-ops skill's UX rule). Research shapes the options; cite sources.
2. **Surface constraints** — the user holds constraints you can't infer (e.g. "the check-in can't be collapsed — I'll forget to fill it in"). Options-first flushes these out before code.
3. **Render an HTML mockup + open it** — write a self-contained HTML file (Platyplus dark theme: `--text:#eef1f4 --text-dim:#9298a6 --accent:#34e07d --bg:#0f1216`, card gradient `#21252f→#191c24`) to `gymapp/mockups/<thing>.html` and `open` it. Put the 2-3 options (or sport variants) behind a toggle in the ONE file so JM compares live. Use `AskUserQuestion` for the actual pick (a one-line ASCII sketch in the `preview` is fine as a label, but the real visual is the opened HTML). Recommendation first.
4. **Build only the chosen option.** If the user says "other"/tweaks, fold it in and re-confirm if it's a big shift.

## When this applies
Any change to layout, components, controls, copy hierarchy, spacing, color/contrast, flows, or "where does X live". NOT needed for pure logic/backend/infra with no visible change.

## Mockup format
**Rendered HTML, opened in the browser** — faithful to the real Platyplus look (phone-width ~430px, the dark theme + green accent), interactive where it clarifies (tap-to-reveal, a sport toggle). Show the DEFAULT state and (if relevant) the after-action state; keep footprint honest so size trade-offs are visible. Reference: `gymapp/mockups/plan-view.html`. ASCII is a fallback only for tiny choices not worth a file.

Companion memory: `show-options-and-mockups-first`. Pairs with the "always research best practice first" UX rule in the platyplus-ops skill.
