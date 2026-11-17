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
  'part time parttime partime pasttime fulltime full luong co ban thu nhap trieu tr k vnd d dong ngay thang tuan gio h ca dem sang chieu toi ' +
  'nam nu va hoac cho cua tai o tu den tren duoi voi la co khong ko kg nhan ca nguoi ban anh chi em ae moi cac ' +
  'nhe de don gian lam ngoi phong thuong on dinh lau dai hap dan tot cao hot nong gap thong bao co hoi nganh san xuat ' +
  'dao tao hoc vien hoc chua biet ung vien ung tuyen lien he zalo sdt dt bao an o ho tro phu cap thuong kinh nghiem yeu cau ' +
  'mien phi phi xe dua don ky tuc xa ktx tang ca giu khong nuoi tra tuan quan ly bo phan dong goi boc xep phu xe giao hang ban hang ' +
  'phuc vu tap vu bep ky thuat vien tho cty company truong pho dong doi team doi ngu kiem chung toi minh ho'
).split(/\s+/))
// 나라·공단 낱말(회사 이름이 아니라 소개 글에 붙는 말)
// 가게 종류 낱말만으로는 이름이 아니다("Shop", "Nhà hàng")
// 자기 가게를 부르는 말("nhà mình", "bên em")·'수요 있음' 문구는 이름이 아니다(#633 2026-11-10 dryrun)
const NOT_NAME_PHRASES = ['quan net', 'tiem net', 'nha minh', 'ben minh', 'ben em', 'ben toi', 'chung em', 'hien co nhu cau', 'nhu cau', 'gan tet', 'truoc tet', 'sau tet', 'cuoi nam', 'dau nam', 'khu vuc', 'bang tin', 'thuong hieu', 'he thong', 'cafe', 'ca phe', 'coffee', 'tra sua', 'quan an', 'cua hang', 'nha hang', 'thuong mai', 'dien may', 'sieu thi', 'trung tam', 'khach san', 'shop', 'quan', 'tiem', 'salon', 'hotel', 'xuong', 'spa', 'nha', 'han quoc', 'trung quoc', 'nhat ban', 'nhat', 'dai loan', 'viet nam', 'kcn', 'ccn', 'khu cong nghiep', 'cum cong nghiep', 'thanh pho', 'tp', 'tinh', 'quan', 'huyen', 'phuong', 'xa', 'thi xa', 'thi tran']
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
  if (!v || v.length > MAX || /[!?]$/.test(v) || !hasNameWord(v) || /^(?:cong ty|cty)(?: (?:tnhh|cp|co phan))?$/.test(fold(v))) return '' // "Công ty"만은 이름이 아니다
  // "CÔNG TY MÌNH"(자기 회사를 부르는 말, #633): 성조 붙은 'mình'만 — 접기 전에 봐야 이름 "Công ty Minh Anh"를 살린다(Codex #663)
  if (/^(?:công ty|cty)\s+mình(?=\s|$)/iu.test(v)) return ''
  return v
}

// 항목 이름표 줄(근무 지역·위치·직무·지원 양식 "Gửi thông tin: Họ tên – SĐT – Cửa hàng làm việc" 등)의 값은 회사 이름 후보로 보지 않는다(#4878 "Khu vực làm việc: siêu thị / trung tâm thương mại …")
const LABEL_LINE = /^(?:khu vực(?: làm việc)?|cửa hàng làm việc|gửi thông tin|cú pháp|địa điểm(?: làm việc)?|địa chỉ|vị trí(?: tuyển dụng)?|công việc|mô tả|yêu cầu|quyền lợi|thời gian|liên hệ)(?:\s*\([^)]*\))?\s*[:：]/iu
const EMOJI = /[\u{1F000}-\u{1FAFF}☀-➿️‍]+/gu
export const KIND = '(?:cửa hàng|quán|nhà hàng|shop|siêu thị|spa|tiệm|salon|trung tâm|khách sạn|hotel|xưởng)'
const AGENCY = /nhan luc|cung ung|tuyen dung ho|xuat khau lao dong|viec lam|manpower|\bhr\b|headhunt/
const WORKPLACE = /nha may|xuong|kcn|ccn|khu cong nghiep|cum cong nghiep|cong ty [a-z]/
// 다른 회사를 위해 뽑는 문구(Lee 2026-11-07 5번 A): 이름에 인력 낱말이 없어도 소개소로 본다.
const FOR_OTHER = /tuyen (?:\S+ ){0,4}cho (?:cong ty|cty|nha may|xuong|cac|nhieu)|cung (?:cap|ung) (?:lao dong|nhan luc|cong nhan)|(?:cac|nhieu) (?:cong ty|nha may) (?:trong|tai|o) (?:kcn|ccn|khu cong nghiep)/
const FEE = /phi tuyen|thu phi|dat coc|\bcoc\b|le phi|phi ho so|mat phi/
const NO_FEE = /khong (?:thu )?(?:mat )?phi|mien phi|khong (?:dat )?coc|0 ?d phi|free/

export interface CompanyRead { name: string; agency: boolean; fee: boolean }

/** 게시글 본문만: 수집기가 붙여 온 댓글(줄 "댓글"/"Bình luận"/"Comments" 아래)은 다른 사람 글이라 읽지 않는다(#560 2026-11-09 실측 3건). */
export function postBody(text: string): string {
  const lines = String(text ?? '').split('\n')
  const cut = lines.findIndex((l) => /^\s*(?:댓글|bình luận|comments?)\s*$/iu.test(l))
  return (cut >= 0 ? lines.slice(0, cut) : lines).join('\n')
}
// 가게 낱말 뒤가 이름이 아니라 위치 설명("quán cạnh ngã 6", "Hotel 06 Ngô Tất Tố")이면 버린다(#560).
// 위치 설명 = 위치 낱말 + 장소 낱말·번호("cạnh ngã 6", "gần chợ", "đối diện trường", "số 12"). 위치 낱말만으로는 버리지 않는다("Nhà hàng Bên Sông", "Snail" — Codex #616).
const NOT_NAME_START = /^(?:(?:cạnh|gần|đối diện|sát|ngay|bên|trước|sau|trong|ở|tại)\s+(?:ngã|cổng|chợ|trường|bệnh viện|siêu thị|ngõ|đường|phố|công viên|ủy ban|ubnd|kcn|ccn|cây xăng|bến|cầu|nhà|quán|tòa|khu|số|\d)|(?:số|sn)\s*\d)/iu
// 숫자로 시작하는 뒤말은 주소 근거가 있을 때만 주소로 본다("Hotel 06 Ngô Tất Tố, Võ Cường, Bắc Ninh"). "Nhà hàng 5 Sao, Bắc Ninh"은 상호(Codex #616).
const isAddressAfter = (rest: string) => /^\d/.test(rest) &&
  (/^\d+\p{L}?(?:[\/-]\d+)*\s+(?:đường|đ\.|phố|ngõ|ngách|hẻm|kiệt)(?=\s|$)/iu.test(rest) || (rest.match(/,/g) ?? []).length >= 2)

/** 원문(여러 줄)에서 회사 이름. 못 찾으면 name=''. */
export function readCompany(text: string): CompanyRead {
  const src = postBody(String(text ?? '').normalize('NFC'))
  const lines = src.split('\n').map((l) => clean(l.replace(EMOJI, ' '))).filter(Boolean)
  const pick = (): string => {
    // ⓪ 첫 줄이 이름만 있는 짧은 줄(#4982 "Bomunttl" — 다음 줄 "Nhà hàng nướng"): 구인 낱말·가게 종류뿐이 아니고 4낱말 이하.
    //    "상호 한 낱말 – 장소"(#633 "KHVATEC – DO NHA, QUẾ VÕ 1")면 대시 앞 한 낱말만 본다.
    //    대시 앞 낱말이 이름이 아니면("COFFEE - MỘC") 첫 줄 전체를 그대로 본다.
    const l0 = lines[0] ?? ''
    const dashed = l0.replace(/^(\p{L}[\p{L}\d&.]{2,30})\s+[–-]{1,2}\s+\S.*$/u, '$1')
    const first = [dashed, l0].find((c) => c && c.split(/\s+/).length <= 4 && ok(c))
    if (first && !/[:：!?]/.test(l0)) return ok(first)
    // ① 이름표 줄
    for (const l of lines) {
      const m = l.match(/^(?:tên )?(?:công ty|cty|đơn vị|nhà tuyển dụng|doanh nghiệp)\s*[:：]\s*(.+)$/iu)
      if (m && ok(m[1])) return ok(m[1])
    }
    // ② "CÔNG TY/CTY …"로 시작하는 줄(앞 8줄) — 뒤에 붙은 "– TUYỂN …"·"tuyển …"·주소는 뗀다
    for (const l of lines) {
      if (!/^(?:công ty|cty)\b/iu.test(l) || /^(?:công ty|cty)\s+(?:có|hỗ trợ|được|sẽ|luôn|cam kết)(?=\s|$)/iu.test(l)) continue
      // "CTY - FUSHAN THƯỞNG 14.000.000Đ", "CTY ChunQiu khu cn hoà phú": 상호 뒤 상여·급여·공단·장소 말은 뗀다(#560).
      const c = l.replace(/^((?:công ty|cty))\s*[-–:]\s*/iu, '$1 ')
        .replace(/\s*[-–|]?\s*(?:đang\s+)?(?:cần tuyển|tuyển dụng|tuyển gấp|tuyển|tuyen)\b.*$/iu, '')
        .replace(/\s*[-–]\s*(?:số|sn)?\s*\d.*$/iu, '')
        .replace(/\s+(?:thưởng|lương|thu nhập)\s*[:：]?\s*\d.*$/iu, '') // 금액이 바로 따라올 때만(“Công ty Lương thực …”은 이름, Codex #616)
        .replace(/\s+(?:khu cn|khu công nghiệp|cụm cn|cụm công nghiệp|kcn|ccn|tại|ở)(?=\s|$).*$/iu, '')
      if (ok(c)) return ok(c)
    }
    // ③ 가게 낱말 바로 뒤 이름(같은 줄 안)
    for (const l of lines) {
      // 이름표 줄은 건너뛰되 "Địa chỉ: Nhà hàng Seoseo Galbi"처럼 주소 이름표 값이 가게 이름이면 읽는다(#560).
      const value = l.match(/^(?:địa chỉ|địa điểm(?: làm việc)?)\s*[:：]\s*(.+)$/iu)?.[1]
      if (LABEL_LINE.test(l) && !value) continue
      // 주소 이름표 값은 가게 낱말로 시작할 때만(주소 속 "cạnh nhà hàng ABC" 같은 주변 업체는 아님, Codex #616)
      if (value !== undefined && !new RegExp(`^${KIND}\\s`, 'iu').test(value.trim())) continue
      const m = (value ?? l).match(new RegExp(`(${KIND})\\s+([^,.!?:\\n]{2,60})`, 'iu'))
      if (!m || NOT_NAME_START.test(m[2].trim()) || isAddressAfter((value ?? l).slice((m.index ?? 0) + m[1].length).trim())) continue
      const c = m[2].replace(/\s*[-–]?\s*(?:đang\s+)?(?:cần tuyển|cần|tuyển dụng|tuyển|tìm|mới khai trương)(?=\s|[:：!–-]|$).*$/iu, '')
        .replace(/\s+khu vực(?=\s|$).*$/iu, '') // "cửa hàng WinMart+ khu vực Bắc Ninh": 뒤 지역 말은 이름이 아니다(②의 공단·장소 말 떼기와 같은 규칙, #633)
        .replace(/\s+\d{1,4}\p{L}?(?:\/\d+)*\s+\p{Lu}\p{Ll}*\s+\p{Lu}.*$/u, '') // "Jollibee 393 Trần Hưng Đạo": 상호 뒤 번지·거리는 주소(#633)
      if (ok(c) && ok(`${m[1]} ${c}`)) return ok(`${m[1]} ${c}`)
    }
    // ④ "tại + 이름"(Việc làm tại VINAMILK - BẮC NINH)
    for (const l of lines.slice(0, 3)) {
      const m = l.match(/(?:việc làm|làm việc|tuyển dụng|cơ hội)\s+tại\s+([^,.!?\n]{2,60})/iu)
      if (!m) continue
      const c = m[1].replace(new RegExp(`^${KIND}\\s*[:：]\\s*`, 'iu'), '').replace(/\s*[-–]\s*.*$/u, '')
      if (ok(c)) return ok(c)
    }
    // ⑤ 제목 대시 뒤("TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH", "BẢNG TIN TUYỂN DỤNG THÁNG 11 – HIGHLANDS COFFEE")
    for (const l of lines.slice(0, 2)) {
      const m = l.match(/^([^–-]{0,20}\s)?(?:tuyển|tuyen|tuyển dụng|tuyển gấp|cần tuyển)\b.*?\s[–-]\s+(.{3,80})$/iu)
      // 앞말이 이름이면("FUTURE GROUP TUYỂN DỤNG – CHUYÊN VIÊN…") 대시 뒤는 직무다 → ⑥에서 앞말을 읽는다. 앞말이 "BẢNG TIN"처럼 이름이 아닐 때만 대시 뒤.
      if (m && !(m[1] && ok(m[1])) && ok(m[2])) return ok(m[2])
    }
    // ⑥ "… TUYỂN DỤNG" 앞(첫 4줄)
    for (const l of lines.slice(0, 4)) {
      if (!/tuyển dụng|cần tuyển|tuyển\b|tìm đồng đội|tìm kiếm|bổ sung nhân sự/iu.test(l)) continue
      const c = l.replace(/\s*[-–]?\s*(?:đang\s+)?(?:mở\s+(?:đợt\s+)?)?(?:cần tuyển|tuyển dụng|tuyển gấp|tuyển|tìm đồng đội|tìm kiếm|bổ sung nhân sự)(?=\s|[:：!–-]|$).*$/iu, '').replace(/\s*thông báo\s*$/iu, '')
        .replace(/\s+(?:ở|tại)\s.*$/iu, '') // "CÔNG TY MÌNH Ở KHÚC XUYÊN CẦN TUYỂN": 뒤 장소 말은 이름이 아니다(②와 같은 규칙, #633)
      // "[Kinh Bắc - Bắc Ninh] Trang sức Huy Thanh"(#560): 대괄호는 장소 → 뒤가 이름. 뒤가 비면 대괄호 안이 이름("[ HAIDILAO VINCOM BẮC NINH ] TUYỂN DỤNG", #633)
      const bracket = c.match(/^\[([^\]]{0,40})\]\s*/u)
      if (bracket && ok(c.slice(bracket[0].length))) return ok(c.slice(bracket[0].length))
      if (bracket && !c.slice(bracket[0].length).trim() && ok(bracket[1])) return ok(bracket[1])
      if (!bracket && ok(c)) return ok(c)
    }
    return ''
  }
  const name = pick()
  const all = fold(src)
  const agency = !!name && ((AGENCY.test(fold(name)) && WORKPLACE.test(all.replace(fold(name), ' '))) || FOR_OTHER.test(all))
  const fee = FEE.test(all) && !NO_FEE.test(all)
  return { name, agency, fee }
}

// ───── 회사 이름 확정: 지금 규칙(readCompany) ∧ AI 동의(Lee 2026-11-17 #872·#887 3차 평가 뒤 결정) ─────
// 원문에서 읽은 이름(사이트 회사 칸이 아닐 때)은 AI(ai-classify와 같은 Haiku·같은 호출, scripts/ocr/company-agree.mjs)에 3번 묻고
// 규칙 답과 맞을 때만 확정한다. 맞지 않거나 근거가 부족하면 이름 없이 이유만 돌려준다 → 등록 입구가 기존 보류함(held)에 넣고 다음 수집 때 다시.
// 낱말 예외를 더하지 않는다: 이름 조건은 위 ok()(지금 규칙의 이름 검사)를 그대로 쓴다.
export const COMPANY_AI_RUNS = 3

/** AI 지시문(#887 3차 v3 그대로 — 평가한 문구를 바꾸지 않는다). 답은 이름 또는 null만. */
export function companyAiPrompt(text: string): string {
  return `From the Vietnamese job post below, copy the name of the employer exactly as it is written in the text.
The employer is the company, shop, brand or recruitment agency that is hiring (if an agency posts, the agency).
Rules:
- Copy characters exactly from the text. Do not translate, correct, expand, or join words from different places. Do not use outside knowledge.
- If a business-type word is written as part of the name, keep it as written (e.g. "Nhà hàng Hoa Sen", "Công ty ABC Vina").
- Do not answer: a workplace location only (a mall, industrial park, street address) when the post does not say that place is the employer; a client or partner the employer works for; a slogan, greeting, headline or job title; salary words.
- Answer null only if no specific employer name is written anywhere in the text.
Answer only JSON: {"company": "<exact text>" or null}

Post:
"""
${text}
"""`
}

const nameKey = (s: string) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim()
const escapeText = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
/** 원문에 글자 그대로(대소문자·띄어쓰기만 무시) 있는가. alone=true면 앞뒤가 글자·숫자가 아닌 독립된 낱말 묶음으로 있어야 한다. */
function inSource(name: string, text: string, alone = false): boolean {
  const body = escapeText(name)
  if (!body) return false
  return new RegExp(alone ? `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])` : body, 'iu').test(String(text ?? '').normalize('NFC'))
}

export interface CompanyAgreement { name: string; reason: string }

/** 규칙 이름 + AI 답 3개(null = 그 회차 오류·잘림·형식 오류, '' = AI가 이름 없음)로 확정 이름을 정한다. 못 정하면 name=''.
 *  ① 같음(성조·대소문자·기호 무시) → 규칙 이름 ② 한쪽이 다른 쪽을 낱말 단위로 포함 → 짧은 이름이 원문에 독립된 낱말로 있고 지금 이름 검사(ok)를 통과할 때만 짧은 이름
 *  그 밖(오류·3번 답이 다름·AI 이름 없음·원문에 없는 답·다른 이름) → 보류. */
export function agreeCompany(rule: string, answers: Array<string | null>, text: string): CompanyAgreement {
  const held = (reason: string) => ({ name: '', reason })
  if (!rule) return held('no_rule_name')
  if (answers.length !== COMPANY_AI_RUNS || answers.some((a) => a === null || a === undefined)) return held('ai_error')
  const keys = new Set(answers.map((a) => nameKey(String(a))))
  if (keys.size !== 1) return held('ai_unstable')
  const ai = String(answers[0]).trim()
  if (!ai || !nameKey(ai)) return held('ai_no_name')
  if (!inSource(ai, text)) return held('ai_not_in_source')
  const r = nameKey(rule), a = nameKey(ai)
  if (r === a) return { name: rule, reason: 'same' }
  const [short, long] = r.length < a.length ? [rule, ai] : [ai, rule]
  if (!` ${nameKey(long)} `.includes(` ${nameKey(short)} `)) return held('different_name')
  const name = ok(short)
  if (!name) return held('short_not_name')
  if (!inSource(name, text, true)) return held('short_not_alone')
  return { name, reason: 'contained' }
}

export type CompanyAsk = (prompt: string, opts: { maxTokens: number }) => Promise<{ text: string; stopReason: string }>

/** AI 답 한 번 → 이름('' = 이름 없음) 또는 null(잘림·형식 오류 — '없음'으로 세지 않는다, #887 3차). HTTP 오류는 던진다. */
export async function askCompanyOnce(text: string, ask: CompanyAsk): Promise<string | null> {
  const { text: out, stopReason } = await ask(companyAiPrompt(text), { maxTokens: 1024 })
  if (stopReason === 'max_tokens') return null
  const m = String(out ?? '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let j: { company?: unknown }
  try { j = JSON.parse(m[0]) } catch { return null }
  const c = j?.company
  if (c === null || c === undefined || String(c).trim().toLowerCase() === 'null') return ''
  return typeof c === 'string' ? c.trim() : null
}

/** 같은 본문(댓글 뺀 postBody — 규칙과 같음)으로 AI에 3번 묻고 agreeCompany로 판정. 3번 모두 HTTP 오류면 unavailable(지금 AI를 못 씀). */
export async function agreeCompanyWithAI(rule: string, text: string, ask: CompanyAsk): Promise<CompanyAgreement & { unavailable?: boolean }> {
  const body = postBody(String(text ?? '').normalize('NFC')).slice(0, 20000)
  const answers: Array<string | null> = []
  let httpErrors = 0
  for (let i = 0; i < COMPANY_AI_RUNS; i++) {
    try { answers.push(await askCompanyOnce(body, ask)) } catch { httpErrors++; answers.push(null) }
  }
  if (httpErrors === COMPANY_AI_RUNS) return { name: '', reason: 'ai_unavailable', unavailable: true }
  return agreeCompany(String(rule ?? '').trim(), answers, body)
}

// 소개소 공고의 실제 근무 공장·공단(Lee 2026-11-07 "3번가자"): 중복 판정에만 쓰는 비교 열쇠(접은 글자). 화면에는 쓰지 않는다.
// 순서: ① "làm (việc) tại / cho / tuyển … cho" + 공장·회사 낱말 + 이름 ② 공단 이름(KCN/CCN/Khu công nghiệp). 못 찾으면 ''(→ 중복 판정은 애매로).
const PLANT_WORD = '(?:nhà máy|công ty|cty|xưởng)'
const STOP = /\s+(?:tại|ở|o|thuộc|khu|kcn|ccn|với|lương|thu nhập|tuyển|cần|làm|ca|giờ|liên hệ)(?=\s|$).*$/iu
export function readWorkplace(text: string): string {
  const src = String(text ?? '').normalize('NFC').replace(EMOJI, ' ')
  const key = (s: string) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim()
  const plant = src.match(new RegExp(`(?:làm việc|làm|đi làm|cho)\\s+(?:tại\\s+)?${PLANT_WORD}\\s+(?:tnhh\\s+|cp\\s+)?([^\\n,.;:!?()–-]{2,60})`, 'iu'))
  if (plant) {
    const name = plant[1].replace(STOP, '').trim()
    if (name && hasNameWord(name)) return key(name)
  }
  const park = src.match(/(?:kcn|ccn|khu công nghiệp|cụm công nghiệp)\s+([^\n,.;:!?()–-]{2,40})/iu)
  if (park) {
    const name = park[1].replace(/\s+(?:mở rộng|bắc ninh|bac ninh|tỉnh|thành phố|tp)(?=\s|$).*$/iu, (m) => (/mở rộng/i.test(m) ? ' mo rong' : '')).trim()
    if (name) return 'kcn ' + key(name)
  }
  return ''
}
