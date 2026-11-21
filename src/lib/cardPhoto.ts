/**
 * 업종 대표 사진 — Lee 2026-11-01(사람인 방식), 2026-11-02 정정: 카드 틀은 그대로 두고
 * 로고·포스터가 없을 때 비는 로고 자리만 업종 사진으로 채운다(표시 없음).
 * 사진: public/images/industry/<업종>.jpg, 출처·저작자·라이선스: data/industry-photos/SOURCES.json.
 */
import type { JobCategory } from '../types/job'
import { shopKindOf } from './shopKinds'

const INDUSTRY: Record<JobCategory, true> = {
  am_thuc_do_uong: true, quan_ly_ban_hang: true, dich_vu: true, van_phong: true, cskh_kinh_doanh: true,
  san_xuat_xay_dung: true, cntt_ky_thuat: true, thiet_ke: true, truyen_thong: true, lai_xe_giao_hang: true,
  y_te_dieu_duong: true, giao_duc_giang_day: true, khac: true,
}

// 음식 업종은 카페와 식당 사진을 나눈다(Lee 2026-11-02 "보문뜰은 식당이야").
const CAFE_SUB = new Set(['barista', 'quan_ca_phe', 'kem_trang_mieng', 'tiem_banh', 'tho_lam_banh'])
const NUONG_WORDS = /nướng|bbq|barbecue|barbeque/iu
const LAU_WORDS = /\blẩu\b|hot\s*pot|hotpot/iu
const RESTAURANT_WORDS = /nhà\s*hàng|restaurant|cuisine/iu
const CAFE_WORDS = /cà\s*phê|ca\s*phe|coffee|caf[eé]|trà\s*sữa|barista|pha\s*chế/iu

// 판매 가게 종류 낱말은 shopKinds.ts 한 곳(상세 그림·Google 이름 비교와 같은 표). 사진이 없는 종류(ban_hang_me_be)는 판매 기본 사진.
const SHOP_PHOTOS = new Set(['ban_hang_noi_that', 'ban_hang_dien_thoai', 'ban_hang_dien_may', 'ban_hang_thoi_trang', 'ban_hang_tien_loi'])

/** 업종 사진 종류(사진 파일 이름) — 카드 로고 자리·상세 ④ 위쪽 그림이 같이 쓴다(2026-11-11 Lee "쭝응웬은 커피인데 쌀국수 집을 넣으면 어떻게 해").
 *  음식: 식당 종류 낱말(nướng·lẩu) → 카페 낱말 → 일반 식당 / 판매: 가게 종류(shopKinds) / 그 밖·모름: null. */
export function photoKind(category: string | null | undefined, subcategory?: string | null, text?: string | null): string | null {
  if (category === 'am_thuc_do_uong') {
    if (subcategory && CAFE_SUB.has(subcategory)) return 'am_thuc_do_uong'
    // 식당은 공고에 적힌 식당 종류 낱말로 고른다(Lee 2026-11-02: 한국 고깃집에 중국 연회장 사진 금지). 없으면 나라 느낌 없는 일반 식당.
    // 2026-11-03 Lee "사진을 왜 커피로 했어?": 식당 종류 낱말을 카페 낱말보다 먼저 본다 — 핫팟 식당의 "pha chế"(음료 담당) 직무 때문에 카페 사진이 나왔다.
    const t = text ?? ''
    if (NUONG_WORDS.test(t)) return 'nha_hang_nuong'
    if (LAU_WORDS.test(t)) return 'nha_hang_lau'
    if (CAFE_WORDS.test(t) && !RESTAURANT_WORDS.test(t)) return 'am_thuc_do_uong'
    return 'nha_hang_chung'
  }
  // 2026-11-03 Lee "사진을 더 찾아서 다양하게": 판매 업종은 공고 낱말로 가게 종류를 고른다(Groupe SEB 가전에 우유 진열대 사진 사례).
  // 맞는 낱말이 없으면 예전 판매 사진(진열대). 약국은 쓸 만한 사진이 없어 아직 없음.
  if (category === 'quan_ly_ban_hang') {
    const kind = shopKindOf(text)
    if (kind && SHOP_PHOTOS.has(kind)) return kind
  }
  return null
}

/** 업종 사진 — 카드 로고 자리·대표 이미지·상세 ④가 같이 쓴다. head = 회사 이름·제목, body = 원문.
 *  공장 그림은 회사 이름·제목만 본다(Lee 2026-11-11 "덧대기": 본문 낱말 'xe máy'(통근)·'vai trò'(역할)·'ô tô'(통근차)에 끌려 예외를 계속 더해야 했다
 *  → 모르면 업종 기본 사진, 엉뚱한 공장 그림보다 낫다 — 11-10 원칙). 가게·식당 종류(photoKind)는 지금까지처럼 원문까지(카페 "pha chế cà phê" 등, Lee 11-02·11-03 순서 그대로). */
export function industryPhotoUrl(category: string | null | undefined, subcategory?: string | null, head?: string | null, body?: string | null): string {
  // 공장은 무엇을 만드는지로 고른 공장 그림 — 상세 ④ 그림과 같은 한 장(2026-11-11 Lee "3개 사진이 안 맞는데": 과자 공장에 봉제 공장 사진).
  // 모르면 카드·④ 모두 기본 그림 한 장(Lee 11-11 "덧대기" 1안 "모르면 기본 그림", #682 — 카드만 봉제 공장 사진이던 것).
  if (category === 'san_xuat_xay_dung') return `/images/template/${factoryPhoto(head ?? '')}.jpg`
  const kind = photoKind(category, subcategory, body ? `${head ?? ''} ${body}` : head)
  return `/images/industry/${kind ?? (category && category in INDUSTRY ? category : 'khac')}.jpg`
}

// 공장 공고는 무엇을 만드는 곳인지 회사 이름·제목 낱말로 먼저 가려 그 사진을 쓴다(Lee 2026-11-10 "과자회사인데 왜 전자회사 사진").
// 위에서부터 먼저 맞는 것. 맞는 종류가 없으면 공장 사진 대신 업종 구분 없는 기본 사진(엉뚱한 공장 사진보다 낫다).
// 낱말은 성조 뺀 글자로 비교 — "sữa(우유)/sửa(수리)", "giày(신발)/giấy(종이)", "may(봉제)/máy(기계)"가 같아지므로 두 낱말 이상 묶음만 쓴다.
// 새 종류는 사진(public/images/template/07-*.jpg)을 받으면 여기 한 줄 추가.
export const FACTORY_PHOTOS: [RegExp, string[]][] = [
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
  // 'xe máy' 단독은 뺌(2026-11-11): 원문의 "có xe máy"(통근용 오토바이)로 자동차 부품 공장이 됐다 — 부품 공장은 'phụ tùng xe'로 잡는다.
  [/\b(?:phu tung o to|linh kien o to|phu tung xe|o to|auto parts)\b/, ['07-oto-phutung']],
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
/** 공장 공고 그림 한 장(카드·상세 ④ 공통): 만드는 것을 회사 이름·제목에서 읽으면 그 공장 그림 첫 장, 모르면 기본 그림(01-co-ban). */
export const BASIC_PHOTO = '01-co-ban'
export const factoryPhoto = (head: string): string => factoryPhotos(head)?.[0] ?? BASIC_PHOTO
