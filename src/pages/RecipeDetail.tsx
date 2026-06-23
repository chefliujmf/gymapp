import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { allRecipesById } from '../data/catalog'
import AddToCalendar from '../AddToCalendar'
import { attributionFor } from '../attribution'

// Imported recipes carry HTML tags + entities in their text — strip/decode to clean prose.
const clean = (s: string) => (s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&deg;/gi, '°').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&rsquo;|&#39;|&apos;/gi, '’').replace(/&quot;/gi, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ').trim()

// Keep only human-facing tags: drop cryptic codes (HCO), region/marketing junk
// ("AU/UK/US COMPLETE!"), anything with slashes or a bang.
const niceTag = (t: string) => {
  const x = clean(t)
  if (!x || x.length < 2) return false
  if (/[/!]/.test(x) || /complete/i.test(x)) return false
  if (/^[A-Z0-9]{2,5}$/.test(x)) return false
  return true
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const coachPick = (useLocation().state as { coachPick?: string } | null)?.coachPick
  const r = id ? allRecipesById[id] : undefined

  if (!r) return <div className="empty"><div className="big">🤷</div>Recipe not found.</div>

  const hasMacros = r.kcal > 0 || r.protein > 0
  const heroStyle = r.thumbnail
    ? { backgroundImage: `url(${r.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero" style={heroStyle}>
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          {!r.thumbnail && '🍽️'}
        </div>
      </div>

      <div className="detail-body">
        {coachPick && <div className="coachpick"><b>Coach’s pick</b> — {coachPick}</div>}
        <span className="eyebrow">{r.category}</span>
        <h1>{r.title}</h1>

        <AddToCalendar item={{ type: 'meal', title: r.title, refId: r.id, mealType: r.category, kcal: r.kcal }} />

        {hasMacros ? (
          <div className="stat-grid">
            <div className="stat"><div className="v">{r.kcal}</div><div className="k">kcal</div></div>
            <div className="stat"><div className="v">{r.protein}g</div><div className="k">protein</div></div>
            <div className="stat"><div className="v">{r.carbs}g</div><div className="k">carbs</div></div>
            <div className="stat"><div className="v">{r.fat}g</div><div className="k">fat</div></div>
          </div>
        ) : (
          <p className="meta" style={{ marginTop: 10 }}>{r.minutes} min · macros not available for imported recipes</p>
        )}

        <div>{[...new Set(r.tags.filter(niceTag).map(clean))].map((t) => <span key={t} className="tag">{t}</span>)}</div>

        <div className="section-title">Ingredients</div>
        <ul className="bullets">
          {r.ingredients.map((ing, i) => <li key={i}>{clean(ing)}</li>)}
        </ul>

        <div className="section-title">Method</div>
        <ol className="steps">
          {r.steps.map(clean).filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}
        </ol>

        {(() => {
          // r.source is a source name ('themealdb'/'centr') or, for older data, a URL.
          const a = attributionFor(r.source)
          if (a) return <p className="meta" style={{ marginTop: 18, opacity: 0.7 }}>Source: {a.url ? <a className="demo-link" href={a.url} target="_blank" rel="noreferrer">{a.label} ↗</a> : a.label} · {a.license}</p>
          let host = ''
          try { host = r.source ? new URL(r.source).hostname : '' } catch { host = '' }
          return host ? <p className="meta" style={{ marginTop: 18 }}>Source: <a className="demo-link" href={r.source} target="_blank" rel="noreferrer">{host} ↗</a></p> : null
        })()}
      </div>
    </div>
  )
}
