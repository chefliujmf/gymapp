// #338 — the coach chat was a wall of text. We render a LIGHT subset of markdown (no dependency, no
// HTML injection): mini-headers, bullet lists, and **bold** inline. This pure parser turns the coach's
// text into blocks; the Chat component renders them as React nodes. Unit-tested (chatFormat.test.ts).

export type Inline = { b: boolean; s: string }
export type Block =
  | { type: 'h'; spans: Inline[] }
  | { type: 'li'; spans: Inline[] }
  | { type: 'p'; spans: Inline[] }

/** Split a line into plain / **bold** runs. */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ b: false, s: s.slice(last, m.index) })
    out.push({ b: true, s: m[1] })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ b: false, s: s.slice(last) })
  return out.length ? out : [{ b: false, s }]
}

/** Parse coach text into blocks: `#`/`##`/`###` or a bold-only line → header; `- `/`* `/`• ` → list item. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const h = line.match(/^#{1,3}\s+(.*)$/)
    if (h) { blocks.push({ type: 'h', spans: parseInline(h[1]) }); continue }
    const li = line.match(/^[-*•]\s+(.*)$/)
    if (li) { blocks.push({ type: 'li', spans: parseInline(li[1]) }); continue }
    // a line that is ONLY a bold label (optionally ending in a colon) reads as a mini-header
    const bold = line.match(/^\*\*(.+?)\*\*:?$/)
    if (bold) { blocks.push({ type: 'h', spans: [{ b: true, s: bold[1].replace(/:\s*$/, '') }] }); continue }
    blocks.push({ type: 'p', spans: parseInline(line) })
  }
  return blocks
}
