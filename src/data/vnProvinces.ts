/** 베트남 2025-07-01 행정구역 개편 반영, 현재 유효한 성/시 34개(통계총국 공식
 * 자료 — crawler/vn_provinces_lookup.py가 쓰는 `vietnam-provinces` 패키지에서
 * 그대로 추출, 두 쪽 값이 어긋나지 않게 동일 출처 사용). 공고 존재 여부와
 * 무관하게 항상 34개 전부 선택 가능해야 한다(2026-09-16 사용자 지시) — 공고가
 * 없는 성/시를 선택하면 결과 0건으로 표시되는 게 맞고, 목록 자체에서 빼면 안 됨.
 */
export const VN_PROVINCES: string[] = [
  'Thành phố Cần Thơ',
  'Thành phố Huế',
  'Thành phố Hà Nội',
  'Thành phố Hải Phòng',
  'Thành phố Hồ Chí Minh',
  'Thành phố Đà Nẵng',
  'Tỉnh An Giang',
  'Tỉnh Bắc Ninh',
  'Tỉnh Cao Bằng',
  'Tỉnh Cà Mau',
  'Tỉnh Gia Lai',
  'Tỉnh Hà Tĩnh',
  'Tỉnh Hưng Yên',
  'Tỉnh Khánh Hòa',
  'Tỉnh Lai Châu',
  'Tỉnh Lào Cai',
  'Tỉnh Lâm Đồng',
  'Tỉnh Lạng Sơn',
  'Tỉnh Nghệ An',
  'Tỉnh Ninh Bình',
  'Tỉnh Phú Thọ',
  'Tỉnh Quảng Ngãi',
  'Tỉnh Quảng Ninh',
  'Tỉnh Quảng Trị',
  'Tỉnh Sơn La',
  'Tỉnh Thanh Hóa',
  'Tỉnh Thái Nguyên',
  'Tỉnh Tuyên Quang',
  'Tỉnh Tây Ninh',
  'Tỉnh Vĩnh Long',
  'Tỉnh Điện Biên',
  'Tỉnh Đắk Lắk',
  'Tỉnh Đồng Nai',
  'Tỉnh Đồng Tháp',
]
