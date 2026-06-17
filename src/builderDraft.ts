// A scratch list of exercises the user is collecting from around the app
// (e.g. "＋ Add to workout" on an exercise page). The builder ingests it on open.
import type { TemplateExercise } from './db'

const KEY = 'builderDraft'

export function getDraft(): TemplateExercise[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { return [] }
}
export function addToDraft(item: TemplateExercise) {
  const d = getDraft(); d.push(item); sessionStorage.setItem(KEY, JSON.stringify(d))
  return d.length
}
export function clearDraft() { sessionStorage.removeItem(KEY) }
export function draftCount() { return getDraft().length }
