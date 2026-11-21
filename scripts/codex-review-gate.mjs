// 독립 검토 표시 문자열(Lee 2026-11-21): 독립 검토(Codex·Claude 검토관)는 병합 조건이 아니다(11-14 결정 7①·#807 게이트 (3) 변경).
// 예전 판정 함수(codexGate — 봇 대기·검토관 자동 호출·두 번째 검토 강제)는 봇·approval-checks가 더 쓰지 않아 지웠다.
// 남은 것은 수동 검토 경로가 쓰는 표시 두 개뿐 — 게시 잡(scripts/ci/claude-publish.mjs)이 검토관 결과·Claude 답 댓글 첫 줄로 붙인다.
export const FALLBACK_MARKER = '<!-- claude-fallback-review -->'
export const REPLY_MARKER = '<!-- claude-codex-reply -->'
