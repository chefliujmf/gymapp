// Platyplus chat helper — runs on the XPS HOST (where `claude` + its subscription
// auth live, glibc-native). The Platyplus app container can't run the glibc claude
// binary (Alpine/musl), so /auth/chat in the container proxies to THIS service.
//
// Security: bound to 127.0.0.1 + the docker bridge; requires a shared secret
// header so only the container can call it. It runs a LOCKED-DOWN `claude -p`
// (only the per-user Platyplus MCP — no shell/files), scoped to the user's Coach
// API token passed by the container.
//
// Env:
//   CHAT_HELPER_PORT    default 8790
//   CHAT_HELPER_BIND    default 0.0.0.0 (so the container reaches it via host-gateway)
//   CHAT_HELPER_SECRET  shared secret (required)
//   CLAUDE_BIN          default ~/.local/bin/claude
//   PLATYPLUS_MCP_PATH  path to mcp/server.js on the host
//   PLATYPLUS_URL       the Coach API the MCP calls (the container, e.g. http://127.0.0.1:8089)
//   NODE_BIN_DIR        dir holding `node` so claude can spawn the MCP (added to PATH)
import http from 'node:http'
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, unlinkSync } from 'node:fs'

const PORT = Number(process.env.CHAT_HELPER_PORT || 8790)
const BIND = process.env.CHAT_HELPER_BIND || '0.0.0.0'
const SECRET = process.env.CHAT_HELPER_SECRET || ''
const CLAUDE_BIN = process.env.CLAUDE_BIN || join(homedir(), '.local/bin/claude')
const MCP_PATH = process.env.PLATYPLUS_MCP_PATH || join(homedir(), 'platyplus-chat/mcp/server.js')
const COACH_API = process.env.PLATYPLUS_URL || 'http://127.0.0.1:8089'
const NODE_BIN_DIR = process.env.NODE_BIN_DIR || join(homedir(), '.local/bin')
const DENY = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite'
const coachPrompt = (name) => `You are ${name}, a personal training & nutrition coach inside the Platyplus app helping ONE user (the signed-in account) manage THEIR own plan. Use ONLY the provided platyplus tools to create or adjust their workouts, rides, runs, meals, mind sessions and notes. You cannot modify the app, read files, run commands, or access any other user. When asked to schedule or change something, do it with the tools, then confirm in one short sentence what you changed. Be concise, practical and encouraging. Decline anything outside this user's training/nutrition planning.`
// #353 — a human phrase for the tool the coach is calling, shown as "Reviewing your …" while it works.
const TOOL_LABEL = { get_wellness: 'your wellness data', get_checkins: 'your check-ins', get_recent_activities: 'your recent activity', list_schedule: 'your schedule', get_weather: 'the weather', check_connections: 'your connections', search_exercises: 'the exercise library', search_recipes: 'recipes', create_workout: 'a gym session', create_ride: 'a ride', create_run: 'a run', schedule_recovery: 'recovery', schedule_supplement: 'supplements', save_coach_review: 'your review', set_activity_text: 'your activity notes', set_athlete_profile: 'your profile', set_thresholds: 'your thresholds', set_weekly_target: 'your week', save_coach_memory: 'your coaching notes', schedule_meal: 'a meal', schedule_mind: 'a mind session', notify: 'a note for you' }
const friendlyTool = (name) => { const t = String(name || '').replace(/^mcp__platyplus__/, ''); return TOOL_LABEL[t] || t.replace(/_/g, ' ') }

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/chat') { res.writeHead(404); return res.end() }
  if (SECRET && req.headers['x-chat-secret'] !== SECRET) { res.writeHead(403); return res.end('forbidden') }
  let body = ''
  req.on('data', (d) => (body += d))
  req.on('end', () => {
    let p; try { p = JSON.parse(body) } catch { res.writeHead(400); return res.end() }
    const message = String(p.message || '').trim().slice(0, 4000)
    const token = p.token
    if (!message || !token) { res.writeHead(400); return res.end('message+token required') }
    const mcpConfig = JSON.stringify({ mcpServers: { platyplus: { command: 'node', args: [MCP_PATH], env: { PLATYPLUS_URL: COACH_API, PLATYPLUS_TOKEN: token } } } })
    // The system prompt is ~128 KB (base engine + per-sport engines + profile) — too big to pass as an
    // argv (Linux caps a single arg at 128 KiB → E2BIG spawn failure). Write it to a temp file and use
    // --append-system-prompt-file so prompt size never crashes the coach.
    const sysPrompt = (typeof p.systemPrompt === 'string' && p.systemPrompt.trim()) ? p.systemPrompt : coachPrompt(p.coach || 'Coach')
    const spFile = join(tmpdir(), `coach-sp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`)
    try { writeFileSync(spFile, sysPrompt) } catch (e) { res.writeHead(500); return res.end('sysprompt write failed: ' + e.message) }
    const args = [
      '-p', message,
      '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
      '--mcp-config', mcpConfig,
      '--allowedTools', 'mcp__platyplus',
      '--disallowedTools', DENY,
      '--append-system-prompt-file', spFile,
    ]
    if (p.sessionId) args.push('--resume', p.sessionId)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`)
    const env = { ...process.env, PATH: `${NODE_BIN_DIR}:${process.env.PATH || ''}` }
    const proc = spawn(CLAUDE_BIN, args, { env })
    proc.stdin?.end()
    let buf = '', err = '', done = false
    const cleanup = () => { try { unlinkSync(spFile) } catch { /* already gone */ } }
    const killer = setTimeout(() => proc.kill('SIGKILL'), 180000)
    const end = () => { if (done) return; done = true; clearTimeout(killer); cleanup(); send({ done: true }); res.end() }
    proc.stdout.on('data', (d) => {
      buf += d
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (!line) continue
        let ev; try { ev = JSON.parse(line) } catch { continue }
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') send({ delta: ev.event.delta.text })
        // #353 — surface tool activity so the UI can show "reviewing your …" instead of a frozen screen.
        else if (ev.type === 'stream_event' && ev.event?.type === 'content_block_start' && ev.event.content_block?.type === 'tool_use') send({ tool: friendlyTool(ev.event.content_block.name) })
        else if (ev.type === 'result' && ev.session_id) send({ sessionId: ev.session_id })
      }
    })
    proc.stderr.on('data', (d) => (err += d))
    proc.on('error', (e) => { if (!done) { done = true; clearTimeout(killer); cleanup(); send({ error: 'coach unavailable: ' + e.message }); res.end() } })
    proc.on('close', () => { if (err && !buf) send({ error: err.slice(0, 200) }); end() })
    res.on('close', () => { if (!done) { clearTimeout(killer); proc.kill('SIGKILL') } })
  })
})
server.listen(PORT, BIND, () => console.log(`platyplus chat-helper listening on ${BIND}:${PORT}`))
