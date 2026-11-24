// 변경 영향 범위 판정 시험(3순위). 실제로 병합된 PR들의 바뀐 파일 목록으로 본다.
import assert from 'node:assert/strict'
import { changeImpact as c } from './change-impact.mjs'
const pick = (r) => `${r.screen ? 'S' : '-'}${r.map ? 'M' : '-'}${r.menu ? 'N' : '-'}`
// 닫힌 방향
assert.equal(pick(c(null)), 'SMN', '목록 없음 → 전부'); assert.equal(pick(c([])), 'SMN', '빈 목록 → 전부')
assert.equal(pick(c(['something/new.bin'])), 'SMN', '미분류 파일 → 화면·지도·메뉴 전부')
assert.equal(pick(c(['src/components/SalaryText.tsx'])), 'SMN', '분류 안 된 화면 파일 → 지도·메뉴까지')
assert.equal(pick(c(['api/map-locations.js', 'src/lib/somethingNew.ts'])), 'SMN', '지도 파일과 미분류 파일이 섞이면 전부')
// #995(병합 봇 워크플로·CI 스크립트·규칙 문서) → 화면과 무관
assert.equal(pick(c(['.github/workflows/bot-pr-automerge.yml', '.github/workflows/deploy-verify.yml', 'scripts/ci/deploy-success-pickup.sh', 'CLAUDE.md', '.claude/RULES_CORE.md', 'WORK_LOG.md'])), '---')
// 화면 검사 워크플로 자체를 바꾸면 화면 검사
assert.equal(pick(c(['.github/workflows/app-screen-check.yml'])), 'SMN')
// #999(다중 지점 전환 migration) → 공개 위치 응답에 닿음
assert.equal(pick(c(['supabase/migrations/20261124120000_multi_branch_conversion.sql', 'supabase/tests/multi_branch_conversion.local.sql', 'docs/plans/x.md'])), 'SM-')
// #991(공개 위치 요약 API) · 좌표 공용 함수
assert.equal(pick(c(['api/map-locations.js', 'api/map-locations.test.ts'])), 'SM-')
assert.equal(pick(c(['src/lib/jobCoords.ts'])), 'SM-')
// 메인 메뉴 검색
assert.equal(pick(c(['src/lib/jobSearchMenu.ts'])), 'S-N')
assert.equal(pick(c(['src/components/home/HomeMapExplorer.tsx'])), 'SMN', '메인 지도 부품은 지도·메뉴 둘 다')
// 크롤러·시험 DB·문서만 → 화면과 무관 / 화면 도면은 화면 검사
assert.equal(pick(c(['crawler/ingest_gateway.py', 'crawler/test_x.py', 'supabase/tests/a.local.sql', 'docs/plans/a.md'])), '---')
assert.equal(pick(c(['docs/decisions/drawings/job-detail-layout.json'])), 'SMN')
// 공고 내용 파일(사진 처리 검증이 읽음)은 화면 검사
assert.equal(pick(c(['scripts/ops/jobs/fb-x.json'])), 'SMN')
console.log('change-impact.test.mjs: 통과')
