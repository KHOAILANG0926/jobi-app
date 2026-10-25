import { createClient } from '@supabase/supabase-js'
import { createAdminUsersHandler } from './_lib/admin-users.js'
import { createAdminGeocodeHandler } from './_lib/admin-geocode.js'
import { createAdminVietmapHandler } from './_lib/admin-vietmap.js'
import { createAutoLocationHandler } from './_lib/admin-auto-location.js'
import { createAdminLocationReviewHandler } from './_lib/admin-location-review.js'
export const config = { maxDuration: 300 }
const handlers = {
  users: createAdminUsersHandler(),
  geocode: createAdminGeocodeHandler(),
  vietmap: createAdminVietmapHandler(),
  'auto-location': createAutoLocationHandler(),
  'location-review': createAdminLocationReviewHandler(),
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store')
  const action=typeof req.query?.action==='string'?req.query.action:new URL(req.url||'/', 'https://localhost').searchParams.get('action')
  if(!Object.hasOwn(handlers,action))return res.status(400).json({error:'Invalid admin action'})
  const bearer=req.headers?.authorization||req.headers?.Authorization||''
  if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'})
  const token=bearer.slice(7).trim()
  if(!token)return res.status(401).json({error:'Authentication required'})
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!key)return res.status(503).json({error:'not_configured'})
  try {
    const auth=createClient(process.env.SUPABASE_URL||'https://edhuesdnuxlbcfephutq.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await auth.auth.getUser(token)
    if(error||data?.user?.app_metadata?.role!=='admin')return res.status(403).json({error:'Admin access required'})
    return handlers[action](req,res)
  }catch {return res.status(503).json({error:'Admin service unavailable'})}
}
