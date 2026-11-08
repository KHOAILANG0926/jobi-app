// Lee 2026-11-08 "운영 링크만 빼고 통일": 화면·검색 제목에 나가는 서비스 이름은 "Việc gần Bạn" 하나.
// 예전 이름(Việt Gần Bạn·Việc Gần Bạn·Việcganban)이 화면 코드(src·api)에 다시 들어오면 실패. 주소(viecganban.vn)·이메일·코드 주석은 검사 대상 아님.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const files = execSync('git ls-files src api index.html public/manifest.json', { encoding: 'utf8' }).split('\n').filter((f) => /\.(tsx?|m?js|html|json)$/.test(f))
const old = /Việt Gần Bạn|Việc Gần Bạn|Việcganban/
const bad = []
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
    if (old.test(line)) bad.push(`${f}:${i + 1} ${t.slice(0, 100)}`)
  })
}
if (bad.length) { console.error('예전 서비스 이름이 남아 있음:\n' + bad.join('\n')); process.exit(1) }
console.log(`PASS 서비스 이름 하나(Việc gần Bạn) — ${files.length}개 파일`)
