// Web Bluetooth: smart trainer (Tacx/FTMS, with ERG) + heart-rate (Polar/HRS).
// Chrome/Edge on Android (Pixel) or desktop, over HTTPS/localhost. One pairing
// flow for any device; previously-granted devices auto-reconnect via getDevices().

export const bleSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator
type BT = { requestDevice(o: unknown): Promise<BluetoothDevice>; getDevices?(): Promise<BluetoothDevice[]> }
const bt = () => (navigator as unknown as { bluetooth: BT }).bluetooth

const HR = 'heart_rate'
const HRM = 'heart_rate_measurement'
const FTMS = 0x1826
const IDB = 0x2ad2
const CTRL = 0x2ad9
const CPS = 0x1818
const CPM = 0x2a63

export interface TrainerData { power?: number; cadence?: number; speed?: number }
export type DeviceRole = 'trainer' | 'hr'
export interface Attached {
  role: DeviceRole
  device: BluetoothDevice
  name: string
  hasErg?: boolean
  setTargetPower?(watts: number): Promise<void>
  disconnect(): void
}
export interface AttachCbs { onTrainer?: (d: TrainerData) => void; onHr?: (bpm: number) => void }

// Remember which role each granted device played, so reconnection is instant.
const ROLE_KEY = 'bleRoles'
const loadRoles = (): Record<string, DeviceRole> => { try { return JSON.parse(localStorage.getItem(ROLE_KEY) || '{}') } catch { return {} } }
const saveRole = (id: string, r: DeviceRole) => { const m = loadRoles(); m[id] = r; localStorage.setItem(ROLE_KEY, JSON.stringify(m)) }

const dv = (e: Event) => (e.target as unknown as { value: DataView }).value
async function hasService(server: BluetoothRemoteGATTServer, uuid: number | string) {
  try { await server.getPrimaryService(uuid); return true } catch { return false }
}

function parseIndoorBike(v: DataView): TrainerData {
  const flags = v.getUint16(0, true); let o = 2; const out: TrainerData = {}
  if (!(flags & 0x1)) { out.speed = v.getUint16(o, true) / 100; o += 2 }
  if (flags & 0x2) o += 2
  if (flags & 0x4) { out.cadence = v.getUint16(o, true) / 2; o += 2 }
  if (flags & 0x8) o += 2
  if (flags & 0x10) o += 3
  if (flags & 0x20) o += 2
  if (flags & 0x40) { out.power = v.getInt16(o, true); o += 2 }
  return out
}

async function attachTrainer(server: BluetoothRemoteGATTServer, onData?: (d: TrainerData) => void) {
  let control: BluetoothRemoteGATTCharacteristic | undefined
  let hasErg = false
  if (await hasService(server, FTMS)) {
    const svc = await server.getPrimaryService(FTMS)
    const bike = await svc.getCharacteristic(IDB)
    await bike.startNotifications()
    bike.addEventListener('characteristicvaluechanged', (e) => onData?.(parseIndoorBike(dv(e))))
    try { control = await svc.getCharacteristic(CTRL); await control.startNotifications(); await control.writeValue(new Uint8Array([0x00])); hasErg = true } catch { /* read-only */ }
  } else {
    const svc = await server.getPrimaryService(CPS)
    const meas = await svc.getCharacteristic(CPM)
    await meas.startNotifications()
    meas.addEventListener('characteristicvaluechanged', (e) => onData?.({ power: dv(e).getInt16(2, true) }))
  }
  const setTargetPower = async (watts: number) => {
    if (!control) return
    const buf = new ArrayBuffer(3); const d = new DataView(buf)
    d.setUint8(0, 0x05); d.setInt16(1, Math.round(watts), true)
    await control.writeValue(buf)
  }
  return { hasErg, setTargetPower }
}

async function attachHR(server: BluetoothRemoteGATTServer, onBpm?: (bpm: number) => void) {
  const svc = await server.getPrimaryService(HR)
  const ch = await svc.getCharacteristic(HRM)
  // Attach the listener BEFORE enabling notifications so the first reading isn't missed.
  ch.addEventListener('characteristicvaluechanged', (e) => {
    const v = dv(e); const f = v.getUint8(0); const bpm = f & 0x1 ? v.getUint16(1, true) : v.getUint8(1)
    console.log('[ble] HR', bpm); onBpm?.(bpm)
  })
  await ch.startNotifications()
  try { await ch.readValue() } catch { /* not all straps support read; notifications still flow */ }
}

async function attach(device: BluetoothDevice, cb: AttachCbs): Promise<Attached> {
  const server = await device.gatt!.connect()
  // Decide role from the ACTUAL services the device offers (self-heals a stale
  // cached role — the #103 "connected but no bpm" when a HR strap was cached as a
  // trainer and we ran the wrong attach). Cache only breaks a genuine tie.
  const hasTrainer = (await hasService(server, FTMS)) || (await hasService(server, CPS))
  const hasHr = await hasService(server, HR)
  console.log('[ble] services', { hasHr, hasTrainer, cached: loadRoles()[device.id] })
  const role: DeviceRole = hasHr && !hasTrainer ? 'hr' : hasTrainer && !hasHr ? 'trainer'
    : (loadRoles()[device.id] || (hasHr ? 'hr' : 'trainer'))
  if (role === 'hr' && hasHr) {
    await attachHR(server, cb.onHr); saveRole(device.id, 'hr')
    return { role, device, name: device.name || 'HR monitor', disconnect: () => device.gatt?.disconnect() }
  }
  if (hasTrainer) {
    const { hasErg, setTargetPower } = await attachTrainer(server, cb.onTrainer); saveRole(device.id, 'trainer')
    return { role: 'trainer', device, name: device.name || 'Trainer', hasErg, setTargetPower, disconnect: () => device.gatt?.disconnect() }
  }
  // last resort: try HR even if detection was fuzzy
  await attachHR(server, cb.onHr); saveRole(device.id, 'hr')
  return { role: 'hr', device, name: device.name || 'HR monitor', disconnect: () => device.gatt?.disconnect() }
}

// Known fitness brand name-prefixes — so HR straps / trainers that don't advertise
// their service UUID still show, WITHOUT listing mice/earphones (#94/#95).
const FITNESS_NAMES = ['Polar', 'Wahoo', 'KICKR', 'TICKR', 'Tacx', 'TACX', 'Garmin', 'HRM', 'Coros', 'COROS', 'Magene', 'Elite', 'Saris', 'Suunto', 'Scosche', 'Kinetic', 'Stages', '4iiii', 'Favero', 'Zwift', 'Decathlon', 'Kestrel', 'Van Rysel', 'Heart', 'HR ', 'Cadence', 'Power', 'Trainer', 'Bike']
/** Pair a new device. Filters to fitness SERVICES or fitness brand NAMES: many HR
 *  straps / trainers don't advertise their service UUID (only a name) so a pure
 *  services filter hides them (#94); acceptAllDevices listed mice/earphones (#95).
 *  This shows real fitness gear and hides the junk. optionalServices lets us still
 *  discover + use the services after connecting. */
export async function pairDevice(cb: AttachCbs, kind?: DeviceRole): Promise<Attached> {
  // Per-row add (#116): narrow the chooser to HR or to trainer/power; attach() still
  // detects the real role from services, so a mis-pick self-heals.
  const svcFilters = kind === 'hr' ? [{ services: [HR] }]
    : kind === 'trainer' ? [{ services: [FTMS] }, { services: [CPS] }, { services: ['cycling_power'] }]
      : [{ services: [HR] }, { services: [FTMS] }, { services: [CPS] }, { services: ['cycling_power'] }]
  const device = await bt().requestDevice({
    filters: [...svcFilters, ...FITNESS_NAMES.map((namePrefix) => ({ namePrefix }))],
    optionalServices: [HR, FTMS, CPS, 'cycling_power'],
  })
  return attach(device, cb)
}

/** Escape hatch (#95): show EVERY Bluetooth device, for sensors that advertise
 *  neither a fitness service UUID nor a recognized name. Noisy (mice/earphones)
 *  but guarantees the device is selectable; we discover its services on connect. */
export async function pairAnyDevice(cb: AttachCbs): Promise<Attached> {
  const device = await bt().requestDevice({
    acceptAllDevices: true,
    optionalServices: [HR, FTMS, CPS, 'cycling_power'],
  })
  return attach(device, cb)
}

/** Silently reconnect to previously-granted devices (no chooser). */
export async function reconnectKnown(cb: AttachCbs): Promise<Attached[]> {
  if (!bt().getDevices) return []
  const out: Attached[] = []
  for (const d of await bt().getDevices!()) {
    try { out.push(await attach(d, cb)) } catch { /* not in range / failed */ }
  }
  return out
}
