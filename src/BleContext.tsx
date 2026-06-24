// App-wide Bluetooth: one device panel that remembers previously-granted devices
// and silently reconnects (Web Bluetooth getDevices()), so pairing is one-time
// and reconnection is instant. Handles live at the provider (persist across nav).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bike, HeartPulse } from 'lucide-react'
import { bleSupported, pairDevice, pairAnyDevice, reconnectKnown, type Attached, type TrainerData } from './ble'

interface BleCtx {
  supported: boolean
  trainer: Attached | null
  hrDev: Attached | null
  live: TrainerData
  bpm?: number
  scanning: boolean
  bridge: { trainer?: string; hr?: string } | null // connected via the desktop sensor bridge (#100)
  reconnect(): Promise<void>
  addDevice(): Promise<void>
  addDeviceAll(): Promise<void>
  setTargetPower(watts: number): void
}

// Desktop sensor bridge (tools/sensor-bridge) — native BLE → ws, for when Chrome
// Web Bluetooth can't see the sensors (macOS). Reuses the SAME live/bpm pipeline.
const BRIDGE_URL = 'ws://localhost:8124'
const Ctx = createContext<BleCtx | null>(null)
export const useBle = () => useContext(Ctx) as BleCtx

export function BleProvider({ children }: { children: ReactNode }) {
  const [trainer, setTrainer] = useState<Attached | null>(null)
  const [hrDev, setHrDev] = useState<Attached | null>(null)
  const [live, setLive] = useState<TrainerData>({})
  const [bpm, setBpm] = useState<number>()
  const [scanning, setScanning] = useState(false)
  const [bridge, setBridge] = useState<{ trainer?: string; hr?: string } | null>(null)
  const cbs = useRef({ onTrainer: setLive, onHr: setBpm }).current
  const wsRef = useRef<WebSocket | null>(null)

  function place(a: Attached) { if (a.role === 'trainer') setTrainer(a); else setHrDev(a) }

  // Try the local sensor bridge: if it's running, stream its data into live/bpm.
  // Retries quietly so starting the bridge mid-session just works. (#100)
  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout>
    const connect = () => {
      if (stop) return
      let ws: WebSocket
      try { ws = new WebSocket(BRIDGE_URL) } catch { timer = setTimeout(connect, 4000); return }
      wsRef.current = ws
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data)
          if (m.type === 'live') { setLive({ power: m.power, cadence: m.cadence, speed: m.speed }); if (m.hr != null) setBpm(m.hr) }
          else if (m.type === 'device') setBridge((b) => ({ ...(b || {}), [m.role]: m.connected ? m.name : undefined }))
        } catch { /* ignore */ }
      }
      ws.onopen = () => setBridge((b) => b || {})
      ws.onclose = () => { wsRef.current = null; setBridge(null); if (!stop) timer = setTimeout(connect, 4000) }
      ws.onerror = () => { try { ws.close() } catch { /* noop */ } }
    }
    connect()
    return () => { stop = true; clearTimeout(timer); try { wsRef.current?.close() } catch { /* noop */ } }
  }, [])

  async function reconnect() {
    if (!bleSupported()) return
    try { (await reconnectKnown(cbs)).forEach(place) } catch { /* none in range */ }
  }
  async function addDevice() {
    setScanning(true)
    try { place(await pairDevice(cbs)) } catch { /* cancelled */ } finally { setScanning(false) }
  }
  async function addDeviceAll() {
    setScanning(true)
    try { place(await pairAnyDevice(cbs)) } catch { /* cancelled */ } finally { setScanning(false) }
  }
  const setTargetPower = (w: number) => {
    trainer?.setTargetPower?.(w)
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ cmd: 'erg', watts: Math.round(w) }))
  }

  return (
    <Ctx.Provider value={{ supported: bleSupported(), trainer, hrDev, live, bpm, scanning, bridge, reconnect, addDevice, addDeviceAll, setTargetPower }}>
      {children}
    </Ctx.Provider>
  )
}

/** Full device panel — auto-reconnects known devices on open; one "Add" button. */
export function BleDevices() {
  const ble = useBle()
  useEffect(() => { ble.reconnect() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // No Web Bluetooth (Firefox/Safari/Brave) AND no bridge running → guide to either.
  if (!ble.supported && !ble.bridge) return (
    <p className="meta" style={{ textAlign: 'center', margin: '12px 0' }}>
      To pair a trainer/HR in this browser, use <b>Chrome</b> or <b>Edge</b> (Web Bluetooth) — <i>or</i> run the
      desktop bridge (<code>tools/sensor-bridge</code>), which streams your sensors to <b>any</b> browser, Firefox included.
    </p>
  )
  const trName = ble.bridge?.trainer || (ble.trainer ? ble.trainer.name : '')
  const hrName = ble.bridge?.hr || (ble.hrDev ? ble.hrDev.name : '')
  const viaBridge = !!ble.bridge
  return (
    <div className="ble-devices">
      {viaBridge && <p className="meta" style={{ textAlign: 'center', margin: '0 0 8px', color: 'var(--accent)' }}>🖥️ Desktop bridge connected — sensors stream natively.</p>}
      <div className={'ble-dev' + (trName ? ' on' : '')}>
        <Bike size={22} />
        <div><b>{trName || 'Smart trainer'}</b><small>{trName ? (ble.bridge?.trainer ? 'Connected · bridge' : ble.trainer?.hasErg ? 'Connected · ERG' : 'Connected') : 'Not connected'}</small></div>
      </div>
      <div className={'ble-dev' + (hrName ? ' on' : '')}>
        <HeartPulse size={22} />
        <div><b>{hrName || 'Heart rate'}</b><small>{hrName ? (ble.bridge?.hr ? 'Connected · bridge' : 'Connected') : 'Watch or strap · not connected'}</small></div>
      </div>
      {ble.supported && <>
        <button className="btn btn--ghost" onClick={ble.addDevice} disabled={ble.scanning}>{ble.scanning ? 'Scanning…' : '＋ Add a device'}</button>
        <p className="meta" style={{ textAlign: 'center', margin: '8px 0 0' }}>Any brand works — trainer, power meter, or a heart-rate watch/strap (Garmin, Coros, Wahoo…).</p>
        <button className="link-btn" onClick={ble.addDeviceAll} disabled={ble.scanning} style={{ display: 'block', margin: '6px auto 0', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>Don't see your device? Show all Bluetooth devices</button>
      </>}
      {!viaBridge && <p className="meta" style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 11 }}>On a Mac (or Firefox/Safari), sensors not showing? Run the desktop bridge (tools/sensor-bridge) — native Bluetooth, any browser.</p>}
    </div>
  )
}
