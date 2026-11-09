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
export type DetailStyle = 'table' | 'band' | 'card'
export const DETAIL_STYLES: DetailStyle[] = ['table', 'band', 'card']
/** 알바몬처럼 공고마다 다르게(Lee 2026-11-09 "다양하게"): 업종 그림 중 하나 + 그 업종 6개 틀 중 하나의 기본 색 + 본문 모양 3가지 중 하나.
 *  같은 공고는 늘 같은 모양(공고 번호로 고름). 칸 구성·순서·글자는 그대로 — 모양만 다르다. */
export function detailLook(category: string | null | undefined, seed: number, style?: string | null): { photo: string; bar: string; head: string; style: DetailStyle } {
  const g = DETAIL_GROUP[String(category ?? '')] ?? 0
  const n = Math.abs(Math.trunc(seed || 0))
  const list = CATEGORY_IMAGES[g]
  const photo = list[n % list.length]
  const c = colorOf(DEFAULT_COLOR[41 + g * 6 + (n % 6)])
  const pick = DETAIL_STYLES.find((x) => x === style) ?? DETAIL_STYLES[n % DETAIL_STYLES.length]
  return { photo: `/images/template/${photo}.jpg`, bar: c.bar, head: c.head, style: pick }
}
