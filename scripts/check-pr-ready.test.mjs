import assert from 'node:assert/strict'
import { checkCompletion, recordProblems, recentPrsFor, titleWords } from './check-pr-ready.mjs'
import { evaluateFiles, parseGitDiff } from './check-repository-policy.mjs'

const valid = `## 사용자 요청 및 확정된 완료 조건
- 요청: 중복 작업 방지
- 완료 조건: 최종 CI 통과

## 작업 범위와 변경 파일
- 범위(하지 않는 것 포함): UI/DB 제외
- 변경 파일: scripts/check-pr-ready.mjs

## 필수 테스트 결과 및 검증 SHA
| 테스트/CI | 결과 | 검증 SHA |
|---|---|---|
| checks | success | 1234567890123456789012345678901234567890 |
| app-screen | success | 1234567890123456789012345678901234567890 |
https://github.com/KHOAILANG0926/jobi-app/actions/runs/12345

## 미충족 조건 또는 실제 병합 차단 사유
없음

## 후속 개선 과제 (현재 작업 완료 조건과 분리)
- 없음

## 최종 상태
- [ ] BLOCKED
- [x] READY FOR APPROVAL
- [ ] MERGED`

assert.deepEqual(checkCompletion(valid, '1234567890123456789012345678901234567890'), [])
assert.ok(checkCompletion(valid, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').length > 0, 'old HEAD evidence rejected')
{
  const sha = '1234567890123456789012345678901234567890'
  const later = (text) => valid.replace('- 없음\n\n## 최종 상태', text + '\n\n## 최종 상태')
  assert.ok(checkCompletion(valid.replace(/## 후속 개선 과제[^\n]*\n- 없음\n\n/, ''), sha).some(e => e.includes('후속')), 'missing follow-up section rejected')
  assert.ok(checkCompletion(later('- VPS 브라우저 옛 버전 지우기'), sha).some(e => e.includes('할 일 번호')), 'follow-up without issue rejected')
  assert.deepEqual(checkCompletion(later('- VPS 브라우저 옛 버전 지우기 (#640)'), sha), [], 'follow-up with issue accepted')
  assert.deepEqual(checkCompletion(later('없음 — 이번 범위 안에서 끝남'), sha), [], 'none with reason accepted')
}
assert.ok(checkCompletion(valid.replace('| app-screen | success |', '| app-screen | failure |'), '1234567890123456789012345678901234567890').length > 0, 'failed screen check rejected')
assert.ok(checkCompletion('').length > 0)
// 2026-11-01: 링크·성공 미리 적기는 요구하지 않는다(실제 결과는 봇 병합이 check-runs로 확인)
assert.deepEqual(checkCompletion(valid.replace('https://github.com/KHOAILANG0926/jobi-app/actions/runs/12345', 'pending'), '1234567890123456789012345678901234567890'), [], 'no link needed')
assert.ok(checkCompletion(valid.replace('- [x] READY FOR APPROVAL', '- [ ] READY FOR APPROVAL')).length > 0)
assert.deepEqual(checkCompletion(valid.replaceAll('| success | 1234567890123456789012345678901234567890 |', '| pending | (검사 후 자동 확인) |'), '1234567890123456789012345678901234567890'), [], 'pending before checks allowed')
console.log('PR completion guard: 7/7 passed')

assert.ok(evaluateFiles(['scripts/status/generate-status.mjs']).length > 0, 'STATUS edits denied')
// 결정 0002: 추가형 migration은 통과, 데이터 삭제·되돌리기 어려운 변경은 막음
assert.equal(evaluateFiles(['supabase/migrations/20261024.sql'], '', { 'supabase/migrations/20261024.sql': '+create table x(id int);\n' }).length, 0, 'additive DB migration allowed (decision 0002)')
assert.ok(evaluateFiles(['supabase/migrations/20261024.sql'], '', { 'supabase/migrations/20261024.sql': '+delete from public.local_jobs;\n' }).length > 0, 'destructive DB migration denied')
// #728 S2: 정답 파일 보호 — 기존 줄을 바꾸려면 PR 본문에 출처(결정 번호·Lee 결정 날짜·원문 인용)가 있어야 한다
const ans = 'src/lib/realJobs.fixtures.ts', prodF = 'src/lib/jobQuyenLoi.ts', edit = { [ans]: '-  salary: "7 triệu",\n+  salary: "8 triệu",\n' }
assert.ok(evaluateFiles([ans, prodF], '', edit).some((e) => e.includes('기대값 변경 근거')), 'answer edit + production code without a source denied')
assert.ok(evaluateFiles([ans, prodF], '기대값 변경 근거: 그냥 바꿈', edit).some((e) => e.includes('기대값 변경 근거')), 'answer edit with a vague reason denied')
assert.equal(evaluateFiles([ans, prodF], '기대값 변경 근거: Lee 2026-11-11 지도 위치 절대 원칙', edit).length, 0, 'answer edit with a Lee decision date allowed')
assert.equal(evaluateFiles([ans], '기대값 변경 근거: 원문 인용 "7 – 8,5 triệu/tháng" (#729)', edit).length, 0, 'answer edit with a quoted source / issue number allowed')
assert.equal(evaluateFiles([ans, prodF], '', { [ans]: '+  salary: "9 triệu",\n' }).filter((e) => e.includes(ans)).length, 0, 'adding answer lines with production code allowed')
// GPT 검토(#728): 의미 정답 시험(jobQuyenLoi 등)도 생산 코드와 같은 PR에서 기존 줄을 바꾸면 막는다. 인프라 시험은 자유.
assert.ok(evaluateFiles(['src/lib/jobQuyenLoi.test.ts', 'src/lib/jobQuyenLoi.ts'], '', { 'src/lib/jobQuyenLoi.test.ts': '-x\n+y\n' }).some((e) => e.includes('기대값 변경 근거')), 'semantic test (jobQuyenLoi) expectation edit without a source denied')
assert.ok(evaluateFiles(['supabase/tests/occupation_publication.pglite.test.mjs', 'supabase/migrations/20261112000000_x.sql'], '', { 'supabase/tests/occupation_publication.pglite.test.mjs': '-assert.equal(a, 1)\n+assert.equal(a, 2)\n' }).some((e) => e.includes('기대값 변경 근거')), 'DB rule test (pglite) expectation edit denied without a source')
assert.ok(evaluateFiles(['crawler/test_x.py', 'crawler/x.py'], '', { 'crawler/test_x.py': '-    assert f(1) == 1\n+    assert f(1) == 2\n' }).some((e) => e.includes('기대값 변경 근거')), 'crawler test expectation edit denied without a source')
assert.equal(evaluateFiles(['scripts/ocr/ocr-compare.test.mjs'], '', { 'scripts/ocr/ocr-compare.test.mjs': '+assert.equal(1, 1)\n' }).length, 0, 'a test file alone is not production code')
assert.equal(evaluateFiles(['src/lib/businessType.test.ts', 'src/lib/businessType.ts'], '', { 'src/lib/businessType.test.ts': "-import { a } from './b.ts'\n+import { a, c } from './b.ts'\n+eq(1, 1, 'new case')\n" }).length, 0, 'import line edits and added cases are not expectation changes')
assert.equal(evaluateFiles(['src/lib/homeMapFilters.test.ts', 'src/lib/homeMapFilters.ts'], '', { 'src/lib/homeMapFilters.test.ts': '-x\n+y\n' }).length, 0, 'infrastructure tests stay free')
assert.ok(evaluateFiles(['supabase/migrations/20261024.sql'], '', { 'supabase/migrations/20261024.sql': '+alter table public.local_jobs drop column title;\n' }).length > 0, 'dropping a column denied')
assert.ok(evaluateFiles(['src/lib/jobDetailSections.ts']).length > 0, 'unverified detail categorization denied')
assert.deepEqual(evaluateFiles(['src/lib/jobDetailSections.ts', 'src/lib/jobDetailSections.test.ts']), [], 'covered detail classification allowed')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx']).length > 0, 'detail UI requires regression proof')
console.log('Repository policy negative tests: 5/5 passed')

assert.ok(evaluateFiles(['.env.production']).length > 0, 'environment secrets blocked')
assert.ok(evaluateFiles(['src/lib/directionsPlan.ts']).length > 0, 'directions changes require regression')
assert.ok(evaluateFiles(['src/lib/jobCoords.ts']).length > 0, 'coordinates changes require regression')
assert.ok(evaluateFiles(['src/components/JobVietMap.tsx']).length > 0, 'map rendering requires regression')
assert.ok(evaluateFiles(['src/components/JobCard.tsx']).length > 0, 'job card changes require layout test')
assert.ok(evaluateFiles(['src/pages/KoreaJobDetail.tsx']).length > 0, 'Korea module needs scoped test')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx', 'scripts/test-job-location-detail.mjs']).length === 0, 'tested detail updates pass')
assert.ok(evaluateFiles(['src/lib/jobCoords.ts', 'src/lib/jobCoords.test.ts']).length === 0, 'tested coordinate changes pass')
const samplePatch = 'diff --git a/src/pages/JobDetail.tsx b/src/pages/JobDetail.tsx\n@@ -1,0 +1 @@\n+window.open(job.source_url)\n'
const parsed = parseGitDiff(samplePatch)
assert.deepEqual(parsed.files, ['src/pages/JobDetail.tsx'])
assert.ok(evaluateFiles(parsed.files, '', parsed.patches).some(x => x.includes('원문 URL')), 'source URL leak blocked')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx', 'scripts/test-job-location-detail.mjs'], '', {'src/pages/JobDetail.tsx': '+// source_url is forbidden\n'}).length === 0, 'comment is not exposure')
console.log('Expanded policy negative/positive cases: 10/10 passed')

// #648: 봇(claude[bot])이 고친 커밋을 올린 뒤 — 작업자 줄은 옛 SHA 그대로, 봇이 새 HEAD에서 돌린 검증 줄이 있으면 통과
{
  const { BOT_PROOF_LABEL } = await import('./check-pr-ready.mjs')
  const head = 'a'.repeat(40)
  const withBot = valid.replace('| app-screen | success | 1234567890123456789012345678901234567890 |',
    `| app-screen | success | 1234567890123456789012345678901234567890 |\n| ${BOT_PROOF_LABEL} | [직접 확인] 통과 | ${head} |`)
  assert.deepEqual(checkCompletion(withBot, head, () => true), [], 'bot-only commits after old SHA + bot proof at HEAD → ok')
  assert.ok(checkCompletion(withBot, head, () => false).some(e => e.includes('옛 근거')), 'a human commit after old SHA → still stale')
  assert.ok(checkCompletion(valid, head, () => true).some(e => e.includes('옛 근거')), 'no bot proof row at HEAD → still stale')
  assert.ok(checkCompletion(withBot.replace(`[직접 확인] 통과 | ${head}`, `실패 | ${head}`), head, () => true).length > 0, 'failed bot proof → not ok')
}
// #648: 봇 검증 줄 넣기 → 같은 줄 두 번째는 바꾸기, 다른 줄은 그대로
{
  const { withBotProof } = await import('./ops/pr-bot-proof.mjs')
  const head = 'b'.repeat(40)
  const once = withBotProof(valid, head, '[직접 확인] 통과')
  assert.deepEqual(checkCompletion(once, head, () => true), [], 'inserted bot proof passes')
  const twice = withBotProof(once, 'c'.repeat(40), '[직접 확인] 통과')
  assert.equal(twice.split('\n').filter(l => l.includes('봇 수정 뒤')).length, 1, 'one bot proof row')
  assert.ok(twice.includes('| checks | success | 1234567890123456789012345678901234567890 |'), 'worker rows untouched')
  console.log('PR bot proof (#648): passed')
}

// 확인한 기록(#666): #661 사례 — companyReader.ts를 바꾸면서 최근 병합 PR #616과 같은 파일을 고치던 열린 PR #663을 안 봄
{
  const now = Date.parse('2026-11-10T16:00:00Z')
  const api = (path) => {
    if (path.startsWith('commits?') && path.includes(encodeURIComponent('src/lib/companyReader.ts'))) return [
      { commit: { message: '회사·주소 읽기: 공통 고침 (#616)\n\n본문' } },
      { commit: { message: '회사 이름 규정 (#540)' } },
      { commit: { message: '직접 올린 커밋(번호 없음)' } }]
    if (path.startsWith('commits?')) return []
    if (path.startsWith('pulls?')) return [
      { number: 663, title: '회사·주소 읽기: #633 HAIDILAO 대괄호·CÔNG TY MÌNH·JMT 공단 주소', updated_at: '2026-11-10T15:00:00Z' },
      { number: 661, updated_at: '2026-11-10T15:00:00Z' }, // 자기 자신
      { number: 300, updated_at: '2026-10-30T00:00:00Z' }] // 오래된 열린 PR은 제외
    if (path === 'pulls/663/files?per_page=100&page=1') return [{ filename: 'src/lib/companyReader.ts' }]
    throw new Error('예상 밖 호출 ' + path)
  }
  const required = recentPrsFor({ files: ['src/lib/companyReader.ts', 'WORK_LOG.md'], self: 661, now, api })
  assert.deepEqual(required.map((r) => r.num), [616, 540, 663])
  assert.match(required[2].why, /열린 PR/)
  // 칸 없음 / 하나 빠짐 / 번호만 → 실패
  assert.match(recordProblems('## 작업 범위와 변경 파일\n- 변경 파일: x', required).join(), /칸 없음/)
  const partial = '## 확인한 기록\n- #616: 회사 이름·주소 공통 고침, 같은 단계 순서를 그대로 씀\n- #540: 11-07 회사 이름 규정(한 곳에서 읽기)\n\n## 다음'
  assert.match(recordProblems(partial, required).join(), /#663 없음/)
  const bare = partial.replace('\n\n## 다음', '\n- #663\n\n## 다음')
  assert.match(recordProblems(bare, required).join(), /#663 설명 없음/)
  const full = partial.replace('\n\n## 다음', '\n- #663: 밤 근무가 같은 함수에 HAIDILAO·JMT 사례 추가 중 — 충돌 없게 그 뒤에 합침\n\n## 다음')
  assert.deepEqual(recordProblems(full, required), [])
  // #6630처럼 앞 번호가 같은 다른 번호는 #663으로 치지 않음
  assert.match(recordProblems(full.replace('#663:', '#6630:'), required).join(), /#663 없음/)
  // 볼 기록이 없으면(작업 기록만 바꾼 PR 등) 칸이 없어도 통과
  assert.deepEqual(recordProblems('본문', []), [])
  assert.deepEqual(recentPrsFor({ files: ['WORK_LOG.md'], self: 1, now, api: (p) => (p.startsWith('pulls?') ? [] : assert.fail(p)) }), [])
}
// Codex 지적: 한 줄에 필수 번호 둘을 몰아 쓰면 실패, 101번째 파일에서만 겹쳐도 찾음
{
  const r = [{ num: 616, why: 'x', words: ['회사'] }, { num: 663, why: 'y', words: ['회사'] }]
  const merged = '## 확인한 기록\n- #616 #663: 회사 이름 그대로 유지하며 기존 결정을 따름\n'
  assert.ok(recordProblems(merged, r).length >= 1)
  const big = (path) => {
    if (path.startsWith('commits?')) return []
    if (path.startsWith('pulls?')) return [{ number: 9, title: '큰 PR', updated_at: '2026-11-10T15:00:00Z' }]
    const page = Number(/page=(\d+)/.exec(path)[1])
    return page === 1 ? Array.from({ length: 100 }, (_, i) => ({ filename: `a${i}.ts` })) : [{ filename: 'src/lib/companyReader.ts' }]
  }
  assert.deepEqual(recentPrsFor({ files: ['src/lib/companyReader.ts'], self: 1, now: Date.parse('2026-11-10T16:00:00Z'), api: big }).map((x) => x.num), [9])
}
// Codex 지적: 열린 PR 목록 둘째 페이지의 PR에서만 파일이 겹쳐도 찾음
{
  const recent = (i) => ({ number: 1000 + i, title: `다른 일 ${i}`, updated_at: '2026-11-10T15:00:00Z' })
  const paged = (path) => {
    if (path.startsWith('commits?')) return []
    if (path.startsWith('pulls?')) {
      const page = Number(/page=(\d+)/.exec(path)[1])
      return page === 1 ? Array.from({ length: 100 }, (_, i) => recent(i)) : [{ number: 7, title: '같은 파일 고침', updated_at: '2026-11-10T14:00:00Z' }]
    }
    const n = Number(/pulls\/(\d+)\/files/.exec(path)[1])
    return n === 7 ? [{ filename: 'src/lib/companyReader.ts' }] : [{ filename: 'x.ts' }]
  }
  assert.deepEqual(recentPrsFor({ files: ['src/lib/companyReader.ts'], self: 1, now: Date.parse('2026-11-10T16:00:00Z'), api: paged }).map((x) => x.num), [7])
}
// 그 PR을 열어 봤는지(#666 2단계): 제목 낱말이 줄에 하나도 없으면 실패
{
  assert.deepEqual(titleWords('fix(ci): 회사 이름 규정 HAIDILAO (#616)'), ['회사', '이름', '규정', 'haidilao'])
  const r = [{ num: 616, why: 'x', words: titleWords('위치 확인: 회사 이름·이름 비교·주소 읽기 공통 고침 (#616)') }]
  assert.match(recordProblems('## 확인한 기록\n- #616: 잘 봤고 이번 변경과 관계없음 확인했습니다\n', r).join(), /그 PR 내용이 없음/)
  assert.deepEqual(recordProblems('## 확인한 기록\n- #616: 이름 비교를 공통으로 고친 PR — 이번엔 그 비교는 안 건드림\n', r), [])
  // 성조 없이 적어도 같은 낱말로 침
  const v = [{ num: 1, why: 'x', words: titleWords('Công ty JMT Quế Võ (#1)') }]
  assert.deepEqual(recordProblems('## 확인한 기록\n- #1: cong ty JMT 공단 주소 읽기 사례\n', v), [])
}
// 11-07 결정(#666 3단계): 회사·주소·급여 읽기 함수를 고치면 그 시험에 eq 사례가 더해져야 함
{
  const src = { 'src/lib/companyReader.ts': '+  const x = 1\n' }
  assert.match(evaluateFiles(['src/lib/companyReader.ts'], '', src).join(), /companyReader\.test\.ts에 eq/)
  assert.match(evaluateFiles(['src/lib/companyReader.ts', 'src/lib/companyReader.test.ts'], '', { ...src, 'src/lib/companyReader.test.ts': '-eq(n("a"), "", "x")\n' }).join(), /eq/)
  assert.deepEqual(evaluateFiles(['src/lib/companyReader.ts', 'src/lib/companyReader.test.ts'], '', { ...src, 'src/lib/companyReader.test.ts': '+eq(n("Quán X"), "", "새 사례")\n' }).filter((e) => /Reader/.test(e)), [])
  assert.match(evaluateFiles(['src/lib/companyReader.ts', 'src/lib/companyReader.test.ts'], '', { ...src, 'src/lib/companyReader.test.ts': '+// eq(n("a"), "", "다음에 추가")\n' }).join(), /eq/)
  assert.deepEqual(evaluateFiles(['src/lib/salaryReader.test.ts'], '', { 'src/lib/salaryReader.test.ts': '+eq(1, 1, "y")\n' }).filter((e) => /Reader/.test(e)), [])
}
console.log('check-pr-ready: 확인한 기록(#666) 통과')

// ───────── R3 (Lee 2026-11-13): 변경 범위·지운 것/합친 것·공고 번호 예외·반복 수정 표시 — 고의 위반 시험 ─────────
import { declaredFiles, fieldOf, scopeProblems, mergeLineProblems, exceptionProblems, repeatedFiles } from './check-pr-ready.mjs'
const prBody = (files, merged = '없음 — 이유가 있는 설명입니다', extra = '') => `## 작업 범위와 변경 파일\n- 범위(하지 않는 것 포함): 시험\n- 변경 파일: ${files}\n- 지운 것/합친 것: ${merged}\n${extra}\n## 확인한 기록\n`
const ch = (filename, o = {}) => ({ filename, status: 'modified', additions: 3, deletions: 0, ...o })
// 변경 파일 읽기: 쉼표·공백·백틱·폴더/·* 무늬
assert.deepEqual(declaredFiles(prBody('`src/a.ts`, scripts/b.mjs (새 파일) docs/')), ['src/a.ts', 'scripts/b.mjs', 'docs/'])
assert.deepEqual(declaredFiles(prBody('src/a.ts(신규), scripts/b.mjs(추가만 — 시험)')), ['src/a.ts', 'scripts/b.mjs'], '파일 뒤 괄호 설명은 버림')
assert.deepEqual(declaredFiles(prBody('')), [], '비어 있음')
// ② 범위 대조: 본문에 없는 파일은 차단, 폴더·무늬는 포함, 이름 바꾸기는 옛 이름도 인정, 작업 기록 파일은 제외, 적고 안 바꾼 파일도 차단
assert.deepEqual(scopeProblems(prBody('src/a.ts, scripts/b.mjs'), [ch('src/a.ts'), ch('scripts/b.mjs')]), [], '일치하면 통과')
assert.ok(scopeProblems(prBody('src/a.ts'), [ch('src/a.ts'), ch('supabase/migrations/x.sql')]).some((e) => e.includes('본문에 없는 파일') && e.includes('supabase/migrations/x.sql')), '범위 밖 파일 차단')
assert.deepEqual(scopeProblems(prBody('src/lib/'), [ch('src/lib/a.ts'), ch('src/lib/deep/b.ts')]), [], '폴더 접두')
assert.deepEqual(scopeProblems(prBody('src/lib/*.test.ts'), [ch('src/lib/x.test.ts')]), [], '* 무늬')
assert.ok(scopeProblems(prBody('src/a.ts'), [ch('src/a.ts'), ch('src/z.ts')]).length === 1)
assert.deepEqual(scopeProblems(prBody('src/new.ts'), [ch('src/new.ts', { status: 'renamed', previous_filename: 'src/old.ts' })]), [])
assert.deepEqual(scopeProblems(prBody('src/a.ts'), [ch('src/a.ts'), ch('WORK_LOG.md'), ch('tsconfig.tsbuildinfo')]), [], '작업 기록·자동 생성 파일은 제외')
assert.ok(scopeProblems(prBody('src/a.ts, src/ghost.ts'), [ch('src/a.ts')]).some((e) => e.includes('실제로 바뀌지 않은') && e.includes('src/ghost.ts')), '적고 안 바꾼 파일')
assert.ok(scopeProblems(prBody(''), [ch('src/a.ts')]).some((e) => e.includes('읽지 못함')), '목록 없음')
// ③ 지운 것/합친 것: 칸 없음·이유 없는 없음·추가만 있는데 지웠다고 적음·새 검사기에 비교 근거 없음
assert.ok(mergeLineProblems('## 작업 범위와 변경 파일\n- 변경 파일: a\n', [ch('src/a.ts')]).some((e) => e.includes('칸 없음')))
assert.ok(mergeLineProblems(prBody('src/a.ts', '없음'), [ch('src/a.ts')]).some((e) => e.includes('이유가 없음')), '이유 없는 없음')
assert.deepEqual(mergeLineProblems(prBody('src/a.ts', '없음 — 새 기능이라 같은 일을 하는 기존 코드가 없음'), [ch('src/a.ts')]), [])
assert.ok(mergeLineProblems(prBody('src/a.ts', '합친 것 — 두 함수를 한 곳으로'), [ch('src/a.ts', { deletions: 0 })]).some((e) => e.includes('삭제된 줄·파일이 없음')), '추가만 있는데 합쳤다고 적음')
assert.deepEqual(mergeLineProblems(prBody('src/a.ts', '합친 것 — 두 함수를 한 곳으로'), [ch('src/a.ts', { deletions: 12 })]), [], '실제 삭제가 있으면 통과')
assert.deepEqual(mergeLineProblems(prBody('src/a.ts', '지운 것 — 옛 파일'), [ch('src/old.ts', { status: 'removed', additions: 0, deletions: 0 })]), [], '파일 삭제도 삭제로 인정')
const wf = ch('.github/workflows/new-check.yml', { status: 'added' })
assert.ok(mergeLineProblems(prBody('x', '없음 — 기존에 비슷한 검사가 전혀 없음'), [wf]).some((e) => e.includes('새 검사기')), '새 워크플로에 비교 근거 없는 없음')
assert.deepEqual(mergeLineProblems(prBody('x', '없음 — scripts/check-pr-ready.mjs와 비교했고 겹치지 않음'), [wf]), [], '비교한 기존 파일을 적으면 통과')
assert.deepEqual(mergeLineProblems(prBody('x', '없음 — #666 장치와 겹치지 않음을 확인'), [wf]), [], 'PR 번호도 비교 근거')
assert.ok(mergeLineProblems(prBody('x', '없음 — 이유가 충분히 있음'), [ch('scripts/ops/new-audit.mjs', { status: 'added' })]).some((e) => e.includes('새 검사기')), '새 검사 스크립트')
assert.deepEqual(mergeLineProblems(prBody('x', '없음 — 이유가 충분히 있음'), [ch('scripts/ops/new-audit.test.mjs', { status: 'added' })]), [], '시험 파일은 새 검사기가 아님')
assert.equal(fieldOf(prBody('a', '합친 것 — 줄 하나\n  - 이어지는 줄', '- 예외 근거: #1'), '지운 것\\/합친 것'), '합친 것 — 줄 하나\n  - 이어지는 줄', '이어지는 줄까지 읽음')
// 공고 번호 예외: 코드에 id 비교·sb-번호 상수를 더하면 차단(시험·자료·주석 제외), 실제 있는 근거(#이슈·결정)가 있으면 통과
const patch = (line) => ({ ...ch('src/lib/x.ts'), patch: `@@ -1,1 +1,2 @@\n context\n+${line}\n` })
assert.ok(exceptionProblems(prBody('x'), [patch("if (job.id === 5438) return 'area'")]).length === 1, 'id 비교 예외 차단')
assert.ok(exceptionProblems(prBody('x'), [patch("const SPECIAL = ['sb-5438']")]).length === 1, 'sb-번호 상수 차단')
assert.ok(exceptionProblems(prBody('x'), [patch("switch (x) { case 5438: break }")]).length === 1, 'case 번호 차단')
assert.deepEqual(exceptionProblems(prBody('x'), [patch("// job.id === 5438 은 예전 예외라 지움")]), [], '주석은 제외')
assert.deepEqual(exceptionProblems(prBody('x'), [{ ...patch("if (job.id === 5438) return 1"), filename: 'src/lib/x.test.ts' }]), [], '시험 파일은 제외')
assert.deepEqual(exceptionProblems(prBody('x'), [patch('const year = 2026')]), [], '일반 코드는 통과')
const okRef = (r) => r.issue === 728
assert.ok(exceptionProblems(prBody('x', '없음 — 이유가 충분히 있음', '- 예외 근거: #99999'), [patch("if (job.id === 5438) return 1")], okRef).length === 1, '없는 이슈 번호는 근거가 아님')
assert.deepEqual(exceptionProblems(prBody('x', '없음 — 이유가 충분히 있음', '- 예외 근거: #728 Lee 결정'), [patch("if (job.id === 5438) return 1")], okRef), [], '실제 있는 기록이면 통과')
assert.deepEqual(scopeProblems(prBody('.gitignore, .env.example'), [ch('.gitignore'), ch('.env.example')]), [], '루트 점 파일도 변경 파일로 읽는다')
assert.deepEqual(exceptionProblems(prBody('x'), [{ ...patch('job = {"id": "sb-4312"}'), filename: 'crawler/test_job_quality.py' }]), [], '파이썬 시험 파일은 제외')
// 반복 수정 표시(차단 아님)
assert.deepEqual(repeatedFiles({ 'src/lib/a.ts': 3, 'src/lib/a.test.ts': 5, 'src/lib/b.ts': 2 }, ['src/lib/a.ts', 'src/lib/a.test.ts', 'src/lib/b.ts']), [{ file: 'src/lib/a.ts', count: 3 }], '같은 파일 고침 PR 3건 이상만, 시험 파일 제외')
// recentPrsFor 통계: 제목에 고침 낱말이 있는 병합 PR만 센다
{
  const stats = { fixCounts: {} }
  const api = (path) => path.startsWith('commits?') ? [{ commit: { message: '오판 고침 (#11)' } }, { commit: { message: '새 기능 추가 (#12)' } }, { commit: { message: '예외 수정 (#13)' } }] : []
  recentPrsFor({ files: ['src/lib/a.ts'], self: 1, api, stats })
  assert.equal(stats.fixCounts['src/lib/a.ts'], 2, '고침 제목 2건만 반복 수정으로 센다')
}
console.log('R3 PR scope/merge-line/exception guards: passed')
