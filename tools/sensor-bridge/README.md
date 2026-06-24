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
