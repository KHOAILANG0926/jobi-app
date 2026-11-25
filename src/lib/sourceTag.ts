import type { Job } from '../types/job.ts'

/** 크롤러가 description에 붙이는 내부 출처 표식(`[source:chotot]` 등).
 *  DB에서 중복 판정·출처 구분에만 쓰는 값이라 공개 HTML·SSR·meta·JSON-LD·sitemap 어디에도 나가면 안 된다. */
const SOURCE_TAG_GLOBAL = /\[\s*source\s*:[^\]]*\]/gi

export function hasSourceTag(text: unknown): boolean {
  return typeof text === 'string' && /\[\s*source\s*:/i.test(text)
}

/** 모든 `[source:...]` 표식을 지운다(위치·대소문자·개수 무관). */
export function stripSourceTags(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(SOURCE_TAG_GLOBAL, '').trim()
}

/** 설명을 새로 쓸 때 예전 설명 맨 앞의 출처 표시를 그대로 이어 붙인다(#6454 — 상세 정리가 표시를 지워 수집기 기존 공고 조회·출처 구분이 깨짐).
 *  새 설명에 이미 표시가 있거나 예전 설명에 표시가 없으면 새 설명 그대로. */
export function keepSourceTag(previous: string | null | undefined, next: string): string {
  const tag = String(previous ?? '').match(/^\s*(\[\s*source\s*:[^\]]*\])/i)?.[1]
  return !tag || hasSourceTag(next) ? next : `${tag} ${next}`
}

/** 공개 HTML(__INITIAL_STATE__)로 내려보내는 공고에서 내부 출처 값(`source`)과 `[source:...]` 표식을 뺀다. */
export function toPublicJobs(jobs: Job[]): Job[] {
  return jobs.map(({ source: _source, ...rest }) => ({
    ...rest,
    title: stripSourceTags(rest.title),
    company: stripSourceTags(rest.company),
    description: stripSourceTags(rest.description),
  }))
}
