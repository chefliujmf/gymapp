import { useState } from 'react'
import { mindSessions } from '../data/catalog'
import type { MindKind } from '../types'
import { MindCard } from '../ui'

const kinds: (MindKind | 'all')[] = ['all', 'meditation', 'breathwork', 'sleep', 'focus']

export default function Mind() {
  const [kind, setKind] = useState<MindKind | 'all'>('all')
  const list = kind === 'all' ? mindSessions : mindSessions.filter((m) => m.kind === kind)

  return (
    <div>
      <div className="page-head">
        <h1>Mind</h1>
        <p>Meditation, breathwork and sleep</p>
      </div>

      <div className="chips">
        {kinds.map((k) => (
          <button key={k} className={'chip' + (kind === k ? ' chip--active' : '')} onClick={() => setKind(k)}>
            {k === 'all' ? 'All' : k}
          </button>
        ))}
      </div>

      <div className="stack">
        {list.map((m) => <MindCard key={m.id} m={m} />)}
        {list.length === 0 && <p className="empty">Nothing here yet.</p>}
      </div>
    </div>
  )
}
