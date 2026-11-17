// 글 질문 1번 — AI 칸 판정(ai-classify)과 회사 이름 확인(read-company-ai)이 같이 쓰는 부르기 코드 한 곳(2026-11-17, 같은 fetch를 두 곳에 두지 않음).
// 포스터 그림 판독(ai-reader.mjs)은 교정 시험(ai-reader-calibration)이 묶여 있어 건드리지 않는다.
/**
 * strict=true: 답이 잘리거나(max_tokens) JSON이 없거나 깨지면 오류(조용히 '없음'이 되지 않게, #887 2차 원인).
 * strict=false: 예전 ai-classify 동작 그대로(JSON이 없으면 {}).
 */
export async function askJSON(prompt, { model, maxTokens = 1024, strict = false, apiKey = process.env.ANTHROPIC_API_KEY } = {}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: model || process.env.CLASSIFY_AI_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error(`AI HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
  if (strict && j.stop_reason === 'max_tokens') throw new Error('cut_off')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) { if (strict) throw new Error('no_json'); return {} }
  if (!strict) return JSON.parse(m[0])
  try { return JSON.parse(m[0]) } catch { throw new Error('bad_json') }
}
