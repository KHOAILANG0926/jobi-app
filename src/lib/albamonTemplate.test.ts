// 상세 ④ 모양(#563 데모, Lee 2026-11-10): 공장은 만드는 것으로 사진을 고르고, 색은 업종마다 하나, 모양은 'box'.
import { detailLook, factoryPhotos } from './albamonTemplate.ts'
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)}`) }
eq(factoryPhotos('CTY BÁNH KẸO HỮU NGHỊ – TUYỂN LIÊN TỤC NAM/NỮ'), ['07-food-banhkeo'], 'candy')
eq(factoryPhotos('Sửa chữa máy'), null, 'sửa chữa is repair, not dairy')
eq(factoryPhotos('Sữa chua Vinamilk'), ['07-food-sua'], 'dairy')
eq(factoryPhotos('Công ty giấy in'), null, 'paper is not shoes')
eq(factoryPhotos('Máy móc công nghiệp'), null, 'machine is not garment')
eq(factoryPhotos('Samsung linh kiện điện tử'), ['07-dientu', '07-san-xuat', '07b-san-xuat'], 'electronics')
eq(factoryPhotos('Linh kiện ô tô Hyundai'), ['07-oto-phutung'], 'auto parts before electronics')
eq(factoryPhotos('Tuyển thợ hàn TIG'), ['07-han'], 'welding')
eq(factoryPhotos('Việc làm Hàn Quốc'), null, 'Hàn Quốc is Korea, not welding')
eq(factoryPhotos('Công ty nhựa ép phun'), ['07-nhua-ep'], 'plastic')
eq(factoryPhotos('Gia công CNC'), ['07-co-khi'], 'CNC')
eq(factoryPhotos('Xưởng đồ gỗ nội thất'), ['07-go-noithat'], 'wood')
eq(factoryPhotos('Công ty bao bì in ấn'), ['07-baobi-in'], 'printing')
if (!detailLook('san_xuat_xay_dung', 1, null, 'Công ty TNHH Hojeong').photo.includes('/01')) throw new Error('unknown factory → basic photo')
const a = detailLook('am_thuc_do_uong', 1), b = detailLook('am_thuc_do_uong', 2)
eq([a.bar, a.style], [b.bar, 'box'], 'same industry → same color, box style')
if (detailLook('am_thuc_do_uong', 1).bar === detailLook('san_xuat_xay_dung', 1).bar) throw new Error('different industries → different colors')
console.log('albamonTemplate: factory photos, industry color, box style passed')

// 2026-11-11 Lee "사진 안 맞는다": 상세 ④ 그림도 카드 사진과 같은 가게·식당 종류(cardPhoto.photoKind)
{
  const { detailLook: d } = await import('./albamonTemplate.ts')
  const ph = (cat: string, kindText: string, sub: string | null = null, seed = 1) => d(cat, seed, null, '', kindText, sub).photo
  eq(ph('am_thuc_do_uong', 'TRUNG NGUYÊN LEGEND BẮC NINH TUYỂN NHÂN VIÊN PHỤC VỤ cà phê'), '/images/industry/am_thuc_do_uong.jpg', 'Trung Nguyên coffee → cafe photo, not pho kitchen')
  eq(ph('quan_ly_ban_hang', 'Vua Nệm Tuyển dụng nhân viên bán hàng'), '/images/industry/ban_hang_noi_that.jpg', 'Vua Nệm → furniture store photo, not grocery')
  eq(ph('am_thuc_do_uong', 'Nhà hàng nướng Bomunttl'), '/images/industry/nha_hang_nuong.jpg', 'grill restaurant')
  for (const seed of [1, 2, 3, 4]) if (ph('am_thuc_do_uong', 'Nhà hàng tuyển phục vụ', null, seed) === '/images/template/02c-an-uong.jpg') throw new Error('plain restaurant never gets the pho kitchen')
  eq(ph('am_thuc_do_uong', 'Quán phở Thìn tuyển phục vụ'), '/images/template/02c-an-uong.jpg', 'pho shop → pho kitchen')
  eq(ph('quan_ly_ban_hang', 'Tuyển nhân viên bán hàng', null, 0), '/images/template/03-ban-hang.jpg', 'unknown shop kind → our sales drawing as before')
  eq(d('san_xuat_xay_dung', 1, null, 'Công ty may mặc', 'Công ty may mặc', null).photo, '/images/template/07-may.jpg', 'factory unchanged')
}
