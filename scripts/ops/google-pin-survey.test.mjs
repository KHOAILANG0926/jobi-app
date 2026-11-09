import assert from 'node:assert/strict'
import { classifyPoint } from './google-pin-survey.mjs'
const P = (o) => ({ lat: 21.1, lng: 106.1, point_kind: 'area', point_authority: 'auto_area', point_evidence: {}, ...o })
assert.equal(classifyPoint(P({ point_evidence: { source: 'Google ChIJabcdefghijk (company)' } })).cls, 'google')
assert.equal(classifyPoint(P({ point_kind: 'exact', point_authority: 'source_verified', point_evidence: { source: 'VietMap abc' } })).cls, 'verified')
assert.equal(classifyPoint(P({ point_kind: 'gate', point_authority: 'auto_gate' })).cls, 'representative')
assert.equal(classifyPoint(P({ point_evidence: { source: 'Original administrative area ward:x' } })).cls, 'representative')
assert.equal(classifyPoint(P({ point_authority: 'admin_confirmed', point_evidence: { url: 'https://www.google.com/maps/place/x' } })).cls, 'google_link')
assert.equal(classifyPoint(P({ point_authority: 'admin_confirmed', point_evidence: { source: 'admin' } })).cls, 'verified')
assert.equal(classifyPoint(P({ lat: null })).cls, 'none')
console.log('google-pin-survey: classification passed')
