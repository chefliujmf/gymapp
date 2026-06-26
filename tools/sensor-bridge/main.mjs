// Platyplus Sensor Bridge — macOS menubar app (#102).
// Wraps bridge.mjs (HR strap + smart trainer over BLE → ws://localhost:8124) in a
// tray app so a NON-technical user just opens it and rides on desktop — no terminal.
// Build/sign on a Mac (see README): electron-rebuild for noble, then electron-builder.
import { app, Tray, Menu, nativeImage, shell, Notification } from 'electron'
import { startBridge } from './bridge.mjs'

let tray
let handle // { status, stop } from startBridge
const state = { ws: false, hr: false, trainer: false, note: 'starting…' }

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Platyplus Sensor Bridge', enabled: false },
    { label: state.ws ? '🟢 Running · ws://localhost:8124' : '⚪️ ' + state.note, enabled: false },
    { type: 'separator' },
    { label: `❤️  HR strap: ${state.hr ? 'connected' : 'searching…'}`, enabled: false },
    { label: `🚲  Trainer: ${state.trainer ? 'connected' : 'searching…'}`, enabled: false },
    { type: 'separator' },
    { label: 'Open Platyplus', click: () => shell.openExternal('https://platyplus.duckdns.org') },
    { label: 'Restart bridge', click: restart },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
}

function refresh() {
  if (!tray) return
  tray.setTitle(state.hr || state.trainer ? '🚴' : '🔌')
  tray.setToolTip('Platyplus bridge' + (state.ws ? ' — running' : ' — ' + state.note))
  tray.setContextMenu(buildMenu())
}

function run() {
  try {
    handle = startBridge({
      onStatus: (s) => {
        // s may carry { hr, trainer, message, ... } — merge whatever the bridge reports
        if (s && typeof s === 'object') {
          if ('hr' in s) state.hr = !!s.hr
          if ('trainer' in s) state.trainer = !!s.trainer
          if (s.message) state.note = String(s.message).slice(0, 60)
        }
        refresh()
      },
    })
    state.ws = true
    state.note = 'running'
  } catch (e) {
    state.ws = false
    state.note = 'bridge failed: ' + (e?.message || e)
    new Notification({ title: 'Platyplus bridge', body: state.note }).show()
  }
  refresh()
}

function restart() {
  try { handle?.stop?.() } catch { /* noop */ }
  state.ws = false; state.hr = false; state.trainer = false; state.note = 'restarting…'
  refresh()
  setTimeout(run, 400)
}

app.whenReady().then(() => {
  app.dock?.hide() // menubar-only, no dock icon
  tray = new Tray(nativeImage.createEmpty()) // text/emoji title — no icon asset needed
  tray.setTitle('🔌')
  refresh()
  run()
})
// Keep running in the menubar even with no windows.
app.on('window-all-closed', () => { /* stay alive */ })
app.on('before-quit', () => { try { handle?.stop?.() } catch { /* noop */ } })
