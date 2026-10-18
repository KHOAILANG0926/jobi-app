// 결정 0003 강제 장치: Lee 승인이 필요한 곳은 결정 문서(docs/decisions)와 이 지정 파일뿐이어야 한다.
// AI가 승인 대상을 늘려 Lee에게 판단할 수 없는 승인을 요구하는 것을 막는다. 아울러 0001의 한국어·영어 결정 짝을 검사한다.
import { readFileSync, readdirSync } from 'node:fs'
// 0005: 도면 대조를 부르는 필수 검사 파일도 Lee 승인 대상(도면 검사를 빼거나 약하게 만드는 것 방지).
const ALLOWED = new Set(['/docs/decisions/', '/.github/CODEOWNERS', '/.github/workflows/app-screen-check.yml'])
const fail = (m) => { console.error('APPROVAL_SCOPE: ' + m); process.exit(1) }
const lines = readFileSync('.github/CODEOWNERS', 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
for (const l of lines) {
  const path = l.split(/\s+/)[0]
  if (!ALLOWED.has(path)) fail(`Lee 승인 대상은 결정 문서만 허용(결정 0003). 허용 안 된 항목: ${path}`)
}
for (const p of ALLOWED) if (!lines.some((l) => l.startsWith(p + ' ') || l.startsWith(p + '\t'))) fail(`필수 항목 없음: ${p}`)
const nums = (dir) => readdirSync(`docs/decisions/${dir}`).filter((f) => /^\d{4}-.*\.md$/.test(f)).map((f) => f.slice(0, 4)).sort().join(',')
if (nums('ko') !== nums('en')) fail(`한국어·영어 결정 번호가 다름: ko=${nums('ko')} en=${nums('en')}`)
console.log(`approval scope OK (${lines.length} owner lines, decisions ${nums('ko')})`)
