// #648: PR 설명 「필수 테스트 결과 및 검증 SHA」 표에 봇 수정 뒤 검증 줄을 넣거나 바꾼다(다른 줄은 그대로).
// 사용: node scripts/ops/pr-bot-proof.mjs <설명.md> <HEAD SHA> <결과 글>
import { readFileSync } from 'node:fs'
import { BOT_PROOF_LABEL } from '../check-pr-ready.mjs'

export function withBotProof(body, sha, result) {
  const row = `| ${BOT_PROOF_LABEL} | ${result} | ${sha} |`
  const lines = String(body).split('\n')
  const at = lines.findIndex((l) => l.startsWith(`| ${BOT_PROOF_LABEL} |`))
  if (at >= 0) { lines[at] = row; return lines.join('\n') }
  const head = lines.findIndex((l) => l.startsWith('## 필수 테스트 결과 및 검증 SHA'))
  if (head < 0) return `${body}\n\n## 필수 테스트 결과 및 검증 SHA\n| 테스트/CI | 결과 | 검증 SHA |\n|---|---|---|\n${row}\n`
  let last = head
  for (let i = head + 1; i < lines.length && !lines[i].startsWith('## '); i++) if (lines[i].startsWith('|')) last = i
  lines.splice(last + 1, 0, ...(last === head ? ['| 테스트/CI | 결과 | 검증 SHA |', '|---|---|---|', row] : [row]))
  return lines.join('\n')
}

if (process.argv[1]?.endsWith('pr-bot-proof.mjs')) {
  const [file, sha, result] = process.argv.slice(2)
  if (!/^[0-9a-f]{40}$/i.test(sha ?? '')) { console.error('HEAD SHA 필요'); process.exit(2) }
  process.stdout.write(withBotProof(readFileSync(file, 'utf8'), sha, result || '실패'))
}
