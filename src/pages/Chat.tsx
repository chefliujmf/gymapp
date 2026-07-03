import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, type User } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { parseBlocks, type Inline } from '../chatFormat'

interface Msg { role: 'user' | 'coach'; text: string }

// #338 — render the coach's reply with light structure (mini-headers, bullets, bold) instead of a
// wall of text. Pure, dependency-free, no HTML injection (parseBlocks in chatFormat.ts).
function Spans({ spans }: { spans: Inline[] }) {
  return <>{spans.map((sp, i) => (sp.b ? <strong key={i}>{sp.s}</strong> : <span key={i}>{sp.s}</span>))}</>
}
function ChatBody({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  const out: React.ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'li') {
      const items = []
      while (i < blocks.length && blocks[i].type === 'li') { items.push(blocks[i]); i++ }
      i--
      out.push(<ul key={i} className="chat-ul">{items.map((it, j) => <li key={j}><Spans spans={it.spans} /></li>)}</ul>)
    } else if (b.type === 'h') {
      out.push(<div key={i} className="chat-h"><Spans spans={b.spans} /></div>)
    } else {
      out.push(<p key={i} className="chat-p"><Spans spans={b.spans} /></p>)
    }
  }
  return <>{out}</>
}

// #310 (Option C) — the onboarding coach doesn't interrogate you in a wall of text; it walks you
// through a few short steps that OPEN THE EXISTING PAGES (Profile / Settings) to set each value, then
// builds your first week. Step order is client-driven (reliable), the coach LLM only bookends (build).
const ackKey = (k: string) => 'setup:ack:' + k
const getAck = (k: string) => { try { return localStorage.getItem(ackKey(k)) === '1' } catch { return false } }
const isEndurance = (u: User) => (u.sports || []).some((s) => s === 'cycling' || s === 'running')
const hasThreshold = (u: User) => !!(u.ftp || u.runThresholdPace || u.sportSettings?.cycling?.ftp || u.sportSettings?.running?.thresholdPace)
interface Step { key: string; label: string; line: string; to?: string; ext?: string; done: (u: User) => boolean; when?: (u: User) => boolean; optional?: boolean }
const STEPS: Step[] = [
  { key: 'intervals', label: 'Connect intervals.icu', line: "First, connect intervals.icu — it's your data hub (HRV, sleep, activities, FTP). I read your history from it.", to: '/settings?onboard=1#ob-connect', done: (u) => !!u.hasIcuKey },
  { key: 'strava', label: 'Connect Strava — inside intervals', line: 'In intervals.icu, connect Strava so your rides & runs (and ~3 months of history) flow in. Tap done when it’s linked.', ext: 'https://intervals.icu/settings', done: () => getAck('strava') },
  { key: 'coach', label: 'Name your coach', line: "What should I go by? Give your coach a name — it's who you'll chat with.", to: '/profile?onboard=1#ob-coach', done: (u) => !!(u.coachName && u.coachName.trim()) },
  { key: 'sport', label: 'Your sport(s)', line: 'Which sports do you do? Tap all that apply — it tunes your plan and app.', to: '/profile?onboard=1#ob-sport', done: (u) => (u.sports || []).length > 0 },
  { key: 'about', label: 'About you', line: 'Confirm your biological sex — it tunes fuelling & recovery, and turns on women-specific coaching where it matters.', to: '/profile?onboard=1#ob-about', done: (u) => !!u.sex },
  { key: 'goals', label: 'Your goals', line: 'What are you training for? Tap what fits and add a line in your own words — this is what makes your plan YOURS.', to: '/profile?onboard=1#ob-goals', done: (u) => { const g = (u.info as { goals?: { focus?: unknown[]; notes?: string } }).goals; return !!(g && ((g.focus && g.focus.length) || (g.notes && g.notes.trim()))) } },
  { key: 'numbers', label: 'Your numbers (optional)', line: "Set FTP / threshold pace if you know them. Don't worry if not — I'll estimate from your intervals history and suggest values.", to: '/profile?onboard=1#ob-numbers', done: (u) => hasThreshold(u), when: isEndurance, optional: true },
  { key: 'equipment', label: 'Your equipment', line: "What gear do you have? I only pick exercises you can actually do.", to: '/profile?onboard=1#ob-equipment', done: (u) => { const e = (u.info as { equipment?: unknown[] }).equipment; return Array.isArray(e) && e.length > 0 } },
  { key: 'avail', label: 'Weekly availability', line: 'How long can you train each day? I fit sessions around your real week.', to: '/profile?onboard=1#ob-avail', done: (u) => !!(u.info as { availability?: unknown }).availability },
]

export default function Chat() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, refresh } = useAuth()
  // Onboarding mode ends the moment the coach finishes (onboardedAt) — the build stream then shows in
  // the normal thread. #257 + #310.
  const onboarding = params.get('onboard') === '1' && !user?.onboardedAt
  const [building, setBuilding] = useState(false) // tapped "build my week" → show the chat thread
  const [, force] = useState(0) // re-render after a manual ack (localStorage, not in user)
  // #306(a): persist the conversation so navigating away (e.g. to a setup page) + back doesn't wipe it.
  const [msgs, setMsgs] = useState<Msg[]>(() => { try { return JSON.parse(sessionStorage.getItem('chatMsgs') || '[]') } catch { return [] } })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [waitedLong, setWaitedLong] = useState(false) // #306(c): show "still working…" after a few s
  const [coach, setCoach] = useState('Coach')
  const [listening, setListening] = useState(false)
  useEffect(() => { try { sessionStorage.setItem('chatMsgs', JSON.stringify(msgs)) } catch { /* quota */ } }, [msgs])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Returning from a setup page → pull the freshest profile so completed steps tick off.
  useEffect(() => { if (onboarding) refresh().catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Voice input — speak instead of type (great for non-technical users + onboarding).
  function toggleMic() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input isn’t supported in this browser — try Chrome.'); return }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = navigator.language || 'en-US'
    // #306(d): keep listening (don't stop after the first pause) until the user taps ⏹.
    rec.continuous = true
    rec.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => { let final = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) final += e.results[i][0].transcript; if (final.trim()) setInput((p) => (p ? p + ' ' : '') + final.trim()) }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec; setListening(true); rec.start()
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim()
    if (!text || busy) return
    setInput(''); setMsgs((m) => [...m, { role: 'user', text }, { role: 'coach', text: '' }]); setBusy(true); setWaitedLong(false)
    const appendDelta = (d: string) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: 'coach', text: c[c.length - 1].text + d }; return c })
    // #306(b): never lock the input forever — abort a stalled/too-long coach turn so busy resets.
    const ctrl = new AbortController()
    const longTimer = setTimeout(() => setWaitedLong(true), 8000)
    const killTimer = setTimeout(() => ctrl.abort(), 180000)
    try {
      const res = await fetch('/auth/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ message: text }), signal: ctrl.signal })
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status)
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
      for (;;) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        let i: number
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i); buf = buf.slice(i + 2)
          const data = frame.split('\n').find((l) => l.startsWith('data:'))
          if (!data) continue
          let ev: { coach?: string; delta?: string; error?: string }
          try { ev = JSON.parse(data.slice(5).trim()) } catch { continue }
          if (ev.coach) setCoach(ev.coach)
          if (ev.delta) appendDelta(ev.delta)
          if (ev.error) appendDelta('⚠️ ' + ev.error)
        }
      }
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? 'That took too long — tap send to try again.' : ((e as Error).message || 'Coach unavailable — tap send to retry.')
      setMsgs((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.role === 'coach' && !last.text) c[c.length - 1] = { role: 'coach', text: '⚠️ ' + msg }; return c })
    } finally { clearTimeout(longTimer); clearTimeout(killTimer); setBusy(false); setWaitedLong(false); if (onboarding || building) refresh().catch(() => {}) } // #257 pick up onboardedAt once the coach finishes
  }
  async function reset() {
    if (!confirm('Start a new conversation?')) return
    await authApi.chatReset().catch(() => {})
    setMsgs([]); try { sessionStorage.removeItem('chatMsgs') } catch { /* ignore */ }
  }

  // ── #310 onboarding step flow — walk the applicable steps, open the real pages ──────────────
  if (onboarding && !building && user) {
    const steps = STEPS.filter((s) => !s.when || s.when(user))
    const skipped = (s: Step) => !!s.optional && getAck('skip:' + s.key)
    const settled = (s: Step) => s.done(user) || skipped(s)
    const doneN = steps.filter(settled).length
    const nowIdx = steps.findIndex((s) => !settled(s))
    // "ready to build" once every REQUIRED step is done (optional steps don't block).
    const ready = steps.every((s) => s.optional || s.done(user))
    const startBuild = () => { setBuilding(true); send('Everything is set. Please analyse my recent intervals history (last ~3 months incl. Strava) to estimate my fitness — FTP / threshold pace, zones — and build my first training week around my availability and equipment. Suggest any numbers I left blank.') }
    return (
      <div className="ob-wrap">
        <div className="ob-hero">
          <div className="ob-ava"><img src="/favicon.svg?v=4" alt="" style={{ width: '68%', height: '68%', borderRadius: 8 }} /></div>
          <div><h2>Welcome{user.username ? `, ${user.username}` : ''}! Let’s set you up.</h2><p>A few taps — I’ll open each page, you set it, come back. No long forms.</p></div>
        </div>
        <div className="ob-prog"><i style={{ width: `${Math.round((doneN / steps.length) * 100)}%` }} /></div>
        <div className="ob-steps">
          {steps.map((s, i) => {
            const done = s.done(user)
            const isSkipped = !done && skipped(s)
            const isNow = i === nowIdx
            return (
              <div key={s.key} className={'ob-step' + (done || isSkipped ? ' done' : isNow ? ' now' : '')}>
                <div className="ob-step__top">
                  <span className={'ob-step__mark' + (done ? ' on' : '')}>{done ? '✓' : isSkipped ? '~' : i + 1}</span>
                  <span className="ob-step__lbl">{s.label}{isSkipped && <span className="meta" style={{ fontWeight: 400 }}> · coach will estimate</span>}</span>
                </div>
                {isNow && !done && <>
                  <div className="ob-step__line">{s.line}</div>
                  {s.ext
                    ? <div style={{ display: 'flex', gap: 8 }}>
                        <a className="ob-open ob-open--ghost" style={{ flex: 1 }} href={s.ext} target="_blank" rel="noreferrer">Open intervals ↗</a>
                        <button className="ob-open" style={{ flex: 1 }} onClick={() => { try { localStorage.setItem(ackKey('strava'), '1') } catch { /* quota */ } force((n) => n + 1) }}>Done ✓</button>
                      </div>
                    : <Link className="ob-open" to={s.to!}>Open {s.label.replace(' (optional)', '')} →</Link>}
                  {s.optional && <button className="ob-open ob-open--ghost" style={{ marginTop: 8 }} onClick={() => { try { localStorage.setItem(ackKey('skip:' + s.key), '1') } catch { /* quota */ } force((n) => n + 1) }}>Skip — let the coach estimate</button>}
                </>}
              </div>
            )
          })}
        </div>
        <div className="ob-build">
          <button className="ob-build__btn" disabled={!ready} onClick={startBuild} style={ready ? undefined : { opacity: .5 }}><img src="/favicon.svg?v=4" alt="" style={{ width: 16, height: 16, borderRadius: 5, verticalAlign: '-3px', marginRight: 6 }} />Build my first week</button>
          <p className="ob-build__sub">{ready ? 'I’ll read your history and design week 1 around your availability.' : `Finish the steps above first (${doneN}/${steps.length}).`}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat">
      <div className="chat-top">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="chat-title">{coach}<span>your coach</span></div>
        <button className="icon-btn" onClick={reset} aria-label="New conversation" title="New conversation">↻</button>
      </div>

      <div className="chat-body">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <div style={{ fontSize: 40 }}>💬</div>
            <p>Ask {coach} to plan or adjust your training & meals.</p>
            <div className="chat-suggest">
              {['Add a push day on Thursday', "What's on my plan this week?", 'Plan 3 high-protein dinners'].map((s) => (
                <button key={s} className="chip" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => {
          const thinking = m.role === 'coach' && !m.text && i === msgs.length - 1 && busy
          return (
            <div key={i} className={'chat-msg chat-msg--' + m.role + (thinking ? ' chat-msg--typing' : '')}>
              {m.text
                ? (m.role === 'coach' ? <ChatBody text={m.text} /> : m.text)
                : (thinking ? `${coach} is ${waitedLong ? 'still working — this can take a moment…' : 'thinking…'}` : '')}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={input} onChange={(e) => setInput(e.target.value)} rows={1}
          placeholder={`Message ${coach}…`}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className={'chat-mic' + (listening ? ' chat-mic--on' : '')} onClick={toggleMic} aria-label="Voice input" title="Speak">{listening ? '⏹' : '🎤'}</button>
        <button className="chat-send" onClick={() => send()} disabled={busy || !input.trim()}>↑</button>
      </div>
    </div>
  )
}
