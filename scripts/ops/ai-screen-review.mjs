// 따로 읽는 검사관(Lee 2026-11-12 "검증 자체가 없다" — 6043 한 건에 화면 오류 14곳이 검사를 통과한 채 공개됨).
// 지금까지 검사는 '칸이 채워졌나'만 보고, 만드는 쪽과 같은 읽기 규칙을 써서 틀려도 맞다고 했다.
// 이 검사관은 우리 읽기 규칙·DB 판정 값을 하나도 보지 않는다. 원문(source_text·ocr_text)과 실제 화면(글 + 화면 사진)만 받아
// 항목마다 맞음/틀림/모름을 답한다. 틀림 = 확정 오류(sure) → 검사표가 공개하지 않는다(job-inspect screenState, 기존 화면 대조 기록에 같이 남김).
// 기준은 CLAUDE.md 확정 구성(10-30) + 같은 사항은 최신 Lee 결정(11-12 원칙: ④ 상여·복리후생 타일 #655, 빈 필수 항목 줄째 숨김, 전화번호 비노출).
// 필요 환경변수: ANTHROPIC_API_KEY(GitHub Secrets). 없으면 '검사관 없음' 확정 오류 — 검사 없이 공개되는 일이 없게.

const MODEL = process.env.SCREEN_REVIEW_MODEL || 'claude-sonnet-5-5'

export const REVIEW_ITEMS = [
  ['nganh_nghe', 'Ngành nghề (job category) on screen fits the ACTUAL duties described in the source (e.g. a technician/repair job is not "dịch vụ và bán hàng" just because the workplace is a mall).'],
  ['salary', 'Salary on screen equals the source (amount, unit, range); numbers are not broken across lines (e.g. "8,5 triệu" must stay one value); no salary invented.'],
  ['title', 'Job title is a job/position name from the source, not a salary sentence, slogan or greeting.'],
  ['hours', 'Working hours / shifts / days on screen match the source.'],
  ['form', 'Hình thức làm việc (full-time/part-time/seasonal…) matches the source when the source states it; not contradicting it.'],
  ['duties', '"Nội dung công việc" contains only work-duty lines — no address, benefits, salary, requirements, contact or recruitment-procedure lines.'],
  ['sections', 'Every other line sits in the right section: requirements (age, gender, experience, documents) in Thông tin tuyển dụng; benefits in Phúc lợi; work environment only environment; procedure only procedure.'],
  ['benefits', 'Benefits shown are stated in the source, and clearly stated benefits (meals, dormitory/"bao ăn ở", insurance, bonus) are shown.'],
  ['duplicate', 'No same information shown twice (same benefit list, same salary sentence, same block repeated).'],
  ['empty', 'No heading or row shown with empty content.'],
  ['image', 'Header picture/logo is not broken and fits this company/industry (not an unrelated brand, not a supermarket photo for a factory/technician job).'],
  ['phone', 'No phone number digits are printed as text anywhere on the page (contact only via call/Zalo buttons).'],
  ['invented', 'Nothing on screen contradicts the source or is invented (company, address, conditions).'],
]

const PROMPT = (source, screenText) => `You are an independent checker for a Vietnamese job site. You did NOT build this page.
Compare the PUBLISHED DETAIL PAGE (text + screenshots) against the ORIGINAL JOB POST. Judge each item strictly.

ORIGINAL JOB POST:
<<<
${source.slice(0, 12000)}
>>>

PAGE TEXT (as rendered, PC):
<<<
${screenText.slice(0, 15000)}
>>>

Items:
${REVIEW_ITEMS.map(([k, d]) => `- ${k}: ${d}`).join('\n')}

Answer ONLY a JSON array, one object per item: {"key": "<item key>", "verdict": "ok" | "wrong" | "unsure", "detail": "<if wrong/unsure: short Korean sentence quoting the exact wrong text and where it should be>"}.
Page conventions (approved by the owner, not errors): the header row always shows 7 benefit icons — colored/highlighted = offered, grey/faded = NOT offered (judge only the highlighted ones); "Ngày đăng" date is the site's own posting date; rows for info the source lacks are hidden; call/Zalo BUTTONS are fine, only phone digits printed as text are wrong.
"wrong" only when you can point to concrete text/picture evidence. Missing optional info that the source also lacks is "ok".`

/**
 * 화면 한 건 검사. shots = PC 화면 조각 사진(Buffer, png) 몇 장, screenText = 화면 글(main innerText).
 * 돌려주는 값: screenAudit과 같은 모양 [{ key, sure, device, detail }]
 */
export async function aiScreenReview({ source, screenText, shots }, { apiKey = process.env.ANTHROPIC_API_KEY } = {}) {
  if (!apiKey) return [{ key: 'ai_review', sure: true, device: 'PC', detail: '따로 읽는 검사관 없음(ANTHROPIC_API_KEY) — 검사 없이 공개하지 않음' }]
  if (!String(source || '').trim()) return [{ key: 'ai_review', sure: false, device: 'PC', detail: '원문 없음 — 검사관 대조 불가(관리자 확인)' }]
  const content = [
    ...shots.slice(0, 6).map((b) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b.toString('base64') } })),
    { type: 'text', text: PROMPT(String(source), String(screenText || '')) },
  ]
  let answer = ''
  for (let attempt = 0; attempt < 2 && !answer; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }))
    if (!r.ok) { if (attempt) return [{ key: 'ai_review', sure: true, device: 'PC', detail: `검사관 호출 실패 HTTP ${r.status} — 다음 실행에 다시` }]; continue }
    const j = await r.json()
    answer = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  }
  return parseReview(answer)
}

/** 검사관 답(JSON 배열)을 판정으로 바꾼다. 못 읽으면 확정 오류(검사 안 된 채 공개 금지). */
export function parseReview(answer) {
  const m = /\[[\s\S]*\]/.exec(String(answer || ''))
  let arr
  try { arr = m ? JSON.parse(m[0]) : null } catch { arr = null }
  if (!Array.isArray(arr)) return [{ key: 'ai_review', sure: true, device: 'PC', detail: '검사관 답을 읽지 못함 — 다음 실행에 다시' }]
  const keys = new Set(REVIEW_ITEMS.map(([k]) => k))
  const seen = new Set(arr.map((x) => x?.key))
  const missing = [...keys].filter((k) => !seen.has(k))
  return [
    ...arr.filter((x) => keys.has(x?.key) && x.verdict !== 'ok')
      .map((x) => ({ key: `ai_${x.key}`, sure: x.verdict === 'wrong', device: 'PC', detail: `[검사관] ${String(x.detail || x.verdict).slice(0, 300)}` })),
    ...(missing.length ? [{ key: 'ai_review', sure: true, device: 'PC', detail: `검사관이 답하지 않은 항목: ${missing.join(', ')}` }] : []),
  ]
}
