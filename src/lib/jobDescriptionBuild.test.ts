// 원문에서 상세요강 만들기 시험 — 실제 운영 원문(jobDescriptionBuild.fixtures.ts, 2026-10-25 조회).
// 새 공고에서 문제가 나오면 그 공고 원문을 fixtures 파일에 넣고 여기 기대값을 한 줄 더한다(버그 하나 = 시험 하나).
import { DESCRIPTION_BUILD_JOBS as jobs } from './jobDescriptionBuild.fixtures.ts'
import { buildDescriptionFromSources, cleanSourceText, sameLine } from './jobDescriptionBuild.ts'
import { bare, detailSections } from './jobDetailSections.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

const run = (id: string) => {
  const j = jobs[id]
  const ctx = { title: j.title, company: j.company, phones: j.phones, addresses: j.addresses, salary: j.salary, values: j.values, valueGroups: j.valueGroups }
  const r = buildDescriptionFromSources([{ name: 'source_text', text: j.source_text }, { name: 'ocr_text', text: j.ocr_text }], ctx)
  return { j, ctx, r, view: detailSections(r.description, ctx) }
}
const linesOf = (view: ReturnType<typeof detailSections>, key: string) => view.sections.find((s) => s.key === key)?.lines ?? []
const all = (view: ReturnType<typeof detailSections>) => view.sections.flatMap((s) => s.lines)

for (const id of Object.keys(jobs)) {
  const { j, ctx, r, view } = run(id)
  // 화면이 그대로 칸을 읽는다(원문 통째로 기타란에 떨어지는 실패 없음)
  assert(view.preserved && !view.usedFallback, `#${id} 화면 칸 나누기 성공`)
  // 사이트 화면 글자·가려진 번호가 남지 않는다
  for (const line of all(view)) {
    assert(!/\*{2,}/.test(line), `#${id} 가려진 번호 남음: ${line}`)
    assert(!/^(?:hien so|thong tin co ban|ca nhan dang tuyen)$/.test(bare(line)), `#${id} 사이트 글자 남음: ${line}`)
  }
  // 같은 줄이 두 번 나오지 않는다
  const shown = all(view)
  shown.forEach((a, i) => shown.forEach((b, k) => assert(i === k || !sameLine(a, b), `#${id} 같은 줄 두 번: ${a} / ${b}`)))
  // 글자를 바꾸지 않는다: 남은 줄은 원문에 그대로 있다(이름표+값을 이은 줄은 두 조각이 각각 원문에 있다)
  const src = String(j.source_text) + '\n' + String(j.ocr_text ?? '')
  for (const line of shown) {
    const parts = line.includes(': ') && !src.includes(line) ? line.split(': ') : [line]
    assert(parts.every((p) => src.includes(p.trim())), `#${id} 원문에 없는 글자: ${line}`)
  }
  // 두 번 만들어도 같다(다시 돌려도 바뀌지 않음)
  const again = buildDescriptionFromSources([{ name: 'source_text', text: r.description }], ctx)
  assert(detailSections(again.description, ctx).sections.flatMap((s) => s.lines).length === shown.length, `#${id} 다시 만들어도 같은 줄 수`)
}

// ── #4878 TEFAL: AI가 고친 글 + 원문이 두 번 나오던 공고 ──
{
  const { view } = run('4878')
  const shown = all(view)
  assert(shown.filter((l) => /chăm sóc quầy kệ/.test(l)).length === 1, '#4878 진열 업무 한 번만(원문 글자 그대로)')
  assert(shown.includes('- Trưng bày, chăm sóc quầy kệ, đảm bảo sản phẩm đẹp, gọn gàng.'), '#4878 원문 그대로(đẹp 포함)')
  assert(!shown.some((l) => /^Lương tối (?:đa|thiểu)/.test(l)), '#4878 상단 급여 총액 반복 없음')
  assert(!shown.some((l) => /Groupe SEB/.test(l)), '#4878 회사명 반복 없음')
  assert(linesOf(view, '06').some((l) => l.startsWith('Ứng tuyển:')), '#4878 지원 방법 → 채용절차')
  assert(!shown.includes('Độ tuổi: 22 - 35 tuổi'), '#4878 위쪽 나이 칸과 같은 줄 반복 없음')
  assert(!shown.includes('Giới tính: Không yêu cầu'), '#4878 위쪽 성별 칸과 같은 줄 반복 없음')
  assert(!shown.some((l) => l.startsWith('Thời gian: Ca xoay 8 tiếng')), '#4878 위쪽 근무시간+근무일과 같은 줄 반복 없음')
  assert(linesOf(view, '02').includes('Kinh nghiệm: < 1 năm'), '#4878 위에 없는 값(경력 < 1 năm)은 남김')
}
// ── #4879 ADTEK: 사이트 화면 글자가 섞여 있던 공고 ──
{
  const { view } = run('4879')
  assert(linesOf(view, '02').includes('- Nam/nữ, tuổi từ 18 đến 45'), '#4879 긴 소개 문단이 짧은 자격 줄을 지우지 않음')
  assert(linesOf(view, '05').includes('- Có ký túc xá cho công nhân'), '#4879 기숙사 → 복리후생')
  assert(linesOf(view, '04').includes('Lương tối thiểu: 9 triệu'), '#4879 상단 급여가 비어 있으면 원문 급여는 남김')
  assert(!all(view).some((l) => /Học vấn tối thiểu: Khác/.test(l)), '#4879 뜻 없는 값(Khác) 제외')
}
// ── 청소 규칙 단위 시험 ──
{
  const c = cleanSourceText('Liên hệ: \n033 715 ****\nHiện số\nNgành nghề:\nBán hàng\nGiới tính:\nĐộ tuổi:\n22 tuổi')
  assert(c.text === 'Ngành nghề: Bán hàng\nĐộ tuổi: 22 tuổi', 'clean: ' + JSON.stringify(c.text))
  assert(c.dropped.some((d) => d.reason === 'label_without_value' && d.line === 'Giới tính:'), '값 없는 이름표 제외')
}
console.log('jobDescriptionBuild.test.ts: 실제 원문 #4878·#4879 + 글자 그대로·중복 없음·사이트 글자 제거 검사 통과')
