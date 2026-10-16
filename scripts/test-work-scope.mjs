import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root = mkdtempSync(join(tmpdir(), 'job-work-scope-'))
const checker = resolve('scripts/check-work-scope.mjs')
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
const write = (path, content) => { mkdirSync(dirname(join(root,path)), { recursive: true }); writeFileSync(join(root,path),content) }
const commit = () => { git('add','.'); git('-c','user.name=scope-test','-c','user.email=scope-test@example.invalid','commit','-qm','test'); return git('rev-parse','HEAD') }
try {
  git('init','-q')
  const rules = {}
  for (const path of ['AGENTS.md','CLAUDE.md','VIECGANBAN_STRUCTURE_BASELINE.md']) {
    write(path,'test rule'); rules[path] = createHash('sha256').update('test rule').digest('hex')
  }
  write('src/card.tsx','header\nconditional slot\nfooter\n')
  write('src/other.tsx','unchanged')
  const scope = { id:'user-request-test',request:'Preserve slot only',mode:'targeted-fix',rules,patches:[{path:'src/card.tsx',kind:'replace',before:'conditional slot',after:'permanent slot'}] }
  write('docs/work-orders/current.json',JSON.stringify(scope))
  const base = commit()
  const run = head => spawnSync(process.execPath,[checker,base,head],{env:{...process.env,SCOPE_REPO:root},encoding:'utf8'})
  write('src/card.tsx','header\npermanent slot\nfooter\n')
  assert.equal(run(commit()).status,0,'requested region is allowed')
  write('src/card.tsx','new header\npermanent slot\nfooter\n')
  const outside=run(commit()); assert.notEqual(outside.status,0); assert.match(outside.stderr,/outside declared region/)
  write('src/card.tsx','header\npermanent slot\nfooter\n')
  write('src/other.tsx','unauthorized new template')
  const file=run(commit()); assert.notEqual(file.status,0); assert.match(file.stderr,/outside declared scope/)
  write('src/other.tsx','unchanged')
  write('docs/work-orders/current.json',JSON.stringify({...scope,request:'self-broaden'}))
  const broaden=run(commit()); assert.notEqual(broaden.status,0); assert.match(broaden.stderr,/WORK_SCOPE_CHANGED/)
  write('docs/work-orders/current.json',JSON.stringify(scope));write('CLAUDE.md','changed rules')
  assert.notEqual(run(commit()).status,0,'unplanned rules changes blocked')
  console.log('Work scope: declared patch PASS; outside-region/file/same-PR scope changes BLOCKED')
} finally { rmSync(root,{recursive:true,force:true}) }
