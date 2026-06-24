import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mindSessions } from '../data/catalog'
import type { MindKind } from '../types'
import { MindCard } from '../ui'

const kinds: (MindKind | 'all')[] = ['all', 'meditation', 'breathwork', 'sleep', 'focus']
const CAP = 80

export default function Mind() {
  const [kind, setKind] = useState<MindKind | 'all'>('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return mindSessions.filter(
      (m) =>
        (kind === 'all' || m.kind === kind) &&
        (!needle || m.title.toLowerCase().includes(needle) || (m.summary || '').toLowerCase().includes(needle)),
    )
  }, [kind, q])

  const navigate = useNavigate()
  return (
    <div>
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back" style={{ marginBottom: 10 }}>‹</button>
      <div className="page-head">
        <h1>Mind</h1>
        <p>{mindSessions.length} sessions — meditation, breathwork, sleep & focus</p>
      </div>

      <input className="search" placeholder="Search sessions…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        {kinds.map((k) => (
          <button key={k} className={'chip' + (kind === k ? ' chip--active' : '')} onClick={() => setKind(k)}>
            {k === 'all' ? 'All' : k}
          </button>
        ))}
      </div>

      <p className="meta" style={{ margin: '4px 2px 10px' }}>
        {list.length} session{list.length === 1 ? '' : 's'}{list.length > CAP ? ` — showing first ${CAP}` : ''}
      </p>

      <div className="stack">
        {list.slice(0, CAP).map((m) => <MindCard key={m.id} m={m} />)}
        {list.length === 0 && <p className="empty">Nothing matches.</p>}
      </div>
    </div>
  )
}
