import { chromium } from 'playwright'
const base=process.env.BASE_URL || 'https://www.viecganban.vn'
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:390,height:844}})
 page.on('console',m=>{if(m.type()==='error') console.log('BROWSER_CONSOLE_ERROR='+m.text().slice(0,130))})
 for(const path of ['/','/viec-lam/tim-kiem']){
   const res=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:45000})
   await page.waitForTimeout(3500)
   const b=await page.locator('body').innerText()
   const count=await page.locator('a[href="/viec-lam/4878"]').count()
   console.log('PAGE='+path+' HTTP='+res.status()+' TEFAL_TEXT='+b.includes('TEFAL')+' CARD_LINKS='+count)
   if(!b.includes('TEFAL') && !count) process.exitCode=1
 }
 const res=await page.goto(base+'/viec-lam/4878',{waitUntil:'domcontentloaded',timeout:45000})
 await page.waitForTimeout(4000)
 const body=await page.locator('body').innerText()
 console.log('DETAIL_HTTP='+res.status()+' TITLE='+body.includes('TEFAL')+' PHONE='+body.includes('0337152446')+' MAP='+((await page.locator('.jd2-map-tap, canvas, [class*=map]').count())>0))
 if(res.status()!==200||!body.includes('TEFAL'))process.exitCode=1
}finally{await browser.close()}
