import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Trash2, ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { authApi, type BacklogTriage, type BacklogAddedItem, type BacklogPriority, type BacklogStatus, type BacklogType } from '../auth/api'

// #438 — in-app admin backlog. Item LIST = bundled backlog.json (from FEEDBACK-LOG.md on deploy, lazy-loaded)
// + JM's app-ADDED items; his live TRIAGE (status / priority / type / comments) is the DB overlay on top.
// His STATUS overrides my .md-derived one. Test-handoff flow: To test (I add what-to-test) → Tested ✓/✗ (JM,
// details in comments). Filter-first (Option A). Claude reads the overlay each session.
type Item = { n: number; status: BacklogStatus; title: string; summary: string; test?: string; env?: string; date?: string; reporter?: string; at?: number; added?: boolean }
type StatusFilter = 'open' | BacklogStatus
type Sort = 'pri' | 'num' | 'status' | 'cmts'

const S_LABEL: Record<BacklogStatus, string> = { review: 'Under review', todo: 'To do', build: 'Building', totest: 'To test', pass: 'Tested ✓', fail: 'Tested ✗', done: 'Done', discarded: 'Discarded' }
const S_DOT: Record<BacklogStatus, string> = { review: '#e05d8c', todo: '#8aa0ff', build: '#ffb454', totest: '#4dd4e0', pass: '#34e07d', fail: '#ff6b6b', done: '#7a8699', discarded: '#545b68' }
const S_RANK: Record<string, number> = { review: 0, fail: 1, build: 2, totest: 3, todo: 4, pass: 5, done: 6, discarded: 7 } // needs-attention first
const TEST_STATUS = new Set<BacklogStatus>(['totest', 'pass', 'fail'])
const fmtWhen = (v?: number | string) => { if (!v) return ''; try { const d = typeof v === 'number' ? new Date(v) : new Date(/T/.test(v) ? v : v + 'T00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' } }
const P_LABEL: Record<BacklogPriority, string> = { hi: 'HIGH', med: 'MED', lo: 'LOW' }
const P_COLOR: Record<BacklogPriority, string> = { hi: '#ff6b6b', med: '#ffb454', lo: '#7a8699' }
const P_RANK: Record<string, number> = { hi: 0, med: 1, lo: 2, '': 3 }
const T_LABEL: Record<BacklogType, string> = { bug: 'Bug', feature: 'Feature', idea: 'Idea', chore: 'Chore' }
const T_COLOR: Record<BacklogType, string> = { bug: '#ff6b6b', feature: '#34e07d', idea: '#b98cff', chore: '#7a8699' }
const ENV_COLOR: Record<string, string> = { dev: '#7a8699', qa: '#ffb454', prod: '#34e07d' }

const STATUS_OPTS: [BacklogStatus, string, string][] = (['review', 'todo', 'build', 'totest', 'pass', 'fail', 'done', 'discarded'] as BacklogStatus[]).map((s) => [s, S_LABEL[s], S_DOT[s]])
const PRI_OPTS: [BacklogPriority, string, string][] = [['hi', 'High', P_COLOR.hi], ['med', 'Med', P_COLOR.med], ['lo', 'Low', P_COLOR.lo]]
const TYPE_OPTS: [BacklogType, string, string][] = [['bug', 'Bug', T_COLOR.bug], ['feature', 'Feature', T_COLOR.feature], ['idea', 'Idea', T_COLOR.idea], ['chore', 'Chore', T_COLOR.chore]]

// a labeled segmented button row (Status / Priority / Type). Highlighted = current; each option carries its colour.
function Seg<T extends string>({ label, opts, value, onPick }: { label: string; opts: [T, string, string?][]; value?: T; onPick: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      <span className="meta" style={{ fontSize: 11, width: 52, flexShrink: 0 }}>{label}</span>
      {opts.map(([v, txt, color]) => {
        const on = value === v
        return <button key={v} onClick={() => onPick(v)} style={{ borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? (color || '#34e07d') : '#ffffff1a'), background: on ? (color || '#34e07d') : '#0b0e12', color: on ? '#12161c' : 'var(--text-dim,#9298a6)' }}>{txt}</button>
      })}
    </div>
  )
}
const chip = (bg: string, fg: string): CSSProperties => ({ fontSize: 10, fontWeight: 800, padding: '3px 6px', borderRadius: 6, background: bg, color: fg, flexShrink: 0 })

export default function AdminBacklog() {
  const [items, setItems] = useState<Item[]>([])
  const [added, setAdded] = useState<BacklogAddedItem[]>([])
  const [triage, setTriage] = useState<BacklogTriage>({})
  const [ready, setReady] = useState(false)
  const [q, setQ] = useState('')
  const [sf, setSf] = useState<StatusFilter>('open')
  const [pf, setPf] = useState<'' | BacklogPriority>('')
  const [sort, setSort] = useState<Sort>('pri')
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [open, setOpen] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  // add-item form (type + priority both required)
  const [adding, setAdding] = useState(false)
  const [nt, setNt] = useState('')
  const [ntype, setNtype] = useState<BacklogType | ''>('')
  const [npri, setNpri] = useState<BacklogPriority | ''>('')
  const [nsum, setNsum] = useState('')

  useEffect(() => {
    import('../data/generated/backlog.json').then((m) => setItems((m.default as Item[]) || [])).finally(() => setReady(true))
    authApi.getBacklogTriage().then((r) => { setTriage(r.triage || {}); setAdded(r.added || []) }).catch(() => {})
  }, [])

  const tr = (n: number) => triage[String(n)] || {}
  const eff = (it: Item): BacklogStatus => tr(it.n).status ?? (tr(it.n).discarded ? 'discarded' : it.status)
  async function patch(n: number, body: Parameters<typeof authApi.updateBacklog>[1]) {
    try { const r = await authApi.updateBacklog(n, body); setTriage((t) => ({ ...t, [String(n)]: r.triage || {} })) } catch { /* ignore */ }
  }
  const addComment = (n: number) => { const text = draft.trim(); if (!text) return; setDraft(''); patch(n, { comment: text }) }

  const merged = useMemo<Item[]>(() => {
    const m = new Map<number, Item>()
    for (const it of items) m.set(it.n, it)
    for (const a of added) m.set(a.n, { n: a.n, status: 'todo', title: a.title, summary: a.summary || '', reporter: a.reporter, at: a.at, added: true })
    return [...m.values()]
  }, [items, added])
  const nextN = useMemo(() => Math.max(438, ...merged.map((i) => i.n)) + 1, [merged])

  async function addItem() {
    const title = nt.trim(); if (!title || !ntype || !npri) return
    try {
      const r = await authApi.addBacklogItem({ n: nextN, title, type: ntype, priority: npri, summary: nsum.trim() || undefined })
      setAdded((a) => [r.item, ...a.filter((x) => x.n !== r.item.n)])
      if (r.triage) setTriage((t) => ({ ...t, [String(r.item.n)]: r.triage! }))
      setNt(''); setNsum(''); setNtype(''); setNpri(''); setAdding(false); setSf('open'); setOpen(r.item.n)
    } catch { /* ignore */ }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, review: 0, todo: 0, build: 0, totest: 0, pass: 0, fail: 0, done: 0, discarded: 0 }
    for (const it of merged) { const s = eff(it); c[s]++; if (s !== 'done' && s !== 'discarded') c.open++ }
    return c
  }, [merged, triage])

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const out = merged.filter((it) => {
      const t = tr(it.n), s = eff(it)
      if (sf === 'open') { if (s === 'done' || s === 'discarded') return false } else if (s !== sf) return false
      if (pf && t.priority !== pf) return false
      if (ql && !`#${it.n} ${it.title} ${it.summary}`.toLowerCase().includes(ql)) return false
      return true
    })
    out.sort((a, b) => {
      const ta = tr(a.n), tb = tr(b.n)
      let cmp: number
      if (sort === 'num') cmp = b.n - a.n
      else if (sort === 'status') cmp = (S_RANK[eff(a)] - S_RANK[eff(b)]) || b.n - a.n
      else if (sort === 'cmts') cmp = (tb.comments?.length || 0) - (ta.comments?.length || 0) || b.n - a.n
      else cmp = (P_RANK[ta.priority || ''] - P_RANK[tb.priority || '']) || b.n - a.n
      return dir === 'asc' ? -cmp : cmp
    })
    return out
  }, [merged, triage, q, sf, pf, sort, dir])

  const statusChips: [StatusFilter, string, number][] = [['open', 'Open', counts.open], ['review', 'Under review', counts.review], ['todo', 'To do', counts.todo], ['build', 'Building', counts.build], ['totest', 'To test', counts.totest], ['pass', 'Tested ✓', counts.pass], ['fail', 'Tested ✗', counts.fail], ['done', 'Done', counts.done], ['discarded', 'Discarded', counts.discarded]]

  return (
    <div>
      <button className="btn btn--ghost" style={{ width: 'auto', padding: '7px 12px', marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setAdding((a) => !a)}><Plus size={15} /> New item</button>
      {adding && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div className="meta" style={{ marginBottom: 8 }}>New item — it'll be #{nextN}. Type + priority are required.</div>
          <input className="search" placeholder="What's the item? (title)" value={nt} autoFocus onChange={(e) => setNt(e.target.value)} />
          <Seg label="Type" opts={TYPE_OPTS} value={ntype || undefined} onPick={setNtype} />
          <Seg label="Priority" opts={PRI_OPTS} value={npri || undefined} onPick={setNpri} />
          <input className="search" placeholder="Notes / detail (optional)" value={nsum} onChange={(e) => setNsum(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ width: 'auto', flex: 1 }} onClick={addItem} disabled={!nt.trim() || !ntype || !npri}>Add item</button>
            <button className="btn btn--ghost" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => { setAdding(false); setNt(''); setNsum(''); setNtype(''); setNpri('') }}>Cancel</button>
          </div>
        </div>
      )}

      <input className="search" placeholder="Search the backlog…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ marginBottom: 8 }}>
        {statusChips.map(([k, label, c]) => <button key={k} className={'chip' + (sf === k ? ' chip--active' : '')} onClick={() => setSf(k)}>{label} <span style={{ opacity: .6 }}>{c}</span></button>)}
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {PRI_OPTS.map(([k, label]) => <button key={k} className={'chip' + (pf === k ? ' chip--active' : '')} onClick={() => setPf(pf === k ? '' : k)}>{label}</button>)}
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
          const t = tr(it.n), s = eff(it), exp = open === it.n, cmts = t.comments || []
          return (
            <div key={it.n} className="card" style={{ padding: 0, opacity: s === 'discarded' ? .55 : 1 }}>
              <div className="card-row" style={{ padding: '11px 12px', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={() => { setOpen(exp ? null : it.n); setDraft('') }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: S_DOT[s], flexShrink: 0 }} title={S_LABEL[s]} />
                <span className="meta" style={{ fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>#{it.n}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                {it.env && <span style={chip(ENV_COLOR[it.env] + '22', ENV_COLOR[it.env])}>{it.env.toUpperCase()}</span>}
                {t.type && <span style={chip(T_COLOR[t.type] + '22', T_COLOR[t.type])}>{T_LABEL[t.type]}</span>}
                {t.priority && <span style={chip(P_COLOR[t.priority] + '22', P_COLOR[t.priority])}>{P_LABEL[t.priority]}</span>}
                {cmts.length > 0 && <span className="meta" style={{ flexShrink: 0, fontSize: 11 }}>💬{cmts.length}</span>}
              </div>
              {exp && (
                <div style={{ padding: '0 12px 13px', borderTop: '1px solid #ffffff10' }}>
                  <div style={{ color: '#c4cad4', fontSize: 13, margin: '10px 0 5px' }}>{it.summary || <span className="meta">No detail{it.added ? ' — added here' : ''}.</span>}</div>
                  <div className="meta" style={{ fontSize: 11, marginBottom: 12 }}>Reported by {it.reporter || 'JM'}{fmtWhen(it.at || it.date) ? ` · ${fmtWhen(it.at || it.date)}` : ''}{it.added ? ' · added in-app' : ''}</div>
                  {TEST_STATUS.has(s) && (
                    <div style={{ background: '#4dd4e011', border: '1px solid #4dd4e033', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color: '#4dd4e0', textTransform: 'uppercase', marginBottom: 3 }}>What to test</div>
                      <div style={{ fontSize: 12.5, color: '#c4cad4' }}>{it.test || it.summary || 'See the item detail above.'}{(s === 'pass' || s === 'fail') && <span className="meta"> · add your tested notes as a comment below.</span>}</div>
                    </div>
                  )}
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
                    <input className="search" style={{ flex: 1, marginBottom: 0 }} placeholder={TEST_STATUS.has(s) ? 'Tested notes / what failed…' : 'Add a comment / direction…'} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addComment(it.n) }} />
                    <button className="btn" style={{ width: 'auto', padding: '0 14px' }} onClick={() => addComment(it.n)} disabled={!draft.trim()}>Post</button>
                  </div>
                  <Seg label="Status" opts={STATUS_OPTS} value={s} onPick={(v) => patch(it.n, { status: v })} />
                  <Seg label="Priority" opts={PRI_OPTS} value={t.priority} onPick={(v) => patch(it.n, { priority: v })} />
                  <Seg label="Type" opts={TYPE_OPTS} value={t.type} onPick={(v) => patch(it.n, { type: v })} />
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
