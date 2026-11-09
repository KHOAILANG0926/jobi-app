// 로고 찾기(Lee 2026-11-07): 위치 확인이 저장한 Google 결과만 쓰고, 같은 이름 1곳·원래 성 안일 때만 장소 번호.
import { cachedGooglePlace, cachedGooglePlaceId, googleCacheKey, needsLogoLookup, websiteDomain } from './logoLookup.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

const job = { id: 1, company: 'Hojeong', location: 'Bắc Ninh', targets: [{ address: 'KCN Quế Võ, Bắc Ninh', workLocationId: null }] }
const place = (id: string, name: string, lat = 21.15) => ({ id, displayName: { text: name }, formattedAddress: 'Quế Võ, Bắc Ninh', location: { latitude: lat, longitude: 106.15 } })
const store = new Map<string, unknown>([[googleCacheKey(job.company, 'KCN Quế Võ, Bắc Ninh'), { places: [place('ChIJabc', 'Công ty TNHH Hojeong Vina')] }]])
const cached = async (k: string) => store.get(k) ?? null
const inside = async () => true, outside = async () => false

assert(await cachedGooglePlaceId(job, cached, inside) === 'ChIJabc', 'cached same-name place → id')
assert(await cachedGooglePlaceId(job, cached, outside) === null, 'outside original province → no id')
// 업종 판정(Lee 2026-11-08)이 같은 함수로 장소 종류를 받는다. 예전 저장분(종류 없음)은 빈 목록.
const p1 = await cachedGooglePlace(job, cached, inside)
assert(p1?.id === 'ChIJabc' && Array.isArray(p1.types) && p1.types.length === 0 && p1.primaryType === null, 'old cache → place without types')
const k2 = googleCacheKey('Highlands', '1 Lý Thái Tổ, Bắc Ninh')
// 원문이 번지 주소면 후보 주소에도 그 거리가 있어야 고른다(#560) — 시험 후보 주소를 실제처럼 같은 거리로.
store.set(k2, { places: [{ ...place('ChIJh', 'Highlands Coffee'), formattedAddress: '1 Lý Thái Tổ, Bắc Ninh', types: ['coffee_shop', 'cafe'], primaryType: 'coffee_shop' }] })
const p2 = await cachedGooglePlace({ id: 2, company: 'Highlands', location: 'Bắc Ninh', targets: [{ address: '1 Lý Thái Tổ, Bắc Ninh', workLocationId: null }] }, cached, inside)
assert(p2?.primaryType === 'coffee_shop' && p2.types.includes('cafe'), 'new cache keeps place kind')
assert(await cachedGooglePlaceId({ ...job, company: 'XYZ' }, cached, inside) === null, 'no cached search → no id (never asks Google)')
store.set(googleCacheKey(job.company, 'KCN Quế Võ, Bắc Ninh'), { places: [place('a', 'Công ty TNHH Hojeong Vina'), place('b', 'Công ty TNHH Hojeong Vina', 21.2)] })
assert(await cachedGooglePlaceId(job, cached, inside) === null, 'two same-name places → no id')

assert(websiteDomain('https://www.Netco.com.vn/vi') === 'netco.com.vn', 'domain from uri')
assert(websiteDomain('javascript:alert(1)') === null && websiteDomain('') === null, 'bad uri → null')

const own = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/facebook/x.jpg'
assert(needsLogoLookup({ company: 'A', title: 't', imageUrl: undefined, images: undefined }, []), 'no photo, no brand → lookup')
assert(!needsLogoLookup({ company: 'A', title: 't', imageUrl: own, images: undefined }, []), 'own stored photo → no lookup')
assert(needsLogoLookup({ company: 'A', title: 't', imageUrl: 'https://scontent.fhan.fbcdn.net/x.jpg', images: undefined }, []), 'facebook CDN url is not our photo → lookup')
console.log('logoLookup: 저장된 Google 결과만 사용 · 같은 이름 1곳 · 원래 성 안 · 사진 있으면 건너뜀 통과')

// 2026-11-07 브랜드 로고 그림: 그림 있으면 brand, 없으면 brand_icon(검사표에 표시)
import { photoSource } from './logoLookup.ts'
import { brandImageUrl } from './brandLogo.ts'
{
  const b = { id: 1, name: 'NETCO POST', matchKeys: ['NETCO POST'], category: 'delivery' as never, linkTo: 'NETCO POST', domain: 'netco.com.vn', initial: 'N', color: '#0a0', featured: true }
  const job = { company: 'NETCO POST', title: 'Tài xế', imageUrl: undefined, images: undefined, companyDomain: undefined }
  assert(photoSource(job, [b]) === 'brand_icon', 'brand without image → brand_icon')
  assert(photoSource(job, [{ ...b, logoUrl: '/brand-logos/netco-post.png' }]) === 'brand', 'brand with image → brand')
  assert(brandImageUrl({ ...b, logoUrl: '/brand-logos/netco-post.png' }) === '/brand-logos/netco-post.png', 'image first')
  assert(brandImageUrl({ ...b, logoUrl: 'https://evil/x.png' })!.includes('favicons'), 'bad path → site icon')
  console.log('brand logo image: 그림 먼저 · 없으면 사이트 아이콘 통과')
}
