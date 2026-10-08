import { parseWardUnit, wardUnitForAddresses, WARD_KEY_PATTERN } from './wardArea.ts'

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
console.log('wardArea tests: all assertions passed')
