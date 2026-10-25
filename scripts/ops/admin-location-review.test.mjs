import test from 'node:test'
import assert from 'node:assert/strict'
import { coordinatesFromGoogleUrl, resolveGoogleShareLink } from '../../api/_lib/admin-location-review.js'

test('accept explicit Google Maps Vietnam destination coordinates',()=>{
  assert.deepEqual(coordinatesFromGoogleUrl('https://www.google.com/maps?q=21.186100,106.076300'),{lat:21.1861,lng:106.0763})
  assert.deepEqual(coordinatesFromGoogleUrl('https://www.google.com/maps/place/test/data=!3d21.1861!4d106.0763'),{lat:21.1861,lng:106.0763})
})
test('refuse viewport, foreign, SSRF, malformed coordinates',()=>{
  for(const link of [
    'https://www.google.com/maps/@21.1861,106.0763,16z',
    'https://maps.app.goo.gl/short',
    'https://maps.app.goo.gl.evil.example/a?q=21.1,106.1',
    'https://127.0.0.1/maps?q=21.1,106.1',
    'http://maps.app.goo.gl/a',
    'https://www.google.com/maps?q=10,20',
    'https://www.google.com/maps?q=46.0000,106.0763',
  ])assert.equal(coordinatesFromGoogleUrl(link),null,link)
})
test('unshorten maps.app.goo.gl through a whitelisted redirect only',async()=>{
  const result=await resolveGoogleShareLink('https://maps.app.goo.gl/Example',async()=>{
    return {status:302,headers:{get:(key)=>key==='location'?'https://www.google.com/maps?q=21.186100,106.076300':null}}
  })
  assert.equal(result.lat,21.1861);assert.equal(result.lng,106.0763)
})
test('reject redirect to arbitrary hosts',async()=>{
  await assert.rejects(()=>resolveGoogleShareLink('https://maps.app.goo.gl/Example',async()=>({
    status:302,headers:{get:()=> 'https://private.example/path'}
  })),/Google Maps links only/)
})
