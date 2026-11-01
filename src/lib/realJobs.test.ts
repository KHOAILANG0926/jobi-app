// 2026-11-01 Lee "기존 틀의 허점" — 시험이 공고 몇 개(KDA·TEFAL)에만 맞춰져 있던 문제.
// 운영에 공개됐던 실제 공고 원문 전체(realJobs.fixtures.ts)로 정리 → 검사를 돌려 "빠짐 0"을 확인한다.
// 새 유형 공고가 나오면 원문을 이 파일에 하나 더 넣는다(공고 번호 전용 코드는 금지, 시험 자료만).
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { detailSections } from './jobDetailSections.ts'
import { inspectJob } from './jobInspect.ts'
import { isCovered } from './jobDetailFill.ts'
import { cleanSourceText } from './jobDescriptionBuild.ts'
import { headingOf } from './jobDetailSections.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
import { REAL_JOBS as jobs } from './realJobs.fixtures.ts'
for (const [id, j] of Object.entries(jobs)) {
  const ctx = { title: j.title, company: j.company, salary: j.salary, contactName: j.contact_name, phones: j.phones, addresses: j.addresses }
  const b = buildDescriptionFromSources([{ name: 'source_text', text: j.source_text }, { name: 'ocr_text', text: j.ocr_text }], ctx)
  const shown = detailSections(b.description, ctx).sections.flatMap((s) => s.lines)
  // 빠짐 0: 게시글·포스터 글자의 모든 줄(소제목·값 없는 이름표 제외)이 화면에 있다
  for (const src of [j.source_text, j.ocr_text]) {
    for (const line of cleanSourceText(src).text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (headingOf(line) || /[:：]\s*$/.test(line) || line.includes('[?]')) continue
      const dup = b.dropped.some((d) => d.reason === 'duplicate' && d.line === line)   // 같은 내용이 이미 보이는 줄(기록됨)
      assert(dup || shown.some((s) => isCovered(line, [s])), `#${id} 빠진 줄: ${line}`)
    }
  }
  // 버린 줄은 정해진 이유만
  for (const d of b.dropped) assert(['site_chrome', 'masked_phone', 'label_without_value', 'shown_above_company', 'meaningless_value', 'duplicate'].includes(d.reason), `#${id} 허용 안 된 이유로 뺌: ${d.reason} ${d.line}`)
  const r = inspectJob({ id: Number(id), ...ctx, description: b.description, source_text: j.source_text, contact_name: j.contact_name })
  for (const key of ['roles', 'hours_twice', 'source_lost', 'duplicate', 'sections']) {
    const item = r.items.find((i) => i.key === key)
    assert(!item || item.ok, `#${id} 검사 ${key} 실패: ${item?.detail}`)
  }
}
console.log(`realJobs.test.ts: 실제 공고 ${Object.keys(jobs).length}개 빠짐 0·허용 이유·검사 통과`)

// 칸 정하는 순서(jobDetailFill.ts 머리말): Lee 종류는 소제목보다 우선, AI 종류는 못 정한 줄에만.
{
  const src = 'XYZ dòng lạ\nQuyền lợi:\n• Đào tạo miễn phí'
  const key = (l: string) => l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const lee = buildDescriptionFromSources([{ name: 'source_text', text: src }], { lineKinds: { [key('• Đào tạo miễn phí')]: { section: '01', by: 'lee' } } })
  assert(lee.lines.find((l) => l.line === '• Đào tạo miễn phí')?.key === '01', 'Lee 종류가 소제목보다 우선')
  const ai = buildDescriptionFromSources([{ name: 'source_text', text: src }], { lineKinds: { [key('• Đào tạo miễn phí')]: { section: '01', by: 'ai' }, [key('XYZ dòng lạ')]: { section: '02', by: 'ai' } } })
  assert(ai.lines.find((l) => l.line === '• Đào tạo miễn phí')?.key === '05', 'AI 종류는 소제목을 못 이김')
  assert(ai.lines.find((l) => l.line === 'XYZ dòng lạ')?.key === '02', 'AI 종류는 못 정한 줄에만')
  console.log('realJobs.test.ts: 칸 정하는 순서 통과')
}
