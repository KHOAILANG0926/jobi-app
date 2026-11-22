// 1-B: 공고 기준 단일 원천(policy/job-criteria.json)과 그것을 읽는 쪽이 어긋나지 않는지.
import { REQUIRED_FIELDS, MIN_CONTACT_DIGITS, DEADLINE_OPEN_THROUGH_DAY, DEADLINE_TIMEZONE } from './jobCriteria.mjs'
import { isJobOpen, todayVn } from './jobDetailView.ts'
import { inspectJob } from './jobInspect.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

// 필수 9개 항목 = CLAUDE.md '공고 상세페이지 구성·공고 작성 체크리스트 최종 확정'(변경 금지). 이 목록을 바꾸려면 Lee 지시가 있어야 한다.
assert(REQUIRED_FIELDS.map((f) => f.key).join(',') === 'salary,hours,employment_type,occupation,application_deadline,num_hires,address,duties,contact', 'required field keys are the confirmed nine, in order')
assert(REQUIRED_FIELDS.map((f) => f.label).join(',') === '급여,근무시간,고용형태,업직종,모집마감,모집인원,주소,업무 내용,연락처', 'required field labels are the confirmed nine, in order')

// 검사표가 이 목록 그대로 '누락'을 알린다(이름이 바뀌지 않았다 = 검사표 출력은 그대로).
{
  const r = inspectJob({ id: 1, title: 'x', company: 'y', phones: [], addresses: [], salary: '', values: [], description: '', source_text: 'x', postingFields: { reviewOnly: true } } as never)
  const item = r.items.find((i) => i.key === 'required_fields')
  assert(!!item && !item.ok, 'an empty job misses required fields')
  assert(REQUIRED_FIELDS.every((f) => String(item?.detail).includes(f.label)), 'every required label is reported when missing: ' + item?.detail)
}

// 마감·연락처 값(Python crawler/job_criteria.py와 같은 파일을 읽는다 — Python 쪽 시험도 같은 값을 확인)
assert(MIN_CONTACT_DIGITS === 8, 'contact needs 8 digits (the DB publish gate value)')
assert(DEADLINE_OPEN_THROUGH_DAY === true && DEADLINE_TIMEZONE === 'Asia/Ho_Chi_Minh', 'deadline day is open, in Vietnam time')
assert(isJobOpen('2026-11-23', '2026-11-23') && !isJobOpen('2026-11-22', '2026-11-23') && isJobOpen(null, '2026-11-23'), 'screen helper follows the shared deadline rule')
assert(todayVn(new Date('2026-11-22T18:30:00Z')) === '2026-11-23' && todayVn(new Date('2026-11-22T16:59:00Z')) === '2026-11-22', 'todayVn is the Vietnam date')
console.log('jobCriteria.test.ts: 공고 기준 단일 원천 시험 통과')
