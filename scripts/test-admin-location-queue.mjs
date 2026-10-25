import assert from 'node:assert/strict'
import test from 'node:test'
import {needsAdminLocationReview as pending} from '../api/_lib/location-review-queue.mjs'
const job={active:true,admin_hidden:false,company:'Factory',location:'Bắc Ninh'}
test('4824 and 4828 work-location rows with null coordinates are pending',()=>{for(const id of [4824,4828])assert.equal(pending({...job,id},[{job_id:id,raw_address:'Bắc Ninh',lat:null,lng:null,location_verified:false}],[]),true)})
test('4879 no work-location row is pending',()=>assert.equal(pending({...job,id:4879},[],[]),true))
test('4878 approximate coordinate without verified bit remains pending',()=>assert.equal(pending({...job,id:4878},[{lat:21.18,lng:106.07,location_verified:false}],[]),true))
test('verified exact point is not pending',()=>assert.equal(pending(job,[{lat:21.18,lng:106.07,location_verified:true}],[]),false))
test('hidden and inactive jobs are excluded',()=>{assert.equal(pending({...job,active:false},[],[]),false);assert.equal(pending({...job,admin_hidden:true},[],[]),false)})
test('approved point for same address removes job',()=>assert.equal(pending(job,[],[{status:'approved',company_snapshot:'Factory',address_snapshot:'Bắc Ninh',lat:21.18,lng:106.07}]),false))
