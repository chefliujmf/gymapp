// Generates PWA PNG icons with no external deps (zlib only).
// Draws a lime barbell glyph on the app's dark background.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const BG = [0x0d, 0x0d, 0x0f]
const LIME = [0xe8, 0xff, 0x3a]

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

function draw(set, S) {
  const fillRect = (x0, y0, w, h, col) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, col)
  }
  // background (rounded look approximated by full fill — maskable safe zone covered)
  fillRect(0, 0, S, S, BG)
  const u = S / 16 // unit grid
  const cy = S / 2
  const bar = (k) => Math.round(k * u)
  // barbell bar
  fillRect(bar(3), Math.round(cy - u * 0.4), bar(10), Math.round(u * 0.8), LIME)
  // inner plates
  const plate = (cx, w, h) => fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h), LIME)
  plate(bar(4.2), u * 1.1, u * 4.5)
  plate(bar(11.8), u * 1.1, u * 4.5)
  // outer plates
  plate(bar(2.7), u * 1.0, u * 3.0)
  plate(bar(13.3), u * 1.0, u * 3.0)
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `pwa-${size}.png`
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size, draw))
  console.log('wrote public/' + name)
}
