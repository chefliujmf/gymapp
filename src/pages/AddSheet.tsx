import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calApi, newId } from '../calendar'
import { recipes, mindSessions, endurance, workouts } from '../data/catalog'
import { segmentsFromEndurance } from '../ride'
import type { WorkoutTemplate, RideTemplate } from '../db'
import { Bike, Dumbbell, Footprints, Salad, Brain, StickyNote, X, Upload } from 'lucide-react'

export type SheetType = '' | 'ride' | 'run' | 'gym' | 'meal' | 'mind' | 'note'

export const colorFor = (s: string) => (s === 'cycling' || s === 'ride' ? '#34e07d' : s === 'running' || s === 'run' ? '#ffb13d' : s === 'gym' ? '#7fd1ff' : s === 'meal' ? '#ff8fb1' : s === 'mind' ? '#b98cff' : '#9aa3b2')
export const iconFor = (s: string, sz = 15) => (s === 'cycling' || s === 'ride' ? <Bike size={sz} /> : s === 'running' || s === 'run' ? <Footprints size={sz} /> : s === 'gym' ? <Dumbbell size={sz} /> : s === 'meal' ? <Salad size={sz} /> : s === 'mind' ? <Brain size={sz} /> : <StickyNote size={sz} />)

/** The Add / Substitute bottom sheet — shared by the Calendar (Plan) page and the
 *  Today page. #146: Today's "Add" opens this IN PLACE (no navigation to /plan).
 *  Substitute mode is driven by `substitute` + `lockType` so this component does
 *  NOT depend on the Calendar's `Entry` type (avoids a circular import). */
export function AddSheet({ date, substitute, lockType, ftp, templates, rideTemplates, onClose, onAdd, onReplaced }: { date: string; substitute?: boolean; lockType?: SheetType; ftp: number; templates: WorkoutTemplate[]; rideTemplates: RideTemplate[]; onClose: () => void; onAdd: () => void; onReplaced?: () => void }) {
  // Substitute is type-LOCKED to the replaced entry — pre-select its type and hide the picker.
  const [type, setType] = useState<SheetType>(() => lockType || '')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [count, setCount] = useState(0)
  const navigate = useNavigate()

  // Replace mode adds one then swaps out the old entry. Otherwise stay open so
  // you can quick-add several to the same day; "Done" closes.
  async function add(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      if (substitute) { onReplaced?.(); return }
      setCount((c) => c + 1); setNote(''); onAdd()
    } catch { /* keep the sheet open */ } finally { setBusy(false) }
  }

  const rideRun = (sport: 'ride' | 'run') => endurance.filter((w) => w.sport === (sport === 'ride' ? 'cycling' : 'running') && (!q || w.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 40)
  const meals = recipes.filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const minds = mindSessions.filter((m) => !q || m.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><strong>{substitute ? 'Substitute on' : 'Add to'} {new Date(date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{count > 0 ? ` · ${count} added` : ''}</strong><button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={onClose}>{count > 0 ? 'Done' : <X size={18} />}</button></div>

        {!type && (
          <>
            <div className="sheet-types">
              {([['ride', 'Ride', Bike], ['run', 'Run', Footprints], ['gym', 'Gym', Dumbbell], ['meal', 'Meal', Salad], ['mind', 'Mind', Brain], ['note', 'Note', StickyNote]] as const).map(([t, label, Icon]) => (
                <button key={t} className="sheet-type" style={{ color: colorFor(t) }} onClick={() => setType(t)}><Icon size={22} /><span>{label}</span></button>
              ))}
            </div>
            {/* Import a COMPLETED activity (vs the planned items above) — #131. Opens the
                Log-activity importer with this day prefilled; it offers to link a plan. */}
            {!substitute && (
              <button className="card import-row" onClick={() => { onClose(); navigate('/log-activity?date=' + date) }}>
                <span className="import-row__ic"><Upload size={18} /></span>
                <div className="card-body"><h3>Import an activity</h3><div className="meta">Something you already did — .fit/.gpx/.tcx or by hand · links to a plan if there is one</div></div>
              </button>
            )}
          </>
        )}

        {type && type !== 'note' && (
          <>
            <input className="search" autoFocus placeholder={`Search ${type}…`} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="stack sheet-list">
              {type === 'gym' && templates.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())).map((t) => (
                <button key={t.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: 'gym', title: t.name, rounds: t.rounds, exercises: t.exercises.map((x) => ({ name: x.name, exId: x.exId, mode: x.mode || 'reps', seconds: x.seconds, sets: x.sets, reps: x.reps, weight: x.weight, rest: x.rest })) }))}>
                  <div className="card-row"><div className="thumb"><Dumbbell size={18} /></div><div className="card-body"><h3>{t.name}</h3><div className="meta">My workout · {t.exercises.length} exercises{t.rounds > 1 ? ` · ${t.rounds} rounds` : ''}</div></div></div>
                </button>
              ))}
              {type === 'gym' && workouts.filter((w) => !q || w.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40).map((w) => (
                <button key={w.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: 'gym', title: w.title, rounds: 1, exercises: (w.exercises || []).map((e) => ({ name: e.name, mode: e.seconds ? 'timed' : 'reps', seconds: e.seconds || 0, rest: 0 })) }))}>
                  <div className="card-row"><div className="thumb"><Dumbbell size={18} /></div><div className="card-body"><h3>{w.title}</h3><div className="meta">{w.discipline} · {(w.exercises || []).length} exercises · {w.duration} min</div></div></div>
                </button>
              ))}
              {(type === 'ride' || type === 'run') && rideTemplates.filter((t) => t.sport === type && (!q || t.name.toLowerCase().includes(q.toLowerCase()))).map((t) => (
                <button key={t.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: type, title: t.name, ftp, segments: t.segments }))}>
                  <div className="card-row"><div className="thumb">{iconFor(type)}</div><div className="card-body"><h3>{t.name}</h3><div className="meta">My {type} · {Math.round(t.segments.reduce((s, x) => s + x.duration, 0) / 60)} min · {t.segments.length} segments</div></div></div>
                </button>
              ))}
              {(type === 'ride' || type === 'run') && rideRun(type).map((w) => (
                <button key={w.id} className="card" disabled={busy} onClick={() => add(() => calApi.savePlan({ id: newId(), date, sport: type, title: w.name, ftp, segments: segmentsFromEndurance(w) }))}>
                  <div className="card-row"><div className="thumb">{iconFor(type)}</div><div className="card-body"><h3>{w.name}</h3><div className="meta">{w.duration} min · {w.category}</div></div></div>
                </button>
              ))}
              {type === 'meal' && meals.map((r) => (
                <button key={r.id} className="card" disabled={busy} onClick={() => add(() => calApi.saveItem({ date, type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal }))}>
                  <div className="card-row"><div className="thumb"><Salad size={18} /></div><div className="card-body"><h3>{r.title}</h3><div className="meta">{r.category} · {r.kcal} kcal</div></div></div>
                </button>
              ))}
              {type === 'mind' && minds.map((m) => (
                <button key={m.id} className="card" disabled={busy} onClick={() => add(() => calApi.saveItem({ date, type: 'mind', title: m.title, refId: m.id, minutes: m.duration }))}>
                  <div className="card-row"><div className="thumb"><Brain size={18} /></div><div className="card-body"><h3>{m.title}</h3><div className="meta">{m.kind}{m.duration ? ` · ${m.duration} min` : ''}</div></div></div>
                </button>
              ))}
            </div>
            {!substitute && <button className="auth-link" onClick={() => { setType(''); setQ('') }}>‹ Back</button>}
          </>
        )}

        {type === 'note' && (
          <>
            <textarea className="search" style={{ minHeight: 90, resize: 'vertical' }} autoFocus placeholder="Write a note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn" disabled={busy || !note.trim()} onClick={() => add(() => calApi.saveItem({ date, type: 'note', title: note.trim().slice(0, 40), notes: note.trim() }))}>Add note</button>
            {!substitute && <button className="auth-link" onClick={() => setType('')}>‹ Back</button>}
          </>
        )}
      </div>
    </div>
  )
}
