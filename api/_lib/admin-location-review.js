import { createClient } from '@supabase/supabase-js'
import { hasLocationClue } from '../../src/lib/locationReviewClue.ts'

// Admin-only location queue/Google link resolution/confirmation. Never fetch non-Google hosts.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const ALLOWED_HOSTS = new Set(['maps.app.goo.gl','www.google.com','google.com','maps.google.com'])
const addressKey = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const coordPair = /(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/
function vietnamPoint(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110
}
export function coordinatesFromGoogleUrl(value) {
  let url
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password) return null
  // Google place data: !3d(latitude)!4d(longitude) refers to the selected place, not just the map viewport.
  const place = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (place) {
    const lat = Number(place[1]), lng = Number(place[2])
    return vietnamPoint(lat,lng) ? {lat,lng} : null
  }
  for (const key of ['q','query','destination','ll']) {
    const match = url.searchParams.get(key)?.match(coordPair)
    if (!match) continue
    const lat = Number(match[1]), lng = Number(match[2])
    if (vietnamPoint(lat,lng)) return {lat,lng}
  }
  return null // Never promote a Google map viewport (@lat,lng) to a verified job location.
}
export async function resolveGoogleShareLink(input, fetcher = fetch) {
  let current = String(input || '')
  for (let i=0;i<5;i++) {
    let url
    try { url=new URL(current) } catch { throw new Error('Invalid Google Maps URL') }
    if (url.protocol!=='https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password)
      throw new Error('Google Maps links only')
    const point=coordinatesFromGoogleUrl(url.toString())
    if (point) return { ...point, resolvedUrl:url.toString() }
    const response=await fetcher(url.toString(),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0'}})
    if(response.status<300 || response.status>=400) throw new Error('Google link has no explicit place coordinates')
    const location=response.headers.get('location')
    if(!location) throw new Error('Google redirect missing')
    current=new URL(location,url).toString()
  }
  throw new Error('Too many Google redirects')
}
function validPoint(lat,lng) {return typeof lat==='number' && typeof lng==='number' && vietnamPoint(lat,lng)}
export function missingVerifiedCoordinate(job, workLocations=[], candidates=[]) {
  if (job.active !== true || job.admin_hidden === true) return false
  const keys=[job.location,...workLocations.map(w=>w.raw_address)].map(addressKey).filter(Boolean)
  if (candidates.some(c=>c.status==='approved' &&
    addressKey(c.company_snapshot)===addressKey(job.company) &&
    keys.includes(addressKey(c.address_snapshot)))) return false
  if (workLocations.some(w=>w.location_verified===true && validPoint(w.lat,w.lng))) return false
  // Lee 2026-10-30: 회사명·번지 단서가 없으면 관리자도 고칠 근거가 없다 → 목록에 올리지 않는다.
  return hasLocationClue(job.company, [job.location,...workLocations.map(w=>w.raw_address)])
}
export function createAdminLocationReviewHandler(deps) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store')
    if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'})
    const auth=String(req.headers?.authorization||'')
    if (!auth.startsWith('Bearer ')) return res.status(401).json({error:'Admin login required'})
    const service=deps?.service || (process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
      : null)
    if(!service)return res.status(503).json({error:'Server not configured'})
    try {
      const {data,error}=await service.auth.getUser(auth.slice(7))
      if(error || !data.user) return res.status(401).json({error:'Invalid session'})
      if(data.user.app_metadata?.role !== 'admin')return res.status(403).json({error:'Admin required'})
      if(req.method==='GET') {
        const [{data:jobs,error:je},{data:works,error:we},{data:approved,error:ae}]=await Promise.all([
          service.from('local_jobs').select('id,title,company,location,created_at,active,admin_hidden').order('created_at',{ascending:true}).limit(2000),
          service.from('job_work_locations').select('id,job_id,raw_address,lat,lng,location_verified,address_accuracy,coordinate_accuracy').limit(4000),
          service.from('job_location_candidates').select('job_id,status,address_snapshot,company_snapshot').eq('status','approved').limit(4000),
        ])
        if(je||we||ae)throw Error('Cannot read location review queue')
        const groups=new Map()
        for(const w of works||[]) {const list=groups.get(w.job_id)||[];list.push(w);groups.set(w.job_id,list)}
        const approvalsByJob=new Map()
        for(const c of approved||[]) { const l=approvalsByJob.get(c.job_id)||[];l.push(c);approvalsByJob.set(c.job_id,l) }
        const pending=(jobs||[]).filter(job=>missingVerifiedCoordinate(job, groups.get(job.id)||[], approvalsByJob.get(job.id)||[])).map(job=>{
          const locs=groups.get(job.id)||[]
          const w=locs.find(w=>w.raw_address)||locs[0]
          const approximate=locs.find(w=>validPoint(w.lat,w.lng))
          return {jobId:job.id,title:job.title,company:job.company,address:w?.raw_address||job.location||'',
            workLocationId:w?.id||null,createdAt:job.created_at,
            approximate:approximate ? {lat:approximate.lat,lng:approximate.lng,accuracy:approximate.coordinate_accuracy||approximate.address_accuracy||'approximate'} : null}
        })
        return res.status(200).json({pending,count:pending.length})
      }
      const action=req.body?.action
      if(action==='resolve') {
        const link=req.body?.link
        if(typeof link!=='string'||link.length>2048) return res.status(400).json({error:'Invalid link'})
        const result=await resolveGoogleShareLink(link,deps?.fetcher||fetch)
        return res.status(200).json({point:result})
      }
      if(action==='confirm') {
        const {jobId,address,lat,lng,workLocationId,googleLink}=req.body||{}
        if(!Number.isSafeInteger(jobId)||typeof address!=='string'||!address.trim()||
           !validPoint(lat,lng)|| (workLocationId!==null && workLocationId!==undefined && !Number.isSafeInteger(workLocationId)))
          return res.status(400).json({error:'Invalid candidate'})
        const {data:job,error:je}=await service.from('local_jobs').select('id,location,company').eq('id',jobId).maybeSingle()
        if(je||!job)return res.status(404).json({error:'Job missing'})
        const {data:locations,error:le}=await service.from('job_work_locations').select('id,raw_address').eq('job_id',jobId)
        if(le)throw Error('Locations unavailable')
        const source=(locations||[]).find(w=>w.raw_address===address)
        if(job.location!==address && !source)return res.status(409).json({error:'Address differs from job source'})
        if(workLocationId && source?.id!==workLocationId)return res.status(409).json({error:'Work location mismatch'})
        const {data:already,error:ae}=await service.from('job_location_candidates').select('id').eq('job_id',jobId).eq('status','approved').limit(1)
        if(ae)throw Error('Cannot inspect existing approval')
        if(already?.length)return res.status(409).json({error:'Job already has a confirmed location'})
        const hasShareLink=typeof googleLink==='string' && googleLink.length>0
        if(hasShareLink) {
          const shared=coordinatesFromGoogleUrl(googleLink)
          if(!shared || Math.abs(shared.lat-lat)>0.000001 || Math.abs(shared.lng-lng)>0.000001)
            return res.status(409).json({error:'Google link coordinates do not match selected pin'})
        }
        const evidence=hasShareLink ? 'Lee confirmed Google Maps location' : 'Lee picked the point on VietMap'
        // Server calls existing admin-only RPC using caller JWT, preserving reviewed_by and audit trail.
        const caller=createClient(SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}})
        // RPC must run with the *user's* JWT. Service key is not used for approval writes.
        const {data:candidate,error:ce}=await caller.rpc('admin_add_location_candidate',{
          p_job_id:jobId,p_address:address,p_lat:lat,p_lng:lng,p_precision:'building',
          p_source:'other',p_evidence:evidence,p_evidence_urls:googleLink?[googleLink]:[],
          p_work_location_id:source?.id||null
        })
        if(ce||!candidate?.id)throw Error(ce?.message||'Candidate creation failed')
        const {error:re}=await caller.rpc('admin_review_location_candidate',{p_candidate_id:candidate.id,p_action:'approve',p_note:'Lee confirmed on admin map'})
        if(re)throw Error(re.message)
        return res.status(200).json({ok:true,candidateId:candidate.id,jobId})
      }
      return res.status(400).json({error:'Invalid action'})
    }catch(error) {
      const message=error instanceof Error?error.message:'Request failed'
      return res.status(422).json({error:message})
    }
  }
}
export default createAdminLocationReviewHandler()
