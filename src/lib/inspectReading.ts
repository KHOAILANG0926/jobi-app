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
  return /\d[\d ]*(?:k|tr|trieu|d|vnd|dong)\b/.test(f) || /\d{1,3}(?: \d{3}){1,3}/.test(f) || /\d[\d.,]*\s*(?:k|tr|triệu|đ|vnd)\b/i.test(line) || /\d{1,3}(?:[.,]\d{3}){1,3}/.test(line)
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
