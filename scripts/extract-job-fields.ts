// 공고 원문(description) → 구조화 항목 추출 (dry-run 전용, DB 쓰기 없음) (2026-10-07).
//   node scripts/extract-job-fields.ts --id=4682
// 규칙은 src/lib/jobDescriptionExtract.ts. 결과 표를 사람이 확인한 뒤에만 별도 승인으로 DB에 반영한다(반영 기능은 아직 없음).
import { supabase } from '../src/lib/supabase.ts'
import { extractJobFields } from '../src/lib/jobDescriptionExtract.ts'

const id = Number((process.argv.find((a) => a.startsWith('--id=')) ?? '').replace('--id=', ''))
if (!Number.isInteger(id)) { console.error('usage: node scripts/extract-job-fields.ts --id=<local_jobs.id>'); process.exit(1) }

const { data, error } = await supabase
  .from('local_jobs')
  .select('id,title,salary,employer_phone,hours,work_days,education,preference,gender_requirement,benefit_tags,contact_zalo,description')
  .eq('id', id).maybeSingle()
if (error || !data) { console.error('조회 실패', error?.message ?? 'not found'); process.exit(1) }

const r = extractJobFields(String(data.description ?? ''), { salary: data.salary as string | null, employerPhone: data.employer_phone as string | null })
console.log(`# #${data.id} ${data.title}\n`)
console.log('| 원문 문장 | 추출 항목 → 값 | 상세요강 처리 |\n|---|---|---|')
for (const it of r.items) {
  const picked = it.picked.map((p) => `${p.field} = ${Array.isArray(p.value) ? p.value.join(' / ') : p.value}`)
  if (it.noColumn) picked.push(`${it.noColumn.field} = (jobSchema에 항목·컬럼 없음)`)
  const action = it.action === 'whole' ? '제거' : it.action === 'partial' ? `일부 유지: ${it.remainder}` : '유지'
  console.log(`| ${it.line} | ${picked.join('; ') || '—'} | ${action}${it.note ? ` (${it.note})` : ''} |`)
}
console.log('\n## 제안 UPDATE (현재 DB 값 → 추출 값)')
const cur: Record<string, unknown> = { hours: data.hours, workDays: data.work_days, education: data.education, preference: data.preference, genderRequirement: data.gender_requirement, benefitTags: data.benefit_tags, contactZalo: data.contact_zalo }
for (const [k, v] of Object.entries(r.fields)) console.log(`- ${k}: ${JSON.stringify(cur[k] ?? null)} → ${JSON.stringify(v)}`)
console.log('\n## 새 상세요강(description) — DB에는 맨 앞 출처 태그를 유지해 저장\n' + (r.sourceTag ? `${r.sourceTag} ` : '') + r.remaining)
