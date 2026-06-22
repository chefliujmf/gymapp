import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../auth/api'

interface Msg { role: 'user' | 'coach'; text: string }

export default function Chat() {
  const navigate = useNavigate()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [coach, setCoach] = useState('Coach')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setMsgs((m) => [...m, { role: 'user', text }, { role: 'coach', text: '' }]); setBusy(true)
    const appendDelta = (d: string) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: 'coach', text: c[c.length - 1].text + d }; return c })
    try {
      const res = await fetch('/auth/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ message: text }) })
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
      setMsgs((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.role === 'coach' && !last.text) c[c.length - 1] = { role: 'coach', text: '⚠️ ' + ((e as Error).message || 'Coach unavailable') }; return c })
    } finally { setBusy(false) }
  }
  async function reset() {
    if (!confirm('Start a new conversation?')) return
    await authApi.chatReset().catch(() => {})
    setMsgs([])
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
              {m.text || (thinking ? `${coach} is thinking…` : '')}
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
        <button className="chat-send" onClick={send} disabled={busy || !input.trim()}>↑</button>
      </div>
    </div>
  )
}
