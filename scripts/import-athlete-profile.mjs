// Import an engine athlete_profile.md into a Platyplus account's coachProfile.
// The coach reads this (engine-native markdown) to personalize plans & answers.
//
// Usage: node scripts/import-athlete-profile.mjs <store.json> <username> <profile.md>
//   e.g. node scripts/import-athlete-profile.mjs ./server/dev-data/store.json jmfiset \
//          ~/dev/cyclingcoach/codex_coach/athlete_profile.md
//
// NOTE: if a server is running against this store, restart it afterward so it
// reloads (an in-memory save() would otherwise overwrite this edit).
import { readFileSync, writeFileSync } from 'node:fs'

const [storePath, username, profilePath] = process.argv.slice(2)
if (!storePath || !username || !profilePath) {
  console.error('usage: node import-athlete-profile.mjs <store.json> <username> <profile.md>')
  process.exit(1)
}
const db = JSON.parse(readFileSync(storePath, 'utf8'))
const user = (db.users || []).find((u) => u.username === username)
if (!user) { console.error(`no such user "${username}" in ${storePath}`); process.exit(1) }
user.coachProfile = readFileSync(profilePath, 'utf8')
user.coachProfileAt = Date.now()
writeFileSync(storePath, JSON.stringify(db, null, 2))
console.log(`imported ${user.coachProfile.length} chars into "${username}" @ ${storePath}`)
