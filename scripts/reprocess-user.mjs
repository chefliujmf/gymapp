#!/usr/bin/env node
// #351 — Reprocess a user's activities after a change/improvement, so they SEE it on real data
// (JM directive 2026-07-04: "reprocess my activities so I can see changes… how it will look once launched").
//
// Fires the locked-down coach (POST /api/coach/run) with a scoped RE-ANALYSIS instruction: re-review the
// user's COMPLETED activities in a recent window with the CURRENT per-sport engine, and save fresh coach
// reviews. Data re-sync + done↔planned re-pair happens on the user's next app load (handle-missed); this
// script owns the OUTWARD coach re-analysis (notes + notifications) that the "Sync + recent re-review"
// scope calls for. Idempotent-ish: re-reviews REPLACE the prior review for an activity.
//
// Usage:
//   PLATYPLUS_URL=https://platyplus.duckdns.org TOKEN=<coach-api-token> node scripts/reprocess-user.mjs [weeks]
//   (weeks default 4). On the XPS you can hit the prod container directly: PLATYPLUS_URL=http://127.0.0.1:8088
//
// Get a user's coach token on the box (Postgres):
//   docker exec gymapp-db psql -U platyplus -tAc "select doc->>'apiToken' from users where username='<user>'"

const BASE = (process.env.PLATYPLUS_URL || 'https://platyplus.duckdns.org').replace(/\/$/, '')
const TOKEN = process.env.TOKEN
const WEEKS = Number(process.argv[2]) || 4
if (!TOKEN) { console.error('set TOKEN=<coach-api-token> (see header for how to fetch it)'); process.exit(1) }

const message = [
  `REPROCESS (engine/UX update) — re-analyze my COMPLETED activities from the LAST ${WEEKS} WEEKS ONLY, so I can see the improved analysis on my real history.`,
  `For each completed ride/run/gym in that window: pull it (get_recent_activities), assess it with the CURRENT per-sport engine (running = Daniels E/M/T/I/R off threshold PACE, never bike power; cycling = FTP power; gym = structure/tempo/each-side), and save an UPDATED coach review (save_coach_review, pass the activityId) with a fresh one-line verdict + 2-4 takeaways + score.`,
  `STRICT: do NOT create or change any planned workout, do NOT touch future weeks, do NOT re-review anything older than ${WEEKS} weeks. Keep each review concise. This is a re-analysis pass only.`,
].join(' ')

const res = await fetch(BASE + '/api/coach/run', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({ message }),
})
const txt = await res.text()
if (!res.ok) { console.error(`FAILED ${res.status}: ${txt}`); process.exit(1) }
console.log(`OK — coach reprocess started (last ${WEEKS} weeks) @ ${BASE}. It runs async (~1-3 min); reviews land on your Progress + as notifications.`)
console.log(txt)
