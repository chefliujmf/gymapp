---
name: commercialization-cost
description: Apply a COST + COMMERCIALIZATION-FEASIBILITY lens to EVERY decision on Platyplus. It's being commercialized (early-bird ~$9/mo → $20, target 50-60% margin, so total COGS ≤ ~$4/user/mo). Before building or choosing anything, estimate its per-user COGS impact (LLM tokens, infra, bandwidth, 3rd-party) and whether it keeps the product profitable at the target price — and prefer the cost-effective option when quality is equal-or-better. Use on coach/LLM work, media, hosting, integrations, and any recurring per-user cost.
---

# Cost-effective + commercialization-feasible — a lens on EVERY decision

Platyplus is being commercialized (JM 2026-07-21). Early-bird **~$9/mo locked** (or $79/yr), standard **$19/mo**, target **50–60% margin** → total **COGS ≤ ~$4/user/month** at $10. Every decision must keep it there. This is a peer of [[platyplus-coach-token-thrift]] (never trade quality for tokens) — extend that instinct to ALL costs, not just LLM.

## The rule
Before building/choosing anything with a recurring or per-user cost, state **(a) its COGS impact per user/month** and **(b) whether the product still clears the margin at the target price.** If a cheaper option is equal-or-better on quality, take it. Never degrade the coaching quality to save cost (that's the whole product) — but eliminate WASTE aggressively.

## The COGS stack (per user / month) — the numbers to reason from
| Line | Rough $/user/mo | Biggest levers |
|---|---|---|
| **LLM (the coach)** | target ~$1–3 | fewer/gated full adapts · model tiering (Haiku cheap passes, Sonnet only for the plan build) · less output (offload decisions to deterministic CODE) · smaller + cached system prompt |
| **Media / bandwidth** | ~$0.05–1.00 | object storage w/ ZERO egress (Cloudflare R2 / Backblaze B2) + CDN; emoji-fallback / drop-if-missing |
| **Payment** | ~$0.60 (~6% on $10) | annual billing amortizes the fixed $0.30; near-unavoidable otherwise |
| **Hosting (compute+DB)** | ~$0.10–0.40 | a small VPS serves hundreds; scales sub-linearly early |
| **Misc** (email/weather/domain) | ~$0.10 | intervals/Strava/push are free |

Real measured coach cost (2026-07-21): **~$4 per Sonnet pass** (22 turns; output 115K + cache-write of the ~100KB prompt), a full multi-pass adapt ~$12–16. So an ungated daily full adapt ≈ $50–150/user/mo — **way over budget.** Levers get it to ~$1–3.

## Apply it — the questions to ask on a decision
1. **Per-user COGS?** LLM tokens (passes × model × output × prompt size), bandwidth, storage, 3rd-party calls.
2. **How often does it run per user?** Per-day/per-session recurring costs dominate; gate them (run only on material change).
3. **Cheaper-equal-quality option?** Deterministic code vs an LLM call; Haiku vs Sonnet vs Opus; a cached/smaller prompt; object-store+CDN vs origin bandwidth; batch vs N round-trips.
4. **Does it still clear the margin at $10?** If a feature adds >$1/user/mo, it must earn it or be optimized/gated.
5. **Free vs trial?** A free TIER bleeds LLM COGS on non-converters — prefer a time-limited free trial.

## Red flags (a decision that quietly breaks the unit economics)
- An LLM call on EVERY page-load / check-in / activity (recurring, ungated).
- Verbose LLM output where deterministic code could decide it (offload it — see [[platyplus-coach-token-thrift]]).
- Serving video/media from the origin server (egress $) instead of a zero-egress bucket + CDN.
- Using the top model everywhere "for quality" when a cheap model holds up (A/B it first).
- A big system prompt re-sent uncached every call.
- A free tier with no LLM cap.

## Checklist before shipping a cost-bearing decision
- [ ] Stated the per-user/month COGS delta.
- [ ] Confirmed it still clears ~50–60% margin at the $10 early-bird price.
- [ ] Chose the cheapest option that's equal-or-better on quality (quality is never traded away).
- [ ] Gated anything recurring to run only when it materially needs to.
- [ ] For LLM: right model tier + minimal output + cached/small prompt + batched tools.

Ties [[platyplus-coach-token-thrift]], [[gymapp-overview]], [[definition-of-done-validate]].
