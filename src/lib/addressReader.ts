// 공고 원문에서 근무지 주소 글자를 읽는 단 한 곳 — Lee 2026-11-07 "주소 읽기를 한 곳으로"(급여 salaryReader와 같은 방식).
// 수집기는 원문만 넘기고, 등록 전 위치 확인(locationPrecheck → api/location-hook)이 이 함수로 읽는다.
// 사이트에 주소 칸이 따로 있는 소스(TopCV 등)는 그 칸을 먼저 쓴다(이 함수는 주소 칸이 없을 때만).
// 빠진 주소를 발견하면: 이 함수 확인 → addressReader.test.ts에 그 공고 사례 추가 → 여기서 고침 → 예전 사례 모두 통과해야 병합.
// 읽는 순서: ① 이름표 붙은 주소 줄 ② 이름표 없는 주소 줄 ③ 동·구·도로 조각.
import { ADMINISTRATIVE_AREAS } from './administrativeArea'
import { normalizePlaceText } from './locationCandidateMatch'
import { KIND, postBody } from './companyReader'

const WORD = '\\p{L}\\p{N}_'
// ① "Địa điểm: Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh" — 그 줄 값을 그대로(번지 포함). Lee 2026-10-30 #5157.
const LABELED = new RegExp(`^[^${WORD}\\n]*(?:địa điểm|địa chỉ)(?: làm việc)?\\s*[:：]\\s*([^\\n]{6,160})$`, 'imu')
// ② 이름표 없는 주소 줄 "Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh" — 쉼표 2~6칸, 160자 이하, 끝 칸이 원래 성 이름. Lee 2026-11-07 #5599.
//    모집·급여·연락 낱말이 있는 줄은 주소가 아니다(제목·급여 줄을 주소로 잡지 않게).
const NOT_ADDRESS = /tuyển|tuyen|lương|luong|triệu|trieu|thu nhập|thu nhap|liên hệ|lien he|zalo|ứng tuyển|ung tuyen|yêu cầu|yeu cau|ca ngày|ca đêm|\d{4,}/iu
const PROVINCES = new Set(ADMINISTRATIVE_AREAS.flatMap((a) => a.aliases))
// ③ 동·구·도로 조각(한 줄 안에서만 — 줄바꿈을 넘어 다음 줄 매장 주소까지 붙이지 않게, #633 Circle K). "khu vực làm việc"(소제목)는 지역 아님(2026-10-30 #5157).
const FRAGMENT = new RegExp(
  `(?:quận|q\\.|huyện|thành phố|tp\\.)\\s*[\\d${WORD} ]{1,20}|` +
  `(?:phường|p\\.|xã|thị trấn)\\s*[${WORD} ]{1,20}|` +
  `(?:đường|ngõ|ngách|khu(?!\\s+vực)|kp)\\s+[${WORD} \\d]{2,30}|` +
  // 공단 이름 "KCN QUẾ VÕ 2"(제목 줄 "CÔNG TY JMT KCN QUẾ VÕ 2", #633) — 그 줄 안에서만, 뒤 구인 낱말은 뗀다
  `(?:kcn|ccn)\\s+[${WORD} ]{2,30}`, 'giu')
const FRAGMENT_TAIL = // 공단 조각에만(동·구 이름 "huyện Cần Giờ"는 그대로, Codex #663)
  /\s+(?:tuyển|tuyen|cần|lương|thu nhập|làm|liên hệ)(?=\s|$).*$/iu

const trimDots = (s: string) => s.replace(/^[ .]+|[ .]+$/g, '')

function unlabeledLine(text: string): string {
  for (const raw of text.split('\n')) {
    let line = trimDots(raw.replace(new RegExp(`^[^${WORD}]+`, 'u'), '').trim())
    const colon = line.split(',', 1)[0].match(/[:：]/)
    if (colon) line = trimDots(line.slice(line.indexOf(colon[0]) + 1)) // "Làm việc tại: …" 앞 이름표는 떼고 주소만
    // 이름표 뒤 값은 띄어 쓴 대시도 칸 구분("Làm việc tại: Nam Sơn / Quế Võ 1 - Bắc Ninh", #633 GOERTEK).
    // 이름표 없는 줄(제목 "… – BẮC NINH")에는 적용하지 않는다.
    if (colon) line = line.replace(/\s+[-–]\s+/gu, ', ')
    const parts = line.split(',').map((x) => x.trim()).filter(Boolean)
    if (parts.length < 2 || parts.length > 6 || line.length > 160 || NOT_ADDRESS.test(line)) continue
    const last = parts[parts.length - 1].replace(/^(?:tỉnh|tinh|thành phố|tp\.?)\s+/iu, '')
    if (PROVINCES.has(normalizePlaceText(last).replace(/\s+/g, ' ').trim())) return line
  }
  return ''
}

/** 원문에서 근무지 주소 글자. 없으면 ''. */
export function readAddress(sourceText: string): string {
  const text = postBody(String(sourceText ?? '').normalize('NFC')) // 댓글(다른 사람 글)은 읽지 않는다(#560)
  const labeled = text.match(LABELED)
  if (labeled) {
    // "Địa chỉ: Nhà hàng Seoseo Galbi" + 다음 줄 "213 Ngọc Hân Công Chúa, …": 값에 번지가 없고 다음 줄이 번지로 시작하면 그 줄이 주소(#560)
    const value = trimDots(labeled[1].trim())
    const next = text.slice((labeled.index ?? 0) + labeled[0].length).split('\n').map((l) => l.trim()).find(Boolean) ?? ''
    // 바꾸는 조건(Codex #616): 값이 가게 이름(가게 낱말로 시작)이고, 다음 줄이 번지로 시작하며 쉼표로 나뉜 주소 근거(동·구·거리·성 이름)가 있을 때만.
    const nextParts = next.split(',').map((x) => x.trim()).filter(Boolean)
    const nextIsAddress = /^(?:số\s*)?\d+[\p{L}]?(?:\/\d+)?\s+\p{L}/iu.test(next) && nextParts.length >= 2 && next.length <= 160 &&
      !NOT_ADDRESS.test(next.replace(/^(?:số\s*)?\d+[^\s]*/iu, '')) &&
      (/(?:phường|xã|quận|huyện|thị xã|thị trấn|tp\.?|thành phố|tỉnh|đường|phố)\s/iu.test(next) || PROVINCES.has(normalizePlaceText(nextParts[nextParts.length - 1]).replace(/^(?:tinh|thanh pho|tp) /, '')))
    if (!/\d/.test(value) && new RegExp(`^${KIND}\\s`, 'iu').test(value) && nextIsAddress) return trimDots(next)
    return value
  }
  const line = unlabeledLine(text)
  if (line) return line
  // 매장 줄이 2곳 이상이면(성 이름 없는 "CN 1: 152 …, Phường Kinh Bắc" 목록) 동 이름 조각을 이어 붙인 가짜 주소 대신 첫 매장 줄(Codex #697)
  const stores = storeLines(text)
  if (stores.length >= 2) return stores[0]
  // ③ 조각: 동·구·도로·공단(FRAGMENT) + 가게 이름 바로 뒤 번지+거리("Cửa hàng Jollibee 393 Trần Hưng Đạo", #633 —
  //    거리 이름을 대문자로 알아봐야 해서 대소문자 무시인 FRAGMENT에는 못 넣고 같은 조각 목록에 앞에 둔다)
  const shopStreets = text.split('\n').flatMap((l) => {
    const k = l.match(new RegExp(KIND, 'iu'))
    const m = k && l.slice((k.index ?? 0) + k[0].length).match(/^[^,\n]*?\s(\d{1,4}\p{L}?(?:\/\d+)*\s+\p{Lu}\p{Ll}*(?:\s+\p{Lu}\p{Ll}*){1,3})/u)
    return m ? [m[1]] : []
  })
  const parts = [...shopStreets, ...[...text.matchAll(FRAGMENT)].map((m) => m[0].trim()).map((m) => (/^(?:kcn|ccn)\s/iu.test(m) ? m.replace(FRAGMENT_TAIL, '') : m))].filter((m) => m.length > 2)
  return [...new Set(parts.slice(0, 3))].join(', ')
}

// 매장(근무지)이 여러 곳인 글(Lee 2026-11-11 KRIK 2곳·MediaMart 4곳 — 핀이 첫 곳만 찍힘): 첫 주소(readAddress) 다음에
// 다른 줄에 적힌 매장 주소도 읽는다. 매장 주소 줄 = 번지+거리 또는 거리·국도·khu phố·thôn 낱말이 있고, 쉼표(띄어 쓴 대시)로 2칸 이상,
// 끝 칸이 원래 성 이름이거나 동·구 낱말이 있는 줄. 앞 이름표("CN Từ Sơn:")와 끝 "Việt Nam"은 뗀다. 첫 주소와 같은 곳(포함)은 뺀다.
const STORE_MARK = /(?:^|[\s,])(?:số\s*)?\d{1,4}\p{L}?(?:\/\d+)*\s+\p{L}|(?:^|[\s,])(?:đường|phố|quốc lộ|ql\.?|khu phố|kp\.?|thôn|tòa|toà)\s/iu
const UNIT_MARK = /(?:^|[\s,])(?:phường|p\.|xã|quận|q\.|huyện|thị xã|thị trấn|tp\.?|thành phố|khu phố)\s/iu
const placeKey = (s: string) => normalizePlaceText(s).replace(/[^a-z0-9]+/g, ' ').trim()
// 같은 매장 = 한 주소가 다른 주소를 낱말 단위로 통째로 포함(가게 이름 + 같은 주소). 낱말 중간은 안 본다 — 12번지 ≠ 112번지(Codex #697).
const sameStore = (a: string, b: string) => ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `)
function storeLine(raw: string): string {
  let line = trimDots(raw.replace(new RegExp(`^[^${WORD}]+`, 'u'), '').trim())
  const colon = line.split(',', 1)[0].match(/[:：]/)
  if (colon) line = trimDots(line.slice(line.indexOf(colon[0]) + 1))
  line = line.replace(/\s+[-–]\s+/gu, ', ').replace(/,\s*(?:việt nam|vietnam)\s*$/iu, '').trim()
  const parts = line.split(',').map((x) => x.trim()).filter(Boolean)
  if (parts.length < 2 || line.length > 160 || NOT_ADDRESS.test(line.replace(/quốc lộ\s*\d+/giu, '')) || !STORE_MARK.test(line)) return ''
  const last = normalizePlaceText(parts[parts.length - 1].replace(/^(?:tỉnh|tinh|thành phố|tp\.?)\s+/iu, '')).replace(/\s+/g, ' ').trim()
  return PROVINCES.has(last) || UNIT_MARK.test(line) ? parts.join(', ') : ''
}

function storeLines(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const a = storeLine(raw)
    const k = a && placeKey(a)
    if (k && !out.some((x) => sameStore(placeKey(x), k))) out.push(a)
  }
  return out
}

/** 원문의 근무지 주소 목록(최대 5곳). 첫 번째는 readAddress와 같다. 주소가 없으면 []. */
export function readAddresses(sourceText: string): string[] {
  const first = readAddress(sourceText)
  if (!first) return []
  const out = [first]
  const keys = [placeKey(first)]
  for (const a of storeLines(postBody(String(sourceText ?? '').normalize('NFC')))) {
    if (out.length >= 5) break
    const k = placeKey(a)
    if (keys.some((x) => sameStore(x, k))) continue
    out.push(a); keys.push(k)
  }
  return out
}

// 매장 주소에 이미 성 이름이 있으면(다른 성 지점 포함) 수집 그룹 지역을 붙이지 않는다 — 다른 성 매장이 그룹 성으로 찍히지 않게(Codex #697).
export const hasProvince = (a: string) => {
  const last = a.split(',').map((x) => x.trim()).filter(Boolean).pop() ?? ''
  return PROVINCES.has(normalizePlaceText(last.replace(/^(?:tỉnh|tinh|thành phố|tp\.?)\s+/iu, '')).replace(/\s+/g, ' ').trim())
}

/** 위치 확인에 쓸 위치 글자 목록: 매장마다 원문 주소 + 수집 그룹 지역. 첫 번째는 readLocationText와 같다. */
export function readLocationTexts(sourceText: string, region = ''): string[] {
  const r = String(region ?? '').trim()
  // 첫 매장은 지금까지와 같은 위치 글자(readLocationText), 다른 매장은 성 이름이 없을 때만 지역을 붙인다.
  const list = readAddresses(sourceText).map((a, i) => (i === 0 ? readLocationText(sourceText, region) : hasProvince(a) ? a : [a, r].filter(Boolean).join(', ')))
  return list.length ? list : [readLocationText(sourceText, region)].filter(Boolean)
}

/** 위치 확인에 쓸 위치 글자: 원문 주소 + (원문에 이름이 있는) 수집 그룹 지역. */
export function readLocationText(sourceText: string, region = ''): string {
  return [readAddress(sourceText), String(region ?? '').trim()].filter(Boolean).join(', ')
}
