/**
 * 검사기 전용 읽기(R2 #753, 검사기 독립성). 공고 검사표(jobInspect)가 "원문 대비 결과가 맞나"를 판정하면서 만드는 쪽의 함수
 * (jobDescriptionBuild의 cleanSourceText·isPromoLine·contactDuplicate·sameLine·timeRanges, jobDetailFill의 isCovered,
 * sourceRecruitmentRoles, mainJobCards의 cardSalary, mealBenefit의 MEAL_HINT)를 가져다 쓰면, 만드는 쪽이 줄을 잘못 뺀 것을 같은 규칙이
 * "빠져도 되는 줄"이라고 봐 줘서 같이 합격한다. 그래서 이 파일은 검사기가 원문을 읽는 데 쓰는 규칙을 **따로** 두고, 아무것도 import하지 않는다.
 * 규칙은 일부러 작고 보수적이다: 원문 줄을 빼도 되는 경우는 사이트 화면 글자·가려진 번호·홍보 한 줄·반복 연락처뿐이다(CLAUDE.md 10-30 ④ 정의 그대로).
 * 만드는 쪽 규칙을 고치면 이 파일은 따라 바뀌지 않는다 — 두 쪽이 어긋나면 검사표가 그 줄을 "빠짐"으로 잡는다(독립 판독의 목적).
 */
const fold = (s: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// 사이트 화면 글자 + 사이트 선택 칸의 '기타' 기본값("Học vấn tối thiểu:" 다음 줄 "Khác" — 정보가 아니라 선택지 이름).
export const SITE_CHROME = /^(?:hien so|thong tin co ban|ca nhan dang tuyen|nha tuyen dung|khac|an so|xem them|doanh nghiep dang tuyen)$/
const MASKED_PHONE = /\d[\d .]{2,}\*{2,}/

/** 원문 줄(공백 정리, 빈 줄·사이트 화면 글자·가려진 번호 줄 제외). */
export function sourceLines(text: string | null | undefined): string[] {
  return String(text ?? '').split(/\r\n|\n|\r/).map((l) => l.trim()).filter((l) => l && !MASKED_PHONE.test(l) && !SITE_CHROME.test(fold(l)))
}

/** big이 small을 글자 그대로(성조·기호 무시) 포함하는가. */
export function covers(big: string, small: string): boolean { const s = fold(small); return !!s && fold(big).includes(s) }
/** 같은 줄인가: 정규화가 같거나 서로가 서로를 덮을 때. */
export function sameLine(a: string, b: string): boolean { const x = fold(a), y = fold(b); return x === y || (!!x && !!y && x.includes(y) && y.includes(x)) }

/** 줄 속 근무시간 범위(정규화: "6:30-14:30"). */
export function timeRanges(line: string): string[] {
  const t = (h: string, m?: string) => `${Number(h)}:${m ?? '00'}`
  // 대시(–·—)를 지우지 않고 '-'로 통일한 뒤 읽는다(fold는 기호를 공백으로 바꿔 범위 표시가 사라진다).
  const low = String(line).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[–—−]/g, '-')
  return [...low.matchAll(/(\d{1,2}) ?[hg:] ?(\d{2})? ?[-~] ?(\d{1,2}) ?[hg:] ?(\d{2})?/g)].map((m) => t(m[1], m[2]) + '-' + t(m[3], m[4]))
}

/** 홍보 한 줄(빼도 되는 줄): 해시태그만 있는 줄, 또는 '!'·'?'로 끝나고 숫자·':'·연락처가 없는 짧은 인사. */
export function promoLike(line: string): boolean {
  const t = String(line).trim()
  if (/^(?:#\S+\s*)+$/.test(t)) return true
  if (!(/[!?]\s*$/.test(t) && !/\d/.test(t) && !/[:：]/.test(t) && !/@|https?:\/\/|zalo|hotline/i.test(t) && t.length <= 120)) return false
  return !FACT_WORDS.test(' ' + fold(t) + ' ')   // 근무 조건·지원 방법·주소·회사 낱말이 있으면 홍보가 아니라 정보(CLAUDE.md 10-30 ④ "애매하면 남긴다")
}
// 검사 쪽 사본(만드는 쪽 JOB_FACT_HINT·ADDRESS_HINT·COMPANY_HINT와 일부러 따로, 성조 없는 형태). 낱말 목록은 보수적으로 넓게 — 홍보로 오인해 빠짐을 놓치는 쪽이 더 나쁘다.
const FACT_WORDS = / (?:lau dai|on dinh|chinh thuc|thoi vu|bao an|bao o|an o|ky tuc|ktx|xe dua don|dua don|bao hiem|bhxh|thuong|phu cap|tang ca|nghi|ca ngay|ca dem|xoay ca|part ?time|full ?time|kinh nghiem|dao tao|luong|thu nhap|tuoi|nam|nu|cv|ho so|phong van|tang|duong|pho|phuong|xa|huyen|quan|thi tran|thanh pho|tp|kcn|khu cong nghiep|ccn|thon|ngo|ngach|so nha|toa|plaza|chi nhanh|co so|cong ty|tnhh|co phan|tap doan|don vi|van phong) /

// 베트남 국가번호(+84·84)와 국내 0 표기를 같은 번호로 본다("0901234567" = "+84 901 234 567").
const DIGITS = (s: string) => [...String(s).matchAll(/\+?\d[\d .()-]{7,}\d/g)].map((m) => m[0].replace(/\D/g, '').replace(/^840?(?=\d{9}$)|^0(?=\d{9}$)/, ''))
const CONTACT_WORDS = new Set(['lien', 'he', 'dt', 'sdt', 'zalo', 'hotline', 'email', 'goi', 'ngay', 'so', 'dien', 'thoai', 'phone', 'tel', 'mr', 'ms', 'anh', 'chi', 'co', 'a', 'c'])
/** 이미 보이는 연락처의 반복인가: 줄의 번호가 모두 shown에 보이고 번호 밖 글자가 연락 낱말뿐. */
export function contactRepeat(line: string, shown: string[]): boolean {
  const mine = DIGITS(line)
  if (!mine.length) return false
  const seen = new Set(shown.flatMap(DIGITS))
  if (!mine.every((d) => seen.has(d))) return false
  const rest = fold(String(line).replace(/\d[\d .()-]{7,}\d/g, ' ')).split(' ').filter(Boolean)
  return rest.every((w) => CONTACT_WORDS.has(w) || w.length <= 1)
}

/** 원문 줄에 급여 금액(단위가 붙은 숫자 또는 천 단위 숫자)이 있는가. */
export function hasPayAmount(line: string): boolean {
  const f = fold(line)
  return /\d[\d ]*(?:k|tr|trieu|d|vnd|dong)\b/.test(f) || /\d{1,3}(?: \d{3}){1,3}/.test(f) || /\d[\d.,]*\s*(?:k|tr|triệu|đ|vnd)(?![\p{L}])/iu.test(line)   // \b는 ASCII 기준이라 "22 trở"의 tr 뒤 ở를 경계로 봐 급여로 오인했다(2026-11-12 운영 대조 sb-4878·5405) || /\d{1,3}(?:[.,]\d{3}){1,3}/.test(line)
}
/** 식사 혜택 낱말(검사 쪽 사본 — 만드는 쪽 mealBenefit.MEAL_HINT와 일부러 따로 둔다). */
export const MEAL_WORDS = /\b(?:an ca|bua ca|bua an|com trua|com ca|ho tro an|bao an|an trua|phu cap an|tro cap an|ho tro tien an|tien an)\b/
/** 메인 화면 카드가 읽을 수 있는 급여인가(돈 단위가 붙은 금액, 또는 상세에 직무별 급여 행이 있는 직무별 안내). */
export function cardReadableSalary(salary: string | null | undefined, description?: string | null): boolean {
  const s = String(salary ?? '')
  if (/(?:\d[\d.,]*\s*(?:triệu|tr\b|k\b|đồng|dong\b|vn[dđ](?!\p{L})|đ|usd\b)|\$\s*\d)/iu.test(s)) return true
  // 직무별 안내는 상세 description에 "직무 | 금액" 행이 하나라도 있어야 카드에 나온다.
  return /theo vi tri/.test(fold(s)) && String(description ?? '').split(/\r\n|\n|\r/).some((l) => (/\b(?:luong)\b|\d+\s*k\s*\/|trieu/.test(fold(l)) || /\d[\d.,]{4,}\s*(?:đ|vn[dđ]|đồng)\s*\//iu.test(l)) && hasPayAmount(l))
}

/**
 * 상단 제목·회사명 줄의 기대값(R2 #753 검사 독립성): 결정 0007(Lee 2026-11-01) 글을 보고 검사기가 따로 쓴 것 —
 * 화면이 쓰는 companyBranch.detailTitle·companyLine·companyLineBroken을 부르지 않는다(검사가 화면과 같은 함수로 기대값을 만들면 화면이 틀릴 때 같이 합격한다).
 * 결정 0007: ① 제목 앞에 회사명이 이어 붙어 있으면 회사명과 이어 붙은 구분 기호를 떼고 보여 준다(남는 글자가 없으면 원래 제목)
 * ② 회사명 줄: 제목에 회사명이 낱말 단위로 보이면 그 뒤에 남는 부분(지점명)만, 남는 게 없으면 줄 없음, 제목에 회사명이 없으면 회사명 전체. 회사 형태 낱말만으로 된 앞부분은 일치로 보지 않는다.
 */
const LEGAL_FORM = new Set(['cong', 'ty', 'cty', 'tnhh', 'trach', 'nhiem', 'huu', 'han', 'mot', 'thanh', 'vien', 'mtv', 'co', 'phan', 'jsc', 'ltd', 'limited', 'corp', 'corporation'])
export function expectedTitle(title: string | null | undefined, company: string | null | undefined): string {
  const t = String(title ?? '').trim(), c = String(company ?? '').trim()
  if (!t || !c) return t
  const cw = c.split(/\s+/)
  const spans = [...t.matchAll(/\S+/g)]
  if (spans.length <= cw.length || !cw.every((w, i) => fold(spans[i][0]) === fold(w))) return t
  const end = spans[cw.length - 1].index! + spans[cw.length - 1][0].length
  return t.slice(end).replace(/^[\s\-–—:|·,]+/u, '').trim() || t
}
export function expectedCompanyLine(shownTitle: string | null | undefined, company: string | null | undefined): string | undefined {
  const name = String(company ?? '').trim()
  if (!name) return undefined
  const inTitle = ` ${fold(String(shownTitle ?? ''))} `
  const cw = name.split(/\s+/)
  for (let k = cw.length; k >= 1; k--) {
    const head = fold(cw.slice(0, k).join(' '))
    if (!head || head.split(' ').every((w) => LEGAL_FORM.has(w))) continue
    if (head.length >= 2 && inTitle.includes(` ${head} `)) return cw.slice(k).join(' ').replace(/^[\s\-–—,:|]+/u, '').trim() || undefined
  }
  return name
}
/** 화면에 보인 회사 줄이 회사명의 뒷부분인데 앞을 회사 형태 낱말만 또는 낱말 중간에서 잘라 낸 것인가(#5876 "TY TNHH ZHAN AN"). */
export function brokenCompanyLine(shownLine: string | null | undefined, company: string | null | undefined): boolean {
  const name = String(company ?? '').trim(), line = String(shownLine ?? '').trim()
  if (!name || !line || line === name || !name.endsWith(line)) return false
  const cut = name.slice(0, name.length - line.length)
  const removed = fold(cut).split(' ').filter(Boolean)
  return !removed.length || removed.every((w) => LEGAL_FORM.has(w)) || !/[\s\-–—,:|(]$/u.test(cut)
}
