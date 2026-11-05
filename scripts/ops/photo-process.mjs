// Publication may continue with a fallback. Photo completion is a separate,
// executable check: filling a record or passing a build cannot complete it.
import { createHash } from 'node:crypto'
import { brandsWithLogo } from './logo-check.mjs'
const text = x => typeof x === 'string' && x.trim() !== ''
const https = x => { try { const u = new URL(x); return u.protocol === 'https:' && !u.username && !u.password } catch { return false } }
export function photoProcessPlan(payload) {
  const c = payload?.logo_check
  const pending = (stage, reason) => ({ complete: false, stage, reason })
  if (!c || !text(payload.company) || !text(payload.title)) return pending('search_pending', '회사명·공고 제목·검색 기록 필요')
  if (!['poster', 'brand', 'stored', 'found_unstored', 'not_found'].includes(c.result)) return pending('search_pending', '사진 처리 결과 값이 유효하지 않음')
  if (c.result === 'found_unstored') return pending('store_pending', '찾았지만 저장·연결 미완료. 브랜드 비대상도 저장 생략 사유가 아님')
  if (c.result === 'not_found') return pending('fallback_pending', '공고 등록은 유지. 검색어·확인한 출처·못 찾은 이유를 남기고 사진 재처리 대상에 유지')
  if (!https(c.official_url) || !https(c.source_image_url)) return pending('search_pending', '공식 출처와 선택한 원본 이미지 주소 필요')
  if (!text(c.company_evidence)) return pending('identify_pending', '선택한 사진의 회사·지점·주소를 확인한 근거 필요')
  if (!Number.isSafeInteger(c.job_id) || c.job_id <= 0) return pending('link_pending', '등록 결과의 실제 공고 번호 필요')
  if (payload.job_id != null && payload.job_id !== c.job_id) return pending('link_pending', '등록/수정 대상과 검증 대상 공고 번호 불일치')
  const expectedJobId = `sb-${c.job_id}`
  if (c.detail_url && c.detail_url !== `https://viecganban.vn/viec-lam/${expectedJobId}`) return pending('link_pending', '등록 결과 공고 번호와 운영 상세 URL 불일치')
  // Registered brand icons retain the existing brand-first rendering rule.
  if (c.result === 'brand') {
    const icon = new URL(c.source_image_url), official = new URL(c.official_url)
    if (!brandsWithLogo().has(c.brand) || icon.hostname !== 'www.google.com' || icon.pathname !== '/s2/favicons' || icon.searchParams.get('domain')?.replace(/^www\./, '') !== official.hostname.replace(/^www\./, '')) return pending('identify_pending', '등록 브랜드·공식 도메인·실제 로고 주소 불일치')
    return { complete: false, stage: 'verify_pending', expectedJobId, title: payload.title, sourceKind: 'brand', expectedUrl: c.source_image_url, sourceUrl: c.official_url, sourceImageUrl: c.source_image_url, companyEvidence: c.company_evidence }
  }
  const stored = c.stored_url
  if (!https(stored) || !stored.startsWith('https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/')) return pending('store_pending', '우리 저장소 공개 이미지 주소 필요')
  const image = Array.isArray(payload.images) && typeof payload.images[0] === 'string' ? payload.images[0] : undefined
  const imageUrl = image && (https(image) ? image : `https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/${image.replace(/^\/+/, '').replace(/^job-images\//, '')}`)
  if (payload.image_url !== stored && imageUrl !== stored) return pending('link_pending', '저장된 사진이 대표 이미지 필드에 연결되지 않음')
  return { complete: false, stage: 'verify_pending', expectedJobId, title: payload.title, expectedUrl: stored, sourceUrl: c.official_url, sourceImageUrl: c.source_image_url, companyEvidence: c.company_evidence }
}

export async function verifyPhotoProcess(payload, deps) {
  const plan = photoProcessPlan(payload)
  if (plan.stage !== 'verify_pending') return plan
  if (deps.detailUrl !== `https://viecganban.vn/viec-lam/${plan.expectedJobId}`) return { ...plan, reason: '검증 URL과 등록 결과 공고 번호 불일치' }
  const errors = [], views = []
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  let sha256
  try {
    const original = await deps.image(plan.sourceImageUrl)
    const saved = await deps.image(plan.expectedUrl)
    for (const value of [original, saved]) if (!/^image\//i.test(value.contentType) || value.bytes.length < 4) throw new Error('이미지 응답 아님')
    sha256 = digest(saved.bytes)
    if (digest(original.bytes) !== sha256) errors.push('공식 원본과 저장 이미지 해시 불일치')
  } catch (e) { errors.push(`원본·저장 이미지 확인 실패: ${e.message}`) }
  for (const width of [1366, 390]) {
    try {
      const view = await deps.inspect(width, plan)
      views.push({ width, ...view })
      if (view.company !== payload.company) errors.push(`${width}: 공고 회사 불일치`)
      if (view.jobId !== plan.expectedJobId || view.title !== payload.title) errors.push(`${width}: 등록 대상 공고 번호·제목 불일치`)
      if (view.detailUrl !== deps.detailUrl) errors.push(`${width}: 다른 공고 URL로 이동됨`)
      if (view.src !== plan.expectedUrl) errors.push(`${width}: 대표 사진 연결 불일치 또는 기본 이미지 표시`)
      if (!view.loaded) errors.push(`${width}: 실제 이미지 로딩 실패`)
      if (!view.sourceVerified) errors.push(`${width}: 출처 페이지에서 회사·선택 이미지 확인 실패`)
    } catch (e) { errors.push(`${width}: 화면 확인 실패: ${e.message}`) }
  }
  return { ...plan, stage: errors.length ? 'verify_pending' : 'complete', complete: errors.length === 0, checkedAt: new Date().toISOString(), detailUrl: deps.detailUrl, sha256, views, errors }
}
