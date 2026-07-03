import { describe, it, expect } from 'vitest'
import { parseInline, parseBlocks } from './chatFormat'

describe('parseInline', () => {
  it('splits **bold** runs', () => {
    expect(parseInline('do **this** now')).toEqual([{ b: false, s: 'do ' }, { b: true, s: 'this' }, { b: false, s: ' now' }])
  })
  it('plain text → one non-bold run', () => {
    expect(parseInline('hello')).toEqual([{ b: false, s: 'hello' }])
  })
})

describe('parseBlocks', () => {
  it('## heading → header block', () => {
    expect(parseBlocks('## Today')[0]).toEqual({ type: 'h', spans: [{ b: false, s: 'Today' }] })
  })
  it('a bold-only line becomes a mini-header', () => {
    expect(parseBlocks('**Plan for the week:**')[0]).toEqual({ type: 'h', spans: [{ b: true, s: 'Plan for the week' }] })
  })
  it('- and • lines → list items', () => {
    const b = parseBlocks('- run easy\n• stretch')
    expect(b.map((x) => x.type)).toEqual(['li', 'li'])
  })
  it('normal text → paragraph; blank lines dropped', () => {
    const b = parseBlocks('Nice work today.\n\nRest up.')
    expect(b.map((x) => x.type)).toEqual(['p', 'p'])
  })
  it('a structured coach reply parses to headers + bullets, not one blob', () => {
    const b = parseBlocks('**This week**\n- Mon: easy run\n- Wed: intervals\n\nKeep it steady.')
    expect(b.map((x) => x.type)).toEqual(['h', 'li', 'li', 'p'])
  })
})
