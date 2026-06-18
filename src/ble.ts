// Web Bluetooth: heart-rate strap (Polar) + smart trainer (Tacx via FTMS).
// Works on Android Chrome (Pixel) over HTTPS/localhost. iOS Safari is unsupported.
// Trainer: reads live power/cadence and can drive ERG (set target watts).

export const bleSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator

type AnyNavigator = Navigator & { bluetooth: { requestDevice(o: unknown): Promise<BluetoothDevice> } }
const bt = () => (navigator as AnyNavigator).bluetooth

// --- Heart rate (standard BLE Heart Rate Service 0x180D) -------------------
export interface HRHandle { device: BluetoothDevice; disconnect(): void }
export async function connectHeartRate(onBpm: (bpm: number) => void): Promise<HRHandle> {
  const device = await bt().requestDevice({ filters: [{ services: ['heart_rate'] }] })
  const server = await device.gatt!.connect()
  const svc = await server.getPrimaryService('heart_rate')
  const ch = await svc.getCharacteristic('heart_rate_measurement')
  await ch.startNotifications()
  ch.addEventListener('characteristicvaluechanged', (e) => {
    const v = (e.target as unknown as { value: DataView }).value
    const flags = v.getUint8(0)
    onBpm(flags & 0x1 ? v.getUint16(1, true) : v.getUint8(1))
  })
  return { device, disconnect: () => device.gatt?.disconnect() }
}

// --- Trainer (FTMS 0x1826, with Cycling Power 0x1818 fallback) -------------
export interface TrainerData { power?: number; cadence?: number; speed?: number }
export interface TrainerHandle {
  device: BluetoothDevice
  /** ERG: set target power in watts (FTMS only; no-op if unsupported). */
  setTargetPower(watts: number): Promise<void>
  hasErg: boolean
  disconnect(): void
}

const FTMS = 0x1826
const FTMS_INDOOR_BIKE = 0x2ad2
const FTMS_CONTROL = 0x2ad9
const CPS = 0x1818
const CPS_MEAS = 0x2a63

/** Parse FTMS Indoor Bike Data (0x2AD2) — walk fields per the flags. */
function parseIndoorBike(v: DataView): TrainerData {
  const flags = v.getUint16(0, true)
  let o = 2
  const out: TrainerData = {}
  if (!(flags & 0x1)) { out.speed = v.getUint16(o, true) / 100; o += 2 } // bit0=0 → inst speed present (0.01 km/h)
  if (flags & 0x2) o += 2                      // avg speed
  if (flags & 0x4) { out.cadence = v.getUint16(o, true) / 2; o += 2 }    // inst cadence (0.5 rpm)
  if (flags & 0x8) o += 2                      // avg cadence
  if (flags & 0x10) o += 3                     // total distance
  if (flags & 0x20) o += 2                     // resistance
  if (flags & 0x40) { out.power = v.getInt16(o, true); o += 2 }          // inst power (W)
  return out
}

export async function connectTrainer(onData: (d: TrainerData) => void): Promise<TrainerHandle> {
  const device = await bt().requestDevice({
    filters: [{ services: [FTMS] }, { services: [CPS] }],
    optionalServices: [FTMS, CPS, 'cycling_power'],
  })
  const server = await device.gatt!.connect()

  let control: BluetoothRemoteGATTCharacteristic | undefined
  let hasErg = false
  try {
    const svc = await server.getPrimaryService(FTMS)
    const bike = await svc.getCharacteristic(FTMS_INDOOR_BIKE)
    await bike.startNotifications()
    bike.addEventListener('characteristicvaluechanged', (e) =>
      onData(parseIndoorBike((e.target as unknown as { value: DataView }).value)))
    try {
      control = await svc.getCharacteristic(FTMS_CONTROL)
      await control.startNotifications()
      await control.writeValue(new Uint8Array([0x00])) // request control
      hasErg = true
    } catch { /* read-only trainer */ }
  } catch {
    // Fallback: Cycling Power Service (power only, no ERG)
    const svc = await server.getPrimaryService(CPS)
    const meas = await svc.getCharacteristic(CPS_MEAS)
    await meas.startNotifications()
    meas.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as unknown as { value: DataView }).value
      onData({ power: v.getInt16(2, true) }) // flags(2) then inst power(2)
    })
  }

  return {
    device,
    hasErg,
    async setTargetPower(watts: number) {
      if (!control) return
      const buf = new ArrayBuffer(3)
      const dv = new DataView(buf)
      dv.setUint8(0, 0x05)                 // Set Target Power opcode
      dv.setInt16(1, Math.round(watts), true)
      await control.writeValue(buf)
    },
    disconnect: () => device.gatt?.disconnect(),
  }
}
