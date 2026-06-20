import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { allExercisesById, workouts } from '../data/catalog'
import { addToDraft } from '../builderDraft'
import { getSetting, setSetting } from '../db'
import { attributionFor } from '../attribution'

export default function ExerciseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ex = id ? allExercisesById[id] : undefined
  const [added, setAdded] = useState(0)
  const gender = (useLiveQuery(() => getSetting('gender')) as 'male' | 'female' | undefined) ?? 'male'

  // Which library workouts feature this exercise (by name).
  const usedIn = useMemo(
    () => (ex ? workouts.filter((w) => (w.exercises || []).some((e) => e.name === ex.name)).slice(0, 8) : []),
    [ex],
  )

  if (!ex) return <div className="empty"><div className="big">🤷</div>Exercise not found.</div>

  const hasFemale = !!ex.videoFemale
  const female = gender === 'female' && hasFemale
  const video = female ? ex.videoFemale : ex.video
  const poster = female ? (ex.imageFemale || ex.image) : ex.image
  const facets = [ex.equipment, ex.muscle, ex.difficulty].filter(Boolean) as string[]

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero detail-hero--video">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {video
            ? <video key={video} className="ex-hero-video" src={video} poster={poster} controls autoPlay loop muted playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} />
            : poster && <img className="ex-hero-video" src={poster} alt={ex.name} />}
        </div>
      </div>

      <div className="detail-body">
        <span className="eyebrow">{ex.category}</span>
        <h1>{ex.name}</h1>

        {hasFemale && (
          <div className="seg" style={{ maxWidth: 200 }}>
            <button className={'seg__btn' + (gender === 'male' ? ' seg__btn--active' : '')} onClick={() => setSetting('gender', 'male')}>Men</button>
            <button className={'seg__btn' + (gender === 'female' ? ' seg__btn--active' : '')} onClick={() => setSetting('gender', 'female')}>Women</button>
          </div>
        )}

        {facets.length > 0 && (
          <div className="chips" style={{ marginTop: 4 }}>
            {facets.map((f) => <span key={f} className="chip">{f}</span>)}
          </div>
        )}
        {ex.seconds && <p className="lead">Typical work: {ex.seconds}s</p>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => setAdded(addToDraft({ exId: ex.id, name: ex.name, image: ex.image, video: ex.video, seconds: ex.seconds || 40, rest: 15 }))}>
            ＋ Add to workout
          </button>
          {added > 0 && <Link to="/build" className="btn btn--ghost" style={{ whiteSpace: 'nowrap', padding: '0 14px' }}>Build ({added}) →</Link>}
        </div>

        {ex.instructions && ex.instructions.length > 0 && (
          <>
            <div className="section-title">How to</div>
            <ol className="steps">
              {ex.instructions.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </>
        )}

        {(() => { const a = attributionFor(ex.source); return a ? (
          <p className="meta" style={{ marginTop: 14, opacity: 0.65 }}>
            Source: {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.label}</a> : a.label} · {a.license}
          </p>
        ) : null })()}

        {usedIn.length > 0 && (
          <>
            <div className="section-title">Featured in</div>
            <div className="stack">
              {usedIn.map((w) => (
                <Link key={w.id} to={`/workouts/${w.id}`} className="ex-row">
                  <div className="ex-thumb-sm" style={w.thumbnail ? { backgroundImage: `url(${w.thumbnail})` } : undefined} />
                  <div className="ex-row-text"><h4>{w.title}</h4><div className="ex-rx">{w.duration} min · {w.discipline}</div></div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
