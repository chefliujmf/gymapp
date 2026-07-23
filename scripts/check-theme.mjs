#!/usr/bin/env node
// #757/#4 (audit) — THEME REGRESSION GUARD. The palette lives in CSS tokens (src/styles.css :root: --accent green,
// --danger red, --amber/--warn, --cyan info, --text/--text-dim). A recurring bug is a SEMANTICALLY-WRONG off-palette
// colour slipping in — most dangerously a calm blue/periwinkle used for a BAD state (a "run-down / low readiness" verdict
// painted periwinkle reads reassuring), or an off-theme blue on the gym grid (memory platyplus-theme-palette). A full
// 318-site hex→token migration is a separate cleanup; THIS gate is the cheap net that stops the known-wrong colours from
// EVER coming back. It fails the build if a denylisted hex appears in src/. Add to the list when a new wrong colour is
// caught. Keep it to genuinely-wrong SEMANTIC colours (not the broad "any hex" rule — that would be 318 false positives).
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// hex (case-insensitive) → why it's banned. These are off-palette colours that were used for the WRONG meaning.
const BANNED = {
  '#7a8cff': 'periwinkle used for LOW readiness / a bad state — a worse state must not read calm. Use var(--danger).',
  '#3d7bff': 'off-theme blue slipped into the gym grid. Use a theme token (var(--cyan) for device/info, var(--accent) for active).',
  '#3b82f6': 'generic Tailwind blue — off-palette. Use var(--cyan) (info/device) or the correct semantic token.',
}

const files = execSync('git ls-files "src/**/*.tsx" "src/**/*.ts" "src/**/*.css"', { encoding: 'utf8' }).split('\n').filter(Boolean)
const hits = []
for (const f of files) {
  let txt
  try { txt = readFileSync(f, 'utf8') } catch { continue }
  const lines = txt.split('\n')
  for (const [hex, why] of Object.entries(BANNED)) {
    const re = new RegExp(hex.replace('#', '#'), 'i')
    lines.forEach((line, i) => { if (re.test(line)) hits.push(`  ${f}:${i + 1}  ${hex} — ${why}`) })
  }
}
if (hits.length) {
  console.error('\n✗ THEME GUARD failed — a banned off-palette / semantically-wrong colour is present:\n')
  console.error(hits.join('\n'))
  console.error('\nUse the CSS theme tokens in src/styles.css (:root) by MEANING. See skill platyplus-theme.\n')
  process.exit(1)
}
console.log(`✓ theme guard: no banned colours in ${files.length} source files`)
