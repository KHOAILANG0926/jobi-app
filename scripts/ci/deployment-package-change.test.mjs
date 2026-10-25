import {test} from 'node:test'
import assert from 'node:assert/strict'
import {onlyAddedTestPg} from './deployment-package-change.mjs'
const before={manifest:{devDependencies:{vite:'1'}},lock:{packages:{'':{devDependencies:{vite:'1'}},'node_modules/vite':{version:'1',dev:true}}}}
const after=()=>structuredClone(before)
test('pg development addition does not require deployment',()=>{
  const next=after()
  next.manifest.devDependencies.pg='8'
  next.lock.packages[''].devDependencies.pg='8'
  next.lock.packages['node_modules/pg']={version:'8',dev:true}
  assert.equal(onlyAddedTestPg(before,next),true)
})
test('runtime dependency or existing build dependency changes still deploy',()=>{
  for(const change of [n=>n.manifest.dependencies={pg:'8'},n=>n.manifest.devDependencies.vite='2',n=>n.lock.packages['node_modules/vite'].version='2',n=>n.lock.packages['node_modules/runtime']={version:'1'}]) {
    const next=after();change(next);assert.equal(onlyAddedTestPg(before,next),false)
  }
})
