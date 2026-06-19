# Platyplus MCP

An [MCP](https://modelcontextprotocol.io) server that lets an **AI coach** create a
Platyplus account's training & nutrition through **typed tools** instead of writing
free-text into an intervals.icu event description.

Why: coaches used to push workouts by hand-formatting `[gymapp] 1 rounds • Squat — 4×8`
text into intervals. Free-text drifts and breaks parsing (it has, twice). With this MCP
the coach calls `create_workout({date, exercises:[{exId, sets, reps}]})` — structured,
validated, with an explicit date — and Platyplus stores it canonically and mirrors the
**correct** format to intervals for display. Same server backs the cyclingcoach,
bertfitnesscoach, and the in-app assistant.

## Tools

| Tool | What it does |
|------|--------------|
| `search_exercises({query, limit?})` | Find exercises by name → `exId` + demo media. Use the `exId` in `create_workout`. |
| `create_workout({date, title, exercises[], rounds?, notes?, id?})` | Schedule a gym workout. Mirrors to intervals canonically. Re-call with same `id` to update. |
| `create_ride({date, title, segments[], ftp?, notes?, id?})` | Structured bike workout (power intervals → real intervals.icu steps). |
| `create_run({date, title, segments[], notes?, id?})` | Structured run (pace/effort intervals). |
| `schedule_meal({date, title, recipeId?, mealType?, kcal?})` | Put a meal on a day. |
| `schedule_mind({date, title, minutes?, refId?})` | Put a mind/recovery session on a day. |
| `add_note({date, notes, title?})` | Free-text note on a day. |
| `list_schedule({from, to})` | Everything planned in a range (plans + items). |
| `remove_workout({id})` / `remove_item({id})` | Delete by id. |

`exercises[]` items: `{ name, exId?, mode?('reps'|'timed'), sets?, reps?, weight?(kg), seconds?(timed), rest? }`.
`segments[]` items: `{ minutes, powerStart(%), powerEnd?(%, default=start), label? }`.
Dates are `YYYY-MM-DD`. Omit `id` to create (the new id is returned); pass it back to update.

## Configure

Two env vars:

- `PLATYPLUS_URL` — default `https://platyplus.duckdns.org`
- `PLATYPLUS_TOKEN` — the account's **Coach API token** (in the app: Profile → Coach API).
  Each account (you, your wife) has its own token, so the coach only ever touches that account.

### Add to a coach repo (Claude Code)

`.mcp.json` in the coach repo (keep the token out of git — see note):

```json
{
  "mcpServers": {
    "platyplus": {
      "command": "node",
      "args": ["/Users/jmfiset/dev/gymapp/mcp/server.js"],
      "env": {
        "PLATYPLUS_URL": "https://platyplus.duckdns.org",
        "PLATYPLUS_TOKEN": "<the account Coach API token>"
      }
    }
  }
}
```

Or: `claude mcp add platyplus --env PLATYPLUS_TOKEN=… -- node /Users/jmfiset/dev/gymapp/mcp/server.js`

> **Token hygiene:** don't commit the token. Put it in the coach repo's local secrets
> (e.g. `.secrets/`, gitignored) and reference it, or use a wrapper that exports it.

## Install / run

```bash
cd mcp && npm install
PLATYPLUS_TOKEN=… node server.js     # speaks MCP over stdio
```

## Notes

- Workouts (gym/ride/run) are stored as plans and mirrored to intervals.icu **only if the
  account has an intervals key set**; otherwise they live in Platyplus only.
- Meals/mind/notes are Platyplus-only (no intervals push).
- The text encode/parse (`[gymapp] …`) remains as the intervals *display* mirror — this MCP
  is the authoritative create path.
