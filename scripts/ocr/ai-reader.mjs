// 독립 판독자(결정 0004, 2026-10-18): 포스터 이미지만 보고 글자를 그대로 옮겨 적는다.
// 입력값(DB의 전화·급여 등)은 절대 보내지 않는다 — 이중 입력 검증처럼 서로 독립적으로 읽어야 의미가 있다.
// Tesseract는 디자인 포스터(칸 배치·흰 글씨)를 못 읽어 판정에서 뺐다(#4828 실제 사례).
// 필요 환경변수: ANTHROPIC_API_KEY (GitHub Secrets에만)
import { readFileSync } from 'node:fs'

export const READER_ID = 'ai-v1'
const MODEL = process.env.OCR_AI_MODEL || 'claude-haiku-5-5'

const PROMPT = `Transcribe ALL text visible in this job poster image exactly as printed, line by line.
Rules:
- Copy characters exactly (Vietnamese diacritics, digits, dots, commas). Do not correct, translate, summarize or reformat.
- Include every phone number and every money amount exactly as printed.
- If a part is unreadable, write [?] for that part. Never guess or fill in digits.
- Output only the transcription, nothing else.`

function mediaType(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.slice(0, 4).toString() === 'RIFF') return 'image/webp'
  if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif'
  throw new Error('지원하지 않는 이미지 형식')
}

/** 이미지 파일 1장을 독립적으로 판독해 글자를 돌려준다. */
export async function readImageAI(file, { apiKey = process.env.ANTHROPIC_API_KEY } = {}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음 — GitHub Secrets에 등록 필요')
  const buf = readFileSync(file)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType(buf), data: buf.toString('base64') } },
        { type: 'text', text: PROMPT },
      ] }],
    }),
  })
  if (!r.ok) throw new Error(`AI 판독 HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  return (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
}
