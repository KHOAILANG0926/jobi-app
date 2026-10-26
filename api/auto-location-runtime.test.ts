import assert from 'node:assert/strict'
import { canonicalVerdictKind } from './_lib/auto-location-runtime.mjs'

assert.equal(canonicalVerdictKind({source_points:[],provider_result:{kind:'exact',lat:21,lng:106}}),null)
assert.equal(canonicalVerdictKind({source_points:[],provider_result:{kind:'unresolved'}}),'unresolved')
assert.equal(canonicalVerdictKind({source_points:[{kind:'area',lat:21,lng:106}],provider_result:{kind:'unresolved'}}),'area')
assert.equal(canonicalVerdictKind({source_points:[{kind:'exact',lat:null,lng:null}]}),null)
console.log('canonical location verdict: source-derived points only, provider failure retained')
