import type { Job } from '../types/job'

function normalizeForPolicy(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/đ/g, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 2026-09-10 실측(운영 DB 읽기 전용 조회로 확인, active=true 263건 중 37건이
// 이 필터에 잘못 걸려 숨겨지고 있었음): 예전 규칙은 "cong no"(công nợ, 매입/
// 매출채권을 뜻하는 극히 일반적인 회계 용어)와 "collection"(영어 단독 단어)을
// 단독으로 차단했다 — "công nợ"/"thu hồi công nợ"는 정상 회계·영업 직무
// 설명에 흔히 등장하고(34건), "collection"은 무역금융의 documentary
// collection(추심결제) 문맥에서도 매칭됐다(1건). 반면 "công"이 빠진
// "nợ"(대출/사채성 채무) 관련 표현이나 "debt collector"/"debt collection"처럼
// 채권추심 직무가 명확한 복합 표현은 그대로 유지한다 — 단독 부분문자열
// 하나로 전체 공고를 차단하지 않고, 문맥이 분명한 경우 복합 표현을
// 쓴다(2026-09-10 사용자 지시).
//
// "nhac no"/"xu ly no xau"도 이후 실제 매칭된 남은 2건(id 4394/4455)의 전체
// title/company/description/source_url을 직접 대조해 재검토한 결과 제거했다
// (2026-09-10, 사용자 판정 기준 적용):
// - id 4394: 실제 은행(MB Bank)이 아니라 그 위탁 콜센터(Công Ty Cổ Phần
//   Truyền Thông Kim Cương)가 올린 고객상담/텔레세일즈 공고 — "nhắc nợ"는
//   여러 상담 스크립트 유형 중 하나(서비스 품질 조사 콜과 같은 채널)일 뿐,
//   개인대출 모집이나 위협성 표현이 전혀 없는 합법 은행 고객서비스 업무.
// - id 4455: 대출/금융회사가 아니라 산업설비 판매회사(Công Ty TNHH MTV
//   Thiết Bị Kỹ Thuật Triệu Vũ)의 영업직 공고 — "theo dõi công nợ xử lý nợ
//   xấu"는 자사가 판매한 장비의 미수금을 영업사원이 사후관리하는 통상적인
//   B2B 영업 업무 중 한 줄일 뿐, 채권추심업이 아님.
// 둘 다 "정상적인 은행/일반기업의 합법적인 채권관리 업무"로 판정해 차단
// 목록에서 제외했다 — 실제 대출 영업/채권추심 문맥은 "cho vay"/"vay tien"/
// "tin dung"/"fe credit" 등 남아있는 다른 규칙으로 여전히 차단된다.
const EXCLUDED_MONEY_JOB_RE =
  /thu hoi no|doi no|thu no\b|vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit|mirae asset|shinhan finance|vpbank finance|debt collector|debt collection|loan/i

export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'>): boolean {
  const text = normalizeForPolicy(`${job.title} ${job.company} ${job.description}`)
  return EXCLUDED_MONEY_JOB_RE.test(text)
}

export function isPublicJobAllowed(job: Job): boolean {
  return !hasExcludedMoneyTerms(job)
}
