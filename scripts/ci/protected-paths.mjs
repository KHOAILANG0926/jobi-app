// 보호 대상 경로 단일 목록(Lee 승인 필요 경로 — 결정 0003, 2026-11-15 S4 개정).
// 여기 한 곳만 고치면 세 곳이 함께 움직인다: ① scripts/decision-approval-gate.mjs의 GATE_CODE(Actions 승인 판정·claude-publish 금지 경로),
// ② scripts/check-approval-scope.mjs(.github/CODEOWNERS가 이 목록과 정확히 같은지 검사), ③ 시험(scripts/check-approval-scope.test.mjs).
// 같은 목록을 정규식·CODEOWNERS·허용표에 따로 적지 않는다 — 따로 적으면 서로 어긋난다(검토 지적).
// 이 파일 자체가 /scripts/ci/ 아래라 Lee 승인 대상이다.
export const OWNER_HANDLE = '@KHOAILANG0926'
export const DECISION_DIR = '/docs/decisions/'
export const OWNER_PATHS = [
  DECISION_DIR,
  '/.github/',
  '/scripts/ci/',
  '/scripts/status/',
  '/scripts/check-*.mjs',
  '/scripts/*-gate.mjs',
  '/scripts/approved-migrations.mjs',
  '/AGENTS.md',
  '/CLAUDE.md',
  '/.claude/RULES_CORE.md',
]

// CODEOWNERS 모양의 단순 패턴: '/폴더/'는 그 아래 전부, '*'는 한 칸(슬래시 없이 1글자 이상), 그 밖은 정확히 같은 파일.
export function matchesOwnerPath(path, list = OWNER_PATHS) {
  return list.some((p) => {
    const g = p.slice(1)
    if (g.endsWith('/')) return path.startsWith(g)
    const [pre, suf] = g.split('*')
    if (suf === undefined) return path === g
    const mid = path.slice(pre.length, path.length - suf.length)
    return path.length > pre.length + suf.length && path.startsWith(pre) && path.endsWith(suf) && !mid.includes('/')
  })
}
