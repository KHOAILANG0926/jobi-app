/**
 * 상세 상단 두 번째 줄(회사명 줄) — 결정 0007(Lee 2026-11-01).
 * 1. 제목에 회사명이 이미 보이면 회사명을 반복하지 않는다. 회사명 뒤에 남는 부분(지점명)이 있으면 그것만 보여 준다.
 * 2. 남는 부분이 없으면 줄을 그리지 않는다(undefined).
 * 3. 제목에 회사명이 없으면 지금처럼 회사명 전체를 보여 준다.
 * 화면 표시만 정한다. DB의 company(원문 그대로, R5)는 바꾸지 않는다. 특정 회사·공고 번호 분기 없음.
 */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

export function companyLine(title: string | null | undefined, company: string | null | undefined): string | undefined {
  const name = String(company ?? '').trim()
  if (!name) return undefined
  const shownTitle = ` ${fold(String(title ?? '')).replace(/[^a-z0-9]+/g, ' ').trim()} `
  const words = name.split(/\s+/)
  // 제목 안에 낱말 경계로 들어 있는 가장 긴 회사명 앞부분
  let k = 0
  for (let i = words.length; i >= 1; i--) {
    const prefix = fold(words.slice(0, i).join(' ')).replace(/[^a-z0-9]+/g, ' ').trim()
    if (prefix.length >= 2 && shownTitle.includes(` ${prefix} `)) { k = i; break }
  }
  if (k === 0) return name
  const branch = words.slice(k).join(' ').replace(/^[\s\-–—,:|]+/, '').trim()
  return branch || undefined
}
