---
name: platyplus-theme
description: Apply the Platyplus color palette to EVERY UI change — use the defined CSS theme tokens (var(--accent) etc.), never invent off-palette hex. Green is primary/active/success; red=danger; amber=warn; cyan=info/device/rest. Use whenever you add or change ANY UI, color, chart, card, badge, highlight, or component in the gymapp repo. ALWAYS apply (JM 2026-07-19, after an off-theme blue slipped into the gym grid).
---

# Platyplus theme — one palette, applied everywhere

**JM directive (2026-07-19): ALWAYS apply this — on every UI/color/component change, not on request.** The
trigger was an off-theme blue (`#3d7bff`) I invented for the gym set-grid's active row + 1RM; JM caught it
twice ("where is there blue"). The rule isn't "never blue" — it's **use the DEFINED tokens, never invent hex,
and pick the token by MEANING.**

## The tokens (dark-only; source of truth = `src/styles.css` `:root`)
Always reference the CSS variable, never the raw hex. Hexes below are just so you recognize them.

**Surfaces / structure**
- `--bg` #14161c — app base (blue-charcoal, not pure black)
- `--bg-soft` #232733 — inputs, chips, stat tiles
- `--bg-elev` / `--card` #1c1f28 — cards
- `--line` #2c313d — borders / dividers
- `--radius` 14px · `--maxw` 720px · `--tab-h` 62px

**Text**
- `--text` / `--ink` #eef1f4 — primary
- `--text-dim` / `--muted` #aab2c0 — secondary (readable on dark — never dark-grey-on-black)

**Brand = GREEN (primary / active / success / interactive)**
- `--accent` #34e07d — THE brand color: primary buttons, active/selected/current state, "done"/success,
  progress fill, links, focus rings, key stats
- `--accent-2` #19b85f · `--accent-press` #2bc06a · `--accent-grad` (135° gradient) — gradients/press
- `--on-accent` #082015 — text/icon ON a green fill (dark green, for contrast)
- `--glow` — the green drop-glow for primary CTAs

**Semantic status colors (use ONLY for their meaning — not as decoration)**
- `--danger` #ff5a5a — destructive (delete/remove), errors
- `--amber` #ffb13d / `--warn` #f0b145 — warning, "needs attention", unset/estimate
- `--cyan` #7fd1ff — INFO / DEVICE / external-source / the REST timer (`.gp2-restbig`, `.est`, `.src-dev`).
  Device cards use `#4aa3ff`. Cyan/blue is LEGIT here — it means "info/device/rest", NOT primary.
- PR gold `#ffd23f` — PR badges only (`.pr-badge`)

## The rules
1. **Reference the token, never a raw hex.** `color: var(--accent)` — not `#34e07d`, and NEVER a new hex like
   `#3d7bff`. If you're typing a hex for a themeable element, stop — find the token.
2. **Pick the token by MEANING, not by look:**
   - active / selected / current / success / "done" / primary CTA / progress → `--accent` (green)
   - destructive / error → `--danger`
   - warning / attention / unset-estimate → `--amber`/`--warn`
   - info / device-sourced / rest / "from intervals-or-a-device" → `--cyan`
   - This is exactly where the blue bug came from: a *current/active* row is a **green** state, not a blue one.
3. **No new colors.** If a UI needs a hue the palette doesn't have, that's a design decision for JM
   (options-first) — don't just pick one. Reuse an existing token first.
4. **`rgba()` tints must match the token** — a green-accented row tints with `rgba(52,224,125,.08)`, not a
   blue tint. Keep tint hue == token hue.
5. **Match the surrounding component.** Before styling, look at a sibling (a nearby card/button/chip) and reuse
   its classes/tokens so the new thing reads as the same system (the `options-first` "sticks to theme" bar).
6. **Contrast on dark stays readable** — dim text is `--text-dim`, never `#666`/dark-grey-on-black.
7. **Dark-only.** There's no light theme; don't add `@media (prefers-color-scheme)` branches for app UI.

## Quick self-check before shipping any UI
- Did I write any raw hex for a themeable element? → replace with the token.
- Is every "active/selected/primary/done" thing GREEN (`--accent`)? → if it's blue, it's wrong.
- Do my `rgba()` tints match their token's hue?
- Does it sit next to its siblings looking like one system?

Pairs with `options-first` (mock + "stick to theme"), `platyplus-charts` (chart colors), and the memory
`platyplus-theme-palette`.
