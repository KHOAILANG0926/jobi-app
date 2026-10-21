import { createClient } from '@supabase/supabase-js'
function runtime() {
  // Preview reuses only published coordinates. Never extend production DB credentials to previews.
  if (process.env.VERCEL_ENV === 'preview') return {async read(ids) {
    const response = await fetch(`https://www.viecganban.vn/api/map-locations?ids=${ids.join(',')}`, {signal: AbortSignal.timeout(10000)})
    if (!response.ok) throw new Error('unavailable')
    const data = await response.json()
    return ids.map(id => ({job_id:id, result:data.points?.[`sb-${id}`]}))
  }}
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('not_configured')
  const db=createClient(process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}})
  return {async read(ids) {const {data,error}=await db.rpc('map_r1_public_points',{p_ids:ids});if(error)throw new Error('unavailable');return data}}
}
export function createMapLocationsHandler(injected) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store')
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'})
    const raw=req.query?.ids
    if(typeof raw!=='string'||raw.length>2000||!/^\d+(,\d+)*$/.test(raw))return res.status(400).json({error:'invalid_ids'})
    const ids=[...new Set(raw.split(',').map(Number))]
    if(ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<=0))return res.status(400).json({error:'invalid_ids'})
    try {
      const rows=await (injected||runtime()).read(ids)
      const points={}
      for(const row of rows??[]) {
        const r=row.result
        if(!ids.includes(Number(row.job_id))||!r||!['gate','area'].includes(r.kind)||typeof r.lat!=='number'||typeof r.lng!=='number'||!(r.lat>=8&&r.lat<=24&&r.lng>=102&&r.lng<=110)||!r.source||!r.checkedAt)continue
        points[`sb-${row.job_id}`]={kind:r.kind,lat:r.lat,lng:r.lng,source:r.source,checkedAt:r.checkedAt}
      }
      return res.status(200).json({points})
    }catch{return res.status(503).json({error:'location_data_unavailable'})}
  }
}
export default createMapLocationsHandler()
