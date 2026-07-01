import { describe, it, expect } from 'vitest'
import { parseCoachNote } from './intervals'

// Real coach note from intervals (Monday i161348698) — the shape we must parse (#273).
const MSG1 = `Coach note - Monday Cottage Strong Efforts (Jun 29)

Verdict
- Score: 8/10. Real quality pushed in hard conditions - NP 198, three efforts on punchy terrain.
- Good. Marked off only because the rolling terrain diluted the structured blocks.
- No plan change; the clean FTP read is Saturday on flat roads.

Execution
- 66 min, IF 76%, avg HR 151. Decoupling 4.8% and the high HR-for-power are the heat, not fitness.

Body / Recovery Exercises
- No new issue flagged; cadence dropped to 82 grinding the climbs.

Mind
- Honest and tough-minded: you pushed in brutal heat on a bad-feeling day.

Next
- Tue: the planned cottage ride + your KOM attempt.
- Saturday is the real FTP test on flat roads.`

const MSG2 = `Recovery / Supplements

Nutrition
- Heat day: rehydrate aggressively tonight - fluids plus electrolytes.

Recovery
- HRV rose to 34 today (above baseline).

Skip today
- EAA: skip; normal protein covers it.`

describe('parseCoachNote', () => {
  it('extracts score, title, and titled sections from the coach thread', () => {
    const n = parseCoachNote([MSG1, MSG2])
    expect(n.score).toBe(8)
    expect(n.title).toBe('Monday Cottage Strong Efforts (Jun 29)')
    const titles = n.sections.map((s) => s.title)
    expect(titles).toContain('Verdict')
    expect(titles).toContain('Execution')
    expect(titles).toContain('Next')
    expect(titles).toContain('Nutrition')
    expect(titles).toContain('Skip today')
    // "Recovery / Supplements" is a bare divider (no direct bullets) → dropped
    expect(titles).not.toContain('Recovery / Supplements')
  })

  it('keeps bullets under the right section', () => {
    const n = parseCoachNote([MSG1, MSG2])
    const next = n.sections.find((s) => s.title === 'Next')!
    expect(next.lines).toHaveLength(2)
    expect(next.lines[0]).toMatch(/Tue:/)
    const verdict = n.sections.find((s) => s.title === 'Verdict')!
    expect(verdict.lines[0]).toMatch(/^Score: 8\/10/)
  })

  it('handles a single message and no score', () => {
    const n = parseCoachNote(['Notes\n- just a plain note'])
    expect(n.score).toBeUndefined()
    expect(n.sections).toHaveLength(1)
    expect(n.sections[0].title).toBe('Notes')
  })
})
