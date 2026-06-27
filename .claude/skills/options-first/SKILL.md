---
name: options-first
description: Before implementing any UX / visual / layout / interaction change, present 2-3 distinct options WITH rendered HTML mockups (opened in the browser) and get the user's pick FIRST. Use whenever a change affects what the user sees or how they interact — never implement-then-iterate.
---

# Options + mockups first

**Rule (JM directive):** do NOT implement a UX/visual/interaction change and let the user react. Present **2-3 distinct options as a rendered HTML mockup** — write a self-contained HTML file to `gymapp/mockups/` and `open` it in the browser (JM reads HTML far better than ASCII; a sport/variant toggle in one file lets him compare). Get the pick, THEN build only that one.

**⚠️ JM CAUGHT ME DRIFTING (2026-06-23): I kept "just building" instead of mocking first.** Default-to-mock for ANYTHING beyond a trivial token/text/one-attribute tweak. The test: *would JM have an opinion on how it looks or is laid out?* If yes → MOCK FIRST, even if I think I know the answer. Specifically mock-first (not build-first): any NEW page/section, any redesign of an existing screen (Progress, post-workout summaries, check-in, nav), any "beef it up / make it richer" request, any new card/list layout. Build-without-mock is ONLY ok for: a color/contrast token, removing an element JM explicitly named, copy edits, a pure bug fix with no layout choice, or a change JM described concretely enough that there's one obvious rendering. When unsure, mock. Shipping unmocked UI and iterating is exactly the anti-pattern JM is paying me to avoid.

**Companion rule — log every feedback, build in ORDER (JM directive 2026-06-23):** the moment JM gives ANY feedback/idea, **append it as its OWN numbered entry at the END of `gymapp/FEEDBACK-LOG.md`** (never merge onto a prior item). **Then LOGGING IS NOT WORKING IT — resume the current in-order item; do NOT jump to the fresh feedback.** Build the OPEN queue strictly top-to-bottom, **to the T**, unless JM EXPLICITLY reprioritizes or asks a one-off. The newest idea is the LAST to build, not the first. Keep statuses current (⬜→🔨→✅). See memory `feedback-log-discipline`. (JM caught me twice jumping ahead — hold the line.)

**Companion rule — keep skills current, proactively (JM 2026-06-23):** whenever you change/improve an approach or get corrected, **edit the relevant skill/memory in the SAME turn** — don't wait to be asked. If you'd do it differently next time, the skill should already say so. See memory `keep-skills-current`.

## How
1. **Research first** — current best practice + how leading apps solve it (see the platyplus-ops skill's UX rule). Research shapes the options; cite sources.
2. **Surface constraints** — the user holds constraints you can't infer (e.g. "the check-in can't be collapsed — I'll forget to fill it in"). Options-first flushes these out before code.
3. **Render an HTML mockup, OPEN it, AND show it inline** — write a self-contained HTML file (Platyplus dark theme: `--text:#eef1f4 --text-dim:#9298a6 --accent:#34e07d --bg:#0f1216`, card gradient `#21252f→#191c24`) to `gymapp/mockups/<thing>.html`. Put the 2-3 options (or sport variants) behind a toggle in the ONE file so JM compares live. Use `AskUserQuestion` for the actual pick (a one-line ASCII sketch in the `preview` is fine as a label, but the real visual is the rendered HTML). Recommendation first.
   **Always do BOTH (don't make JM ask "where is the mockup?"):**
   ```sh
   open "mockups/<thing>.html"                      # opens it in the default browser
   # AND render to PNG + Read it so JM sees it INLINE in chat:
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --window-size=460,900 --screenshot="/tmp/mock.png" "file://$PWD/mockups/<thing>.html"
   ```
   then **Read `/tmp/mock.png`** to display it in the conversation. (For multi-option toggles, screenshot each state to its own PNG and Read them all.) JM should SEE the mockup in the reply, not have to open a file.
4. **Build only the chosen option.** If the user says "other"/tweaks, fold it in and re-confirm if it's a big shift.

## Mobile hard rules (non-negotiable — JM directives)
- **Contrast: never super-dark-grey text/elements on black (JM 2026-06-23).** Body/secondary text uses `--text` / `--text-dim`, not a near-black grey. Cards on the black bg need a visible border or lighter fill + real padding (don't let a card melt into the background). When in doubt, lift contrast.
- **NO horizontal scroll, EVER.** Platyplus is mobile-first; off-screen content on a sideways-scrolling row is undiscoverable. Chip rows, filters, tabs, tag lists — they **WRAP** (`flex-wrap: wrap`), never `overflow-x: auto`/`nowrap`. (JM 2026-06-23: the Settings equipment chips scrolled sideways — chips off-screen. Fixed `.chips` to wrap globally.) If something genuinely can't wrap, that's a design-options conversation, not a horizontal-scroll default.

## When this applies
Any change to layout, components, controls, copy hierarchy, spacing, color/contrast, flows, or "where does X live". NOT needed for pure logic/backend/infra with no visible change.

## Mockup format
**Rendered HTML, opened in the browser** — faithful to the real Platyplus look (phone-width ~430px, the dark theme + green accent), interactive where it clarifies (tap-to-reveal, a sport toggle). Show the DEFAULT state and (if relevant) the after-action state; keep footprint honest so size trade-offs are visible. Reference: `gymapp/mockups/plan-view.html`. ASCII is a fallback only for tiny choices not worth a file.

Companion memory: `show-options-and-mockups-first`. Pairs with the "always research best practice first" UX rule in the platyplus-ops skill.
