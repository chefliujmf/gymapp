// Loud environment indicator so you never act on the wrong env. Detected from the
// hostname — same build, correct label everywhere:
//   platyplus.duckdns.org     -> PROD (no frame — clean, this is the real thing)
//   platyplus-qa.duckdns.org  -> QA   (staging, full prod parity)
//   anything else             -> DEV  (localhost / tailnet / .ts.net vite server)
const host = typeof location !== 'undefined' ? location.hostname : ''
const ENV =
  host === 'platyplus.duckdns.org' ? null
    : host === 'platyplus-qa.duckdns.org' ? { label: 'QA', color: '#a855f7' }
      : { label: 'DEV', color: '#ff8c1a' }

export default function EnvBadge() {
  if (!ENV) return null
  return (
    <>
      {/* viewport border frame — always on screen, can't be missed */}
      <div style={{ position: 'fixed', inset: 0, border: `4px solid ${ENV.color}`, zIndex: 9998, pointerEvents: 'none' }} />
      {/* labelled bar, top-center */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
        background: ENV.color, color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: 2,
        padding: '4px 18px 5px', borderRadius: '0 0 12px 12px', pointerEvents: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,.45)', textShadow: '0 1px 1px rgba(0,0,0,.3)',
        paddingTop: 'max(4px, env(safe-area-inset-top))',
      }}>{ENV.label}</div>
    </>
  )
}
