/**
 * 카드 글자 다듬기(보여 주기만, 원문·상세 화면은 그대로) — Lee 2026-11-01 지적.
 *  - 회사 이름 끝의 지역("WALLACE BẮC NINH")은 바로 아래 위치 줄에 이미 있으므로 카드에서 뺀다.
 *  - 제목 앞·뒤에 붙은 회사 이름은 위 회사 줄과 겹치므로 뺀다.
 *  - 전부 대문자인 제목은 첫 글자만 대문자로(소리치는 느낌 방지). 낱말은 바꾸지 않는다.
 */
import { bare } from './jobDetailSections.ts'

const strip = (s: string) => s.replace(/^[\s\-–—:|·,]+|[\s\-–—:|·,]+$/gu, '').trim()

/** 회사 이름 끝 낱말들이 위치 글자에 들어 있으면 뗀다(남는 글자가 있을 때만). */
export function cardCompany(company: string | null | undefined, area: string | null | undefined): string {
  const name = String(company ?? '').trim()
  const where = ` ${bare(String(area ?? ''))} `
  const words = name.split(/\s+/)
  // 지역 이름은 두 낱말 이상("Bắc Ninh")일 때만 뗀다 — 한 낱말 일치는 회사 이름 일부일 수 있음.
  for (let n = Math.min(3, words.length - 1); n >= 2; n--) {
    const tail = bare(words.slice(-n).join(' '))
    if (tail.length >= 3 && where.includes(` ${tail} `)) return words.slice(0, -n).join(' ')
  }
  return name
}

const ACRONYMS = /^(?:PG|KCN|CTY|CV|TNHH|KTX|BHXH|BHYT|BHTN|HR|IT|QC|QA|VNĐ|VND|PT|FT|CEO|KH|SX)$/u

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, '')
  return letters.length >= 6 && letters === letters.toLocaleUpperCase('vi') && letters !== letters.toLocaleLowerCase('vi')
}

export function cardTitle(title: string | null | undefined, company: string | null | undefined): string {
  let t = String(title ?? '').trim()
  const c = String(company ?? '').trim()
  if (c.length >= 3) {
    const tb = bare(t), cb = bare(c)
    if (tb.startsWith(cb + ' ')) t = strip(t.slice(c.length))
    else if (tb.endsWith(' ' + cb)) t = strip(t.slice(0, t.length - c.length))
  }
  if (isAllCaps(t)) {
    // 약어(PG·KCN·CTY·TNHH 등)는 그대로 대문자.
    const low = t.split(/(\s+)/).map((w) => (ACRONYMS.test(w.replace(/[^\p{L}]/gu, '')) ? w : w.toLocaleLowerCase('vi'))).join('')
    t = low.charAt(0).toLocaleUpperCase('vi') + low.slice(1)
  }
  return t || String(title ?? '').trim()
}
