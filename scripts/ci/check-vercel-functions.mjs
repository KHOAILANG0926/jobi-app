import { readdirSync } from 'node:fs'
const live=readdirSync('api',{withFileTypes:true}).filter(f=>f.isFile()&&!f.name.startsWith('_')&&/\.(?:js|mjs|ts)$/.test(f.name)).map(f=>f.name).sort()
console.log('Vercel Serverless Functions: '+live.length+'/12 ('+live.join(', ')+')')
if(live.length>12){console.error('::error::Vercel Hobby limit exceeded: '+live.length+'/12');process.exit(1)}
