import { photoProcessPlan } from './photo-process.mjs'
export function photoProcessPrProblems(body, payloads) {
  if (!payloads.length) return []
  const status = body.match(/^- 사진 처리:\s*(완료|미완료)/m)?.[1]
  if (!status) return ['공고 사진 처리 상태 필요: - 사진 처리: 미완료 또는 완료(운영 검증 필요)']
  if (status === '미완료') return [] // Registration proceeds; never conceal the unfinished photo task.
  const problems = []
  for (const { path, payload } of payloads) {
    const plan = photoProcessPlan(payload)
    if (plan.stage !== 'verify_pending') problems.push(`${path}: 사진 완료 주장 불가 (${plan.stage})`)
    if (!/^https:\/\/viecganban\.vn\/viec-lam\/sb-\d+$/.test(payload.logo_check?.detail_url ?? '')) problems.push(`${path}: 사진 완료 주장은 실제 운영 상세 URL 필요`)
  }
  return problems
}
