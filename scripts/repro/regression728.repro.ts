// #728 회귀 시험 — 과거에 "고쳤다"고 보고했지만 화면에 다시 나온 기본 오류 4건(Lee 2026-11-12 지시).
// 이 파일은 생산 코드를 바꾸지 않는다. 지금 코드에서 실패해야 정상이다(실패 = 오류가 아직 남아 있다는 증거).
// 격리: src/ 밖(scripts/repro/)이라 tsc(include: src)·npm test(src·api 수집)·build에 자동 편입되지 않는다. 수동 실행:
//   node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/repro/regression728.repro.ts
// 범위: 재현 증거이지 원인 확정이 아니다(5157=fixture 원문→함수, 5421=일부 문구+합성 입력, 급여=JobDetail.tsx 식 추출(실제 렌더 경로 사용 미검증), 업종=합성 직무+businessFromGoogle).
// 기대값은 CLAUDE.md 확정 구성(10-30 ① ② ④)과 규칙 문구에서 그대로 가져왔다. 작업자가 지금 코드 결과에 맞춰 바꾸지 않는다.
// 사례·원인 코드: GitHub 이슈 #728 3차 분석.
import { readFileSync } from 'node:fs'
import { buildDescriptionFromSources } from '../../src/lib/jobDescriptionBuild.ts'
import { detailSections } from '../../src/lib/jobDetailSections.ts'
import { albamonCompose } from '../../src/lib/jobQuyenLoi.ts'
import { ruleConfirmedFlags } from '../../src/lib/aiClassifyGuard.ts'
import { inspectJob } from '../../src/lib/jobInspect.ts'
import { businessFromGoogle } from '../../src/lib/businessType.ts'
import { REAL_JOBS } from '../../src/lib/realJobs.fixtures.ts'

const failures: string[] = []
const check = (ok: boolean, name: string, detail: string) => { if (!ok) failures.push(`✗ ${name}\n    ${detail}`); else console.log(`✓ ${name}`) }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

// ── 사례 1. 상세 ④ 칸 배치 (5157 실제 원문) ─────────────────────────────────────────────
// 10-30: ④ Nội dung công việc = 업무 내용. 주소는 ③ Khu vực, 근무시간·교대는 ① Thời gian, 복리후생은 ① Phúc lợi.
{
  const j = (REAL_JOBS as Record<string, any>)['5157']
  const ctx = { title: j.title, company: j.company, salary: j.salary, contactName: j.contact_name, phones: j.phones, addresses: j.addresses }
  const built = buildDescriptionFromSources([{ name: 'source_text', text: j.source_text }, { name: 'ocr_text', text: j.ocr_text }], ctx)
  const c = albamonCompose(detailSections(built.description, ctx).sections, {
    title: j.title, company: j.company, salary: j.salary, hasHours: true, addresses: j.addresses })
  const lines = (label: string) => c.detail.find((s) => s.label === label)?.lines ?? []
  const duties = lines('Nội dung công việc')
  const badDuty = duties.filter((l) => /^(?:dia diem|khu vuc lam viec)\s*:/.test(fold(l).replace(/^[\s•\-*]+/, '')) || /\bca [ab]\s*:/.test(fold(l)))
  check(!badDuty.length, '5157 ④ 업무 칸에 주소·교대 시간 줄이 없다', `업무 칸에 들어간 줄: ${JSON.stringify(badDuty)}`)
  const env = lines('Môi trường làm việc')
  const badEnv = env.filter((l) => /bao hiem|dao tao mien phi|co hoi thang tien/.test(fold(l)))
  check(!badEnv.length, '5157 ④ 근무환경 칸에 복리후생(보험·교육·승진) 줄이 없다', `근무환경 칸에 들어간 줄: ${JSON.stringify(badEnv)}`)
}

// ── 사례 2. 복리후생 "Bao ăn ở" = 숙식 제공 → 기숙사 켜짐 (5421) ────────────────────────
{
  const ai = [{ code: 'dormitory', evidence: 'Bao ăn ở' }, { code: 'meal_provided', evidence: 'Bao ăn ở' }] as Parameters<typeof ruleConfirmedFlags>[0]
  const flags = ruleConfirmedFlags(ai, 'Bao ăn ở')
  check(flags.includes('dormitory'), '5421 AI가 고른 기숙사("Bao ăn ở")가 공고 칸에 켜진다', `켜진 칸: ${JSON.stringify(flags)}`)
  const r = inspectJob({ id: 5421, title: 'Tuyển phụ bếp', source_text: 'Tuyển nhân viên phụ bếp\nBao ăn ở\nLương thoả thuận', description: 'Bao ăn ở',
    dormitory: false, meal_provided: true } as Parameters<typeof inspectJob>[0])
  const b = r.items.find((i) => i.key === 'benefits')
  check(b?.ok === false, '5421 검사표가 원문 "Bao ăn ở"인데 기숙사 꺼짐을 잡는다', `검사표 benefits: ${JSON.stringify(b)}`)
}

// ── 사례 3. 급여 소수점 쉼표 "8,5 triệu"가 두 줄로 깨지지 않는다 (6043) ───────────────────
// 화면 코드(src/pages/JobDetail.tsx) 안의 급여 나누기 식을 그대로 꺼내 실행한다(생산 코드 그대로 검사).
{
  const src = readFileSync(new URL('../../src/pages/JobDetail.tsx', import.meta.url), 'utf8')
  const m = /salaryText\.split\((\/.+?\/[a-z]*)\)/.exec(src)
  check(!!m, 'JobDetail 급여 나누기 식 찾음', '식을 못 찾음(코드 위치가 바뀌었으면 이 시험을 새 위치로)')
  if (m) {
    const re = new Function(`return ${m[1]}`)() as RegExp
    const parts = '7 – 8,5 triệu/tháng + Thưởng doanh thu'.split(re)
    check(parts.length === 1, '6043 화면 급여 "7 – 8,5 triệu/tháng"이 한 줄로 남는다', `화면 식 ${m[1]} 결과: ${JSON.stringify(parts)}`)
  }
}

// ── 사례 4. 업무가 원문에 적힌 공고는 Google 장소 종류(쇼핑몰)로 서비스·판매로 정하지 않는다 (6043) ─
// CLAUDE.md 2026-11-01(#5247): 가게 업종 분류는 "실제 업무가 미기재"일 때만.
{
  const job = { company: 'Vincom Bắc Ninh', location: 'Đường Lý Thái Tổ, Phường Kinh Bắc, Bắc Ninh',
    title: 'Nhân viên Kỹ thuật',
    source_text: 'Vincom Bắc Ninh tuyển Nhân viên Kỹ thuật\nMô tả công việc:\n- Kiểm tra, bảo dưỡng, sửa chữa máy game và thiết bị điện\n- Xử lý sự cố kỹ thuật trong ca\nLương 7 – 8,5 triệu/tháng' }
  const r = businessFromGoogle(job, { id: 'place-test', primaryType: 'shopping_mall', types: ['shopping_mall'] })
  check(r === null, '6043 업무(점검·수리)가 적힌 공고를 쇼핑몰 장소 종류로 서비스·판매 분류하지 않는다', `결과: ${JSON.stringify(r)}`)
}

if (failures.length) {
  console.log(`\nregression728.repro.ts: 실패 ${failures.length}개 — 아래 오류가 지금 코드에 남아 있음\n` + failures.join('\n'))
  throw new Error(`regression728: ${failures.length}개 실패`)
}
console.log('regression728.repro.ts: all assertions passed')
