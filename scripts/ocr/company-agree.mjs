// 회사 이름 동의 확인(Lee 2026-11-17 #872·#887): 등록 입구(crawler/ingest_gateway.py)가 원문에서 읽은 회사 이름을 넘기면
// AI(ai-classify와 같은 호출 ai-ask.mjs)에 같은 글을 3번 묻고 companyReader.agreeCompanyWithAI로 판정한다(판정은 그 한 곳). DB는 쓰지 않는다.
// 입력(stdin JSON): { "rule": "<규칙이 읽은 이름>", "text": "<규칙이 읽은 그 글(원문 또는 포스터 글자)>" }
// 출력(stdout JSON): { "name": "<확정 이름 또는 ''>", "reason": "<same|contained|ai_error|ai_unstable|…>" } — 원문·열쇠는 출력하지 않는다.
// 종료 코드 3 = AI를 지금 쓸 수 없음(열쇠 없음·3번 모두 HTTP 오류) → 입구가 '지금 확인 못 함'으로 보류한다.
// 실행: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ocr/company-agree.mjs
import { readFileSync } from 'node:fs'
import { agreeCompanyWithAI } from '../../src/lib/companyReader.ts'
import { askAI } from './ai-ask.mjs'

if (!process.env.ANTHROPIC_API_KEY) { console.error('company_ai_unavailable: ANTHROPIC_API_KEY 없음'); process.exit(3) }
let input
try { input = JSON.parse(readFileSync(0, 'utf8')) } catch { console.error('입력 JSON 오류'); process.exit(2) }
const result = await agreeCompanyWithAI(input?.rule, input?.text, askAI)
if (result.unavailable) { console.error('company_ai_unavailable: AI 호출 3번 모두 실패'); process.exit(3) }
process.stdout.write(JSON.stringify({ name: result.name, reason: result.reason }))
