// 업종 대표 사진 주소(Lee 2026-11-02: 비는 로고 자리만 채움)
import { industryPhotoUrl } from './cardPhoto.ts'
function eq(got: unknown, want: unknown, name: string) { if (got !== want) throw new Error(`${name}: ${got} ≠ ${want}`) }
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Bomunttl tuyển cô rửa bát full time Nhà hàng nướng Ngô Tất Tố'), '/images/industry/nha_hang_nuong.jpg', 'Bomunttl Nhà hàng nướng → grill photo')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Quán lẩu Thái tuyển phục vụ'), '/images/industry/nha_hang_lau.jpg', 'lẩu → hotpot photo')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Nhà hàng tuyển phục vụ'), '/images/industry/nha_hang_chung.jpg', 'no type word → plain restaurant')
eq(industryPhotoUrl('am_thuc_do_uong', 'barista', ''), '/images/industry/am_thuc_do_uong.jpg', 'barista → cafe photo')
eq(industryPhotoUrl('am_thuc_do_uong', null, 'Highlands Coffee tuyển nhân viên'), '/images/industry/am_thuc_do_uong.jpg', 'coffee word → cafe')
eq(industryPhotoUrl('san_xuat_xay_dung'), '/images/industry/san_xuat_xay_dung.jpg', 'factory')
eq(industryPhotoUrl('other'), '/images/industry/khac.jpg', 'legacy/unknown → khac')
eq(industryPhotoUrl(undefined), '/images/industry/khac.jpg', 'missing → khac')
console.log('cardPhoto ok')
