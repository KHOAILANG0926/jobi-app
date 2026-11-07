// 로고 찾기(Lee 2026-11-07): 위치 확인이 저장한 Google 결과만 쓰고, 같은 이름 1곳·원래 성 안일 때만 장소 번호.
import { cachedGooglePlaceId, googleCacheKey, needsLogoLookup, websiteDomain } from './logoLookup.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

const job = { id: 1, company: 'Hojeong', location: 'Bắc Ninh', targets: [{ address: 'KCN Quế Võ, Bắc Ninh', workLocationId: null }] }
const place = (id: string, name: string, lat = 21.15) => ({ id, displayName: { text: name }, formattedAddress: 'Quế Võ, Bắc Ninh', location: { latitude: lat, longitude: 106.15 } })
const store = new Map<string, unknown>([[googleCacheKey(job.company, 'KCN Quế Võ, Bắc Ninh'), { places: [place('ChIJabc', 'Công ty TNHH Hojeong Vina')] }]])
const cached = async (k: string) => store.get(k) ?? null
const inside = async () => true, outside = async () => false

assert(await cachedGooglePlaceId(job, cached, inside) === 'ChIJabc', 'cached same-name place → id')
assert(await cachedGooglePlaceId(job, cached, outside) === null, 'outside original province → no id')
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
