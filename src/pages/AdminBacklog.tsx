import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Trash2, RotateCcw, ArrowDown, ArrowUp } from 'lucide-react'
import { authApi, type BacklogTriage, type BacklogPriority } from '../auth/api'

// #438 — in-app admin backlog. The item LIST is the bundled backlog.json (built from FEEDBACK-LOG.md on
// deploy, lazy-loaded so it's out of the main bundle); JM's live triage (priority / comments / discard)
// is the DB overlay. Filter-first (Option A) — 250+ open items, so you filter down + triage a row inline.
type Item = { n: number; status: 'todo' | 'build' | 'done'; title: string; summary: string }
type StatusFilter = 'open' | 'todo' | 'build' | 'done' | 'discarded'
type PriFilter = '' | BacklogPriority | 'unset'
type Sort = 'pri' | 'num' | 'status' | 'cmts'

const PRI_LABEL: Record<BacklogPriority, string> = { hi: 'HIGH', med: 'MED', lo: 'LOW' }
const PRI_COLOR: Record<BacklogPriority, string> = { hi: '#ff6b6b', med: '#ffb454', lo: '#7a8699' }
const PRI_RANK: Record<string, number> = { hi: 0, med: 1, lo: 2, '': 3 }
const DOT: Record<string, string> = { build: '#ffb454', todo: '#8aa0ff', done: '#34e07d' }
const S_NAME: Record<string, string> = { build: 'Building', todo: 'To do', done: 'Done' }
const priChip = (p: BacklogPriority): CSSProperties => ({ fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 6, letterSpacing: '.03em', background: PRI_COLOR[p] + '22', color: PRI_COLOR[p] })

export default function AdminBacklog() {
  const [items, setItems] = useState<Item[]>([])
  const [triage, setTriage] = useState<BacklogTriage>({})
  const [ready, setReady] = useState(false)
  const [q, setQ] = useState('')
  const [sf, setSf] = useState<StatusFilter>('open')
  const [pf, setPf] = useState<PriFilter>('')
  const [sort, setSort] = useState<Sort>('pri')
  const [dir, setDir] = useState<'desc' | 'asc'>('desc') // sort both ways
  const [open, setOpen] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    import('../data/generated/backlog.json').then((m) => setItems((m.default as Item[]) || [])).finally(() => setReady(true))
    authApi.getBacklogTriage().then((r) => setTriage(r.triage || {})).catch(() => {})
  }, [])

  const tr = (n: number) => triage[String(n)] || {}
  async function patch(n: number, body: Parameters<typeof authApi.updateBacklog>[1]) {
    try { const r = await authApi.updateBacklog(n, body); setTriage((t) => ({ ...t, [String(n)]: r.triage || {} })) } catch { /* ignore */ }
  }
  const setPriority = (n: number, p: BacklogPriority) => patch(n, { priority: tr(n).priority === p ? null : p })
  const addComment = (n: number) => { const text = draft.trim(); if (!text) return; setDraft(''); patch(n, { comment: text }) }

  const counts = useMemo(() => {
    const c = { open: 0, todo: 0, build: 0, done: 0, discarded: 0 }
    for (const it of items) { const d = !!tr(it.n).discarded; if (d) { c.discarded++; continue } c[it.status]++; if (it.status !== 'done') c.open++ }
    return c
  }, [items, triage])

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const out = items.filter((it) => {
      const t = tr(it.n), disc = !!t.discarded
      if (sf === 'discarded') { if (!disc) return false } else if (disc) return false
      else if (sf === 'open') { if (it.status === 'done') return false } else if (it.status !== sf) return false
      if (pf === 'unset') { if (t.priority) return false } else if (pf && t.priority !== pf) return false
      if (ql && !`#${it.n} ${it.title} ${it.summary}`.toLowerCase().includes(ql)) return false
      return true
    })
    out.sort((a, b) => {
      const ta = tr(a.n), tb = tr(b.n)
      let cmp: number
      if (sort === 'num') cmp = b.n - a.n
      else if (sort === 'status') cmp = a.status.localeCompare(b.status) || b.n - a.n
      else if (sort === 'cmts') cmp = (tb.comments?.length || 0) - (ta.comments?.length || 0) || b.n - a.n
      else cmp = (PRI_RANK[ta.priority || ''] - PRI_RANK[tb.priority || '']) || b.n - a.n
      return dir === 'asc' ? -cmp : cmp
    })
    return out
  }, [items, triage, q, sf, pf, sort, dir])

  const statusChips: [StatusFilter, string, number][] = [['open', 'Open', counts.open], ['todo', 'To do', counts.todo], ['build', 'Building', counts.build], ['done', 'Done', counts.done], ['discarded', 'Discarded', counts.discarded]]
  const priChips: [PriFilter, string][] = [['hi', 'High'], ['med', 'Med'], ['lo', 'Low'], ['unset', 'Unset']]

  return (
    <div>
      <input className="search" placeholder="Search the backlog…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ marginBottom: 8 }}>
        {statusChips.map(([k, label, c]) => (
          <button key={k} className={'chip' + (sf === k ? ' chip--active' : '')} onClick={() => setSf(k)}>{label} <span style={{ opacity: .6 }}>{c}</span></button>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {priChips.map(([k, label]) => (
          <button key={k} className={'chip' + (pf === k ? ' chip--active' : '')} onClick={() => setPf(pf === k ? '' : k)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="meta">Sort</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ background: '#0b0e12', border: '1px solid #ffffff1a', color: 'var(--text,#eef1f4)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
          <option value="pri">Priority</option><option value="num">Item #</option><option value="status">Status</option><option value="cmts">Comments</option>
        </select>
        <button className="icon-btn" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))} aria-label={`Sort ${dir === 'desc' ? 'descending' : 'ascending'} — tap to flip`} title={dir === 'desc' ? 'High → low (tap for low → high)' : 'Low → high (tap for high → low)'} style={{ width: 32, height: 32, flexShrink: 0 }}>
          {dir === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
        </button>
        <span className="meta" style={{ marginLeft: 'auto' }}>{list.length} shown</span>
      </div>

      <div className="stack">
        {list.map((it) => {
          const t = tr(it.n), ex = open === it.n, cmts = t.comments || []
          return (
            <div key={it.n} className="card" style={{ padding: 0, opacity: t.discarded ? .55 : 1 }}>
              <div className="card-row" style={{ padding: '11px 12px', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={() => { setOpen(ex ? null : it.n); setDraft('') }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: DOT[it.status], flexShrink: 0 }} title={S_NAME[it.status]} />
                <span className="meta" style={{ fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>#{it.n}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                {t.priority && <span style={priChip(t.priority)}>{PRI_LABEL[t.priority]}</span>}
                {cmts.length > 0 && <span className="meta" style={{ flexShrink: 0, fontSize: 11 }}>💬{cmts.length}</span>}
              </div>
              {ex && (
                <div style={{ padding: '0 12px 13px', borderTop: '1px solid #ffffff10' }}>
                  <div style={{ color: '#c4cad4', fontSize: 13, margin: '10px 0 12px' }}>{it.summary}</div>
                  {cmts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {cmts.map((c) => (
                        <div key={c.at} style={{ background: '#0b0e12', border: '1px solid #ffffff12', borderRadius: 8, padding: '7px 10px', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--accent,#34e07d)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', marginRight: 6 }}>You</span>{c.text}</span>
                          <button className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }} aria-label="Delete comment" onClick={() => patch(it.n, { deleteCommentAt: c.at })}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <input className="search" style={{ flex: 1, marginBottom: 0 }} placeholder="Add a comment / direction…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addComment(it.n) }} />
                    <button className="btn" style={{ width: 'auto', padding: '0 14px' }} onClick={() => addComment(it.n)} disabled={!draft.trim()}>Post</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="meta" style={{ fontSize: 11 }}>Priority</span>
                    {(['hi', 'med', 'lo'] as BacklogPriority[]).map((p) => (
                      <button key={p} onClick={() => setPriority(it.n, p)} style={{ borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (t.priority === p ? PRI_COLOR[p] : '#ffffff1a'), background: t.priority === p ? PRI_COLOR[p] : '#0b0e12', color: t.priority === p ? '#12161c' : 'var(--text-dim,#9298a6)' }}>{PRI_LABEL[p]}</button>
                    ))}
                    <button onClick={() => patch(it.n, { discarded: !t.discarded })} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #ff6b6b44', background: 'none', color: '#ff6b6b' }}>
                      {t.discarded ? <><RotateCcw size={12} /> Restore</> : <><Trash2 size={12} /> Discard</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {ready && !list.length && <p className="meta" style={{ textAlign: 'center', padding: '20px 0' }}>Nothing matches these filters.</p>}
        {!ready && <p className="meta">Loading backlog…</p>}
      </div>
    </div>
  )
}
