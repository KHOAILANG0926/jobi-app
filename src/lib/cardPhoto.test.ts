// 업종 대표 사진 주소(Lee 2026-11-02: 비는 로고 자리만 채움)
import { industryPhotoUrl } from './cardPhoto.ts'
function eq(got: unknown, want: unknown, name: string) { if (got !== want) throw new Error(`${name}: ${got} ≠ ${want}`) }
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Bomunttl tuyển cô rửa bát full time Nhà hàng nướng Ngô Tất Tố'), '/images/industry/nha_hang_nuong.jpg', 'Bomunttl Nhà hàng nướng → grill photo')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Quán lẩu Thái tuyển phục vụ'), '/images/industry/nha_hang_lau.jpg', 'lẩu → hotpot photo')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Nhà hàng tuyển phục vụ'), '/images/industry/nha_hang_chung.jpg', 'no type word → plain restaurant')
eq(industryPhotoUrl('am_thuc_do_uong', 'barista', ''), '/images/industry/am_thuc_do_uong.jpg', 'barista → cafe photo')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Highlands Coffee tuyển nhân viên'), '/images/industry/am_thuc_do_uong.jpg', 'coffee word → cafe')
eq(industryPhotoUrl('san_xuat_xay_dung'), '/images/template/01-co-ban.jpg', 'unknown factory → basic art, same as detail (#682)')
// 2026-11-11 Lee "3개 사진이 안 맞는데"(CTY BÁNH KẸO HỮU NGHỊ): 카드 사진도 상세 ④와 같은 공장 그림
eq(industryPhotoUrl('san_xuat_xay_dung', null, 'BÁNH KẸO HỮU NGHỊ CTY BÁNH KẸO HỮU NGHỊ – TUYỂN LIÊN TỤC NAM/NỮ'), '/images/template/07-food-banhkeo.jpg', '11-11 candy factory card = detail candy factory art')
// Lee 2026-11-11 "덧대기": 본문은 보지 않는다 — 회사 이름·제목에 종류가 없으면 업종 기본 사진(본문 'xe máy'·'vai trò'·'ô tô' 걱정 없음)
eq(industryPhotoUrl('san_xuat_xay_dung', null, 'Công ty ABC tuyển công nhân', 'Vai trò: đứng máy ép nhựa. Có xe ô tô đưa đón, xe máy'), '/images/template/01-co-ban.jpg', 'factory: body never read (vai trò·ô tô·xe máy·ép nhựa in body ignored)')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'TRUNG NGUYÊN LEGEND BẮC NINH TUYỂN NHÂN VIÊN PHỤC VỤ', 'Pha chế cà phê, phục vụ khách'), '/images/industry/am_thuc_do_uong.jpg', 'shop/food kind still reads the body as before (Trung Nguyên cafe)')
eq(industryPhotoUrl('san_xuat_xay_dung', null, 'Công ty nhựa ABC tuyển công nhân ép nhựa'), '/images/template/07-nhua-ep.jpg', 'kind in company/title → that factory art')
eq(industryPhotoUrl('other'), '/images/industry/khac.jpg', 'legacy/unknown → khac')
eq(industryPhotoUrl(undefined), '/images/industry/khac.jpg', 'missing → khac')
console.log('cardPhoto ok')

// 2026-11-03 판매 업종 가게 종류(실제 공고 낱말)
{
  const { industryPhotoUrl: u } = await import('./cardPhoto.ts')
  const ok = (a: string, b: string, n: string) => { if (a !== b) throw new Error(`${n}: ${a}`) }
  ok(u('quan_ly_ban_hang', null, 'Groupe SEB Tefal tuyển PG bán hàng gia dụng'), '/images/industry/ban_hang_dien_may.jpg', 'Groupe SEB 가전')
  ok(u('quan_ly_ban_hang', null, 'Vua Nệm Tuyển dụng nhân viên bán hàng'), '/images/industry/ban_hang_noi_that.jpg', 'Vua Nệm 매트리스')
  ok(u('quan_ly_ban_hang', null, 'Tuyển nhân viên bán hàng'), '/images/industry/quan_ly_ban_hang.jpg', '낱말 없으면 예전 판매 사진')
  ok(u('am_thuc_do_uong', null, 'nhà hàng nướng gia dụng'), '/images/industry/nha_hang_nuong.jpg', '음식 업종은 그대로')
  console.log('cardPhoto shop kinds ok')
}

// 2026-11-03 핫팟 식당 공고의 "pha chế" 직무 → 카페가 아니라 핫팟 사진(Joy Thái 같은 꼴, 공고 번호 전용 아님)
{
  const { industryPhotoUrl: u } = await import('./cardPhoto.ts')
  const ok = (a: string, b: string, n: string) => { if (a !== b) throw new Error(`${n}: ${a}`) }
  ok(u('am_thuc_do_uong', null, 'JOY THÁI – THAI CUISINE & HOTPOT tuyển NHÂN VIÊN PHA CHẾ, NHÂN VIÊN BẾP'), '/images/industry/nha_hang_lau.jpg', 'hotpot + pha chế → hotpot')
  ok(u('am_thuc_do_uong', null, 'Nhà hàng tuyển nhân viên pha chế, phục vụ'), '/images/industry/nha_hang_chung.jpg', 'nhà hàng + pha chế → restaurant')
  ok(u('am_thuc_do_uong', null, 'Quán trà sữa tuyển nhân viên pha chế'), '/images/industry/am_thuc_do_uong.jpg', 'trà sữa pha chế → cafe')
  console.log('cardPhoto restaurant-before-cafe ok')
}
