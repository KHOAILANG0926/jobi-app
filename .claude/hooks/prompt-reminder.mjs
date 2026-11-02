#!/usr/bin/env node
// Lee 2026-11-02: 매 메시지마다 짧은 확인 문구를 붙인다. UserPromptSubmit 훅의 표준 출력은 Claude의 맥락에 들어간다.
process.stdout.write([
  '[Viecganban 확인] 시킨 것만 한다(지시 없는 변경·파일 생성 금지).',
  '작업이면 먼저 범위·완료 조건·해당 CLAUDE.md 절을 확인하고 시작한다.',
  '확인한 것만 주장([직접 확인]/[기존 기록]/[추정]). 보고는 5줄 이내, 한국어.',
].join('\n') + '\n')
