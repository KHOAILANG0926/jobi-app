import { createClient } from '@supabase/supabase-js'
import { runLocationBatch, vietmapRequest } from './_lib/auto-location-runtime.mjs'
export const config = { maxDuration: 300 }
function runtime() {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY, vietmap=process.env.VIETMAP_SERVICE_KEY
  if(!key||!vietmap)throw new Error('not_configured')
  const db=createClient(process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}})
  return {enabled:()=>process.env.MAP_R1_ENABLED==='true',async verify(token){const {data,error}=await db.auth.getUser(token);if(error)throw new Error('unauthorized');return data.user},run:()=>runLocationBatch(db,vietmapRequest(vietmap),5)}
}
export function createAutoLocationHandler(injected) {
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store')
    try {
      const deps=injected||runtime()
      if(!deps.enabled())return res.status(503).json({error:'map_r1_not_enabled'})
      if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'})
      const token=req.headers?.authorization?.replace(/^Bearer /,'')
      if(!token)return res.status(401).json({error:'unauthorized'})
      let user
      try{user=await deps.verify(token)}catch{return res.status(401).json({error:'unauthorized'})}
      if(user?.app_metadata?.role!=='admin')return res.status(403).json({error:'forbidden'})
      return res.status(200).json(await deps.run())
    }catch{return res.status(503).json({error:'location_service_unavailable'})}
  }
}
export default createAutoLocationHandler()
