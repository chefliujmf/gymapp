// #519/#520 — NO-HARDCODED-ATHLETE gate (mirrors the media-independence gate). The SHARED coaching engine is
// read by EVERY athlete, so it must never carry a specific person's NAME — athlete-specifics live in the
// per-user PROFILE. Used two ways: imported by sync-coach-engine.mjs (fails at regeneration time) AND run
// standalone in the `build` script so CI fails even on a DIRECT edit to a generated engine. Extend
// PERSONAL_NAMES as real users join — it's a privacy/leak backstop, not coaching data.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PERSONAL_NAMES = [/\bJean[-\s]?Manuel\b/i, /\bFiset\b/i, /\bJMF\b/, /\bXenia\b/i]
const ENGINES = ['coach-engine.md', 'coach-engine-cycling.md', 'coach-engine-female.md']

// Return a list of "<file>: <matched name>" leaks across the generated engines under `serverDir`.
export function engineNameLeaks(serverDir) {
  const leaks = []
  for (const name of ENGINES) {
    let txt = ''
    try { txt = readFileSync(join(serverDir, name), 'utf8') } catch { continue }
    for (const rx of PERSONAL_NAMES) { const m = txt.match(rx); if (m) leaks.push(`${name}: "${m[0]}"`) }
  }
  return leaks
}

// Throw (exit 1) if any generated engine contains an athlete name. Reused by the sync + the standalone runner.
export function assertNoAthleteNames(serverDir) {
  const leaks = engineNameLeaks(serverDir)
  if (leaks.length) {
    console.error('\n✗ coach-engine gate FAILED — a specific athlete name is in the SHARED engine:\n  ' +
      leaks.join('\n  ') + '\n  Athlete specifics belong in the per-user PROFILE, not the shared engine. Remove the name from the source.\n')
    process.exit(1)
  }
}

// Run directly (part of `npm run build` → enforced in CI): scan the committed generated engines.
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  assertNoAthleteNames(join(here, '..', 'server'))
  console.log('coach-engine gate: OK (no hardcoded athlete names in the shared engine)')
}
