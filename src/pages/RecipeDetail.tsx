import { useNavigate, useParams } from 'react-router-dom'
import { allRecipesById } from '../data/catalog'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const r = id ? allRecipesById[id] : undefined

  if (!r) return <div className="empty"><div className="big">🤷</div>Recipe not found.</div>

  return (
    <div>
      <div className="detail-top">
        <div className="detail-hero">
          <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
          🍽️
        </div>
      </div>

      <div className="detail-body">
        <span className="eyebrow">{r.category}</span>
        <h1>{r.title}</h1>

        <div className="stat-grid">
          <div className="stat"><div className="v">{r.kcal}</div><div className="k">kcal</div></div>
          <div className="stat"><div className="v">{r.protein}g</div><div className="k">protein</div></div>
          <div className="stat"><div className="v">{r.carbs}g</div><div className="k">carbs</div></div>
          <div className="stat"><div className="v">{r.fat}g</div><div className="k">fat</div></div>
        </div>

        <div>{r.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>

        <div className="section-title">Ingredients</div>
        <ul className="bullets">
          {r.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
        </ul>

        <div className="section-title">Method</div>
        <ol className="steps">
          {r.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
    </div>
  )
}
