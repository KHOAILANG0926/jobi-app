// 1-B: 공고 기준 단일 원천(policy/job-criteria.json)과 그것을 읽는 쪽이 어긋나지 않는지.
import { REQUIRED_FIELDS, MIN_CONTACT_DIGITS, DEADLINE_OPEN_THROUGH_DAY, DEADLINE_TIMEZONE } from './jobCriteria.mjs'
import { isJobOpen, todayVn } from './jobDetailView.ts'
import { inspectJob } from './jobInspect.ts'
import { INSPECT_CONTACT_DIGITS, enoughContact } from './inspectReading.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

// 필수 9개 항목 = CLAUDE.md '공고 상세페이지 구성·공고 작성 체크리스트 최종 확정'(변경 금지). 이 목록을 바꾸려면 Lee 지시가 있어야 한다.
assert(REQUIRED_FIELDS.map((f) => f.key).join(',') === 'salary,hours,employment_type,occupation,application_deadline,num_hires,address,duties,contact', 'required field keys are the confirmed nine, in order')
assert(REQUIRED_FIELDS.map((f) => f.label).join(',') === '급여,근무시간,고용형태,업직종,모집마감,모집인원,주소,업무 내용,연락처', 'required field labels are the confirmed nine, in order')

// 검사표가 이 목록 그대로 '누락'을 알린다(이름이 바뀌지 않았다 = 검사표 출력은 그대로).
// 점검기(jobInspect.ts)는 독립성 시험(scripts/ci/inspector-independence.test.mjs, R2 #753)상 이 JSON을 import하지 않는다 — 자기 목록을 갖고, 여기서 일치만 고정한다.
{
  const r = inspectJob({ id: 1, title: 'x', company: 'y', phones: [], addresses: [], salary: '', values: [], description: '', source_text: 'x', postingFields: { reviewOnly: true } } as never)
  const item = r.items.find((i) => i.key === 'required_fields')
  assert(!!item && !item.ok, 'an empty job misses required fields')
  assert(REQUIRED_FIELDS.every((f) => String(item?.detail).includes(f.label)), 'every required label is reported when missing: ' + item?.detail)
}

// 마감·연락처 값(Python crawler/job_criteria.py와 같은 파일을 읽는다 — Python 쪽 시험도 같은 값을 확인)
assert(MIN_CONTACT_DIGITS === 8, 'contact needs 8 digits (the DB publish gate value)')
// #973: 검사표 필수 항목 '연락처'도 같은 8자리 기준 — 3자리 같은 짧은 숫자는 누락으로 알린다(예전엔 빈칸만 아니면 통과).
assert(INSPECT_CONTACT_DIGITS === MIN_CONTACT_DIGITS, 'inspector contact digits equal the shared criteria')
assert(enoughContact('0388 492 985') && enoughContact('Zalo: 0912.345.678') && !enoughContact('123') && !enoughContact('') && !enoughContact(null), 'enoughContact counts digits like the DB gate')
{
  const base = { id: 1, title: 'x', company: 'y', addresses: [], salary: '', values: [], description: '', source_text: 'x', postingFields: { reviewOnly: true } }
  const short = inspectJob({ ...base, phones: ['123'] } as never).items.find((i) => i.key === 'required_fields')
  const full = inspectJob({ ...base, phones: ['0388492985'] } as never).items.find((i) => i.key === 'required_fields')
  assert(String(short?.detail).includes('연락처'), 'a 3-digit contact is reported missing: ' + short?.detail)
  assert(!String(full?.detail).includes('연락처'), 'a 10-digit phone is a contact: ' + full?.detail)
}
assert(DEADLINE_OPEN_THROUGH_DAY === true && DEADLINE_TIMEZONE === 'Asia/Ho_Chi_Minh', 'deadline day is open, in Vietnam time')
assert(isJobOpen('2026-11-23', '2026-11-23') && !isJobOpen('2026-11-22', '2026-11-23') && isJobOpen(null, '2026-11-23'), 'screen helper follows the shared deadline rule')
assert(todayVn(new Date('2026-11-22T18:30:00Z')) === '2026-11-23' && todayVn(new Date('2026-11-22T16:59:00Z')) === '2026-11-22', 'todayVn is the Vietnam date')
// DB가 하드코딩한 같은 기준이 JSON과 어긋나지 않는다(2단계 #978): 공개 게이트의 연락처 자릿수와 만료 처리·알림 RPC의 시간대.
// 운영 DB 함수는 JSON을 읽을 수 없어 migration에 값이 글자로 박혀 있다 — 값을 바꾸면 이 시험이 새 migration 필요를 알려 준다.
{
  const fsModule = 'node:fs' // 다른 시험(JobDetail 소스 읽기)과 같은 방식 — src 타입 검사에 node 타입을 들이지 않는다
  const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: URL, enc: string) => string }
  const migration = (file: string) => readFileSync(new URL('../../supabase/migrations/' + file, import.meta.url), 'utf8')
  const gate = migration('20261101190000_db_publish_gate.sql')
  const digitLimits = [...gate.matchAll(/'\\D', '', 'g'\)\)\s*<\s*(\d+)/g)].map((m) => Number(m[1]))
  assert(digitLimits.length === 2 && digitLimits.every((n) => n === MIN_CONTACT_DIGITS), 'DB publish gate contact digits equal the shared criteria: ' + digitLimits)
  for (const file of ['20261123000000_deactivate_expired_vn_date.sql', '20260927090000_job_alerts.sql']) {
    assert(migration(file).includes(`at time zone '${DEADLINE_TIMEZONE}'`), file + ' uses the shared deadline timezone')
  }
}
console.log('jobCriteria.test.ts: 공고 기준 단일 원천 시험 통과')
