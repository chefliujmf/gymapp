#!/usr/bin/env node
// Collect content from YOUR OWN Centr account into the app catalog.
//
// This reuses the logged-in browser session already saved by the cyclingcoach
// project (.secrets/centr_state.json) so you don't re-enter credentials.
// Output: src/data/centr/workouts.json  (gitignored, merged at build time).
//
// Personal use only: pulls from a subscription you pay for, onto your own
// server. Do not redistribute the content.
//
// Requires Playwright (optional dep):
//   npm i -D playwright && npx playwright install chromium
//
// Usage:
//   CENTR_STATE=/Users/jmfiset/dev/cyclingcoach/.secrets/centr_state.json \
//   node scripts/centr-collect.mjs

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../src/data/centr')
const STATE =
  process.env.CENTR_STATE ||
  resolve(__dirname, '../../cyclingcoach/.secrets/centr_state.json')

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error(
    'Playwright is not installed.\n' +
      '  npm i -D playwright && npx playwright install chromium\n' +
      'Then re-run this script.',
  )
  process.exit(1)
}

if (!existsSync(STATE)) {
  console.error(
    `No saved Centr session at:\n  ${STATE}\n` +
      'Run the cyclingcoach collector once to log in, or set CENTR_STATE.',
  )
  process.exit(1)
}

const slug = (s) =>
  's-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ storageState: STATE })
const page = await ctx.newPage()

console.log('Opening Centr workout library…')
await page.goto('https://centr.com/workouts', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)

// NOTE: Centr's DOM changes over time. These selectors are a starting point —
// adjust to whatever the live page exposes. We capture metadata only here;
// video URLs are resolved separately and pointed at your Emby library.
const cards = await page.$$eval('a[href*="/workout/"]', (els) =>
  els.slice(0, 60).map((el) => ({
    href: el.getAttribute('href') || '',
    title: (el.querySelector('h2,h3,[class*=title]')?.textContent || el.textContent || '')
      .trim()
      .slice(0, 80),
  })),
)

const seen = new Set()
const workouts = []
for (const c of cards) {
  if (!c.title || seen.has(c.title)) continue
  seen.add(c.title)
  workouts.push({
    id: slug(c.title),
    title: c.title,
    discipline: 'strength',
    duration: 30,
    level: 'intermediate',
    equipment: [],
    summary: 'Imported from Centr. Edit discipline/duration as needed.',
    source: 'https://centr.com' + c.href,
    // videoUrl: set this to your Emby stream URL once the file is in your library
  })
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(
  resolve(OUT_DIR, 'workouts.json'),
  JSON.stringify({ workouts }, null, 2),
)
console.log(`Wrote ${workouts.length} workouts -> src/data/centr/workouts.json`)

await browser.close()
