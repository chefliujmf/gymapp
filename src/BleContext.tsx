// App-wide Bluetooth: one device panel that remembers previously-granted devices
// and silently reconnects (Web Bluetooth getDevices()), so pairing is one-time
// and reconnection is instant. Handles live at the provider (persist across nav).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bike, HeartPulse } from 'lucide-react'
import { bleSupported, pairDevice, reconnectKnown, type Attached, type TrainerData } from './ble'

interface BleCtx {
  supported: boolean
  trainer: Attached | null
  hrDev: Attached | null
  live: TrainerData
  bpm?: number
  scanning: boolean
  reconnect(): Promise<void>
  addDevice(): Promise<void>
  setTargetPower(watts: number): void
}
const Ctx = createContext<BleCtx | null>(null)
export const useBle = () => useContext(Ctx) as BleCtx

export function BleProvider({ children }: { children: ReactNode }) {
  const [trainer, setTrainer] = useState<Attached | null>(null)
  const [hrDev, setHrDev] = useState<Attached | null>(null)
  const [live, setLive] = useState<TrainerData>({})
  const [bpm, setBpm] = useState<number>()
  const [scanning, setScanning] = useState(false)
  const cbs = useRef({ onTrainer: setLive, onHr: setBpm }).current

  function place(a: Attached) { if (a.role === 'trainer') setTrainer(a); else setHrDev(a) }

  async function reconnect() {
    if (!bleSupported()) return
    try { (await reconnectKnown(cbs)).forEach(place) } catch { /* none in range */ }
  }
  async function addDevice() {
    setScanning(true)
    try { place(await pairDevice(cbs)) } catch { /* cancelled */ } finally { setScanning(false) }
  }
  const setTargetPower = (w: number) => { trainer?.setTargetPower?.(w) }

  return (
    <Ctx.Provider value={{ supported: bleSupported(), trainer, hrDev, live, bpm, scanning, reconnect, addDevice, setTargetPower }}>
      {children}
    </Ctx.Provider>
  )
}

/** Full device panel — auto-reconnects known devices on open; one "Add" button. */
export function BleDevices() {
  const ble = useBle()
  useEffect(() => { ble.reconnect() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ble.supported) return (
    <p className="meta" style={{ textAlign: 'center', margin: '12px 0' }}>
      To pair a trainer/HR, use <b>Chrome</b> or <b>Edge</b>. Firefox, Safari &amp; Brave don't support Web Bluetooth.
    </p>
  )
  return (
    <div className="ble-devices">
      <div className={'ble-dev' + (ble.trainer ? ' on' : '')}>
        <Bike size={22} />
        <div><b>{ble.trainer ? ble.trainer.name : 'Smart trainer'}</b><small>{ble.trainer ? (ble.trainer.hasErg ? 'Connected · ERG' : 'Connected') : 'Not connected'}</small></div>
      </div>
      <div className={'ble-dev' + (ble.hrDev ? ' on' : '')}>
        <HeartPulse size={22} />
        <div><b>{ble.hrDev ? ble.hrDev.name : 'Heart rate'}</b><small>{ble.hrDev ? 'Connected' : 'Watch or strap · not connected'}</small></div>
      </div>
      <button className="btn btn--ghost" onClick={ble.addDevice} disabled={ble.scanning}>{ble.scanning ? 'Scanning…' : '＋ Add a device'}</button>
      <p className="meta" style={{ textAlign: 'center', margin: '8px 0 0' }}>Any brand works — trainer, power meter, or a heart-rate watch/strap (Garmin, Coros, Wahoo…).</p>
    </div>
  )
}
