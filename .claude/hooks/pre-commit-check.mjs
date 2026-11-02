#!/usr/bin/env node
// Lee 2026-11-02: 커밋·push 전에 검사를 자동으로 돌려, 실패하면 Claude의 명령을 막는다(CLAUDE.md 우선 원칙 4).
// PreToolUse(Bash) 훅: 표준 입력 JSON의 tool_input.command를 보고, git commit이면 tsc, git push면 tsc + build.
// 막을 때는 종료 코드 2 + 이유(stderr)를 Claude에게 돌려준다. 다른 명령은 그대로 통과.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

let input = {}
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}') } catch { process.exit(0) }
const command = String(input?.tool_input?.command ?? '')
const isCommit = /\bgit\b[^\n;&|]*\bcommit\b/.test(command)
const isPush = /\bgit\b[^\n;&|]*\bpush\b/.test(command)
if (!isCommit && !isPush) process.exit(0)
// 문서·기록만 바꾸는 커밋은 막지 않는다(코드 변경이 없으면 tsc·build가 의미 없음).
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const block = (why) => { process.stderr.write(`[Viecganban 커밋 전 검사] ${why}\n`); process.exit(2) }

if (!existsSync(join(root, 'node_modules'))) block('node_modules가 없어 tsc·build를 확인할 수 없습니다. npm ci 후 다시 시도하세요(검사 없이 커밋 금지 — CLAUDE.md 우선 원칙 4).')
const run = (args, label) => {
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
  if (r.status !== 0) block(`${label} 실패:\n${String(r.stdout || '').slice(-1500)}${String(r.stderr || '').slice(-800)}`)
}
run(['tsc', '--noEmit'], 'npx tsc --noEmit')
if (isPush) {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
  if (r.status !== 0) block(`npm run build 실패:\n${String(r.stdout || '').slice(-1500)}${String(r.stderr || '').slice(-800)}`)
}
process.exit(0)
