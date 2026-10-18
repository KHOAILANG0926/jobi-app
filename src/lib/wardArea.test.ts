import { parseWardUnit, wardUnitForAddresses, WARD_KEY_PATTERN, findWardCenter } from './wardArea.ts'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }

{
  const u = parseWardUnit('Xã Tam Đa, Huyện Yên Phong, Bắc Ninh')
  assert(!!u && u.key === 'xa:tam da|yen phong|bac ninh' && u.kind === 'xa' && u.label === 'Xã Tam Đa', 'xã unit parsed')
  assert(u!.searchText === 'Xã Tam Đa, Huyện Yên Phong, Bắc Ninh' && u!.searchTextShort === 'Xã Tam Đa, Bắc Ninh', 'search texts keep the original spelling')
  assert(WARD_KEY_PATTERN.test(u!.key), 'key matches the public lookup format')
}
{
  const u = parseWardUnit('Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh')
  assert(!!u && u.key === 'phuong:vo cuong|bac ninh|bac ninh', 'phường unit parsed')
  const t = parseWardUnit('Thành phố Bắc Ninh, Tỉnh Bắc Ninh, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh')
  assert(t?.key === 'phuong:vo cuong|bac ninh|bac ninh', 'repeated province words in the free text do not matter')
  const street = parseWardUnit('37 Lý Thái Tổ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh')
  assert(street?.key === 'phuong:vo cuong|bac ninh|bac ninh', 'street text before the unit is ignored for the key')
  const mixed = parseWardUnit('Lô A1, KDC Đồng Khu, P.ĐÌNH BẢNG, TX. TỪ SƠN, T. BẮC NINH, Phường Từ Sơn, Thị xã Từ Sơn, Bắc Ninh')
  assert(mixed?.key === 'phuong:tu son|tu son|bac ninh', 'abbreviated units are not counted as a second ward')
}
{
  assert(parseWardUnit('Huyện Yên Phong, Bắc Ninh') === null, 'district-only address has no ward')
  assert(parseWardUnit('Bắc Ninh') === null && parseWardUnit('') === null, 'province-only / empty → null')
  assert(parseWardUnit('Số 354 Đường Thanh Niên, Phường Tân Hưng, Thành phố Hải Phòng, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh') === null, 'two provinces mixed → null')
  assert(parseWardUnit('Phường Châu Khê, Phường Đình Bảng, Phường Đồng Kỵ, Xã Hương Mạc, Phường Phù Khê, Thị xã Từ Sơn, Bắc Ninh') === null, 'many wards listed → null')
  assert(parseWardUnit('Phường Quế Võ, Quế Võ, Bắc Ninh') === null, 'district without its own prefix is not a unit')
}
{
  const a = 'Phường Từ Sơn, Thị xã Từ Sơn, Bắc Ninh'
  assert(wardUnitForAddresses([a, a])?.key === 'phuong:tu son|tu son|bac ninh', 'same unit twice → that unit')
  assert(wardUnitForAddresses([a, 'Xã Tam Đa, Huyện Yên Phong, Bắc Ninh']) === null, 'different wards → null')
  assert(wardUnitForAddresses([a, 'Bắc Ninh']) === null, 'one address without a ward → null')
  assert(wardUnitForAddresses([]) === null && wardUnitForAddresses([null, '']) === null, 'no addresses → null')
}
// 2026-10-18: 새 2단계 주소(2025년 7월 개편 후 구 폐지) — #4828 실제 주소
{
  const u = parseWardUnit('Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh')
  assert(!!u && u.key === 'phuong:phuong lieu||bac ninh' && u.district === '' && u.label === 'phường Phương Liễu', '2-level ward parsed (#4828)')
  assert(u!.searchText === 'phường Phương Liễu, Bắc Ninh' && WARD_KEY_PATTERN.test(u!.key), '2-level search text + key pattern')
  assert(parseWardUnit('Xã Tam Đa, Tỉnh Bắc Ninh')?.key === 'xa:tam da||bac ninh', '2-level with Tỉnh prefix')
  assert(parseWardUnit('Phường Hoàn Kiếm, Thành phố Hà Nội')?.key === 'phuong:hoan kiem||ha noi', '2-level with Thành phố province')
  assert(parseWardUnit('Xã Tam Đa, Huyện Yên Phong') === null, 'ward + district without province is not 2-level')
  assert(parseWardUnit('Khu phố Mao Yên, Bắc Ninh') === null, 'no ward prefix → null')
  // 옛 3단계는 그대로
  assert(parseWardUnit('Phường Phương Liễu, Huyện Quế Võ, Bắc Ninh')?.key === 'phuong:phuong lieu|que vo|bac ninh', '3-level unchanged')
  // 저장된 옛 3단계 좌표를 2단계 key로 재사용(구 무시), 서로 다른 곳이면 안 씀
  const cache = { 'phuong:phuong lieu|que vo|bac ninh': { status: 'found', lat: 21.1568, lng: 106.1275 } }
  assert(findWardCenter(cache, 'phuong:phuong lieu||bac ninh')?.lat === 21.1568, 'old 3-level cache reused for 2-level key')
  assert(findWardCenter({ ...cache, 'phuong:phuong lieu|khac|bac ninh': { status: 'found', lat: 20.5, lng: 105.5 } }, 'phuong:phuong lieu||bac ninh') === null, 'conflicting same-name wards → null')
  assert(findWardCenter(cache, 'phuong:phuong lieu||ha noi') === null, 'different province → null')
  assert(findWardCenter({ 'xa:a||b': { status: 'miss' } }, 'xa:a||b') === null, 'miss is not a center')
}
console.log('wardArea tests: all assertions passed')
