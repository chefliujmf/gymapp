import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exercises as library } from '../data/catalog'
import { saveTemplate, getTemplate, type TemplateExercise } from '../db'
import { scheduleGymWorkout } from '../intervals'
import { getDraft, clearDraft } from '../builderDraft'

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function WorkoutBuilder() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') ? Number(params.get('id')) : undefined

  const [name, setName] = useState('')
  const [rounds, setRounds] = useState(1)
  const [items, setItems] = useState<TemplateExercise[]>([])
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (editId != null) {
      getTemplate(editId).then((t) => { if (t) { setName(t.name); setRounds(t.rounds); setItems(t.exercises) } })
    } else {
      // Ingest anything collected via "＋ Add to workout" elsewhere.
      const draft = getDraft()
      if (draft.length) { setItems(draft); clearDraft() }
    }
  }, [editId])

  const results = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return library.slice(0, 40)
    return library.filter((e) => e.name.toLowerCase().includes(n)).slice(0, 40)
  }, [q])

  function add(e: typeof library[number]) {
    setItems((xs) => [...xs, { exId: e.id, name: e.name, image: e.image, video: e.video, mode: 'timed', seconds: e.seconds || 40, rest: 15, sets: 3, reps: 10 }])
  }
  const update = (i: number, patch: Partial<TemplateExercise>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const remove = (i: number) => setItems((xs) => xs.filter((_, j) => j !== i))
  const move = (i: number, d: number) => setItems((xs) => {
    const j = i + d; if (j < 0 || j >= xs.length) return xs
    const c = [...xs];[c[i], c[j]] = [c[j], c[i]]; return c
  })

  const totalMin = Math.round((items.reduce((s, x) =>
    s + (x.mode === 'reps' ? (x.sets ?? 3) * (30 + x.rest) : x.seconds + x.rest), 0) * rounds) / 60)

  async function persist(): Promise<number> {
    const id = await saveTemplate({ id: editId, name: name.trim() || 'My workout', rounds, exercises: items })
    return Number(id)
  }
  async function onSave() {
    if (!items.length) return setStatus('Add at least one exercise.')
    await persist(); setStatus('✓ Saved to your workouts'); setTimeout(() => navigate('/workouts'), 700)
  }
  async function onSchedule() {
    if (!items.length) return setStatus('Add at least one exercise.')
    setStatus('Scheduling…')
    try {
      const id = await persist()
      await scheduleGymWorkout(date, name.trim() || 'My workout', id, items.map((x) => ({ name: x.name, exId: x.exId, mode: x.mode, seconds: x.seconds, rest: x.rest, sets: x.sets, reps: x.reps, weight: x.weight })), rounds)
      setStatus(`✓ Added to ${date} on intervals.icu`)
    } catch (e) {
      setStatus(`✗ ${(e as Error).message === 'NO_KEY' ? 'Connect intervals.icu in Profile first' : 'Failed: ' + (e as Error).message}`)
    }
  }

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{editId != null ? 'Edit workout' : 'Build a workout'}</h1>
        <button className="back" onClick={() => navigate(-1)}>Close</button>
      </div>

      <input className="search" placeholder="Workout name (e.g. Leg Day)" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginTop: 8 }}>
        <span>Rounds</span>
        <div className="chips" style={{ margin: 0 }}>
          <button className="rctrl" style={{ minWidth: 40, height: 36, color: 'var(--ink,#111)', background: 'rgba(0,0,0,.06)' }} onClick={() => setRounds((r) => Math.max(1, r - 1))}>−</button>
          <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{rounds}</span>
          <button className="rctrl" style={{ minWidth: 40, height: 36, color: 'var(--ink,#111)', background: 'rgba(0,0,0,.06)' }} onClick={() => setRounds((r) => r + 1)}>+</button>
        </div>
      </div>

      <div className="section-title">Exercises {items.length > 0 && `· ~${totalMin} min`}</div>
      {items.length === 0 && <p className="meta">No exercises yet — add some below.</p>}
      <div className="stack" style={{ gap: 8 }}>
        {items.map((x, i) => (
          <div key={i} className="ex-row" style={{ flexWrap: 'wrap' }}>
            <div className="ex-thumb-xs" style={x.image ? { backgroundImage: `url(${x.image})` } : undefined} />
            <div className="ex-row-text" style={{ flex: 1 }}>
              <h4>{x.name}</h4>
              <div className="seg seg--mini" style={{ margin: '6px 0 0', maxWidth: 190 }}>
                <button className={'seg__btn' + ((x.mode ?? 'timed') === 'timed' ? ' seg__btn--active' : '')} onClick={() => update(i, { mode: 'timed' })}>Timed</button>
                <button className={'seg__btn' + (x.mode === 'reps' ? ' seg__btn--active' : '')} onClick={() => update(i, { mode: 'reps' })}>Sets×reps</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {(x.mode ?? 'timed') === 'timed' ? (
                  <>
                    <label className="mini">work<input type="number" value={x.seconds} onChange={(e) => update(i, { seconds: Number(e.target.value) })} />s</label>
                    <label className="mini">rest<input type="number" value={x.rest} onChange={(e) => update(i, { rest: Number(e.target.value) })} />s</label>
                  </>
                ) : (
                  <>
                    <label className="mini">sets<input type="number" value={x.sets ?? 3} onChange={(e) => update(i, { sets: Number(e.target.value) })} /></label>
                    <label className="mini">reps<input type="number" value={x.reps ?? 10} onChange={(e) => update(i, { reps: Number(e.target.value) })} /></label>
                    <label className="mini">kg<input type="number" value={x.weight ?? ''} onChange={(e) => update(i, { weight: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                    <label className="mini">rest<input type="number" value={x.rest} onChange={(e) => update(i, { rest: Number(e.target.value) })} />s</label>
                  </>
                )}
              </div>
            </div>
            <div className="chips" style={{ margin: 0, gap: 2 }}>
              <button className="chip" onClick={() => move(i, -1)}>↑</button>
              <button className="chip" onClick={() => move(i, 1)}>↓</button>
              <button className="chip" style={{ color: 'var(--danger,#c00)' }} onClick={() => remove(i)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => setPicking((p) => !p)}>
        {picking ? 'Done adding' : '＋ Add exercises'}
      </button>

      {picking && (
        <div className="card" style={{ padding: 12, marginTop: 8 }}>
          <input className="search" placeholder="Search the library…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="stack" style={{ gap: 4, maxHeight: '40vh', overflow: 'auto' }}>
            {results.map((e) => (
              <div key={e.id} className="ex-row" onClick={() => add(e)} style={{ cursor: 'pointer' }}>
                <div className="ex-thumb-xs" style={e.image ? { backgroundImage: `url(${e.image})` } : undefined} />
                <div className="ex-row-text"><h4>{e.name}</h4><div className="ex-rx">{e.category}</div></div>
                <span style={{ fontSize: 20, color: 'var(--accent,#0a0)' }}>＋</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-title">Schedule</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input className="search" style={{ margin: 0 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn" style={{ whiteSpace: 'nowrap', width: 'auto', padding: '0 16px' }} onClick={onSchedule}>Add to day</button>
      </div>

      <button className="btn" style={{ marginTop: 16 }} onClick={onSave}>Save to my workouts</button>
      {status && <p className="meta" style={{ marginTop: 10, textAlign: 'center' }}>{status}</p>}
    </div>
  )
}
