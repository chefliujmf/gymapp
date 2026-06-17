import { trainers } from '../data/catalog'
import { TrainerCard } from '../ui'

export default function Trainers() {
  return (
    <div>
      <div className="page-head">
        <h1>Trainers</h1>
        <p>The coaches behind your sessions</p>
      </div>
      <div className="stack">
        {trainers.map((t) => <TrainerCard key={t.id} t={t} />)}
      </div>
    </div>
  )
}
