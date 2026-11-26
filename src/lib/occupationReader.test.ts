// #717 B(Lee 2026-11-25): 웹 등록의 직업코드 읽기는 수집기와 같은 규칙 파일·같은 결과(규칙 공통화, 별도 판정 체계 없음).
import { classifyOccupation, occupationCandidates, occupationForPost } from './occupationReader.mjs'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const fsModule = 'node:fs' // 다른 시험(jobCriteria.test.ts)과 같은 방식 — src 타입 검사에 node 타입을 들이지 않는다
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: URL, enc: string) => string }
const json = (p: string) => JSON.parse(readFileSync(new URL('../../data/occupations/' + p, import.meta.url), 'utf8'))

// 1) 수집기(crawler/test_occupation_classifier.py)와 같은 사례 파일로 같은 결과
for (const c of json('occupation_rule_cases.json').cases) {
  const got = classifyOccupation(c.title, c.source_text)
  assert(JSON.stringify(got) === JSON.stringify(c.expected), `same as crawler: ${c.title} → ${JSON.stringify(got)} / ${JSON.stringify(c.expected)}`)
  if (got) assert((c.title + '\n' + c.source_text).includes(got.occupation_evidence), 'evidence is original text: ' + c.title)
}

// 2) 후보 표: 공식 목록에 있는 코드만, 업장 종류(D)는 후보 없음
const official = new Map(json('34-2020/occupation_codes.json').map((c: { code: string; name_vi: string }) => [c.code, c.name_vi]))
for (const subs of Object.values(json('subcategory_candidates.json').candidates) as Array<Record<string, Array<{ code: string; name_vi: string }>>>)
  for (const list of Object.values(subs)) for (const c of list) assert(official.get(c.code) === c.name_vi, 'official code/name: ' + c.code)
assert(occupationCandidates('am_thuc_do_uong', 'phuc_vu_ban').map((c) => c.code).join() === '5131', 'A row candidate')
assert(occupationCandidates('am_thuc_do_uong', 'nha_hang').length === 0, 'D row (workplace type) has no candidate')
assert(occupationCandidates('khac', '').length === 0 && occupationCandidates('am_thuc_do_uong', undefined).length === 0, 'no subcategory → no candidate')

// 3) 선택만으로 확정하지 않는다 — 업무 내용 근거가 후보 안일 때만
const post = (subcategory: string, title: string, description: string) => occupationForPost({ category: 'am_thuc_do_uong', subcategory, title, description })
assert(JSON.stringify(post('phuc_vu_ban', 'Tuyển nhân viên phục vụ', 'Phục vụ khách')) === JSON.stringify({ occupation_code: '5131', occupation_evidence: 'nhân viên phục vụ' }), 'duty text backs the candidate')
assert(post('phuc_vu_ban', 'Tuyển nhân viên', 'Làm việc tại quán, lương 6 triệu') === null, 'no duty evidence → null (hold)')
assert(post('phuc_vu_ban', 'Tuyển phụ bếp', 'Phụ bếp') === null, 'evidence outside the chosen candidates → null')
assert(JSON.stringify(post('dau_bep', 'Tuyển đầu bếp', 'Nấu món Việt')) === JSON.stringify({ occupation_code: '5120', occupation_evidence: 'đầu bếp' }), 'multi-candidate decided by duty text')
assert(post('nha_hang', 'Tuyển nhân viên phục vụ', 'Phục vụ') === null, 'workplace type alone never fixes a code')
console.log('occupationReader.test.ts: 직업분류 규칙 공통화·후보 판정 시험 통과')
