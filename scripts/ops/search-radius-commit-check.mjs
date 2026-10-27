import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
export async function assertRadiusCommit(browser) {
 const out=await mkdtemp(join(tmpdir(),'radius-commit-'))
 const page=await browser.newPage()
 try {
  await build({configFile:false,plugins:[react()],logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},build:{outDir:out,emptyOutDir:true,lib:{entry:fileURLToPath(new URL('../fixtures/search-radius-commit.tsx',import.meta.url)),name:'RadiusCommit',formats:['iife'],fileName:()=> 'radius.js'}}})
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({content:await readFile(join(out,'radius.js'),'utf8')})
  const input=page.getByRole('spinbutton')
  await input.waitFor()
  await input.fill('400');await input.press('Enter')
  await page.getByRole('button',{name:'20 km',exact:true}).click()
  assert.equal(await page.locator('#radius-commit').getAttribute('data-committed'),'20:20000','preset and meter input must agree in the same DOM commit')
  assert.equal(await input.inputValue(),'20000')
  // A cancelled draft must not reappear when a previous preset is selected.
  await input.fill('7300')
  await page.getByRole('button',{name:'400 m',exact:true}).click()
  assert.equal(await input.inputValue(),'400')
  console.log('PASS: radius presets and meter input agree in the same DOM commit; obsolete draft discarded')
 }finally{await page.close();await rm(out,{recursive:true,force:true})}
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
 try{await assertRadiusCommit(browser)}finally{await browser.close()}
}
