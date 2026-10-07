// Chợ Tốt 박닌 수집 결과(out/ct_res_*.json, bn_collect_chotot_ext.js 산출) → 검토용 CSV. DB 쓰기 없음, 원문 URL은 CSV에 넣지 않는다.
// 실행: node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_build_chotot_csv.mjs [--target=100]
// 열: "근무 회사"(실제 일하는 회사)와 "게시자"(공고를 올린 계정/회사)를 분리한다. 대기업·브랜드(Samsung·Coca-Cola·Amphenol…)는 대행사가 아니라 근무 회사.
// 제외 규칙(애매하면 제외 쪽): 연락처 없음 / 회사명 없음·개인명 / 옛 박장 / 대행사인데 근무 회사·KCN 근거 없음 / 내부 중복 / 같은 근무 회사 3번째부터.
import fs from 'node:fs'
import { findIndustrialPark, foldText } from '../../src/lib/industrialPark.ts'

const dir = 'scripts/research/out/'
const LIMIT = Number((process.argv.find(a => a.startsWith('--target=')) ?? '--target=100').slice(9))
const rec = {}
for (const f of fs.readdirSync(dir).filter(f => /^ct_res_.*\.json$/.test(f)).sort()) Object.assign(rec, JSON.parse(fs.readFileSync(dir + f, 'utf8')))
// 수집 텍스트가 NFD(결합 문자)일 수 있어 NFC로 맞춘 뒤 정규식 비교
const nfc = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.normalize('NFC') : v]))
const rows = Object.entries(rec).map(([id, r]) => ({ id, ...nfc(r) })).sort((a, b) => Number(b.id) - Number(a.id))

const OLD_BG = /Bắc Giang|Việt Yên|Yên Dũng|Hiệp Hòa|Tân Yên|Lạng Giang|Lục Nam|Lục Ngạn|Sơn Động|Yên Thế/i
const BIZ = /công ty|cty|tnhh|cổ phần|\bcp\b|jsc|corp|co\.?,? ?ltd|group|tập đoàn|nhà máy|xí nghiệp|xưởng|hợp tác xã|express|logistics|school|trường|bệnh viện|ngân hàng|\bbank\b|siêu thị|cửa hàng|shop|store|coop|mart|hotel|khách sạn|nhà hàng|restaurant|spa|salon|clinic|phòng khám|studio|agency|solutions?|technology|electronics|vina|việt nam|viet ?nam|international|industrial|plastic|packaging|\bkho\b/i
// 대행사(인력·채용 대행)만. 대기업·브랜드는 포함하지 않는다.
const AGENCY = /nhân lực|nhân sự|tuyển dụng|dụng tuyển|việc làm|lao động|cung ứng|outsourc|\bhr\b|manpower|staffing|talent|\brrd\b|\bgrgr\b|adtek|sức bật|almustech/i
// 대행 공고 본문에서 실제 근무 회사 추출: 알려진 대기업·브랜드 또는 '공단/회사/nhà máy + 이름'
const BRAND = /samsung|canon|amphenol|foxconn|goertek|luxshare|coca[ -]?cola|pepsi|mondelez|kinh đô|nestl[eé]|hyundai|\blg\b|panasonic|sunny|fuji|yuzhan|avery dennison|\baqua\b|pizza hut|jollibee|lotte|vinfast|viettel|techcombank|bosch|toyota|honda|yamaha|brother|nidec|sharp|kyocera|ricoh|pegatron|compal|wistron|\bflex\b|jabil|ibiden|murata|taiyo|daikin|haier/i
const NAMED = /(?:công ty|cty|nhà máy)[ \t]+(?:tnhh|cp|cổ phần)?[ \t]*([A-ZÀ-Ỹ][\p{L}0-9&.-]*(?: [A-ZÀ-Ỹ][\p{L}0-9&.-]*){0,4})/u
const HEADING = /^(yêu|mô|quyền|thông|mức|lương|địa|làm|tuyển|cần|chế|phúc|điều|nơi|số|ưu|nhận|có|là|cung|đang|hỗ|được|chuyên|và|nhà|trả|đãi|thời|ngành|vị)/i
const NEAR_KCN = /(?:gần|cạnh|đối diện|sát|lân cận|gần khu)\s+(?:KCN|khu công nghiệp|cụm công nghiệp)[^\n,.;]{0,30}/giu  // '근처' 표현은 근무지 근거가 아니다
// 표에 없는 KCN 표기를 본문에서 이름째로 읽는다('KCN Quế võ 3- P Quế Võ' → 'KCN Quế võ 3'). 주소 단어(Phường·Bắc Ninh·Số…)에서 끊는다.
const KCN_STOP = /^(bắc|p|phường|xã|huyện|tp|thị|số|lô|tại|cần|tuyển|địa|đường|thuộc|thôn|làm|lương|có|và|nhà|công|từ|ngày|ca|hà|thái|hải|ninh|giang|nội)$/i
const kcnNameFromText = t => {
  const m = /(?:^|[\s(])(KCN|khu công nghiệp)\s+([\p{L}0-9]+(?:[ \t]+[\p{L}0-9]+){0,4})/iu.exec(t)
  if (!m) return ''
  const words = []
  for (const w of m[2].split(/[ \t]+/)) { if (KCN_STOP.test(w)) break; words.push(w); if (/^rộng$/i.test(w)) break }
  return words.length ? `${/^kcn$/i.test(m[1]) ? 'KCN' : 'Khu công nghiệp'} ${words.join(' ')}` : ''
}
const workCompanyFrom = (text, poster) => {
  const b = BRAND.exec(text); if (b) return b[0]
  const m = NAMED.exec(text), n = m && m[0].trim()
  // 소제목('Công ty Yêu cầu…', 'Mô tả…')을 회사명으로 잡지 않는다
  return n && !HEADING.test(m[1]) && foldText(n) !== foldText(poster) && !AGENCY.test(n) ? n : ''
}
// 개인명 판정(보수적): 베트남 성씨·흔한 이름으로 시작하는 2~5단어, 대문자 3자 이상 토큰 없음, 상호 키워드 없음. 3자 이하 상호('a','Hip')도 상호 불명으로 제외.
const PERSON = /^(nguyễn|trần|lê|phạm|hoàng|huỳnh|phan|vũ|võ|đặng|bùi|đỗ|hồ|ngô|dương|lý|đinh|lương|trịnh|nông|hiệp|vinh|anh|phương|sơn|an|ánh|hip|minh|thu|hà|lan|hương|linh|trang|tuấn|hùng|dũng|nam|long)(\s+\S+){1,4}$/i
// 근무지 라벨 줄에 박닌이 아닌 다른 성이 있으면(박닌 근무지 아님·다성 모집) 제외
const OTHER_PROV = /Hà Nội|Hải Phòng|Hưng Yên|Thái Nguyên|Hải Dương|Vĩnh Phúc|Phú Thọ|Hồ Chí Minh|HCM|Bình Dương|Đà Nẵng|Quảng Ninh|Nam Định|Thanh Hóa|Lạng Sơn|Hà Nam|Ninh Bình/i
const WORKLINE = /địa chỉ|địa điểm|nơi làm việc|làm việc tại|📍|khu vực/i
const otherProvinceWorksite = t => t.split('\n').some(l => WORKLINE.test(l) && OTHER_PROV.test(l) && !/Bắc Ninh/i.test(l))
const PLACEHOLDER = /nhà tuyển dụng|ẩn danh|không rõ/i

const perCompany = {}, out = [], seen = new Set(), stats = {}
const bump = k => { stats[k] = (stats[k] ?? 0) + 1 }
for (const r of rows) {
  const poster = (r.co || '').trim()
  const text = [r.sub, r.addr, r.body].join('\n')
  const kcnText = text.replace(NEAR_KCN, ' ')
  const park = findIndustrialPark(r.addr + ' ' + r.body.replace(NEAR_KCN, ' '), r.sub)
  const kcnInText = park?.name || kcnNameFromText(kcnText)
  const agency = AGENCY.test(poster) || AGENCY.test(r.acc || '')
  // 근무 회사: 대행사면 본문에서 추출한 회사(없으면 비움), 아니면 게시 회사 자체
  let work = agency ? workCompanyFrom(text, poster) : poster
  const looksPerson = (poster.length <= 3 && !BRAND.test(poster) && !AGENCY.test(poster)) || (!BIZ.test(poster) && !agency && !/[A-ZĐ]{3,}/.test(poster) && PERSON.test(poster))
  let reason = ''
  if (!r.ok) reason = '상세 데이터 없음(재방문 필요)'
  else if (!r.ph) reason = '연락처 없음'
  else if (!poster || PLACEHOLDER.test(poster)) reason = '회사명 없음'
  else if (looksPerson) reason = '회사명 없음(개인명·상호 불명)'
  else if (OLD_BG.test(text)) reason = '옛 박장 지역'
  else if (otherProvinceWorksite(text)) reason = '다른 성 근무지(박닌 아님·다성 모집)'
  else if (agency && !work && !kcnInText) reason = '대행사·근무 회사/KCN 근거 없음'
  // 중복 기준 = 회사 + 제목 + 전화(DB 반영 시 중복 확인과 같은 기준)
  const key = foldText((work || poster) + '|' + r.sub + '|' + r.ph)
  if (!reason && seen.has(key)) reason = '수집분 내부 중복'
  if (!reason) {
    const ck = foldText(work || kcnInText || poster)
    perCompany[ck] = (perCompany[ck] ?? 0) + 1
    if (perCompany[ck] > 2) reason = '같은 근무 회사 3번째 이후(최대 2건)'
  }
  if (!reason) seen.add(key)
  if (!reason && out.filter(o => !o.excluded).length >= LIMIT) reason = `목표 ${LIMIT}건 초과분(보류)`
  out.push({ id: r.id, work: work || (agency ? '(대행사 공고 — KCN 근거)' : ''), poster, agency: agency ? 'Y' : 'N', title: r.sub, salary: r.sal, address: r.addr, kcn: park?.name ?? kcnInText, contact: r.ph, hasContact: r.ph ? 'Y' : 'N', source: 'Chợ Tốt', posted: r.date, collected: new Date().toISOString().slice(0, 10), excluded: reason })
  bump(reason ? 'x:' + reason : 'ok')
}
fs.writeFileSync(dir + 'bacninh_chotot_rows.json', JSON.stringify(out.map((o, i) => ({ ...o, body: rows[i].body })), null, 1))  // 내부용(id·본문 포함, CSV와 달리 gitignore 폴더)
const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
const cols = ['work', 'poster', 'agency', 'title', 'salary', 'address', 'kcn', 'contact', 'hasContact', 'source', 'posted', 'collected', 'excluded']
const head = ['근무 회사', '게시자', '대행사 여부', '직무', '급여', '근무지(주소)', 'KCN 매칭', '연락처', '연락처 유무', '출처 사이트', '게시 시점', '수집일', '제외 사유']
fs.writeFileSync(dir + 'bacninh_chotot_review.csv', '﻿' + [head.join(','), ...out.map(o => cols.map(c => esc(o[c])).join(','))].join('\r\n'))
console.log(JSON.stringify(stats, null, 1))
const ok = out.filter(o => !o.excluded)
console.log('채택(연락처 있음):', ok.length, '/ KCN 매칭:', ok.filter(o => o.kcn).length, '/ 대행사 게시:', ok.filter(o => o.agency === 'Y').length, '/ 전체 방문:', rows.length)
