/**
 * 카드 글자 다듬기(보여 주기만, 원문·상세 화면은 그대로) — Lee 2026-11-01 지적.
 *  - 회사 이름 끝의 지역("WALLACE BẮC NINH")은 바로 아래 위치 줄에 이미 있으므로 카드에서 뺀다.
 *  - 제목 앞·뒤에 붙은 회사 이름은 위 회사 줄과 겹치므로 뺀다.
 *  - 전부 대문자인 제목은 첫 글자만 대문자로(소리치는 느낌 방지). 낱말은 바꾸지 않는다.
 */
import { bare } from './jobDetailSections.ts'
import { ADMINISTRATIVE_AREAS } from './administrativeArea.ts'

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

// 카드 상호·지점(Lee 2026-11-07): 상호와 지점을 한 줄에 같이 넣지 않는다. 카드 상호에서는 회사 형태 낱말을 뺀다(상세·DB는 원래 이름).
//  - 지점: " – / - / | / ( / Chi nhánh / Cơ sở / CN / CS " 뒤. 지점이 지역 이름뿐이면 버린다(아래 지역 줄과 겹침).
//  - 지점이 있으면 지역 줄 대신 "지점, 성"을 쓴다(2번 방식).
const LEGAL_RX = /(?<![\p{L}\p{N}])(?:công ty|cty|trách nhiệm hữu hạn|một thành viên|tnhh|mtv|cổ phần|jsc|co\.?,?\s*ltd\.?|limited|corporation|corp)(?![\p{L}\p{N}])/giu
const BRANCH_SPLIT = /\s+[–—|-]\s+|\s*\(|\s+(?:chi nhánh|cơ sở|cn|cs)\s+/iu
const PLACE_WORDS = new Set([...ADMINISTRATIVE_AREAS.flatMap((a) => a.aliases.flatMap((x) => x.split(' '))), 'tp', 'thanh', 'pho', 'tinh', 'phuong', 'p', 'xa', 'quan', 'huyen', 'thi', 'tran'])

export interface CardCompanyParts { name: string; branch: string; place: string }

/** 카드 상호·지점·지역 줄. 상호는 회사 형태 낱말과 끝의 지역을 뺀 이름(남는 글자가 없으면 원래 이름). */
export function cardCompanyParts(company: string | null | undefined, area: string | null | undefined): CardCompanyParts {
  const full = String(company ?? '').trim()
  const place = String(area ?? '').trim()
  const m = full.match(BRANCH_SPLIT)
  let name = m && m.index && m.index > 0 ? full.slice(0, m.index) : full
  let branch = m && m.index && m.index > 0 ? strip(full.slice(m.index + m[0].length).replace(/[()]/g, ' ').replace(/^\s*(?:chi nhánh|cơ sở|cn|cs)\s+/iu, '')) : ''
  const noLegal = strip(name.replace(LEGAL_RX, ' ').replace(/\s{2,}/g, ' '))
  if (noLegal.length >= 2) name = noLegal
  name = cardCompany(name, place) || full
  const where = ` ${bare(place)} `
  const placeOnly = branch && bare(branch).split(' ').every((w) => !w || where.includes(` ${w} `) || PLACE_WORDS.has(w))
  if (placeOnly) branch = ''
  const province = place.split(/\s*,\s*/).filter(Boolean).pop() ?? ''
  const shownPlace = branch ? [branch, province].filter((x, i, a) => x && (i === 0 || !bare(a[0]).endsWith(bare(x)))).join(', ') : place
  return { name, branch, place: shownPlace }
}

const ACRONYMS = /^(?:PG|KCN|CTY|CV|TNHH|KTX|BHXH|BHYT|BHTN|HR|IT|QC|QA|VNĐ|VND|PT|FT|CEO|KH|SX)$/u

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, '')
  return letters.length >= 6 && letters === letters.toLocaleUpperCase('vi') && letters !== letters.toLocaleLowerCase('vi')
}

/** 제목 앞·뒤에서 회사 글자(낱말 단위)를 뗀다. 문장부호·대시 차이는 무시. */
function stripWords(t: string, c: string): string | null {
  const cw = bare(c).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  if (!cw.length || cw.join('').length < 3) return null
  const words = t.split(/\s+/)
  const key = (w: string) => bare(w).replace(/[^a-z0-9]+/g, '')
  const tw = words.map(key)
  // 앞
  let i = 0, j = 0
  while (i < tw.length && j < cw.length) { if (!tw[i]) { i++; continue } if (tw[i] !== cw[j]) break; i++; j++ }
  if (j === cw.length && i < words.length) return strip(words.slice(i).join(' '))
  // 뒤
  i = tw.length - 1; j = cw.length - 1
  while (i >= 0 && j >= 0) { if (!tw[i]) { i--; continue } if (tw[i] !== cw[j]) break; i--; j-- }
  if (j < 0 && i >= 0) return strip(words.slice(0, i + 1).join(' '))
  return null
}

export function cardTitle(title: string | null | undefined, company: string | null | undefined): string {
  let t = String(title ?? '').trim()
  const c = String(company ?? '').trim()
  if (c.length >= 3) {
    const parts = cardCompanyParts(c, '')
    const m = c.match(BRANCH_SPLIT)
    const withBranch = m && m.index ? `${c.slice(0, m.index)} ${c.slice(m.index + m[0].length).replace(/[()]/g, ' ')}` : ''
    for (const cand of [c, withBranch, parts.branch ? `${parts.name} ${parts.branch}` : ''].filter(Boolean)) {
      const cut = stripWords(t, cand)
      if (cut) { t = cut; break }
    }
  }
  if (isAllCaps(t)) {
    // 약어(PG·KCN·CTY·TNHH 등)는 그대로 대문자.
    const low = t.split(/(\s+)/).map((w) => (ACRONYMS.test(w.replace(/[^\p{L}]/gu, '')) ? w : w.toLocaleLowerCase('vi'))).join('')
    t = low.charAt(0).toLocaleUpperCase('vi') + low.slice(1)
  }
  return t || String(title ?? '').trim()
}
