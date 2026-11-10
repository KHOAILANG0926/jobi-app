// 알바몬 '간편! 템플릿' 그대로 따라 하기(Lee 2026-11-08 "새로 만들지 말고 알바몬 그대로"). 2026-11-08 알바몬 기업회원 화면 직접 확인값.
// 78개 = 13개 업직종 × 6. 모든 템플릿 같은 틀(큰 사진 위 회사명·제목). 템플릿마다 기본 색·제목 글자색(검정/흰색)이 정해져 있다.
// 사진: 알바몬 사진은 쓰지 않는다. 업종별 우리 그림(public/images/template, Lee 2026-11-08 AI 팀 그림 담당).

export interface TemplateColor { id: number; name: string; bar: string; head: string; dot: string }
// 색 12가지: 소제목 왼쪽 막대색(bar)과 표 머리 배경색(head). 알바몬 계산값 그대로.
export const TEMPLATE_COLORS: TemplateColor[] = [
  { id: 7, name: 'pink', bar: 'rgb(255,171,182)', head: 'rgb(251,240,241)', dot: '#ffabb6' },
  { id: 8, name: 'orange', bar: 'rgb(250,192,138)', head: 'rgb(255,245,238)', dot: '#fac08a' },
  { id: 9, name: 'yellow', bar: 'rgb(250,219,138)', head: 'rgb(255,250,222)', dot: '#fadb8a' },
  { id: 10, name: 'yellowish green', bar: 'rgb(228,235,156)', head: 'rgb(252,255,220)', dot: '#e4eb9c' },
  { id: 11, name: 'green', bar: 'rgb(147,221,150)', head: 'rgb(234,255,234)', dot: '#93dd96' },
  { id: 12, name: 'mint', bar: 'rgb(147,221,203)', head: 'rgb(234,255,245)', dot: '#93ddcb' },
  { id: 13, name: 'skyblue', bar: 'rgb(147,217,221)', head: 'rgb(233,244,244)', dot: '#93d9dd' },
  { id: 14, name: 'blue', bar: 'rgb(147,190,221)', head: 'rgb(238,245,250)', dot: '#93bedd' },
  { id: 15, name: 'indigo', bar: 'rgb(147,154,221)', head: 'rgb(238,240,255)', dot: '#939add' },
  { id: 16, name: 'purple', bar: 'rgb(197,147,221)', head: 'rgb(251,241,255)', dot: '#c593dd' },
  { id: 17, name: 'light brown', bar: 'rgb(184,152,146)', head: 'rgb(245,237,235)', dot: '#b89892' },
  { id: 18, name: 'gray', bar: 'rgb(145,145,145)', head: 'rgb(237,237,237)', dot: '#919191' },
]

// 13개 업직종(알바몬 순서). 베트남어 이름.
export const TEMPLATE_CATEGORIES = [
  'Cơ bản', 'Ăn uống', 'Quản lý cửa hàng·Bán hàng', 'Dịch vụ', 'Văn phòng', 'CSKH·Kinh doanh', 'Sản xuất·Xây dựng',
  'IT·Kỹ thuật', 'Thiết kế', 'Truyền thông', 'Lái xe·Giao hàng', 'Y tế·Nghiên cứu', 'Giáo dục',
]

// 템플릿 41~118의 기본 색(알바몬 실측)
const DEFAULT_COLOR: Record<number, number> = {
  41: 14, 42: 8, 43: 7, 44: 17, 45: 13, 46: 18, 47: 8, 48: 17, 49: 12, 50: 9, 51: 17, 52: 8, 53: 13, 54: 16, 55: 8, 56: 14, 57: 15, 58: 8,
  59: 17, 60: 9, 61: 17, 62: 9, 63: 14, 64: 12, 65: 14, 66: 18, 67: 15, 68: 9, 69: 13, 70: 9, 71: 18, 72: 14, 73: 15, 74: 12, 75: 8, 76: 14,
  77: 13, 78: 9, 79: 8, 80: 12, 81: 8, 82: 14, 83: 18, 84: 13, 85: 13, 86: 14, 87: 12, 88: 16, 89: 17, 90: 14, 91: 18, 92: 7, 93: 14, 94: 16,
  95: 15, 96: 18, 97: 13, 98: 15, 99: 7, 100: 16, 101: 11, 102: 13, 103: 14, 104: 14, 105: 15, 106: 8, 107: 16, 108: 14, 109: 13, 110: 18,
  111: 13, 112: 12, 113: 13, 114: 14, 115: 15, 116: 10, 117: 12, 118: 9,
}
// 제목 글자가 검정인 템플릿(알바몬 color_1). 나머지는 흰 글자.
// 2026-11-08: 우리 그림은 모두 왼쪽(글자 자리)이 밝은 벽이라 흰 글자가 안 보인다 → 모든 틀 검정 글자(아래 TEMPLATES). 표는 알바몬 기록으로 남김.
export const ALBAMON_DARK_TITLE = new Set([41, 42, 45, 46, 49, 50, 55, 58, 62, 63, 68, 74, 75, 76, 78, 79, 84, 91, 94, 101, 103, 106, 107, 110, 113, 114, 115, 116])
// 템플릿 머리 사진(Lee 2026-11-08): AI 팀 그림 담당(ChatGPT·Gemini 앱)이 그린 업종별 우리 그림 — public/images/template.
// 13개 업직종 순서 그대로, 업종마다 1~3장을 6개 틀에 번갈아 쓴다. 글자·로고 없는 그림이라 출처 표시 의무가 없다.
// 왼쪽 제목 자리는 화면에서 하얗게 흐리게 덮는다(AlbamonTemplate.css .amt-visual::after) — 현실적인 사진도 글자가 보이게(Lee 2026-11-09).
const CATEGORY_IMAGES: string[][] = [
  ['01-co-ban', '01b-co-ban', '01c-co-ban'], ['02-an-uong', '02b-an-uong', '02c-an-uong'], ['03-ban-hang', '03b-ban-hang'], ['04-dich-vu', '04b-dich-vu'],
  ['05-van-phong', '05b-van-phong'], ['06-cskh'], ['07-san-xuat', '07b-san-xuat'], ['08-it', '08b-it'], ['09-thiet-ke', '09b-thiet-ke'],
  ['10-truyen-thong', '10b-truyen-thong'], ['11-giao-hang', '11b-giao-hang'], ['12-y-te', '12b-y-te'], ['13-giao-duc', '13b-giao-duc'],
]

export interface TemplateInfo { id: number; name: string; category: string; color: number; darkTitle: boolean; photo: string | null }
export const TEMPLATES: TemplateInfo[] = Array.from({ length: 78 }, (_, i) => {
  const id = 41 + i
  const g = Math.floor(i / 6)
  const category = TEMPLATE_CATEGORIES[g]
  const list = CATEGORY_IMAGES[g]
  const photo = list[(i % 6) % list.length]
  return { id, category, name: `${category} ${(i % 6) + 1}`, color: DEFAULT_COLOR[id], darkTitle: true, photo: `/images/template/${photo}.jpg` }
})
export const colorOf = (id: number) => TEMPLATE_COLORS.find((c) => c.id === id) ?? TEMPLATE_COLORS[7]

// 항목: 알바몬 순서·기본 선택(로고·모집부문·근무조건·지원조건·접수방법 켬, 담당자 정보 끔). 기타 1~4는 '항목추가'로 생김.
export type SectionKey = 'logo' | 'roles' | 'work' | 'support' | 'apply' | 'contact' | 'etc1' | 'etc2' | 'etc3' | 'etc4'
export const SECTION_LABEL: Record<SectionKey, string> = {
  logo: 'Logo', roles: 'Vị trí tuyển dụng', work: 'Điều kiện làm việc', support: 'Điều kiện ứng tuyển', apply: 'Cách ứng tuyển',
  contact: 'Thông tin người liên hệ', etc1: 'Khác 1', etc2: 'Khác 2', etc3: 'Khác 3', etc4: 'Khác 4',
}
export const SECTION_ORDER: SectionKey[] = ['logo', 'roles', 'work', 'support', 'apply', 'contact', 'etc1', 'etc2', 'etc3', 'etc4']

// 바깥 입력값 → 상세모집요강 채우기(알바몬 '현재 입력한 조건으로 상세모집요강에 적용하기' 그대로: 급여는 넣지 않는다).
export interface OuterForm {
  title: string; roles: string[]; period: string; days: string[]; start: string; end: string; benefits: string
  education: string; preferred: string; applyMethods: string; contactName: string; contactPhone: string
}
const li = (items: string[]) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`
export function bodyFromForm(key: 'work' | 'support' | 'apply' | 'contact', f: OuterForm): string {
  if (key === 'work') {
    const days = f.days.length ? `${f.days.length} ngày/tuần (${f.days.join(', ')})` : ''
    const time = f.start && f.end ? `${f.start}~${f.end}` : ''
    return li([`Thời hạn làm việc: ${f.period}`, `Ngày làm việc: ${days}`, `Thời gian làm việc: ${time}`, `Phúc lợi: ${f.benefits}`])
  }
  if (key === 'support') return li([`Học vấn: ${f.education || 'Không yêu cầu'}`, `Ưu tiên: ${f.preferred}`])
  if (key === 'apply') return li([`Cách ứng tuyển: ${f.applyMethods}`]) + `<p><br>Khi gọi điện, hãy nói <strong>'Tôi xem tin tuyển dụng trên Viecganban'</strong> để được hỗ trợ nhanh hơn.</p>`
  return li([`Người liên hệ: ${f.contactName}`, `Số điện thoại: ${f.contactPhone}`])
}
export const ROLE_DUTY_DEFAULT = '- Công việc:\n- Yêu cầu:'

// #563 (Lee 2026-11-08·09 "KDA도"): 수집 공고 상세 ④도 간편 템플릿 모양 — 업종 그림 머리 + 템플릿 색 소제목 막대. 글자는 원문 그대로.
// 공고 업종 13개는 템플릿 13개 업직종과 같은 순서(khac = Cơ bản). 그림은 업종 그림 중 공고 번호로 하나, 색은 그 업종 첫 틀의 기본 색.
const DETAIL_GROUP: Record<string, number> = {
  khac: 0, am_thuc_do_uong: 1, quan_ly_ban_hang: 2, dich_vu: 3, van_phong: 4, cskh_kinh_doanh: 5, san_xuat_xay_dung: 6,
  cntt_ky_thuat: 7, thiet_ke: 8, truyen_thong: 9, lai_xe_giao_hang: 10, y_te_dieu_duong: 11, giao_duc_giang_day: 12,
}
export type DetailStyle = 'box' | 'table' | 'band' | 'card'
// Lee 2026-11-10: 'box'(소제목 색 막대 + 테두리 상자)로 통일. 나머지는 ?tpl= 비교용으로만 남김.
export const DETAIL_STYLES: DetailStyle[] = ['box', 'table', 'band', 'card']
/** 상세 ④ 모양(Lee 2026-11-10): 사진 = 업종 그림(공장은 만드는 것으로 고름) 중 공고 번호로 하나, 색 = 업종마다 하나, 모양 = box(?tpl=로 다른 모양 비교).
 *  같은 공고는 늘 같은 모양(공고 번호로 고름). 칸 구성·순서·글자는 그대로 — 모양만 다르다. */
// 공장 공고는 무엇을 만드는 곳인지 회사 이름·제목 낱말로 먼저 가려 그 사진을 쓴다(Lee 2026-11-10 "과자회사인데 왜 전자회사 사진").
// 위에서부터 먼저 맞는 것. 맞는 종류가 없으면 공장 사진 대신 업종 구분 없는 기본 사진(엉뚱한 공장 사진보다 낫다).
// 낱말은 성조 뺀 글자로 비교 — "sữa(우유)/sửa(수리)", "giày(신발)/giấy(종이)", "may(봉제)/máy(기계)"가 같아지므로 두 낱말 이상 묶음만 쓴다.
// 새 종류는 사진(public/images/template/07-*.jpg)을 받으면 여기 한 줄 추가.
const FACTORY_PHOTOS: [RegExp, string[]][] = [
  [/\b(?:banh keo|keo ngot|banh quy|snack|socola|chocolate|keo deo)\b/, ['07-food-banhkeo']],
  [/\b(?:banh mi|banh ngot|bakery|lo banh)\b/, ['07-food-banhmi']],
  [/\b(?:nuoc giai khat|do uong|nuoc ngot|nuoc suoi|bia|ruou|beverage|nuoc trai cay)\b/, ['07-food-douong']],
  [/\b(?:sua tuoi|sua chua|sua bot|nha may sua|vinamilk|th true milk|dairy)\b/, ['07-food-sua']],
  [/\b(?:thuy san|hai san|che bien tom|che bien ca|ca tra|fillet)\b/, ['07-food-thuysan']],
  [/\b(?:che bien thit|xuc xich|giam bong|thit heo|thit lon|thit ga|thit bo)\b/, ['07-food-thit']],
  [/\b(?:thuc pham|che bien thuc pham|dong goi thuc pham|food)\b/, ['07-food-donggoi']],
  [/\b(?:giay dep|da giay|giay the thao|pouchen|changshin|footwear)\b/, ['07-giay']],
  [/\b(?:may mac|xuong may|cong nhan may|may cong nghiep|quan ao|garment)\b/, ['07-may']],
  [/\b(?:det may|det nhuom|soi|vai|textile)\b/, ['07-detsoi']],
  [/\b(?:phu tung o to|linh kien o to|phu tung xe|o to|xe may|auto parts)\b/, ['07-oto-phutung']],
  [/\b(?:dien tu|linh kien dien tu|bo mach|smt|pcb|samsung|electronics)\b/, ['07-dientu', '07-san-xuat', '07b-san-xuat']],
  [/\b(?:nhua|ep phun|khuon nhua|ep nhua|plastic)\b/, ['07-nhua-ep']],
  [/\b(?:tho han|han dien|han tig|han mig|han co2|welding)\b/, ['07-han']],
  [/\b(?:co khi|cnc|tien phay|gia cong kim loai|gia cong co khi)\b/, ['07-co-khi']],
  [/\b(?:do go|noi that|che bien go|xuong go|furniture)\b/, ['07-go-noithat']],
  [/\b(?:bao bi|in an|nha in|thung carton|printing)\b/, ['07-baobi-in']],
]
const fold = (t: string) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
// 성조로만 갈리는 낱말은 원래 글자로 한 번 더 본다: 우유 sữa(≠ sửa chữa 수리)
const NEEDS_TONE: Record<string, RegExp> = { '07-food-sua': /sữa|vinamilk|th true milk|dairy/i }
export function factoryPhotos(text: string): string[] | null {
  const t = ` ${fold(text)} `
  const raw = String(text ?? '').normalize('NFC').toLowerCase()
  return FACTORY_PHOTOS.find(([re, photos]) => re.test(t) && (NEEDS_TONE[photos[0]]?.test(raw) ?? true))?.[1] ?? null
}

/** 상세 ④ 업종별 색(Lee 2026-11-10 "색깔은 업종별로 좀 구분해서" — 13개 업종이 서로 다른 색, 글 모형 확인 "가자").
 *  bg = 바탕, hi = 소제목 형광펜, point = 아이콘·화살표·전화 버튼. 흰 카드·검정 글자·금액 빨강은 모든 업종 같음(CSS). */
export const DETAIL_PALETTE: Record<string, { bg: string; hi: string; point: string }> = {
  san_xuat_xay_dung: { bg: '#FFF7E6', hi: '#FCD58A', point: '#B45309' },
  am_thuc_do_uong: { bg: '#FFF1EA', hi: '#FDBA9A', point: '#C2410C' },
  quan_ly_ban_hang: { bg: '#FDF0F5', hi: '#F7B4CC', point: '#BE185D' },
  dich_vu: { bg: '#F5F0FF', hi: '#CDB8F5', point: '#6D28D9' },
  van_phong: { bg: '#EEF5FF', hi: '#A9CBF5', point: '#1D4ED8' },
  cskh_kinh_doanh: { bg: '#E9FAF6', hi: '#99E0CF', point: '#0F766E' },
  cntt_ky_thuat: { bg: '#EEF0FF', hi: '#B4BCF5', point: '#4338CA' },
  thiet_ke: { bg: '#FCEFFB', hi: '#F0B3EA', point: '#A21CAF' },
  truyen_thong: { bg: '#FFF0F0', hi: '#F7B7B7', point: '#B91C1C' },
  lai_xe_giao_hang: { bg: '#EEFAEE', hi: '#A6E0A9', point: '#15803D' },
  y_te_dieu_duong: { bg: '#EAF7FB', hi: '#9ED9EA', point: '#0E7490' },
  giao_duc_giang_day: { bg: '#F6FAE8', hi: '#CDE59A', point: '#4D7C0F' },
  khac: { bg: '#F1F3F6', hi: '#C4CCD8', point: '#475569' },
}
export function detailLook(category: string | null | undefined, seed: number, style?: string | null, text = ''): { photo: string; bar: string; head: string; point: string; style: DetailStyle } {
  const g = DETAIL_GROUP[String(category ?? '')] ?? 0
  const n = Math.abs(Math.trunc(seed || 0))
  const list = g === DETAIL_GROUP.san_xuat_xay_dung ? (factoryPhotos(text) ?? CATEGORY_IMAGES[0]) : CATEGORY_IMAGES[g]
  const photo = list[n % list.length]
  const c = DETAIL_PALETTE[String(category ?? '')] ?? DETAIL_PALETTE.khac
  const pick = DETAIL_STYLES.find((x) => x === style) ?? 'box'
  return { photo: `/images/template/${photo}.jpg`, bar: c.hi, head: c.bg, point: c.point, style: pick }
}
