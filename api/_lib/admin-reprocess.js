import { createClient } from '@supabase/supabase-js'

/** Auth is verified in api/admin.js before this handler is called. */
export function createAdminReprocessHandler() {
  return async (req,res) => {
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({error:'Method not allowed'})
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!key)return res.status(503).json({error:'not_configured'})
    const client=createClient(process.env.SUPABASE_URL||'https://edhuesdnuxlbcfephutq.supabase.co',key,{
      auth:{persistSession:false,autoRefreshToken:false}
    })
    try {
      if(req.method==='GET') {
        const id=Number(req.query?.job_id||new URL(req.url,'https://localhost').searchParams.get('job_id'))
        if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid job id'})
        const {data,error}=await client.from('job_reprocess_queue')
          .select('id,job_id,rule_version,reason,status,attempts,result,error,requested_at,finished_at')
          .eq('job_id',id).order('requested_at',{ascending:false}).limit(10)
        if(error)throw error
        return res.status(200).json({jobs:data})
      }
      const ids=req.body?.job_ids
      if(!Array.isArray(ids)||ids.length<1||ids.length>20||
        !ids.every(id=>Number.isSafeInteger(id)&&id>0)) return res.status(400).json({error:'Invalid job ids'})
      const unique=[...new Set(ids)]
      // Validate each requested job; no arbitrary DB ID or admin-hidden job replay.
      const {data:jobs,error:readError}=await client.from('local_jobs')
        .select('id,origin,admin_hidden,description').in('id',unique)
      if(readError)throw readError
      if(jobs?.length!==unique.length||jobs.some(j=>j.origin!=='crawler'||j.admin_hidden||
        !(j.description||'').includes('[source:facebook]'))) return res.status(409).json({error:'Unsupported or protected job'})
      const ruleVersion='manual-'+Date.now().toString(36)
      const {data,error}=await client.from('job_reprocess_queue').insert(
        unique.map(id=>({job_id:id,rule_version:ruleVersion,reason:'admin_requested'}))
      ).select('id,job_id,status')
      if(error)throw error
      // Optional server-to-server immediate kick; absence of a GitHub token leaves
      // the durable queue for the scheduled Actions worker (never lose requests).
      let execution='github_actions_scheduled'
      const ghToken=process.env.GITHUB_REPROCESS_TOKEN
      if(ghToken) {
        try {
          const response=await fetch('https://api.github.com/repos/KHOAILANG0926/jobi-app/actions/workflows/refresh-facebook-existing.yml/dispatches',{
            method:'POST',
            headers:{Authorization:`Bearer ${ghToken}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
            body:JSON.stringify({ref:'master'})
          })
          if(response.status===204)execution='github_actions_dispatched'
        } catch { /* durable queue is still processed on the next scheduled run */ }
      }
      return res.status(202).json({accepted:true,queue:data,execution})
    } catch {
      return res.status(503).json({error:'Queue unavailable'})
    }
  }
}
