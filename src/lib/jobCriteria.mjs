import criteria from '../../policy/job-criteria.json' with { type: 'json' }

// 공고 기준(마감·연락처·필수 9개 항목)의 단일 원천 policy/job-criteria.json을 읽는 화면 쪽 통로. Python은 crawler/job_criteria.py.
export const CRITERIA_VERSION = criteria.version
/** 필수 9개 항목(CLAUDE.md '공고 상세페이지 구성·공고 작성 체크리스트 최종 확정') — key는 검사 코드, label은 검사표에 보이는 이름. */
export const REQUIRED_FIELDS = criteria.required_fields
/** '연락처 있음' = 전화·Zalo의 숫자가 이 개수 이상(DB 공개 게이트 job_publish_gate_reason과 같은 기준). */
export const MIN_CONTACT_DIGITS = criteria.contact.min_digits
/** 마감 당일은 열림, 오늘은 베트남 날짜(화면 todayVn·알림 RPC와 같은 기준). */
export const DEADLINE_OPEN_THROUGH_DAY = criteria.deadline.open_through_deadline_day
export const DEADLINE_TIMEZONE = criteria.deadline.timezone
