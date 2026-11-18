// 회사 이름 AI 확인(read-company-ai.mjs) 시험 — 네트워크·열쇠 없음. AI 자리는 가짜 답을 넣는다.
// 실행: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ocr/read-company-ai.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { confirmCompany, RUNS } from './read-company-ai.mjs'

const text = 'JOY THÁI BẮC NINH TUYỂN DỤNG – ĐI LÀM NGAY!\nJOY THÁI – THAI CUISINE & HOTPOT đang tìm kiếm những đồng đội'
const seq = (...answers) => { let i = 0; return async () => answers[i++] }

assert.equal(RUNS, 3)
// 3번 모두 같은 답 + 규칙과 포함 관계(짧은 이름이 따로 쓰임) → 확정
assert.deepEqual(await confirmCompany({ rule: 'JOY THÁI BẮC NINH', text }, seq({ company: 'JOY THÁI' }, { company: 'JOY THÁI' }, { company: 'JOY THÁI' })),
  { name: 'JOY THÁI', agreed: true, reason: 'contained' })
// 3번 중 하나 다름 → 보류
assert.equal((await confirmCompany({ rule: 'JOY THÁI BẮC NINH', text }, seq({ company: 'JOY THÁI' }, { company: null }, { company: 'JOY THÁI' }))).reason, 'ai_split')
// 오류 한 번이면 판정하지 않고 오류(입구는 '지금 확인 못 함'으로 보류) — 오류를 '없음'으로 세지 않는다(#887 2차)
let calls = 0
await assert.rejects(confirmCompany({ rule: 'JOY THÁI BẮC NINH', text }, async () => { calls++; if (calls === 2) throw new Error('bad_json'); return { company: 'JOY THÁI' } }), /bad_json/)
// 이름이 글자가 아닌 답(숫자·목록)은 오류
await assert.rejects(confirmCompany({ rule: 'JOY THÁI BẮC NINH', text }, async () => ({ company: 1 })), /bad_answer/)
// 지시문에 원문이 들어가고 규칙 이름은 AI에 보내지 않는다(독립 판독)
const prompts = []
await confirmCompany({ rule: 'RULE-ONLY-NAME', text: 'CTY ABC tuyển dụng' }, async (p) => { prompts.push(p); return { company: null } })
assert.equal(prompts.length, 3)
assert.ok(prompts.every((p) => p.includes('CTY ABC tuyển dụng') && !p.includes('RULE-ONLY-NAME')))
// 실제 실행: 열쇠가 없으면 종료 코드 1, 원문을 출력하지 않는다
const run = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './scripts/ts-extensionless-register.mjs', 'scripts/ocr/read-company-ai.mjs'],
  { input: JSON.stringify({ rule: 'X', text: 'SECRET-LOOKING TEXT 0912345678' }), env: { PATH: process.env.PATH }, encoding: 'utf8' })
assert.equal(run.status, 1)
assert.equal(run.stdout, '')
assert.ok(run.stderr.includes('company_ai_unavailable') && !run.stderr.includes('0912345678'))
console.log('read-company-ai: 3회 동의·불일치·오류·독립 판독·열쇠 없음 시험 통과')
