// Tiny JSON-file user store (single writer, atomic rename). Fine for the handful
// of users a personal app has. Shape:
//   { sessionSecret, users: [{ id, username, email, role, passwordHash,
//                              passkeys: [{id, publicKey, counter, transports}],
//                              info: {}, createdAt }],
//     resets: { [userId]: { codeHash, expiresAt } } }
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

const FILE = process.env.DATA_FILE || '/data/store.json'

function blank() {
  return { sessionSecret: randomBytes(48).toString('hex'), users: [], resets: {} }
}

export function load() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    const s = blank()
    save(s)
    return s
  }
}

export function save(store) {
  const dir = dirname(FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmp = FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(store, null, 2))
  renameSync(tmp, FILE)
}

export function newId() {
  return randomBytes(9).toString('base64url')
}
