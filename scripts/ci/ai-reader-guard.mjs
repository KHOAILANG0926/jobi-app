// AI 판독자 교정 시험은 ANTHROPIC_API_KEY가 필요하다. 포크 PR에는 GitHub가 Secrets를 전달하지 않고, PR이 바꾼 코드·스크립트·의존성에 키를 주는 것은 위험하므로
// PR 검사(publication-gate)에서는 키를 쓰지 않는다. 대신 이 확인이 "판독 입력이 바뀐 PR은 신뢰된 교정 실행을 통과해야 한다"를 지킨다(비밀키 없음).
//  - 판독 입력이 안 바뀐 PR: 이 PR이 판독자를 바꾸지 않았다는 사실만 확인한다. 교정 자체는 master의 신뢰된 실행(.github/workflows/ai-reader-calibration.yml)이 맡는다 — 그 결과를 이 PR의 검증 결과로 세지 않는다.
//  - 판독 입력이 바뀐 PR: 이 PR의 head 커밋에 대해 사람이 코드를 확인하고 돌린 교정 실행(workflow_dispatch, 같은 저장소 브랜치)이 성공해야 통과. 없으면 실패(포크 PR은 원본 저장소 브랜치로 옮겨야 함).
// 보안(Codex #806): ① 판독 입력은 파일 목록이 아니라 교정 시험의 import 그래프(기준·head 양쪽 합집합)에서 구한다 — ocr-compare가 부르는 src/lib/salaryReader.ts 같은 간접 입력도 포함.
//   ② 변경 목록은 git diff -z --no-renames(이름 바꾸기로 옛 경로를 숨기거나 특수문자 파일명으로 경로 검사를 피하지 못하게). ③ 교정 실행 증거는 workflow_dispatch로 돈 head 커밋의 성공 실행만.
//   ④ 증거가 된 실행이 PR이 바꾼 교정 워크플로를 돌렸다면 증거가 아니다(워크플로를 무력화하고 통과시키는 것 방지) — 입력 변경과 교정 워크플로 변경은 한 PR에 함께 둘 수 없다.
//   ⑤ 이 스크립트는 PR 검사에서 기준(base) 커밋의 사본으로 실행한다(PR이 가드를 고쳐 통과시키지 못하게; 기준에 아직 없으면 PR 사본). ⑥ 출력은 워크플로 명령 주입을 막도록 정리한다.
// 사용: node ai-reader-guard.mjs <changed-files(-z).bin> <workflow-runs.json>  (환경: HEAD_SHA, BASE_SHA, 저장소 루트에서 실행)
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { posix } from 'node:path'

export const CALIBRATION_WORKFLOW = 'ai-reader-calibration.yml'
export const CALIBRATION_WORKFLOW_PATH = `.github/workflows/${CALIBRATION_WORKFLOW}`
export const ENTRY = 'scripts/ocr/ai-reader.test.mjs'
// 항상 판독 입력인 것: 판독자·교정 시험·비교기·정답 포스터. (교정 워크플로 파일은 정확도를 바꾸지 않고, 이 가드를 처음 들이는 PR이 자기 자신에게 걸리는 순환을 만들어 제외 — ④가 대신 막는다)
export const READER_INPUTS = [/^scripts\/ocr\/ai-reader\.mjs$/, /^scripts\/ocr\/ai-reader\.test\.mjs$/, /^scripts\/ocr\/ocr-compare\.mjs$/, /^test-fixtures\/ocr\//]

const SPEC = /(?:\bimport|\bexport)\b[^'"`;]*?\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g
/** 시작 파일에서 상대 경로 import를 따라 닿는 저장소 파일 전부. read(path) = 파일 글자(없으면 null). */
export function importClosure(entry, read) {
  const seen = new Set()
  const walk = (file) => {
    if (seen.has(file)) return
    const text = read(file)
    if (text == null) return
    seen.add(file)
    for (const m of text.matchAll(SPEC)) {
      const spec = m[1] ?? m[2] ?? m[3]
      const base = posix.normalize(posix.join(posix.dirname(file), spec))
      const hit = [base, `${base}.ts`, `${base}.mjs`, `${base}.js`, `${base}.tsx`, `${base}/index.ts`].find((c) => read(c) != null)
      if (hit) walk(hit)
    }
  }
  walk(entry)
  return seen
}

export const readerInputsChanged = (files, extra = new Set()) => files.filter((f) => READER_INPUTS.some((re) => re.test(f)) || extra.has(f))
const safe = (s) => String(s).replace(/[\r\n%]/g, ' ').replace(/::/g, ': ').slice(0, 600)

/** runs = GitHub Actions 교정 워크플로의 이 head 커밋 실행 목록(event·conclusion·head_sha). 같은 이름의 PR 실행(event=pull_request)은 인정하지 않는다. */
export function decide({ changed, runs, headSha, extraInputs = new Set(), workflowExistsAtBase = true }) {
  const touched = readerInputsChanged(changed, extraInputs)
  if (!touched.length) return { ok: true, message: 'AI 판독 입력(판독자·교정 시험·비교기·그 import·정답 포스터) 변경 없음 — 교정은 master의 신뢰된 실행(ai-reader-calibration)이 맡는다. 그 결과는 이 PR의 검증 결과가 아니다.' }
  const short = String(headSha ?? '').slice(0, 7)
  if (workflowExistsAtBase && changed.includes(CALIBRATION_WORKFLOW_PATH))
    return { ok: false, message: safe(`AI 판독 입력(${touched.join(', ')})과 교정 워크플로(${CALIBRATION_WORKFLOW})를 한 PR에서 함께 바꿀 수 없다 — 바뀐 워크플로로 돈 실행은 교정 증거가 아니다. 나눠서 올린다.`) }
  const proven = (runs ?? []).some((r) => r.event === 'workflow_dispatch' && r.head_sha === headSha && r.status === 'completed' && r.conclusion === 'success')
  if (proven) return { ok: true, message: safe(`AI 판독 입력 변경(${touched.join(', ')}) — 이 head 커밋(${short})에 대한 신뢰된 교정 실행 성공 확인`) }
  return { ok: false, message: safe(`AI 판독 입력이 바뀌었다(${touched.join(', ')}). 이 head 커밋(${short})에 대한 교정 실행(workflow_dispatch: ${CALIBRATION_WORKFLOW})이 성공해야 한다. ` +
    '포크 PR에는 Secrets를 줄 수 없으므로 코드 검토 후 원본 저장소 브랜치로 옮겨 사람이 실행한다(승인 필요). PR 코드에 키를 주는 우회는 하지 않는다.') }
}

const git = (...args) => { try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } }

if (process.argv[1]?.endsWith('ai-reader-guard.mjs')) {
  const [filesPath, runsPath] = process.argv.slice(2)
  const { HEAD_SHA, BASE_SHA } = process.env
  if (!HEAD_SHA || !BASE_SHA) { console.error('::error::HEAD_SHA·BASE_SHA 필요 — 닫힌 실패'); process.exit(1) }
  const changed = readFileSync(filesPath, 'utf8').split('\0').filter(Boolean)
  const runs = JSON.parse(readFileSync(runsPath, 'utf8')).workflow_runs ?? []
  const extra = new Set()
  for (const ref of [BASE_SHA, HEAD_SHA]) for (const f of importClosure(ENTRY, (p) => git('show', `${ref}:${p}`))) extra.add(f)
  const r = decide({ changed, runs, headSha: HEAD_SHA, extraInputs: extra, workflowExistsAtBase: git('cat-file', '-e', `${BASE_SHA}:${CALIBRATION_WORKFLOW_PATH}`) !== null })
  console.log(r.message)
  if (!r.ok) { console.error('::error::' + r.message); process.exit(1) }
}
