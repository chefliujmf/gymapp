import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// #310 (Option C) — when the onboarding coach sends you to an existing page to set a value
// (?onboard=1[#section]), this sticky bar scrolls to that section and gives ONE tap back to the
// coach. No new pages: we reuse Profile/Settings and just bookend them so the flow never strands
// a non-technical user on a big settings screen.
export default function OnboardReturnBar() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const onboard = params.get('onboard')

  useEffect(() => {
    if (!onboard) return
    const hash = window.location.hash?.replace('#', '')
    if (hash) {
      // let the page paint first, then scroll the target section into view
      const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
      return () => clearTimeout(t)
    }
  }, [onboard])

  if (!onboard) return null
  return (
    <div className="ob-bar">
      <span className="ob-bar__t">🦫 Coach setup — set this, then head back</span>
      <button className="ob-bar__done" onClick={() => navigate('/chat?onboard=1')}>Done ✓</button>
    </div>
  )
}
