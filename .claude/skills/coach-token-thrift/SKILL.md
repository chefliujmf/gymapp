---
name: coach-token-thrift
description: Minimize coach TOKEN usage when developing Platyplus's coach — prefer deterministic server CODE over MCP round-trips and systemPrompt dumps wherever quality is equal-or-better, and never trade quality for tokens. Use on EVERY change that touches the coach — the systemPrompt (buildSystemPrompt), MCP tools (mcp/server.js), coach-engine*.md, readiness/daily-adapt, or any per-turn tool sequence.
---

# Coach token thrift — cheaper by code, never cheaper by worse answers

**JM directive (2026-07-19, #590):** "We always have to be optimal in the coach token usage; anything we can
rely more on code vs MCP calls and coach is better for this goal — but ONLY if we guarantee same or higher
quality results." This is a **hard constraint on every coach-touching change**, not a one-off task.

**Why it matters:** the coach runs on JM's Claude subscription tokens. Every MCP round-trip, every block dumped
into the ~128 KB systemPrompt (already near the #352 argv cap), and every redundant per-turn tool call costs
tokens, latency, and reliability. Deterministic server code is cheaper, faster, and more predictable — *when it
can match the quality.*

## The test — apply it to every coach change
Before adding OR keeping an MCP tool call, a systemPrompt block, or a per-turn tool sequence, ask:

> **"Can server code compute or pre-inject this at ≥ the quality the coach would get by fetching/reasoning it?"**

- **Yes →** do it in code. Pre-inject the fact; drop the tool call / prompt bloat.
- **No (code would degrade the answer) →** keep the coach/MCP path. Quality wins.

## Where the wins usually are
1. **Pre-inject server-known facts** instead of MCP fetches: today's calendar/plan, benchmarks (FTP/CP/zones),
   readiness (Sleep/Freshness/Energy), recent activities, weekday/tz labels. The server already has these —
   handing them to the coach in context beats a `get_*` tool call every turn.
2. **Collapse multi-tool per-turn sequences** the coach runs each turn into ONE server-computed context block.
3. **Trim the systemPrompt** — cut anything not earning its tokens; keep single-topic runtime messages
   (daily-adapt #439) out of the static prompt.
4. **Move pure logic to server code** (readiness math, load budgets, cap checks, pace/zone mapping) — it's
   already the pattern (`readiness.js`, `icu-steps.js`, `plan-cap.js`); don't make the coach re-derive it.

## The guardrail (non-negotiable)
**Never trade quality for tokens.** Before switching any path from coach/MCP to code:
- **Verify parity** — the code output must be as good or better on real cases (spot-check against what the coach
  produced). If in doubt, A/B it; don't assume.
- A quality regression to save tokens is a REJECT, every time. Cheaper-but-worse is not the goal; cheaper-and-
  equal (or better) is.

## Propagate (this is a lens, not a file)
Apply it alongside the "when you change X, also update Y" propagation rule: a coach change touches the API,
`mcp/server.js` (sync to the host), `coach-engine*.md`, and skills/memory. When you make any of those cheaper,
re-check quality across all of them.

Pairs with memory `platyplus-coach-token-thrift`, `platyplus-propagate-all-layers`, and skills `platyplus-ops`,
`platyplus-testing` (verify parity before calling a token-saving change "done").
