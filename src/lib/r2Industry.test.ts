// R2(#753) 업종 독립 검증: 원문 업무로 정한 업종(r2Industry.fixtures.ts)과 생산 업종 판정이 어긋나는지 본다.
// 공장 업무 공고가 Google 장소 유형(쇼핑몰·음식점·호텔·마트)으로 가게 업종이 되면 실패한다. 실패 목록을 모아 보여 준다.
import { R2_ORACLE } from './r2Oracle.fixtures.ts'
import { R2_INDUSTRY, HOSTILE_PLACES } from './r2Industry.fixtures.ts'
import { businessFromGoogle, businessFromName, dutyStated } from './businessType.ts'
import { lineKey } from './aiClassifyGuard.ts'

const failures: string[] = []
let checks = 0
const ok = (c: boolean, what: string, detail: string) => { checks++; if (!c) failures.push(`✗ ${what}\n    ${detail}`) }

for (const o of R2_ORACLE) {
  const industry = R2_INDUSTRY[o.id]
  ok(!!industry, `[${o.id}] 업종 기대값이 있음`, '독립 기대값 자료에 없는 공고')
  // 저장된 AI 줄 판정(detail_line_kinds) 흉내: 기대값이 AI 판정 줄(ai:true)로 표시한 줄은 AI가 그 칸으로 정했다고 본다
  const lineKinds: Record<string, { section: '01' | '02' | '03' | '04' | '05' | '06' | '07'; by: 'ai' }> = {}
  for (const f of o.facts) if (f.ai) {
    const line = o.source.split('\n').find((l) => l.includes(f.evidence)); if (line) lineKinds[lineKey(line)] = { section: f.section, by: 'ai' }
  }
  const job = { company: o.ctx.company, title: o.ctx.title, location: o.ctx.addresses[0] ?? '', source_text: o.source, lineKinds }
  for (const place of HOSTILE_PLACES) {
    const r = businessFromGoogle(job, place)
    if (industry === 'non-service') ok(r === null, `[${o.id}] 공장 업무 공고를 Google 장소 유형(${place.primaryType})으로 가게 업종 확정 금지`, `확정된 결과: ${JSON.stringify({ code: r?.code, kind: r?.kind, method: r?.method })}`)
  }
  if (industry === 'non-service') ok(businessFromName(job) === null, `[${o.id}] 공장 업무 공고를 이름 낱말로 가게 업종 확정 금지`, '이름 낱말 경로가 가게 업종을 확정함')
}

// 저장된 AI 줄 판정이 업종 단계에서도 읽히는가(공단 이름이 없어도 업무가 AI로 정해졌으면 장소 유형으로 덮어쓰지 않는다) — 합성 공고
{
  const src = 'Công ty ABC Bắc Ninh tuyển nhân viên\nLắp ráp, kiểm tra bo mạch điện tử\nLương 8 triệu/tháng\nLiên hệ: 0912345678'
  const job = { company: 'Công ty ABC Bắc Ninh', location: '216 Lý Thái Tổ, Bắc Ninh', source_text: src }
  const kinds = { [lineKey('Lắp ráp, kiểm tra bo mạch điện tử')]: { section: '01' as const, by: 'ai' as const } }
  ok(dutyStated({ ...job, lineKinds: kinds }) === true, '[합성] AI가 업무(01)로 정한 줄이 있으면 업무 기재로 본다', 'lineKinds를 읽지 않음')
  ok(businessFromGoogle({ ...job, lineKinds: kinds }, HOSTILE_PLACES[0]) === null, '[합성] AI 판정 업무가 있는 공고는 쇼핑몰 유형으로 가게 업종 확정 금지', 'lineKinds가 반영되지 않음')
}
// 과잉 차단 방지: 업무 미기재 + 공단 이름 없음 + 가게 장소 유형이면 지금처럼 가게 업종(Wallace 규칙 유지)
{
  const job = { company: 'Wallace Bắc Ninh', location: '216 Nguyễn Trãi, Bắc Ninh', source_text: 'Wallace Bắc Ninh tuyển nhân viên\nĐịa chỉ: 216 Nguyễn Trãi, Bắc Ninh\nLiên hệ: 0912345678' }
  ok(businessFromGoogle(job, HOSTILE_PLACES[1])?.kind === 'fnb', '[대조] 업무 미기재 가게 공고는 장소 유형으로 업종 확정(기존 규칙 유지)', '정상 경로까지 막힘')
}
console.log(`r2Industry: 공고 ${R2_ORACLE.length}개, 검사 ${checks}건, 실패 ${failures.length}건`)
if (failures.length) { console.log(failures.join('\n')); throw new Error(`r2Industry: 업종 어긋남 ${failures.length}건`) }
console.log('r2Industry.test.ts: all assertions passed')
