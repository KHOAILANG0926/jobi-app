import test from 'node:test'
import assert from 'node:assert/strict'
import { needsAdminLocationReview } from '../api/_lib/admin-location-review.js'
const job={id:4824,active:true,admin_hidden:false,company:'CTY',location:'Bac Ninh'}
test('public job, row exists with missing coordinate, queued',()=>{
 assert.equal(needsAdminLocationReview(job,[{raw_address:'Bac Ninh',lat:null,lng:null,location_verified:false}]),true)
})
test('public job, no work location rows, queued',()=>{
 assert.equal(needsAdminLocationReview({...job,id:4879},[]),true)
})
test('public job, approximate coordinates not verified, queued',()=>{
 assert.equal(needsAdminLocationReview({...job,id:4878},[{raw_address:'Bac Ninh',lat:21.1861,lng:106.0763,location_verified:false}]),true)
})
test('verified coordinates or approved candidate, not queued',()=>{
 const loc={raw_address:'Bac Ninh',lat:21.1861,lng:106.0763,location_verified:true}
 assert.equal(needsAdminLocationReview(job,[loc]),false)
 assert.equal(needsAdminLocationReview(job,[],[{company_snapshot:'CTY',address_snapshot:'Bac Ninh'}]),false)
})
test('private and hidden jobs never queued',()=>{
 assert.equal(needsAdminLocationReview({...job,active:false},[]),false)
 assert.equal(needsAdminLocationReview({...job,admin_hidden:true},[]),false)
})
