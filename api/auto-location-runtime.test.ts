import assert from 'node:assert/strict'
import { canonicalVerdictKind } from './_lib/auto-location-runtime.mjs'

assert.equal(canonicalVerdictKind({source_points:[],provider_result:{kind:'exact',lat:21,lng:106}}),null)
assert.equal(canonicalVerdictKind({source_points:[],provider_result:{kind:'unresolved'}}),'unresolved')
assert.equal(canonicalVerdictKind({source_points:[{kind:'area',lat:21,lng:106}],provider_result:{kind:'unresolved'}}),'area')
assert.equal(canonicalVerdictKind({source_points:[{kind:'exact',lat:null,lng:null}]}),null)
console.log('canonical location verdict: source-derived points only, provider failure retained')
const {missingVerifiedCoordinate}=await import('./_lib/admin-location-review.js')
assert.equal(missingVerifiedCoordinate({active:true,admin_hidden:false,company:'Any employer',location:'TP. Bắc Ninh'},[{raw_address:'TP. Bắc Ninh',lat:21.18608,lng:106.07632,location_verified:false}],[]),true,'administrative approximation remains in existing confirmation queue')
