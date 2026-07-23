#!/usr/bin/env node
// #(coach-down 2026-07-23) — REGRESSION GUARD against undefined-variable ReferenceErrors in the SERVER code. The coach
// went down in prod because an incomplete `today`→`todayIso` rename left THREE bare `today` refs in buildSystemPrompt;
// `node --check` only validates SYNTAX, so it sailed through — a bare undefined var only throws at RUNTIME (and one of
// the three hid behind an empty-array `.filter`, so even a manual test missed it). ESLint `no-undef` catches this class
// STATICALLY. This runs it over the server modules and FAILS the build on any undefined reference. Keep it in the build
// chain (package.json build + build:app) alongside the other gates. Server-only (the client has its own tsc typecheck).
import { ESLint } from 'eslint'

const eslint = new ESLint({
  useEslintrc: false,
  overrideConfig: {
    env: { node: true, es2022: true },
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'off' }, // no-undef is the safety net; style rules stay off
  },
})

const results = await eslint.lintFiles(['server/*.js', 'mcp/*.js', 'chat-helper/*.mjs'])
const undef = results.flatMap((r) => r.messages.filter((m) => m.ruleId === 'no-undef').map((m) => `  ${r.filePath.replace(process.cwd() + '/', '')}:${m.line}:${m.column}  ${m.message}`))

if (undef.length) {
  console.error('\n✗ UNDEFINED-VARIABLE guard failed — these would throw a ReferenceError at runtime:\n')
  console.error(undef.join('\n'))
  console.error('\n(This is exactly the class that took the coach down. Define the variable or fix the reference.)\n')
  process.exit(1)
}
console.log(`✓ no-undef guard: no undefined variables in ${results.length} server module(s)`)
