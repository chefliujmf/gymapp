# Platyplus sensor bridge (desktop)

Reliable trainer + heart-rate on **desktop Chrome** (esp. macOS), where Web
Bluetooth can't discover advertising-only sensors like a HR chest strap.

It reads your sensors over the Mac's **native Bluetooth** (the same stack Zwift
uses) and streams the data to the Platyplus ride player over a localhost
WebSocket — no Chrome Web Bluetooth involved.

## Run it

```bash
cd tools/sensor-bridge
npm install        # first time only (builds the native BLE module)
npm start
```

- macOS will prompt to allow **Bluetooth** for your terminal app — say **yes**
  (or System Settings → Privacy & Security → Bluetooth → enable Terminal/iTerm).
- Put your HR strap on and wake the trainer (spin the pedals).
- The bridge prints `HR streaming…` / `trainer streaming…` as they connect.
- Open a ride in Chrome — the player auto-connects to the bridge and shows live
  watts / cadence / bpm. ERG target is forwarded to the trainer if it supports it.

Leave the bridge running while you ride. `Ctrl-C` to stop.

## How the app uses it

The ride player tries `ws://localhost:8124` first; if the bridge is running it
uses that data and shows a **"Bridge"** source. If not, it falls back to the
in-browser Web Bluetooth pairing (which is fine on Android Chrome / your phone).

## Notes

- Only `localhost` connects (the WebSocket binds to `127.0.0.1`).
- Works for any standard BLE HR strap, smart trainer (FTMS) or power meter (CPS).
- This is a personal-use helper; it's not deployed — you run it on the machine you
  ride from.

## Menubar app (#102) — for non-technical riders

Instead of running the CLI, package this as a **macOS menubar app** so a non-technical
user just opens "Platyplus Sensor Bridge" and rides — no terminal. `main.mjs` wraps
`startBridge()` in an Electron tray (status: HR / trainer / running).

**Build it (on a Mac — the BLE native module + signing need real hardware):**

```bash
cd tools/sensor-bridge
npm install              # installs electron + electron-builder; postinstall runs
                         # electron-rebuild so @abandonware/noble matches Electron's ABI
npm run app              # dev: launches the menubar app locally to test
npm run dist             # builds a .dmg into dist/
```

**Notes / gotchas (must be done on the Mac, can't be verified in CI):**
- **Native module:** `@abandonware/noble` is native — `electron-rebuild` (the
  `postinstall`) recompiles it for Electron. If BLE doesn't work in the app, re-run
  `npx electron-rebuild -f -w @abandonware/noble`.
- **Bluetooth permission:** macOS will prompt on first run (the `NSBluetooth…` string
  is set). Grant it.
- **Code signing (for sharing with others, e.g. the household):** set an Apple
  Developer ID and notarize — add to `npm run dist`:
  `CSC_NAME="Developer ID Application: <you>" APPLE_ID=… APPLE_APP_SPECIFIC_PASSWORD=… APPLE_TEAM_ID=… npm run dist`.
  Unsigned, it still runs on your own Mac (right-click → Open the first time).
- The app is menubar-only (`LSUIElement`), keeps running with no window, and stops the
  bridge cleanly on Quit.
