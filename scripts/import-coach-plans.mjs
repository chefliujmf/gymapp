#!/usr/bin/env node
// Convert your cyclingcoach plan JSON into app catalog content.
// Reads the sibling cyclingcoach project's active plans and writes
// src/data/coach/plan.json (gitignored, merged into the catalog at build).
//
// Gym sessions (gym_table) -> strength Workouts with per-exercise demo links.
// Bike sessions (warmup/main_set/cooldown) -> cardio Workouts with a readable
// interval breakdown. The dated sessions are assembled into a "My Training
// Plan" Program in date order.
//
// Usage:  node scripts/import-coach-plans.mjs [path-to-cyclingcoach]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COACH_ROOT = process.argv[2] || resolve(__dirname, '../../cyclingcoach')
const ACTIVE_DIR = join(COACH_ROOT, 'codex_coach/plans/active')
const OUT_DIR = resolve(__dirname, '../src/data/coach')

if (!existsSync(ACTIVE_DIR)) {
  console.error(`No active plans dir at: ${ACTIVE_DIR}\nPass the cyclingcoach path as arg 1.`)
  process.exit(1)
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const demoLink = (name) =>
  `https://musclewiki.com/exercises?search=${encodeURIComponent(String(name).split(/\bor\b|,|\//)[0].trim())}`

function gymToWorkout(w) {
  const table = w.gym_table || []
  if (!table.length) return null
  return {
    id: 'coach-' + slug(w.workout_id || w.title),
    title: w.title || 'Coach Strength Session',
    discipline: w.discipline === 'mobility' ? 'mobility' : 'strength',
    duration: Math.round((w.estimated_duration_sec || (w.constraints?.max_duration_min || 60) * 60) / 60),
    level: 'intermediate',
    equipment: w.constraints?.equipment || [],
    summary: w.objective || 'Coach-prescribed strength session.',
    coach: 'Your Coach',
    planned_date: w.planned_date || null,
    exercises: table.map((r) => ({
      name: r.exercise || r.movement,
      prescription: [r.sets && r.reps ? `${r.sets} x ${r.reps}` : r.reps || '', r.rest ? `rest ${r.rest}` : '']
        .filter(Boolean)
        .join(' · '),
      note: r.notes || (r.movement && r.exercise ? r.movement : undefined),
      demoUrl: demoLink(r.exercise || r.movement),
    })),
  }
}

function pct(target) {
  if (target?.power_pct_ftp) {
    const [a, b] = target.power_pct_ftp
    return `${Math.round(a * 100)}-${Math.round(b * 100)}% FTP`
  }
  if (target?.rpe) return `RPE ${target.rpe.join('-')}`
  return ''
}

function bikeToWorkout(w) {
  const steps = []
  const push = (arr, label) => {
    for (const blk of arr || []) {
      const inner = blk.steps || [blk]
      const reps = blk.repeat && blk.repeat > 1 ? `${blk.repeat}× ` : ''
      for (const s of inner) {
        const mins = s.duration_sec ? `${Math.round(s.duration_sec / 60)} min` : ''
        steps.push({
          name: `${label}${s.type ? ' · ' + s.type.replace('_', ' ') : ''}`,
          prescription: [reps + mins, pct(s.target)].filter(Boolean).join(' @ '),
          note: s.notes || undefined,
        })
      }
    }
  }
  push(w.warmup, 'Warm-up')
  push(w.main_set, 'Main')
  push(w.cooldown, 'Cool-down')
  if (!steps.length) return null
  const totalMin = w.constraints?.max_duration_min || Math.round((w.estimated_duration_sec || 3600) / 60)
  return {
    id: 'coach-' + slug(w.workout_id || w.title),
    title: w.title || 'Coach Ride',
    discipline: 'cardio',
    duration: totalMin,
    level: 'advanced',
    equipment: w.constraints?.equipment || ['bike'],
    summary: w.objective || 'Coach-prescribed ride.',
    coach: 'Your Coach',
    planned_date: w.planned_date || null,
    exercises: steps,
  }
}

function convert(w) {
  if (w.gym_table) return gymToWorkout(w)
  if (w.main_set || w.warmup) return bikeToWorkout(w)
  return null
}

const workouts = []
const seen = new Set()
for (const file of readdirSync(ACTIVE_DIR).filter((f) => f.endsWith('.json'))) {
  let data
  try {
    data = JSON.parse(readFileSync(join(ACTIVE_DIR, file), 'utf8'))
  } catch {
    continue
  }
  const sessions = Array.isArray(data.workouts) ? data.workouts : [data]
  for (const s of sessions) {
    const w = convert(s)
    if (w && !seen.has(w.id)) {
      seen.add(w.id)
      workouts.push(w)
    }
  }
}

// Build a dated training-plan program from sessions that have a planned_date.
const dated = workouts
  .filter((w) => w.planned_date)
  .sort((a, b) => a.planned_date.localeCompare(b.planned_date))

const program = {
  id: 'coach-training-plan',
  title: 'My Training Plan',
  discipline: 'cardio',
  weeks: Math.max(1, Math.ceil(dated.length / 7)),
  daysPerWeek: Math.min(7, dated.length || 1),
  level: 'advanced',
  summary: 'Your live plan imported from your cycling coach — rides and gym sessions in order.',
  schedule: (dated.length ? dated : workouts).map((w, i) => ({
    day: i + 1,
    label: w.planned_date || w.discipline,
    workoutId: w.id,
  })),
}

// strip the helper field before writing
for (const w of workouts) delete w.planned_date

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'plan.json'), JSON.stringify({ workouts, programs: workouts.length ? [program] : [] }, null, 2))
console.log(`Imported ${workouts.length} coach workouts -> src/data/coach/plan.json`)
console.log(`Training plan program: ${program.schedule.length} sessions`)
