// App-wide Bluetooth state so devices pair BEFORE a ride (like JOIN) and the
// connection persists into the workout (handles live at the provider, not a page).
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { bleSupported, connectHeartRate, connectTrainer, type HRHandle, type TrainerData, type TrainerHandle } from './ble'

interface BleCtx {
  supported: boolean
  hr?: number
  live: TrainerData
  trState: 'idle' | 'on' | 'erg'
  hrState: 'idle' | 'on'
  connectTrainer(): Promise<void>
  connectHr(): Promise<void>
  setTargetPower(w: number): void
}
const Ctx = createContext<BleCtx | null>(null)
export const useBle = () => useContext(Ctx) as BleCtx

export function BleProvider({ children }: { children: ReactNode }) {
  const [hr, setHr] = useState<number>()
  const [live, setLive] = useState<TrainerData>({})
  const [trState, setTrState] = useState<'idle' | 'on' | 'erg'>('idle')
  const [hrState, setHrState] = useState<'idle' | 'on'>('idle')
  const trainerRef = useRef<TrainerHandle | null>(null)
  const hrRef = useRef<HRHandle | null>(null)

  async function connectTrainerFn() {
    try { const h = await connectTrainer(setLive); trainerRef.current = h; setTrState(h.hasErg ? 'erg' : 'on') } catch { /* cancelled */ }
  }
  async function connectHrFn() {
    try { const h = await connectHeartRate(setHr); hrRef.current = h; setHrState('on') } catch { /* cancelled */ }
  }
  const setTargetPower = (w: number) => { void hrRef.current; trainerRef.current?.setTargetPower(w) }

  return (
    <Ctx.Provider value={{ supported: bleSupported(), hr, live, trState, hrState, connectTrainer: connectTrainerFn, connectHr: connectHrFn, setTargetPower }}>
      {children}
    </Ctx.Provider>
  )
}

/** Reusable pair-devices row — show on a ride detail before starting. */
export function BleConnect() {
  const ble = useBle()
  if (!ble.supported) return (
    <p className="meta" style={{ textAlign: 'center', marginTop: 8 }}>
      To pair a trainer/HR, open in <b>Chrome</b> (Android or desktop). Brave &amp; Safari don't support Bluetooth.
    </p>
  )
  return (
    <div className="chips" style={{ justifyContent: 'center', marginTop: 8 }}>
      <button className={'chip' + (ble.trState !== 'idle' ? ' chip--active' : '')} onClick={ble.connectTrainer}>
        {ble.trState === 'erg' ? '✓ Trainer · ERG' : ble.trState === 'on' ? '✓ Trainer' : '🚴 Connect trainer'}
      </button>
      <button className={'chip' + (ble.hrState === 'on' ? ' chip--active' : '')} onClick={ble.connectHr}>
        {ble.hrState === 'on' ? '✓ HR' : '♥ Connect HR'}
      </button>
    </div>
  )
}
