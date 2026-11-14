// AI 판독자 교정 시험은 ANTHROPIC_API_KEY가 필요하다. 포크 PR에는 GitHub가 Secrets를 전달하지 않고, PR이 바꾼 코드·스크립트·의존성에 키를 주는 것은 위험하므로
// PR 검사(publication-gate)에서는 키를 쓰지 않는다. 대신 이 확인이 "판독 입력이 바뀐 PR은 신뢰된 교정 실행을 통과해야 한다"를 지킨다(비밀키 없음).
//  - 판독 입력이 안 바뀐 PR: 이 PR이 판독자를 바꾸지 않았다는 사실만 확인한다. 교정 자체는 master의 신뢰된 실행(.github/workflows/ai-reader-calibration.yml)이 맡는다 — 그 결과를 이 PR의 검증 결과로 세지 않는다.
//  - 판독 입력이 바뀐 PR: 이 PR의 head 커밋에 대해 사람이 코드를 확인하고 돌린 교정 실행(workflow_dispatch, 같은 저장소 브랜치)이 성공해야 통과. 없으면 실패(포크 PR은 원본 저장소 브랜치로 옮겨야 함).
// 사용: node scripts/ci/ai-reader-guard.mjs <changed-files.txt> <workflow-runs.json> (워크플로가 만든 파일; 조회 실패 시 호출하지 않고 실패)
import { readFileSync } from 'node:fs'

export const CALIBRATION_WORKFLOW = 'ai-reader-calibration.yml'
// 판독 결과에 영향을 주는 입력: 판독자·교정 시험·비교기(시험이 부름)·정답 포스터·교정 워크플로 자신
export const READER_INPUTS = [/^scripts\/ocr\/ai-reader\.mjs$/, /^scripts\/ocr\/ai-reader\.test\.mjs$/, /^scripts\/ocr\/ocr-compare\.mjs$/,
  /^test-fixtures\/ocr\//, /^\.github\/workflows\/ai-reader-calibration\.yml$/]
export const readerInputsChanged = (files) => files.filter((f) => READER_INPUTS.some((re) => re.test(f)))

/** runs = GitHub Actions 교정 워크플로의 이 head 커밋 실행 목록(event·conclusion·head_sha). 같은 이름의 PR 실행(event=pull_request)은 인정하지 않는다. */
export function decide({ changed, runs, headSha }) {
  const touched = readerInputsChanged(changed)
  if (!touched.length) return { ok: true, message: 'AI 판독 입력(판독자·교정 시험·비교기·정답 포스터) 변경 없음 — 교정은 master의 신뢰된 실행(ai-reader-calibration)이 맡는다. 그 결과는 이 PR의 검증 결과가 아니다.' }
  const proven = (runs ?? []).some((r) => r.event === 'workflow_dispatch' && r.head_sha === headSha && r.status === 'completed' && r.conclusion === 'success')
  if (proven) return { ok: true, message: `AI 판독 입력 변경(${touched.join(', ')}) — 이 head 커밋(${String(headSha).slice(0, 7)})에 대한 신뢰된 교정 실행 성공 확인` }
  return { ok: false, message: `AI 판독 입력이 바뀌었다(${touched.join(', ')}). 이 head 커밋(${String(headSha).slice(0, 7)})에 대한 교정 실행(workflow_dispatch: ${CALIBRATION_WORKFLOW})이 성공해야 한다. ` +
    '포크 PR에는 Secrets를 줄 수 없으므로 코드 검토 후 원본 저장소 브랜치로 옮겨 사람이 실행한다(승인 필요). PR 코드에 키를 주는 우회는 하지 않는다.' }
}

if (process.argv[1]?.endsWith('ai-reader-guard.mjs')) {
  const [filesPath, runsPath] = process.argv.slice(2)
  const changed = readFileSync(filesPath, 'utf8').split(/\r?\n/).filter(Boolean)
  const runs = JSON.parse(readFileSync(runsPath, 'utf8')).workflow_runs ?? []
  const r = decide({ changed, runs, headSha: process.env.HEAD_SHA })
  console.log(r.message)
  if (!r.ok) { console.error('::error::' + r.message); process.exit(1) }
}
