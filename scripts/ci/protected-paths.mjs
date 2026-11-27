// 보호 대상 경로 단일 목록(Lee 승인 필요 경로 — 결정 0003, 2026-11-15 S4 개정).
// 여기 한 곳만 고치면 세 곳이 함께 움직인다: ① scripts/decision-approval-gate.mjs의 GATE_CODE(Actions 승인 판정·claude-publish 금지 경로),
// ② scripts/check-approval-scope.mjs(.github/CODEOWNERS가 이 목록과 정확히 같은지 검사), ③ 시험(scripts/check-approval-scope.test.mjs).
// 같은 목록을 정규식·CODEOWNERS·허용표에 따로 적지 않는다 — 따로 적으면 서로 어긋난다(검토 지적).
// 이 파일 자체가 /scripts/ci/ 아래라 Lee 승인 대상이다.
export const OWNER_HANDLE = '@KHOAILANG0926'
export const DECISION_DIR = '/docs/decisions/'
export const OWNER_PATHS = [
  DECISION_DIR,
  // 워크플로는 폴더 전체가 아니라 '실제 권한·비밀값·실행기·필수 검사'를 가진 파일만 적는다(Lee 2026-11-23 '일반 워크플로 자동 병합' 정책을 서버 쪽 CODEOWNERS에서도 지킴). 기준은 decision-approval-gate의
  // workflowPrivileged·workflowDefinesRequiredCheck 한 곳이며, 그 기준에 걸리는 워크플로가 이 목록에 없으면 check-approval-scope가 빨간불이다(우회·누락 방지).
  '/.github/CODEOWNERS',
  '/.github/approved-migrations.json',
  '/.github/pull_request_template.md',
  '/.github/workflows/admin-line-pick-e2e.yml',
  '/.github/workflows/admin-location-confirm.yml',
  '/.github/workflows/admin-location-evening-report.yml',
  '/.github/workflows/admin-location-review-e2e.yml',
  '/.github/workflows/ai-reader-calibration.yml',
  '/.github/workflows/android-twa-build.yml',
  '/.github/workflows/android-upload-key-init.yml',
  '/.github/workflows/app-screen-check.yml',
  '/.github/workflows/approval-checks.yml',
  '/.github/workflows/auto-location.yml',
  '/.github/workflows/bot-pr-automerge.yml',
  '/.github/workflows/brand-logo-watch.yml',
  '/.github/workflows/brand-logo.yml',
  '/.github/workflows/business-search-compare.yml',
  '/.github/workflows/claude-auto.yml',
  '/.github/workflows/codex-wait-timer.yml',
  '/.github/workflows/company-code-assign.yml',
  '/.github/workflows/company-reread.yml',
  '/.github/workflows/crawl-chotot-probe.yml',
  '/.github/workflows/crawl-facebook-one.yml',
  '/.github/workflows/crawl-guard.yml',
  '/.github/workflows/crawl.yml',
  '/.github/workflows/crawler-cli-tests.yml',
  '/.github/workflows/demo-capture.yml',
  '/.github/workflows/deploy-verify.yml',
  '/.github/workflows/detail-read.yml',
  '/.github/workflows/fetch-occupation-source.yml',
  '/.github/workflows/job-ocr-check.yml',
  '/.github/workflows/job-repair-preview.yml',
  '/.github/workflows/job-rules-apply.yml',
  '/.github/workflows/korea-fb-research.yml',
  '/.github/workflows/korea-fb-survey.yml',
  '/.github/workflows/location-ladder-compare.yml',
  '/.github/workflows/migrations-apply.yml',
  '/.github/workflows/mobile-screens.yml',
  '/.github/workflows/multi-role-presentation.yml',
  '/.github/workflows/occupation-publication-check.yml',
  '/.github/workflows/occupation-r8-apply.yml',
  '/.github/workflows/occupation-weekly-unclassified.yml',
  '/.github/workflows/ops-insert-job.yml',
  '/.github/workflows/ops-publish-jobs.yml',
  '/.github/workflows/ops-run-sql.yml',
  '/.github/workflows/pr-checks.yml',
  '/.github/workflows/refresh-facebook-existing.yml',
  '/.github/workflows/review-signal.yml',   // 승인 체인 구성(S4: 승인·취소 즉시 재검사 신호) — 권한은 없지만 내용 기준과 별개로 명시 보호
  '/.github/workflows/rules-core-sync.yml',
  '/.github/workflows/status-guard.yml',
  '/.github/workflows/status-report.yml',
  '/.github/workflows/street-center-dryrun.yml',
  '/.github/workflows/unmerged-work-alert.yml',
  '/.github/workflows/vercel-deploy.yml',
  '/.github/workflows/vps-clean-old-runner.yml',
  '/.github/workflows/vps-diag.yml',
  '/.github/workflows/vps-disk-report.yml',
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
