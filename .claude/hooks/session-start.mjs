#!/usr/bin/env node
// Lee 2026-11-02: 세션이 열리면 핵심 규칙을 자동으로 Claude 앞에 띄운다(안 읽고 시작하지 못하게).
// SessionStart 훅의 표준 출력은 Claude의 대화 맥락에 들어간다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
try {
  const core = readFileSync(join(root, '.claude', 'RULES_CORE.md'), 'utf8')
  process.stdout.write(`[Viecganban 규칙 — 세션 시작 자동 표시. 작업 전에 반드시 지킨다]\n\n${core}\n`)
} catch (e) {
  process.stdout.write(`[Viecganban] .claude/RULES_CORE.md를 읽지 못함(${e.message}). CLAUDE.md 본문을 먼저 읽고 시작한다.\n`)
}
