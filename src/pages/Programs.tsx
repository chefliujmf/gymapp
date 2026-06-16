import { programs } from '../data/catalog'
import { ProgramCard } from '../ui'

export default function Programs() {
  return (
    <div>
      <div className="page-head">
        <h1>Programs</h1>
        <p>Structured multi-week plans</p>
      </div>
      <div className="stack">
        {programs.map((p) => <ProgramCard key={p.id} p={p} />)}
      </div>
    </div>
  )
}
