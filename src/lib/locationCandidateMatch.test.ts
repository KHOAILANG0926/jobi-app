import {
  addressMatch, buildCandidateEvidence, distanceMeters, isDuplicateCandidate, MIN_NAME_SIMILARITY, nameSimilarity, normalizePlaceText,
} from './locationCandidateMatch.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

assert(normalizePlaceText('Phường Võ Cường, TP. Bắc Ninh') === 'phuong vo cuong tp bac ninh', 'Vietnamese text is normalized (tones, đ, punctuation)')

// Company name vs POI name: legal-form words do not count, core name must match.
assert(nameSimilarity('Công ty TNHH Samsung Electronics Việt Nam', 'Samsung Electronics Việt Nam - Yên Phong') === 1, 'same company, different branch label')
assert(nameSimilarity('CÔNG TY CP THE TERMINAL KITCHEN BAR', 'The Terminal Kitchen & Bar') >= MIN_NAME_SIMILARITY, 'restaurant name with legal prefix still matches')
assert(nameSimilarity('Công ty TNHH Hanaka', 'Nhà hàng Hoa Sen') < MIN_NAME_SIMILARITY, 'unrelated POI is below the candidate threshold')
assert(nameSimilarity('Công ty TNHH', 'Công ty TNHH Bất kỳ') === 0, 'legal form alone never matches')

// Address match for multi-branch companies.
const jobAddr = 'Lô A1, KCN Yên Phong, Xã Long Châu, Huyện Yên Phong, Tỉnh Bắc Ninh'
assert(addressMatch(jobAddr, { ward: 'Xã Long Châu', district: 'Huyện Yên Phong', province: 'Tỉnh Bắc Ninh' }).result === 'match', 'same ward + district = match')
assert(addressMatch(jobAddr, { ward: 'Phường Khắc Niệm', district: 'Thành phố Bắc Ninh', province: 'Tỉnh Bắc Ninh' }).result === 'partial', 'same province only = partial (other branch possible)')
assert(addressMatch(jobAddr, { ward: 'Phường Dịch Vọng', district: 'Quận Cầu Giấy', province: 'Thành phố Hà Nội' }).result === 'mismatch', 'different province = mismatch')
assert(addressMatch('', { ward: 'Xã Long Châu' }).result === 'unknown', 'empty job address = unknown')
assert(addressMatch(jobAddr, {}).result === 'unknown', 'POI without admin units = unknown')

// Evidence text shows match result per level for the reviewer.
const evidence = buildCandidateEvidence({
  company: 'Công ty TNHH Samsung Electronics Việt Nam', jobAddress: jobAddr, similarity: 1, distanceM: 420.4,
  poi: { name: 'Samsung Electronics Việt Nam', address: 'KCN Yên Phong', lat: 21.2, lng: 106, refId: 'auto:abc', units: { ward: 'Xã Long Châu', district: 'Huyện Yên Phong', province: 'Tỉnh Bắc Ninh' } },
})
assert(evidence.startsWith('[Tự động] VietMap POI: Samsung Electronics Việt Nam'), 'evidence names the VietMap POI')
assert(evidence.includes('Địa chỉ khớp') && evidence.includes('Phường/xã: Xã Long Châu ✓') && evidence.includes('420 m'), 'evidence shows address match per level and distance')
assert(evidence.includes('Chưa duyệt'), 'evidence states the candidate is not approved')

// Duplicate check: same job address within 30 m (any status, incl. rejected) is not re-created.
const d = distanceMeters({ lat: 21.1861, lng: 106.0763 }, { lat: 21.1861, lng: 106.0766 })
assert(d > 25 && d < 40, `~31 m east (${d.toFixed(1)})`)
const existing = [{ address_snapshot: jobAddr, lat: 21.1861, lng: 106.0763 }]
assert(isDuplicateCandidate(existing, { address: jobAddr, lat: 21.18611, lng: 106.07631 }), 'near-identical point for same address is a duplicate')
assert(!isDuplicateCandidate(existing, { address: jobAddr, lat: 21.1871, lng: 106.0763 }), '~110 m away is a different candidate')
assert(!isDuplicateCandidate(existing, { address: 'Địa chỉ khác', lat: 21.1861, lng: 106.0763 }), 'other address of the same job is separate')

console.log('locationCandidateMatch.test.ts: candidate matching assertions passed')
