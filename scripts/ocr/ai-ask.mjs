// AI 글 판정 호출 한 곳(ai-classify.mjs에서 꺼냄, 2026-11-17 #872). 모델·호출 방식은 ai-classify와 같다(2026-11-08 Lee Sonnet→Haiku).
// 회사 이름 동의 확인(company-agree.mjs)도 같은 함수를 쓴다 — 별도 AI 모델·별도 호출 경로를 만들지 않는다.
export const AI_MODEL = process.env.CLASSIFY_AI_MODEL || 'claude-haiku-5-5'

/** 글 지시문 한 번 → { text, stopReason }. HTTP 오류는 상태 번호를 담아 던진다(본문 앞 200자만). 열쇠 값은 어디에도 출력하지 않는다. */
export async function askAI(prompt, { maxTokens = 3000, apiKey = process.env.ANTHROPIC_API_KEY, model = AI_MODEL } = {}) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) { const e = new Error(`AI HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e }
  const j = await r.json()
  return { text: (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(''), stopReason: j.stop_reason ?? '' }
}
