#!/usr/bin/env node
// Platyplus local sensor bridge (#100).
// Reads a HR strap + smart trainer over the Mac's NATIVE Bluetooth (noble →
// CoreBluetooth, the same stack Zwift uses) and streams the data to the Platyplus
// ride player over a localhost WebSocket. This exists because macOS Chrome's Web
// Bluetooth won't discover advertising-only sensors (a HR strap can't be OS-paired).
//
// Run:  cd tools/sensor-bridge && npm install && npm start
// macOS will ask to allow Bluetooth for your terminal — say yes (System Settings →
// Privacy & Security → Bluetooth). Then open a ride in Chrome; it auto-connects.
//
// Protocol (JSON over ws://localhost:8124):
//   server → client : {type:'live', hr?, power?, cadence?, speed?}
//                     {type:'device', role:'hr'|'trainer', name, connected:bool}
//   client → server : {cmd:'erg', watts:N}   (sets ERG target if the trainer supports it)

// Exposes startBridge({onStatus}) so the menubar app (#102) can run it; also runs
// standalone via `node bridge.mjs` for power users.
import noble from '@abandonware/noble'
import { WebSocketServer } from 'ws'

const PORT = 8124
const HR = '180d', HRM = '2a37'
const FTMS = '1826', IDB = '2ad2', FTCP = '2ad9'
const CPS = '1818', CPM = '2a63'
const WANT = [HR, FTMS, CPS]

const norm = (u) => String(u).toLowerCase().replace(/-/g, '').replace(/^0000([0-9a-f]{4})0000.*/, '$1')

export function startBridge({ onStatus } = {}) {
const status = { bluetooth: 'unknown', hr: null, trainer: null }
const emit = () => { try { onStatus?.({ ...status }) } catch { /* noop */ } }
const log = (...a) => console.log('[bridge]', ...a)

// ---- WebSocket server ----
const wss = new WebSocketServer({ port: PORT, host: '127.0.0.1' })
const live = { hr: undefined, power: undefined, cadence: undefined, speed: undefined }
let ergControl = null
function broadcast(msg) { const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === 1) c.send(s) }
function pushLive() { broadcast({ type: 'live', ...live }) }
wss.on('listening', () => log(`WebSocket up on ws://localhost:${PORT} — open a ride in any browser.`))
wss.on('connection', (c) => {
  log('ride player connected'); pushLive()
  c.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString())
      if (m.cmd === 'erg' && ergControl) setErg(Number(m.watts) || 0)
    } catch { /* ignore */ }
  })
})

// ---- ERG (FTMS control point) ----
async function setErg(watts) {
  if (!ergControl) return
  const buf = Buffer.alloc(3); buf.writeUInt8(0x05, 0); buf.writeInt16LE(Math.round(watts), 1)
  try { await ergControl.writeAsync(buf, false) } catch (e) { log('erg write failed', e.message) }
}

// ---- parsers ----
function parseHR(d) { const f = d.readUInt8(0); return f & 0x1 ? d.readUInt16LE(1) : d.readUInt8(1) }
function parseIndoorBike(d) {
  const flags = d.readUInt16LE(0); let o = 2; const out = {}
  if (!(flags & 0x1)) { out.speed = d.readUInt16LE(o) / 100; o += 2 }
  if (flags & 0x2) o += 2
  if (flags & 0x4) { out.cadence = d.readUInt16LE(o) / 2; o += 2 }
  if (flags & 0x8) o += 3
  if (flags & 0x10) o += 2
  if (flags & 0x20) o += 3
  if (flags & 0x40) o += 2
  if (flags & 0x80) { out.power = d.readInt16LE(o); o += 2 }
  return out
}
function parseCps(d) { return { power: d.readInt16LE(2) } } // flags(2) + instant power(int16)

// ---- BLE ----
const connected = new Set()
noble.on('stateChange', (state) => {
  log('bluetooth', state); status.bluetooth = state; emit()
  if (state === 'poweredOn') { log('scanning for HR strap + trainer…'); noble.startScanning(WANT, false) }
  else noble.stopScanning()
})

noble.on('discover', async (p) => {
  const services = (p.advertisement.serviceUuids || []).map(norm)
  const isHr = services.includes(HR)
  const isTrainer = services.includes(FTMS) || services.includes(CPS)
  if (!isHr && !isTrainer) return
  if (connected.has(p.id)) return
  connected.add(p.id)
  const name = p.advertisement.localName || (isHr ? 'HR monitor' : 'Trainer')
  try {
    log('connecting', name, '(' + p.id + ')')
    await p.connectAsync()
    const { characteristics } = await p.discoverAllServicesAndCharacteristicsAsync()
    const byUuid = (u) => characteristics.find((c) => norm(c.uuid) === u)
    p.once('disconnect', () => {
      connected.delete(p.id); log('lost', name)
      if (isHr) status.hr = null; else status.trainer = null; emit()
      broadcast({ type: 'device', role: isHr ? 'hr' : 'trainer', name, connected: false })
      if (noble.state === 'poweredOn') noble.startScanning(WANT, false)
    })

    const hrm = byUuid(HRM)
    if (hrm) { await hrm.subscribeAsync(); hrm.on('data', (d) => { live.hr = parseHR(d); pushLive() }); log('HR streaming:', name); status.hr = name; emit(); broadcast({ type: 'device', role: 'hr', name, connected: true }) }

    const idb = byUuid(IDB)
    const cpm = byUuid(CPM)
    if (idb) {
      await idb.subscribeAsync(); idb.on('data', (d) => { Object.assign(live, parseIndoorBike(d)); pushLive() })
      const cp = byUuid(FTCP)
      if (cp) { try { await cp.subscribeAsync(); await cp.writeAsync(Buffer.from([0x00]), false); ergControl = cp; log('ERG control ready') } catch { /* read-only trainer */ } }
      log('trainer streaming (FTMS):', name); status.trainer = name; emit(); broadcast({ type: 'device', role: 'trainer', name, connected: true })
    } else if (cpm) {
      await cpm.subscribeAsync(); cpm.on('data', (d) => { Object.assign(live, parseCps(d)); pushLive() })
      log('power meter streaming (CPS):', name); status.trainer = name; emit(); broadcast({ type: 'device', role: 'trainer', name, connected: true })
    }

    // keep scanning for the OTHER device (HR + trainer)
    if (noble.state === 'poweredOn') noble.startScanning(WANT, false)
  } catch (e) {
    connected.delete(p.id); log('connect failed', name, e.message)
    if (noble.state === 'poweredOn') noble.startScanning(WANT, false)
  }
})

emit()
return { status, stop: () => { try { noble.stopScanning() } catch { /* noop */ } try { wss.close() } catch { /* noop */ } } }
}

// Standalone CLI (power users): `node bridge.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  startBridge({ onStatus: (s) => console.log('[bridge] status', JSON.stringify(s)) })
  process.on('SIGINT', () => { console.log('[bridge] bye'); process.exit(0) })
}
