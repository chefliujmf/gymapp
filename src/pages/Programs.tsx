import { programs } from '../data/catalog'
import PageHead from '../PageHead'
import { ProgramCard } from '../ui'

export default function Programs() {
  return (
    <div>
      <PageHead title="Programs" sub="Structured multi-week plans" />
      <div className="stack">
        {programs.map((p) => <ProgramCard key={p.id} p={p} />)}
      </div>
    </div>
  )
}
