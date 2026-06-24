import { useState } from 'react'
import { Rocket } from 'lucide-react'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'

// Admin-only "Promote to prod" in the header (#78). Hidden on prod (you promote
// FROM dev/QA), and only for admins. Triggers the GitHub promotion workflow.
const isProd = typeof location !== 'undefined' && location.hostname === 'platyplus.duckdns.org'

export default function PromoteButton() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (isProd || user?.role !== 'admin') return null

  async function promote() {
    if (!confirm('Promote the current dev/QA build to PRODUCTION? GitHub merges dev → main once CI is green, then prod deploys.')) return
    setBusy(true); setMsg('')
    try { await authApi.promoteProd(); setMsg('✓ Promotion started') }
    catch (e) { setMsg('✗ ' + (e as Error).message) }
    finally { setBusy(false); setTimeout(() => setMsg(''), 6000) }
  }

  return (
    <button className="promote-btn" onClick={promote} disabled={busy} title={msg || 'Promote dev/QA → prod'} aria-label="Promote to prod">
      <Rocket size={15} /> {busy ? '…' : msg ? msg : 'Promote'}
    </button>
  )
}
