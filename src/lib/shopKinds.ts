/**
 * 가게 종류 낱말 한 곳(Lee 2026-11-11 "업종 분류할 때 이런 애기 관련 업종이 하나도 없어?").
 * 카드 사진(cardPhoto)·상세 ④ 그림(albamonTemplate)·Google 이름 비교(companyPlaceSearch)가 같은 표를 읽는다 — 한쪽에만 낱말이
 * 있어 Con Cưng("Siêu Thị Mẹ Bầu & Em Bé Con Cưng")을 다른 회사로 보고, 매트리스 가게에 식료품 마트 그림이 나왔다.
 * 낱말은 성조 뗀 글자. words = 가게 종류 일반 낱말(이름 앞머리면 이름 비교에서 뗌), brands = 체인 이름(사진 고르기만, 이름에서 떼지 않음).
 * 순서 = 우선순위(2026-11-03 Groupe SEB 가전 사례 그대로).
 */
export const SHOP_KINDS: Array<{ kind: string; words: string[]; brands?: string[] }> = [
  { kind: 'ban_hang_noi_that', words: ['nem', 'noi that', 'giuong', 'sofa', 'chan ga', 'ga goi'] },
  { kind: 'ban_hang_dien_thoai', words: ['dien thoai', 'smartphone', 'phu kien dien thoai', 'di dong'], brands: ['iphone', 'the gioi di dong'] },
  { kind: 'ban_hang_dien_may', words: ['gia dung', 'dien may', 'dien lanh', 'do dien', 'noi com', 'tu lanh', 'may giat'], brands: ['tefal'] },
  { kind: 'ban_hang_thoi_trang', words: ['quan ao', 'thoi trang', 'giay dep', 'tui xach', 'shop quan', 'boutique'] },
  { kind: 'ban_hang_tien_loi', words: ['tien loi', 'minimart', 'mini mart', 'tap hoa'], brands: ['circle k', '7-eleven', 'ministop', 'gs25'] },
  { kind: 'ban_hang_me_be', words: ['me va be', 'me bau', 'em be', 'me be', 'do so sinh'] },
]
export const foldShop = (v: string) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const KIND_RES = SHOP_KINDS.map((k) => ({ kind: k.kind, re: new RegExp(`\\b(?:${[...k.words, ...(k.brands ?? [])].map(esc).join('|')})\\b`) }))
/** 공고 글 → 가게 종류(없으면 null). */
export function shopKindOf(text: string | null | undefined): string | null {
  const f = foldShop(text ?? '')
  return KIND_RES.find((k) => k.re.test(f))?.kind ?? null
}
/** 이름 앞머리에서 뗄 가게 종류 일반 낱말(체인 이름 제외) + 소개소 앞머리(2026-11-11 "CTY CUNG ỨNG NHÂN LỰC TÂN THÀNH GROUP"). */
// 어학원 앞머리(2026-11-11 'Anh ngữ Regal Edu Vân Dương' ↔ Google 'Regal Edu Vân Dương')도 이름 비교에서만 뗀다.
export const NAME_HEAD_WORDS: string[] = [...SHOP_KINDS.flatMap((k) => k.words), 'cung ung nhan luc', 'cung ung lao dong', 'cung ung', 'trung tam anh ngu', 'trung tam ngoai ngu', 'anh ngu', 'ngoai ngu']
