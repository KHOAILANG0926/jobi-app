// AI 팀 그림 담당(Gemini) — Lee 2026-11-08 "Claude가 못하는 그림은 Gemini에게".
// 사용: node scripts/media/gemini-image.mjs <요청.json> <출력 폴더>
//   요청.json = { "max": 10, "jobs": [{ "name": "fnb-cheap", "model": "...", "prompt": "...", "aspect": "16:9" }] }
// 열쇠: GEMINI_API_KEY(GitHub 금고에만). 열쇠·응답 본문은 로그에 쓰지 않는다.
// 돈 새는 것 막기: 한 번 실행에 max장(기본 10)까지만. 넘는 요청은 그리지 않고 끝낸다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const KEY = process.env.GEMINI_API_KEY
if (!KEY) { console.error('::error::GEMINI_API_KEY 없음 — GitHub 금고에 넣어야 함'); process.exit(1) }
const [reqPath, outDir] = process.argv.slice(2)
const req = JSON.parse(readFileSync(reqPath, 'utf8'))
const MAX = Math.min(Number(req.max ?? 10), 20)
mkdirSync(outDir, { recursive: true })
const API = 'https://generativelanguage.googleapis.com/v1beta'

if (process.env.LIST_MODELS === '1') {
  const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY } })
  if (!r.ok) { console.error(`::error::모델 목록 HTTP ${r.status}`); process.exit(1) }
  const names = ((await r.json()).models ?? []).map((m) => m.name.replace('models/', '')).filter((n) => /image|imagen/i.test(n))
  console.log(`그림 모델: ${names.join(', ') || '(없음)'}`)
}

let made = 0, failed = 0
const report = []
for (const job of (req.jobs ?? []).slice(0, MAX)) {
  const body = {
    contents: [{ parts: [{ text: job.prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.aspect ?? '16:9' } },
  }
  const t0 = Date.now()
  const r = await fetch(`${API}/models/${encodeURIComponent(job.model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
  })
  if (!r.ok) {
    failed++
    const msg = (await r.text()).replace(/AIza[0-9A-Za-z_-]+/g, '***').slice(0, 300)
    console.log(`::warning::${job.name}: HTTP ${r.status} ${msg}`)
    report.push({ name: job.name, model: job.model, ok: false, status: r.status })
    continue
  }
  const json = await r.json()
  const part = (json.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)
  if (!part) { failed++; report.push({ name: job.name, model: job.model, ok: false, reason: 'no_image' }); console.log(`::warning::${job.name}: 그림 없음`); continue }
  const ext = /png/.test(part.inlineData.mimeType) ? 'png' : 'jpg'
  writeFileSync(join(outDir, `${job.name}.${ext}`), Buffer.from(part.inlineData.data, 'base64'))
  made++
  report.push({ name: job.name, model: job.model, ok: true, file: `${job.name}.${ext}`, seconds: Math.round((Date.now() - t0) / 1000), usage: json.usageMetadata ?? null })
  console.log(`${job.name}: 그림 완료 (${job.model})`)
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(`::notice::그림 ${made}장 · 실패 ${failed}`)
if (!made) process.exit(1)
