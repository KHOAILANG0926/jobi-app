import test from 'node:test'
import assert from 'node:assert/strict'
import { missingVerifiedCoordinate as pending } from '../../api/_lib/admin-location-review.js'
const job={id:4824,active:true,admin_hidden:false,company:'CTY KDA',location:'Bac Ninh'}
test('4824 and 4828: work row exists but coordinates are null',()=>{
 assert.equal(pending(job,[{raw_address:'Bac Ninh',lat:null,lng:null,location_verified:false}]),true)
})
test('4879: no work location row exists',()=>assert.equal(pending({...job,id:4879},[]),true))
test('4878: approximate coords not verified are still pending',()=>assert.equal(pending({...job,id:4878},[{raw_address:'Bac Ninh',lat:21.1,lng:106.1,location_verified:false}]),true))
test('exclude already verified precise coordinates',()=>assert.equal(pending(job,[{raw_address:'Bac Ninh',lat:21.1,lng:106.1,location_verified:true}]),false))
test('exclude valid approved point for same company and address',()=>assert.equal(pending(job,[],[{status:'approved',company_snapshot:'CTY KDA',address_snapshot:'Bac Ninh'}]),false))
test('exclude private and hidden jobs',()=>{assert.equal(pending({...job,active:false}),false);assert.equal(pending({...job,admin_hidden:true}),false)})
