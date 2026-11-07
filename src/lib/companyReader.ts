// 공고 원문에서 회사(업체) 이름을 읽는 단 한 곳 — Lee 2026-11-07 "회사 이름 규정"(주소 addressReader·급여 salaryReader와 같은 방식).
// 수집기는 이 함수를 위치 확인 서버를 통해 쓴다(직접 읽지 않음). 잘못 읽은 공고는 companyReader.test.ts에 사례 추가 → 여기 고침.
// 찾는 순서: ① 이름표 줄 "Công ty: …" ② "CÔNG TY/CTY …"로 시작하는 줄 ③ 가게 낱말 바로 뒤 이름(같은 줄 안에서만)
//            ④ "tại + 이름"(Việc làm tại VINAMILK) ⑤ 제목 대시 뒤 ⑥ "… tuyển dụng" 앞(첫 줄들)
// 버림: 구인 글 낱말·숫자·금액·지역·나라·공단 낱말만으로 된 후보, 홍보 문장(!/? 끝), 60자 넘음.
// 못 찾으면 ''(→ 그 공고는 수집하지 않음, Lee 2026-11-07). 소개소(인력 회사)는 그 이름을 회사로 쓰고 agency=true
// (공고 '채용 형태' 칸 recruitment_type='agency' — 화면 "Qua công ty cung ứng". 소개소 판정: 이름 인력 낱말+다른 근무지, 또는 다른 회사를 위해 뽑는 문구,
//  또는 위치 확인 서버가 본 전화번호 기록(같은 번호가 다른 회사 이름으로 쓰임, locationPrecheck.agencyByPhone)).
import { fold } from './jobIdentity'
import { ADMINISTRATIVE_AREAS } from './administrativeArea'

// 구인 글에 늘 나오는 낱말(접은 글자). 이 낱말·숫자만으로 된 후보는 회사 이름이 아니다.
const JOB_WORDS = new Set((
  'tuyen dung gap can them lien tuc nhieu so luong vi tri nhan vien nv lao dong ldpt ld pho thong cong nhan viec lam thoi vu chinh thuc ' +
  'part time parttime fulltime full luong co ban thu nhap trieu tr k vnd d dong ngay thang tuan gio h ca dem sang chieu toi ' +
  'nam nu va hoac cho cua tai o tu den tren duoi voi la co khong ko kg nhan ca nguoi ban anh chi em ae moi cac ' +
  'nhe de don gian lam ngoi phong thuong on dinh lau dai hap dan tot cao hot nong gap thong bao co hoi nganh san xuat ' +
  'dao tao hoc vien hoc chua biet ung vien ung tuyen lien he zalo sdt dt bao an o ho tro phu cap thuong kinh nghiem yeu cau ' +
  'mien phi phi xe dua don ky tuc xa ktx tang ca giu khong nuoi tra tuan quan ly bo phan dong goi boc xep phu xe giao hang ban hang ' +
  'phuc vu tap vu bep ky thuat vien tho cty company truong pho dong doi team doi ngu kiem chung toi minh ho'
).split(/\s+/))
// 나라·공단 낱말(회사 이름이 아니라 소개 글에 붙는 말)
// 가게 종류 낱말만으로는 이름이 아니다("Shop", "Nhà hàng")
const NOT_NAME_PHRASES = ['cafe', 'ca phe', 'coffee', 'tra sua', 'quan an', 'cua hang', 'nha hang', 'thuong mai', 'dien may', 'sieu thi', 'trung tam', 'khach san', 'shop', 'quan', 'tiem', 'salon', 'hotel', 'xuong', 'spa', 'nha', 'han quoc', 'trung quoc', 'nhat ban', 'nhat', 'dai loan', 'viet nam', 'kcn', 'ccn', 'khu cong nghiep', 'cum cong nghiep', 'thanh pho', 'tp', 'tinh', 'quan', 'huyen', 'phuong', 'xa', 'thi xa', 'thi tran']
const REGION_PHRASES = [...new Set(ADMINISTRATIVE_AREAS.flatMap((a) => a.aliases))].sort((a, b) => b.length - a.length)

/** 회사 이름이 될 수 있는 낱말이 하나라도 남는가(구인 낱말·숫자·지역·나라·공단 낱말 제외). */
export function hasNameWord(candidate: string): boolean {
  let s = ` ${fold(candidate).replace(/[^a-z0-9]+/g, ' ')} `
  for (const p of [...NOT_NAME_PHRASES, ...REGION_PHRASES]) s = s.split(` ${p} `).join(' ')
  return s.split(/\s+/).some((w) => w && !JOB_WORDS.has(w) && !/\d/.test(w) && w.length > 1)
}

const MAX = 60
function clean(c: string): string {
  return c.replace(/\s{2,}/g, ' ').replace(/^[\s\-–•*:|]+|[\s\-–•*:|,.]+$/g, '').trim()
}
function ok(c: string): string {
  const v = clean(c)
  if (!v || v.length > MAX || /[!?]$/.test(v) || !hasNameWord(v)) return ''
  return v
}

// 항목 이름표 줄(근무 지역·위치·직무 등)의 값은 회사 이름 후보로 보지 않는다(#4878 "Khu vực làm việc: siêu thị / trung tâm thương mại …")
const LABEL_LINE = /^(?:khu vực(?: làm việc)?|địa điểm(?: làm việc)?|địa chỉ|vị trí(?: tuyển dụng)?|công việc|mô tả|yêu cầu|quyền lợi|thời gian|liên hệ)(?:\s*\([^)]*\))?\s*[:：]/iu
const EMOJI = /[\u{1F000}-\u{1FAFF}☀-➿️‍]+/gu
const KIND = '(?:cửa hàng|quán|nhà hàng|shop|siêu thị|spa|tiệm|salon|trung tâm|khách sạn|hotel|xưởng)'
const AGENCY = /nhan luc|cung ung|tuyen dung ho|xuat khau lao dong|viec lam|manpower|\bhr\b|headhunt/
const WORKPLACE = /nha may|xuong|kcn|ccn|khu cong nghiep|cum cong nghiep|cong ty [a-z]/
// 다른 회사를 위해 뽑는 문구(Lee 2026-11-07 5번 A): 이름에 인력 낱말이 없어도 소개소로 본다.
const FOR_OTHER = /tuyen (?:\S+ ){0,4}cho (?:cong ty|cty|nha may|xuong|cac|nhieu)|cung (?:cap|ung) (?:lao dong|nhan luc|cong nhan)|(?:cac|nhieu) (?:cong ty|nha may) (?:trong|tai|o) (?:kcn|ccn|khu cong nghiep)/
const FEE = /phi tuyen|thu phi|dat coc|\bcoc\b|le phi|phi ho so|mat phi/
const NO_FEE = /khong (?:thu )?(?:mat )?phi|mien phi|khong (?:dat )?coc|0 ?d phi|free/

export interface CompanyRead { name: string; agency: boolean; fee: boolean }

/** 원문(여러 줄)에서 회사 이름. 못 찾으면 name=''. */
export function readCompany(text: string): CompanyRead {
  const src = String(text ?? '').normalize('NFC')
  const lines = src.split('\n').map((l) => clean(l.replace(EMOJI, ' '))).filter(Boolean)
  const pick = (): string => {
    // ⓪ 첫 줄이 이름만 있는 짧은 줄(#4982 "Bomunttl" — 다음 줄 "Nhà hàng nướng"): 구인 낱말·가게 종류뿐이 아니고 4낱말 이하
    if (lines[0] && lines[0].split(/\s+/).length <= 4 && !/[:：!?]/.test(lines[0]) && ok(lines[0])) return ok(lines[0])
    // ① 이름표 줄
    for (const l of lines) {
      const m = l.match(/^(?:tên )?(?:công ty|cty|đơn vị|nhà tuyển dụng|doanh nghiệp)\s*[:：]\s*(.+)$/iu)
      if (m && ok(m[1])) return ok(m[1])
    }
    // ② "CÔNG TY/CTY …"로 시작하는 줄(앞 8줄) — 뒤에 붙은 "– TUYỂN …"·"tuyển …"·주소는 뗀다
    for (const l of lines) {
      if (!/^(?:công ty|cty)\b/iu.test(l) || /^(?:công ty|cty)\s+(?:có|hỗ trợ|được|sẽ|luôn|cam kết)(?=\s|$)/iu.test(l)) continue
      const c = l.replace(/\s*[-–|]?\s*(?:đang\s+)?(?:cần tuyển|tuyển dụng|tuyển gấp|tuyển|tuyen)\b.*$/iu, '')
        .replace(/\s*[-–]\s*(?:số|sn)?\s*\d.*$/iu, '')
      if (ok(c)) return ok(c)
    }
    // ③ 가게 낱말 바로 뒤 이름(같은 줄 안)
    for (const l of lines) {
      if (LABEL_LINE.test(l)) continue
      const m = l.match(new RegExp(`(${KIND})\\s+([^,.!?:\\n]{2,60})`, 'iu'))
      if (!m) continue
      const c = m[2].replace(/\s*[-–]?\s*(?:đang\s+)?(?:cần tuyển|tuyển dụng|tuyển|tìm|mới khai trương)(?=\s|[:：!–-]|$).*$/iu, '')
      if (ok(c)) return ok(`${m[1]} ${c}`)
    }
    // ④ "tại + 이름"(Việc làm tại VINAMILK - BẮC NINH)
    for (const l of lines.slice(0, 3)) {
      const m = l.match(/(?:việc làm|làm việc|tuyển dụng|cơ hội)\s+tại\s+([^,.!?\n]{2,60})/iu)
      if (!m) continue
      const c = m[1].replace(new RegExp(`^${KIND}\\s*[:：]\\s*`, 'iu'), '').replace(/\s*[-–]\s*.*$/u, '')
      if (ok(c)) return ok(c)
    }
    // ⑤ 제목 대시 뒤("TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH")
    for (const l of lines.slice(0, 2)) {
      const m = l.match(/^(?:tuyển|tuyen|tuyển dụng|tuyển gấp|cần tuyển)\b.*?\s[–-]\s+(.{3,80})$/iu)
      if (m && ok(m[1])) return ok(m[1])
    }
    // ⑥ "… TUYỂN DỤNG" 앞(첫 4줄)
    for (const l of lines.slice(0, 4)) {
      if (!/tuyển dụng|cần tuyển|tuyển\b|tìm đồng đội|tìm kiếm/iu.test(l)) continue
      const c = l.replace(/\s*[-–]?\s*(?:đang\s+)?(?:cần tuyển|tuyển dụng|tuyển gấp|tuyển|tìm đồng đội|tìm kiếm)(?=\s|[:：!–-]|$).*$/iu, '').replace(/\s*thông báo\s*$/iu, '')
      if (ok(c)) return ok(c)
    }
    return ''
  }
  const name = pick()
  const all = fold(src)
  const agency = !!name && ((AGENCY.test(fold(name)) && WORKPLACE.test(all.replace(fold(name), ' '))) || FOR_OTHER.test(all))
  const fee = FEE.test(all) && !NO_FEE.test(all)
  return { name, agency, fee }
}
