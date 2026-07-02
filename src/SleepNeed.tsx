import { useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'
import { fetchWellness } from './intervals'
import { estimateSleepNeed, type SleepNeedEstimate } from './sleep'

// #304 — sleep need: a DEFAULT the athlete confirms, that LEARNS from their data over time (with a
// "need X more nights" mention while it collects), and SUGGESTS a change when recovery says so.
const clamp = (n: number) => Math.max(4, Math.min(12, Math.round(n * 4) / 4))
const dismissKey = (v: number) => 'sleepSugg:dismiss:' + v

function Stepper({ val, onChange }: { val: number; onChange: (v: number) => void }) {
  return (
    <div className="sn-step">
      <button aria-label="less" onClick={() => onChange(clamp(val - 0.25))}>–</button>
      <span className="sn-big">{val}<small>h</small></span>
      <button aria-label="more" onClick={() => onChange(clamp(val + 0.25))}>+</button>
    </div>
  )
}

export default function SleepNeed() {
  const { user, refresh } = useAuth()
  const confirmed = user?.sleepNeed != null
  const [val, setVal] = useState<number>(user?.sleepNeed ?? 8)
  const [est, setEst] = useState<SleepNeedEstimate | null>(null)
  const [, force] = useState(0)
  useEffect(() => {
    if (!user?.hasIcuKey) return
    const to = new Date(), from = new Date(); from.setDate(to.getDate() - 45)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    fetchWellness(iso(from), iso(to)).then((w) => setEst(estimateSleepNeed(w))).catch(() => {})
  }, [user?.hasIcuKey])
  const save = (v: number) => { const c = clamp(v); setVal(c); authApi.saveProfile({ sleepNeed: c }).then(() => refresh().catch(() => {})).catch(() => {}) }

  // 1 — DEFAULT, needs confirm
  if (!confirmed) return (
    <div className="card sn-card">
      <div className="sn-row"><div style={{ flex: 1 }}><div className="sn-lbl">Sleep need <span className="sn-tag def">Default</span></div><div className="sn-sub">We start everyone at 8 h — confirm it or set yours. It drives your personal <b>Sleep</b> readiness score.</div></div><Stepper val={val} onChange={setVal} /></div>
      <div className="sn-actions"><button className="btn primary" onClick={() => save(val)}>Confirm {val} h</button></div>
    </div>
  )

  // 3 — LEARNING (not enough data yet)
  if (est && est.needMore > 0) return (
    <div className="card sn-card">
      <div className="sn-row"><div style={{ flex: 1 }}><div className="sn-lbl">Sleep need <span className="sn-tag learn">Learning</span></div><div className="sn-sub">Watching your sleep vs recovery to find your real need.</div></div><span className="sn-big dim">{val}<small>h</small></span></div>
      <div className="sn-prog"><i style={{ width: `${Math.round((est.nights / 21) * 100)}%` }} /></div>
      <div className="sn-hint">🔎 Need <b>~{est.needMore} more night{est.needMore > 1 ? 's' : ''}</b> of sleep + HRV data before I can estimate your ideal. Using {val} h for now.</div>
    </div>
  )

  // 4 — LEARNED, suggests a change (unless dismissed for this value)
  const sugg = est && est.suggested != null && Math.abs(est.suggested - val) >= 0.25 ? est.suggested : null
  const dismissed = sugg != null && (() => { try { return localStorage.getItem(dismissKey(sugg)) === '1' } catch { return false } })()
  if (sugg != null && !dismissed) return (
    <div className="card sn-card sn-sugg">
      <div className="sn-row"><div style={{ flex: 1 }}><div className="sn-lbl">Sleep need <span className="sn-tag learn">Data suggests {sugg} h</span></div><div className="sn-sub">You recover best on <b>~{sugg} h</b>{est!.avgSleep ? ` — you average ${est!.avgSleep} h${est!.trainOften && sugg > (est!.avgSleep || 0) ? ', short for how often you train' : ''}` : ''}.</div></div><span className="sn-big">{val}<span className="sn-arrow">→</span><span className="sn-accent">{sugg}</span><small>h</small></span></div>
      <div className="sn-actions"><button className="btn primary" onClick={() => save(sugg)}>Use {sugg} h</button><button className="btn" onClick={() => { try { localStorage.setItem(dismissKey(sugg), '1') } catch { /* quota */ } force((n) => n + 1) }}>Keep {val} h</button></div>
    </div>
  )

  // 2 — CONFIRMED, all good
  return (
    <div className="card sn-card">
      <div className="sn-row"><div style={{ flex: 1 }}><div className="sn-lbl">Sleep need <span className="sn-tag you">Yours</span></div><div className="sn-sub">Driving your Sleep readiness. I keep watching your data and will suggest a change if your recovery says so.</div></div><Stepper val={val} onChange={save} /></div>
    </div>
  )
}
