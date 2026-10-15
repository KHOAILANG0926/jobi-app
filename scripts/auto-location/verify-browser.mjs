import {spawn} from 'node:child_process'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{env:{...process.env,VITE_VIETMAP_TILEMAP_KEY:'map-r1-synthetic-test-key'},stdio:'ignore'})
try{
 let ready=false
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5173')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}
 if(!ready)throw new Error('Local test server unavailable')
 for(const file of process.argv.slice(2)){
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file],{stdio:'inherit'});child.on('error',reject);child.on('exit',resolve)})
  if(code!==0){process.exitCode=1;break}
 }
}finally{server.kill()}
