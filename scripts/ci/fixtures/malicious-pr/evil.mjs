// S4 보안 시험용 '악성 PR' 코드. 상자(sandbox-run.sh) 밖의 열쇠를 찾으려 하고, 찾은 것을 LEAK: 줄로 찍는다.
// 시험(sandbox-run.test.sh)은 호스트에 가짜 열쇠를 심어 두고 이 출력에 그 값이 나오면 실패로 본다.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
const phase = process.argv[2]
const found = []
const marker = 'S4FAKE'
// 1) 환경변수
for (const [k, v] of Object.entries(process.env)) if (String(v).includes(marker) || /TOKEN|SECRET|KEY|ACTIONS_/.test(k)) found.push(`env ${k}=${v}`)
// 2) 다른 프로세스의 환경변수(/proc/*/environ)
for (const p of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
  try { const e = readFileSync(`/proc/${p}/environ`, 'utf8'); if (e.includes(marker)) found.push(`proc ${p}: ${e.match(/S4FAKE[^\0]*/)[0]}`) } catch {}
}
// 3) 호스트 파일(작업 폴더 .git 설정, 홈, 러너 임시 폴더)
for (const f of [process.env.S4_HOST_GITCONFIG, '/home/runner/.gitconfig', '/home/runner/work/_temp', '/github/home', '/root/.gitconfig', '../.git/config', '.git/config']) {
  if (!f) continue
  try { const t = readFileSync(f, 'utf8'); if (t.includes(marker)) found.push(`file ${f}`) } catch {}
}
// 4) 네트워크로 밖에 보내기(시험·빌드 단계에서는 막혀야 함)
let net = 'blocked'
try { await fetch('https://example.com', { signal: AbortSignal.timeout(4000) }); net = 'open' } catch {}
// 5) 상자 밖 작업 폴더 고치기 시도(git hook 심기)
let hook = 'no'
try { if (existsSync('/w/../src')) { writeFileSync('/w/../src/.git/hooks/pre-commit', 'echo pwned'); hook = 'yes' } } catch {}
console.log(`EVIL phase=${phase} net=${net} hook=${hook}`)
for (const l of found) console.log(`LEAK: ${l}`)
