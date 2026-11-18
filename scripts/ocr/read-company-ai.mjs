// 회사 이름 AI 확인(Lee 2026-11-17 #872 R 트랙, #887 평가 결과) — 등록 입구(crawler/ingest_gateway.py)가 원문에서 읽은 회사 이름에만 부른다.
// AI는 이름을 정하지 않고 규칙 이름을 확인만 한다: 같은 질문 3번(모델·부르기는 ai-classify와 같은 ai-ask.askJSON) → 판정은 companyReader.agreeCompany 한 곳.
// 입력(stdin JSON): {"rule": "<규칙이 읽은 이름>", "text": "<원문>"}. 출력(stdout JSON): {"name","agreed","reason"}.
// 3번 중 하나라도 오류(열쇠 없음·HTTP·잘림·JSON 깨짐)면 판정하지 않고 종료 코드 1 → 입구는 '지금 확인 못 함'으로 보류(다음 수집 때 다시).
// 실행: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ocr/read-company-ai.mjs < input.json
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { askJSON } from './ai-ask.mjs'
import { agreeCompany } from '../../src/lib/companyReader.ts'

// #887 3차(v3) 지시문 그대로 — 예시 이름은 평가 사례에 없는 지어낸 이름(과적합 방지). 답은 이름 또는 null만.
export const PROMPT = (text) => `From the Vietnamese job post below, copy the name of the employer exactly as it is written in the text.
The employer is the company, shop, brand or recruitment agency that is hiring (if an agency posts, the agency).
Rules:
- Copy characters exactly from the text. Do not translate, correct, expand, or join words from different places. Do not use outside knowledge.
- If a business-type word is written as part of the name, keep it as written (e.g. "Nhà hàng Hoa Sen", "Công ty ABC Vina").
- Do not answer: a workplace location only (a mall, industrial park, street address) when the post does not say that place is the employer; a client or partner the employer works for; a slogan, greeting, headline or job title; salary words.
- Answer null only if no specific employer name is written anywhere in the text.
Answer only JSON: {"company": "<exact text>" or null}

Post:
"""
${text}
"""`
export const RUNS = 3

/** AI 3번 → 규칙 이름과 동의 판정. ask는 시험에서 바꿔 넣는다. 오류는 그대로 던진다(판정하지 않음). */
export async function confirmCompany({ rule, text }, ask = (p) => askJSON(p, { maxTokens: 1024, strict: true })) {
  const answers = []
  for (let i = 0; i < RUNS; i++) {
    const a = await ask(PROMPT(String(text ?? '').slice(0, 20000)))
    const c = a?.company
    if (c !== null && c !== undefined && typeof c !== 'string') throw new Error('bad_answer')
    answers.push(c ?? null)
  }
  return agreeCompany(String(rule ?? ''), answers, String(text ?? ''))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'))
    process.stdout.write(JSON.stringify(await confirmCompany(input)))
  } catch (e) {
    // 원문·열쇠는 출력하지 않는다. 오류 종류만.
    console.error('company_ai_unavailable', String(e?.message ?? '').slice(0, 80))
    process.exit(1)
  }
}
