import { companyCore, businessKind, phoneKeys, sameCompany, sameJob, sameLocation, duplicateGroups, type IdentityJob } from './jobIdentity.ts'

function assert(c: unknown, m: string): void { if (!c) throw new Error('jobIdentity.test: ' + m) }

// 핵심 이름: 회사 형태·가게 종류·지역·지점 낱말을 빼면 같은 회사 (Lee 2026-11-06 Haidilao 사례)
for (const n of ['Haidilao', 'CÔNG TY TNHH HAIDILAO VIỆT NAM', 'Lẩu Haidilao Bắc Ninh', 'Hai Di Lao', 'Haidilao - Chi nhánh Bắc Ninh'])
  assert(companyCore(n).core === 'haidilao', `핵심 이름 haidilao: ${n} → ${companyCore(n).core}`)
assert(companyCore('CÔNG TY TNHH HOJEONG').core === companyCore('Ho Jeong').core, 'Hojeong 띄어쓰기')
assert(companyCore('Lẩu Haidilao Bắc Ninh').kind === 'nha_hang', '이름의 가게 종류 낱말 = 업종')

// 같은 이름이라도 업종이 다르면 다른 회사 (카페와 식당은 따로)
const cafe: IdentityJob = { id: 1, company: 'Phúc Lộc Coffee', occupation_code: '5131' }
const quan: IdentityJob = { id: 2, company: 'Nhà hàng Phúc Lộc', occupation_code: '5131' }
const bds: IdentityJob = { id: 3, company: 'CÔNG TY CỔ PHẦN BẤT ĐỘNG SẢN PHÚC LỘC', category: 'cskh_kinh_doanh', occupation_code: '3334' }
assert(businessKind(cafe) === 'quan_ca_phe' && businessKind(quan) === 'nha_hang' && businessKind(bds) === 'bat_dong_san', '업종: ' + [businessKind(cafe), businessKind(quan), businessKind(bds)])
assert(!sameCompany(cafe, quan) && !sameCompany(quan, bds), '이름 같고 업종 다르면 다른 회사')
// 업종은 하는 일로 나누지 않는다: 같은 식당의 서빙·요리 공고는 같은 회사
assert(sameCompany({ id: 4, company: 'Lẩu Haidilao', subcategory: 'phuc_vu_ban' }, { id: 5, company: 'Haidilao Việt Nam', subcategory: 'dau_bep' }) === false
  || businessKind({ company: 'Haidilao Việt Nam', subcategory: 'dau_bep', category: 'am_thuc_do_uong' }) !== 'dau_bep', '하는 일 소분류는 업종이 아님')

// 번호: 한쪽에 회사 이름이 없을 때만. 양쪽 이름이 다르면 번호가 같아도 다른 회사
assert(phoneKeys('+84 384 873 315', '0384.873.315').length === 1, '번호 통일(84→0, 기호 제거)')
assert(sameCompany({ id: 6, company: '', employer_phone: '0384873315' }, { id: 7, company: 'BĐS Phúc Lộc', employer_phone: '+84384873315' }), '이름 없는 쪽은 번호로')
assert(!sameCompany({ id: 8, company: 'Samsung', employer_phone: '0911111111' }, { id: 9, company: 'Hojeong', employer_phone: '0911111111' }), '인력업체 번호 공유는 다른 회사')

// 하는 일: 세부끼리는 같아야, 큰 분류뿐이면 첫 자리
assert(sameJob({ id: 1, occupation_code: '8202' }, { id: 2, occupation_code: '8202' }) && !sameJob({ id: 1, occupation_code: '8202' }, { id: 2, occupation_code: '7543' }), '세부 코드')
assert(sameJob({ id: 1, occupation_code: '8' }, { id: 2, occupation_code: '8202' }), '큰 분류뿐이면 첫 자리')

// 위치: 정확한 핀 200m 안 / 같은 공단 = 같음, 대략 위치 = 판단 불가
const p = (lat: number, lng: number, kind = 'exact', park: string | null = null) => ({ lat, lng, point_kind: kind, industrial_park: park })
assert(sameLocation({ id: 1, points: [p(21.18, 106.07)] }, { id: 2, points: [p(21.1805, 106.0705)] }) === 'same', '200m 안')
assert(sameLocation({ id: 1, points: [p(21.18, 106.07)] }, { id: 2, points: [p(21.19, 106.07)] }) === 'different', '1km 밖')
assert(sameLocation({ id: 1, points: [p(21.18, 106.07, 'gate', 'KCN Yên Phong')] }, { id: 2, points: [p(21.2, 106.0, 'area', 'KCN Yen Phong')] }) === 'same', '같은 공단')
assert(sameLocation({ id: 1, points: [p(21.18, 106.07)] }, { id: 2, points: [p(21.18, 106.07, 'area')] }) === 'unknown', '대략 위치는 판단 불가')

// 묶음
const jobs: IdentityJob[] = [
  { id: 10, company: 'Lẩu Haidilao Bắc Ninh', occupation_code: '5131', points: [p(21.18, 106.07)] },
  { id: 11, company: 'CÔNG TY TNHH HAIDILAO VIỆT NAM', subcategory: 'nha_hang', occupation_code: '5131', points: [p(21.1803, 106.0702)] },
  { id: 12, company: 'Haidilao', subcategory: 'nha_hang', occupation_code: '5131', points: [p(21.05, 105.8)] },      // 다른 지점
  { id: 13, company: 'Haidilao', subcategory: 'nha_hang', occupation_code: '5131', points: [p(21.18, 106.07, 'area')] }, // 대략 위치
]
const g = duplicateGroups(jobs)
assert(JSON.stringify(g.duplicates) === '[[10,11]]', '같은 지점만 중복: ' + JSON.stringify(g))
assert(g.unknownLocation.some(([a, b]) => a === 10 && b === 13), '대략 위치는 확인 목록: ' + JSON.stringify(g.unknownLocation))
console.log('jobIdentity.test.ts: 회사·업종·하는 일·위치 중복 기준 통과')
