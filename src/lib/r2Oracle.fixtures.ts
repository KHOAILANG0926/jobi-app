// R2(#753) 독립 기대값 — 원문 ↔ 확정 결과. 생산 함수·낱말표로 만든 값이 아니라 **사람이 원문을 읽고 CLAUDE.md 10-30 확정 칸 정의로 정한 값**이다.
// 칸 정의(10-30): 01 업무 내용 / 02 모집 조건(성별·나이·학력·경력·건강·요구) / 03 근무시간·요일·형태·연장 / 04 급여·수당·상여·지급 방식 /
//   05 복리후생·근무환경(보험·기숙사·식사·셔틀·교육·환경) / 06 지원 방법·연락처·절차 / 07 그 밖(회사 소개·소개 보너스).
// 규칙: ① evidence는 원문에 그대로 있는 글자(시험이 확인 — 지어낸 근거 금지) ② 모호한 줄은 넣지 않는다(넣지 않는 것이 맞는 값을 코드에 맞춰 고치는 것보다 낫다)
// ③ 이 파일의 기대값은 생산 코드 수정 PR에서 바꾸려면 PR 본문에 '기대값 변경 근거:'가 필요하다(S2 정답 보호, *.fixtures.ts).
// 사례는 줄기만 한다 — 공고 번호·특정 낱말 예외가 아니라 '원문 줄 → 칸' 사실만 적는다.
import { REAL_JOBS } from './realJobs.fixtures.ts'
import { BOMUNTTL_SOURCE, BOMUNTTL_CONTEXT } from './jobMultiRole.fixtures.ts'
import { FUSHAN_SOURCE, FUSHAN_CONTEXT } from './fushanSource.fixture.ts'

export type SectionKey = '01' | '02' | '03' | '04' | '05' | '06' | '07'
/** ai:true = 라벨·낱말이 없어 단어 규칙이 못 정하고 생산에서는 AI/Lee 판정(detail_line_kinds)이 정하는 줄 — 오프라인에서는 정해진 칸 또는 07(미정)이면 통과, 다른 이름 칸이면 실패. */
export interface OracleFact { evidence: string; section: SectionKey; ai?: true }
export interface OracleJob {
  id: string
  source: string
  ctx: { title: string; company: string; salary: string | null; phones: string[]; addresses: string[] }
  facts: OracleFact[]
  /** 공고 칸으로 켜져야 하는 복리후생(on:true + 원문 근거) / 꺼져야 하는 것(on:false; evidence가 있으면 AI가 그 근거를 내도 꺼져 있어야 함). 판단 보류는 키를 두지 않는다. */
  benefits: Partial<Record<'shuttle_bus' | 'dormitory' | 'meal_provided', { on: boolean; evidence?: string }>>
  /** 급여 칸 글자에 들어 있어야 하는 원문 숫자 토큰 */
  salaryTokens?: string[]
}
const real = (k: string) => { const j = REAL_JOBS[k]; return { source: j.source_text, ctx: { title: j.title, company: j.company, salary: j.salary, phones: j.phones, addresses: j.addresses } } }

export const R2_ORACLE: OracleJob[] = [
  { id: '4824 KDA', ...real('4824'), salaryTokens: ['310k'], // 10-30 ① Lương = 대표 금액 1개 + 지급 단위
    facts: [
      { evidence: 'Làm ngồi linh kiện tai nghe', section: '01', ai: true }, { evidence: 'NAM , NỮ (14-50t)', section: '02', ai: true },
      { evidence: 'Ca ngày: 310k/11h', section: '04' }, { evidence: 'Ca đếm: 360k/11h', section: '04' }, { evidence: 'Chuyên cần 50k/tuần', section: '04' },
      { evidence: 'Lương tính và thanh toán theo ngày', section: '04' }, { evidence: 'Có xe đưa đón', section: '05' }, { evidence: 'Được mang điện thoại vào xưởng', section: '05' },
    ],
    // 같은 연락처가 숫자·띄어쓰기만 달리 반복된 줄('Liên hệ: 0877 880 756')은 10-30 ④가 거르는 줄이라 기대값에 넣지 않는다.
    benefits: { shuttle_bus: { on: true, evidence: 'Có xe đưa đón' }, dormitory: { on: false }, meal_provided: { on: false } } },
  { id: '4828 Mao Yên', ...real('4828'), salaryTokens: ['5.500.000'],
    facts: [
      { evidence: 'Phụ cấp: 1.200.000đ/tháng', section: '04' }, { evidence: 'Thâm niên sau 2 tháng: +200.000đ', section: '04' },
      { evidence: 'Sản xuất dây truyền dữ liệu, dây mạng.', section: '01' }, { evidence: 'Nhanh nhẹn, chăm chỉ, chịu khó.', section: '02' },
    ],
    benefits: { shuttle_bus: { on: false }, dormitory: { on: false }, meal_provided: { on: false } } },
  { id: '4878 TEFAL', ...real('4878'), salaryTokens: ['8', '18'],
    facts: [
      { evidence: 'Tư vấn, giới thiệu và bán các sản phẩm gia dụng TEFAL cho khách hàng.', section: '01' }, { evidence: 'Nam cao >1m65, Nữ cao >1m55.', section: '02' },
      { evidence: 'Thời gian: Ca xoay 8 tiếng, nghỉ 1 ngày/tuần', section: '03' }, { evidence: 'Đóng BHXH, BHYT, BHTN đầy đủ.', section: '05' },
      { evidence: 'Được đào tạo kỹ năng bán hàng & sản phẩm.', section: '05' }, { evidence: 'Thưởng lễ, Tết, lương tháng 13, phép năm.', section: '04' },
      { evidence: 'Ứng tuyển: Liên hệ qua Zalo (Phương Dung)', section: '06' }, { evidence: 'Chương trình cộng tác viên: 500.000đ/ứng viên tham gia phỏng vấn', section: '07' },
    ],
    benefits: { shuttle_bus: { on: false }, dormitory: { on: false }, meal_provided: { on: false } } },
  { id: '4879 ADTEK', ...real('4879'), salaryTokens: ['9', '17'],
    facts: [
      { evidence: 'Có ký túc xá cho công nhân', section: '05' }, { evidence: 'Chế độ bữa ca: 2 bữa/ca', section: '05' }, { evidence: 'Hỗ trợ tìm trọ và hoàn thiện hồ sơ', section: '05' },
      { evidence: 'Tăng ca thường xuyên, làm thêm cả Chủ nhật', section: '03' }, { evidence: 'Nam/nữ, tuổi từ 18 đến 45', section: '02' }, { evidence: 'Sức khỏe tốt, chịu được ca và tăng ca', section: '02' },
      { evidence: 'Ứng viên quan tâm vui lòng nộp hồ sơ', section: '06' },
      // 'Khích lệ: 6.000.000 VNĐ/6 tháng'은 '현금 상여'(04)인지 원문이 '복리후생' 소제목 아래 적은 줄(05)인지 모호해 기대값에 넣지 않는다.
    ],
    benefits: { shuttle_bus: { on: false }, dormitory: { on: true, evidence: 'Có ký túc xá cho công nhân' }, meal_provided: { on: true, evidence: 'Chế độ bữa ca: 2 bữa/ca' } } },
  { id: '4982 Bomunttl(복수 직무)', source: BOMUNTTL_SOURCE, ctx: { title: BOMUNTTL_CONTEXT.title, company: BOMUNTTL_CONTEXT.company, salary: BOMUNTTL_CONTEXT.salary, phones: BOMUNTTL_CONTEXT.phones, addresses: BOMUNTTL_CONTEXT.addresses },
    facts: [
      { evidence: 'Tháng nghỉ 4 ngày', section: '03' }, { evidence: 'Nghỉ trưa hơn 2 tiếng', section: '03' }, { evidence: 'Được thưởng vào các ngày lễ', section: '04' },
      { evidence: 'Mức lương: 30k-35k/ 1h', section: '04' }, { evidence: 'Yêu cầu: nhanh nhẹn, dễ hòa nhập, có ý thức trong công việc', section: '02' },
      { evidence: 'Môi trường làm việc vui vẻ – thân thiện', section: '05' }, { evidence: 'Được đào tạo khi chưa có kinh nghiệm', section: '05' }, { evidence: 'Liên hệ ngay: 0365 447 485', section: '06' },
    ],
    // 복수 직무 공고: 식사는 직무별(결정 0006) — AI가 근거 'Bao ăn 2 bữa'를 내도 공고 전체 칸으로 켜지 않는다(on:false + evidence = 근거가 있어도 꺼져 있어야 함). 셔틀·기숙사 없음.
    benefits: { shuttle_bus: { on: false }, dormitory: { on: false }, meal_provided: { on: false, evidence: 'Bao ăn 2 bữa' } } },
  { id: '5157 Highlands', ...real('5157'),
    facts: [
      { evidence: 'Ca A: 06h30 – 14h30', section: '03' }, { evidence: 'Ca B: 14h – 22h', section: '03' }, { evidence: 'Tốt nghiệp THPT', section: '02' },
      { evidence: 'Giao tiếp tốt, nhanh nhẹn, hoà đồng và chủ động trong công việc', section: '02' }, { evidence: 'Đào tạo miễn phí trước khi nhận việc', section: '05' },
      { evidence: 'Được tham gia đầy đủ các chế độ bảo hiểm theo quy định', section: '05' }, { evidence: 'Cơ hội thăng tiến rõ ràng sau 6 tháng', section: '05' },
      { evidence: 'Ibox hoặc liên hệ Mr Tuấn Minh: 0365102703', section: '06' }, { evidence: 'Nộp trực tiếp CV tại cửa hàng', section: '06' },
    ],
    benefits: { shuttle_bus: { on: false }, dormitory: { on: false }, meal_provided: { on: true, evidence: 'hỗ trợ ăn ca' } } },
  { id: 'FUSHAN 공단 공장', source: FUSHAN_SOURCE, ctx: { title: FUSHAN_CONTEXT.title, company: FUSHAN_CONTEXT.company, salary: FUSHAN_CONTEXT.salary, phones: FUSHAN_CONTEXT.phones, addresses: FUSHAN_CONTEXT.addresses }, salaryTokens: ['12', '17'],
    facts: [
      // 'Công việc:' 라벨이 있어도 자세·환경 낱말뿐이면 업무가 아니다 — Lee 2026-10-27 FUSHAN 결정(업무 추정 금지, 업무 칸은 'chưa ghi' 안내): 05
      { evidence: 'Công việc: Làm ngồi, phòng thường', section: '05' }, { evidence: 'LCB + PC: 7.200.000đ', section: '04' }, { evidence: 'Cty Thưởng 10.000.000đ', section: '04' },
      { evidence: 'Thu nhập: 12 -> 17 triệu', section: '04' }, { evidence: 'Có KTX và hỗ trợ tìm trọ', section: '05' }, { evidence: 'Liên hệ Zalo: 0388492985', section: '06' },
    ],
    benefits: { shuttle_bus: { on: false }, dormitory: { on: true, evidence: 'Có KTX' }, meal_provided: { on: false } } },
]
