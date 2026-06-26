// Calendar items (meal/mind/note) + UI authoring of workout plans (which push to
// intervals). Workout plans themselves are read via fetchGymPlans (plan.ts).
export interface CalItem {
  id: string
  date: string
  type: 'meal' | 'mind' | 'note'
  title: string
  refId?: string
  mealType?: string
  kcal?: number
  minutes?: number
  notes?: string
  why?: string // coach's per-pick reason (shown as "Coach's pick: …")
}

async function j<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/auth' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return (res.status === 204 ? null : await res.json()) as T
}

export const newId = () => 'pp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const calApi = {
  items: (from: string, to: string) => j<CalItem[]>(`/items?from=${from}&to=${to}`),
  saveItem: (it: Partial<CalItem>) => j<CalItem>('/items', { body: it }),
  delItem: (id: string) => j<{ ok: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  savePlan: (p: Record<string, unknown>) => j<Record<string, unknown>>('/plans', { body: p }),
  delPlan: (id: string) => j<{ ok: boolean }>(`/plans/${id}`, { method: 'DELETE' }),
  // Push every Platyplus plan in the window OUT to intervals (dedup-aware) — the re-sync button (#150).
  resyncPlans: (from: string, to: string) => j<{ total: number; created: number; linked: number; updated: number; errors: number; skipped?: string }>('/plans/resync', { body: { from, to } }),
}
