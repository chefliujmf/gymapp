// Loud environment indicator so you never act on the wrong env. Detected from the
// hostname — same build, correct label everywhere:
//   *.ts.net               -> QA   (tailnet staging URL)
//   platyplus.duckdns.org  -> PROD (no frame — clean, this is the real thing)
//   anything else          -> DEV  (localhost / tailscale-IP vite server)
const host = typeof location !== 'undefined' ? location.hostname : ''
const ENV =
  host.endsWith('.ts.net') ? { label: 'QA · STAGING', color: '#a855f7' }
    : host === 'platyplus.duckdns.org' ? null
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
