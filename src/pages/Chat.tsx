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
    setInput(''); setMsgs((m) => [...m, { role: 'user', text }]); setBusy(true)
    try {
      const r = await authApi.chat(text)
      setCoach(r.coach || 'Coach')
      setMsgs((m) => [...m, { role: 'coach', text: r.reply || '…' }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'coach', text: '⚠️ ' + ((e as Error).message || 'Coach unavailable') }])
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
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div className="chat-title">{coach}<span>your coach</span></div>
        <button className="chat-reset" onClick={reset} title="New conversation">↻</button>
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
        {msgs.map((m, i) => (
          <div key={i} className={'chat-msg chat-msg--' + m.role}>{m.text}</div>
        ))}
        {busy && <div className="chat-msg chat-msg--coach chat-msg--typing">{coach} is thinking…</div>}
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
