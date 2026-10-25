import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function bearerToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

function runtimeDependencies(token) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server authentication configuration is incomplete')
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async verifyCaller(accessToken) {
      const { data, error } = await adminClient.auth.getUser(accessToken)
      if (error || !data.user) throw new Error('Invalid access token')
      return data.user
    },
    async banUser(userId, suspended) {
      const attributes = suspended ? { ban_duration: '876000h' } : { ban_duration: 'none' }
      const { error } = await adminClient.auth.admin.updateUserById(userId, attributes)
      if (error) throw error
    },
    async setDatabaseStatus(userId, status, reason) {
      const { error } = await callerClient.rpc('admin_set_account_status', {
        target_user_id: userId,
        next_status: status,
        reason,
      })
      if (error) throw error
    },
  }
}


const SECTION_CODES = ['01','02','03','04','05','06','07']
const BENEFIT_CODES = ['shuttle_bus','dormitory','meal_provided','fuel','housing','attendance','productivity']
const BENEFIT_LABELS = {fuel:'Xăng xe',housing:'Nhà ở',attendance:'Chuyên cần',productivity:'Năng suất'}
const lineKey = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

async function handleLinePicks(req,res,adminClient) {
  if (req.method === 'GET') {
    const {data:jobs,error} = await adminClient.from('local_jobs')
      .select('id,title,ocr_check').in('origin',['crawler','admin']).order('id',{ascending:false}).limit(200)
    if(error) throw error
    const {data:kinds,error:kindError}=await adminClient.from('detail_line_kinds').select('line_key')
    if(kindError) throw kindError
    const known = new Set((kinds||[]).map(k=>k.line_key))
    const pending=[]
    for(const job of jobs||[]) for(const line of job.ocr_check?.detail_fill?.unclassified||[]) {
      if(typeof line !== 'string' || !line.trim() || known.has(lineKey(line))) continue
      pending.push({jobId:job.id,title:job.title,line})
    }
    return res.status(200).json({pending})
  }
  if(req.method !== 'POST' || req.body?.action !== 'line-pick')
    return res.status(400).json({error:'Invalid action'})
  const {jobId,line,code}=req.body||{}
  if(!Number.isSafeInteger(jobId)||typeof line!=='string'||line.length>2000||
    typeof code!=='string'||(!SECTION_CODES.includes(code)&&!BENEFIT_CODES.includes(code)))
    return res.status(400).json({error:'Invalid selection'})
  const {data:job,error}=await adminClient.from('local_jobs')
    .select('id,ocr_check,source_text,ocr_text,benefit_tags').eq('id',jobId).maybeSingle()
  if(error) throw error
  if(!job) return res.status(404).json({error:'Job not found'})
  const unclassified=job.ocr_check?.detail_fill?.unclassified||[]
  if(!unclassified.includes(line))return res.status(409).json({error:'Line is no longer pending'})
  const key=lineKey(line)
  const {data:existing,error:existingError}=await adminClient.from('detail_line_kinds')
    .select('line_key,decided_by').eq('line_key',key).maybeSingle()
  if(existingError) throw existingError
  if(existing?.decided_by==='lee')return res.status(409).json({error:'Already selected by Lee'})
  if(SECTION_CODES.includes(code)) {
    const {error:writeError}=await adminClient.from('detail_line_kinds').upsert({
      line_key:key,section:code,example:line,decided_by:'lee'
    },{onConflict:'line_key'})
    if(writeError)throw writeError
  } else {
    const source=[job.source_text,job.ocr_text].filter(Boolean).join('\\n')
    if(!source.includes(line))return res.status(409).json({error:'Evidence not in original source'})
    const changes={...job.ocr_check,lee_benefits:[
      ...(job.ocr_check?.lee_benefits||[]).filter(x=>x.line!==line),
      {line,code,decided_by:'lee'}]}
    if(['shuttle_bus','dormitory','meal_provided'].includes(code))changes[code]=true
    else changes.benefit_tags=[...new Set([...(job.benefit_tags||[]),BENEFIT_LABELS[code]])]
    const update={ocr_check:changes}
    if(code in BENEFIT_LABELS) update.benefit_tags=changes.benefit_tags
    else update[code]=true
    const {error:writeError}=await adminClient.from('local_jobs').update(update).eq('id',jobId)
    if(writeError)throw writeError
  }
  return res.status(200).json({ok:true,jobId,code,decided_by:'lee',rebuild_required:SECTION_CODES.includes(code)})
}

export function createAdminUsersHandler(injectedDependencies) {
  return async function adminUsersHandler(req, res) {
    const isLinePick = req.url?.includes('action=line-picks') || req.body?.action === 'line-pick'
    if (!isLinePick && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const token = bearerToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })

    const { userId, status, reason = '' } = req.body || {}
    if (!isLinePick && (typeof userId !== 'string' || !userId || !['active', 'suspended'].includes(status) || typeof reason !== 'string')) {
      return res.status(400).json({ error: 'Invalid request' })
    }

    let deps
    try {
      deps = injectedDependencies || runtimeDependencies(token)
      const caller = await deps.verifyCaller(token)
      if (caller?.app_metadata?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      if (isLinePick) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
        return await handleLinePicks(req,res,admin)
      }
      const suspended = status === 'suspended'
      await deps.banUser(userId, suspended)
      try {
        await deps.setDatabaseStatus(userId, status, reason.trim())
      } catch (databaseError) {
        await deps.banUser(userId, !suspended).catch(() => undefined)
        throw databaseError
      }
      return res.status(200).json({ ok: true, status })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed'
      const statusCode = message === 'Invalid access token' ? 401 : 500
      return res.status(statusCode).json({ error: message })
    }
  }
}

export default createAdminUsersHandler()
