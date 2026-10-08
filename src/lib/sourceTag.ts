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

/** 공개 HTML(__INITIAL_STATE__)로 내려보내는 공고에서 내부 출처 값(`source`)과 `[source:...]` 표식을 뺀다. */
export function toPublicJobs(jobs: Job[]): Job[] {
  return jobs.map(({ source: _source, ...rest }) => ({
    ...rest,
    title: stripSourceTags(rest.title),
    company: stripSourceTags(rest.company),
    description: stripSourceTags(rest.description),
  }))
}
