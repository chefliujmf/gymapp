// Generates PWA PNG icons with no external deps (zlib only).
// Draws a lime barbell glyph on the app's dark background.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'

// Platyplus mascot palette (matches public/favicon.svg — sweatband, NO cross).
const BG = [0x0d, 0x0d, 0x0f]
const GREEN = [0x34, 0xe0, 0x7d]
const RED = [0xff, 0x6b, 0x6b]
const DARK = [0x0d, 0x0d, 0x0f]
const BILL1 = [0x17, 0x5c, 0x3a]
const BILL2 = [0x24, 0x94, 0x57]

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function png(size, draw) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
  }
  draw(set, size)
  // add filter byte (0) per scanline
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Render the same mascot as favicon.svg (64x64 space, scaled to S). NO cross.
function draw(set, S) {
  const f = S / 64
  const ellipse = (cx, cy, rx, ry, col) => {
    for (let y = Math.floor((cy - ry) * f); y <= Math.ceil((cy + ry) * f); y++)
      for (let x = Math.floor((cx - rx) * f); x <= Math.ceil((cx + rx) * f); x++) {
        const dx = (x / f - cx) / rx, dy = (y / f - cy) / ry
        if (dx * dx + dy * dy <= 1) set(x, y, col)
      }
  }
  const disk = (cx, cy, r, col) => ellipse(cx, cy, r, r, col)
  const line = (x1, y1, x2, y2, r, col) => { for (let t = 0; t <= 1; t += 0.03) disk(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, col) }
  // rounded-rect dark background (radius 14 in 64-space)
  const rad = 14
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx = x / f, sy = y / f
    const inX = sx >= rad && sx <= 64 - rad, inY = sy >= rad && sy <= 64 - rad
    let inside = inX || inY
    if (!inside) { const cxr = sx < rad ? rad : 64 - rad, cyr = sy < rad ? rad : 64 - rad; inside = (sx - cxr) ** 2 + (sy - cyr) ** 2 <= rad * rad }
    if (inside) set(x, y, BG)
  }
  ellipse(32, 28, 16.5, 14.5, GREEN)                                  // head
  for (let t = 0; t <= 1; t += 0.008) {                               // red sweatband (quadratic arc, width ~6)
    const mt = 1 - t
    disk(mt * mt * 17.5 + 2 * mt * t * 32 + t * t * 46.5, mt * mt * 23 + 2 * mt * t * 16.5 + t * t * 23, 3, RED)
  }
  line(22.5, 27, 29, 28.5, 1.3, DARK); line(41.5, 27, 35, 28.5, 1.3, DARK)  // game-face brows
  disk(27, 30.5, 2.2, DARK); disk(37, 30.5, 2.2, DARK)                // eyes
  ellipse(32, 44, 15, 7, BILL1); ellipse(32, 42.5, 15, 5.8, BILL2)    // flat bill
  disk(28, 41, 1.2, DARK); disk(36, 41, 1.2, DARK)                    // nostrils
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `pwa-${size}.png`
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size, draw))
  console.log('wrote public/' + name)
}
