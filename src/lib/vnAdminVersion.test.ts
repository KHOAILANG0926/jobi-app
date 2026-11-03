// 행정구역 자료 판 일치 검사(Lee 2026-11-03 "명확한 기준"): 앱 자료(src/data/vn*.ts)는
// scripts/data/gen-vn-admin.py로만 만들고, 수집기(crawler/requirements.txt)와 같은 판이어야 한다.
// 판 번호만이 아니라 파일 내용의 SHA-256까지 비교해 손으로 고친 자료도 잡는다.
// node:fs·node:crypto는 src/ tsconfig(브라우저 타입)에 타입이 없어 동적 import(jobAlerts.test.ts와 같은 방식).
const fsName = 'node:' + 'fs'
const cryptoName = 'node:' + 'crypto'
const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync: (path: URL, enc: string) => string }
const { createHash } = (await import(/* @vite-ignore */ cryptoName)) as { createHash: (alg: string) => { update: (s: string) => { digest: (enc: string) => string } } }

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
const root = new URL('../../', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('scripts/data/vn-admin-version.json', root), 'utf8')) as { version: string; sha256: Record<string, string> }
const pin = /^vietnam-provinces==(.+)$/m.exec(readFileSync(new URL('crawler/requirements.txt', root), 'utf8'))?.[1]?.trim()
assert(pin === meta.version, `crawler pin ${pin} == app data ${meta.version}`)
for (const [file, sha] of Object.entries(meta.sha256)) {
  // Windows(CRLF)로 받은 사본도 같은 값이 나오게 줄끝을 LF로 맞춰서 비교.
  const got = createHash('sha256').update(readFileSync(new URL(`src/data/${file}`, root), 'utf8').replace(/\r\n/g, '\n')).digest('hex')
  assert(got === sha, `${file} unchanged since generation (regenerate with scripts/data/gen-vn-admin.py)`)
}
console.log('vnAdminVersion.test.ts: all passed')
