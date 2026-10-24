import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'})
  const authorization = String(req.headers.authorization || '')
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return res.status(401).json({error:'Authorization required'})
  if (!KEY) return res.status(503).json({error:'Service unavailable'})
  const client = createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  try {
    const {data:{user},error:authError} = await client.auth.getUser(token)
    if (authError || !user) return res.status(401).json({error:'Invalid session'})
    if (user.app_metadata?.role !== 'admin') return res.status(403).json({error:'Admin only'})
    const users = []
    for (let page = 1; page <= 100; page++) {
      const {data,error} = await client.auth.admin.listUsers({page,perPage:100})
      if (error) throw error
      users.push(...data.users)
      if (data.users.length < 100) break
    }
    const publicUsers = users.filter(u => u.app_metadata?.role !== 'admin')
    const profiles = new Map()
    for (let start = 0; start < publicUsers.length; start += 100) {
      const ids = publicUsers.slice(start,start+100).map(u => u.id)
      const {data,error} = await client.from('user_profiles')
        .select('user_id,full_name,email,phone,city').in('user_id',ids)
      if (error) throw error
      for (const p of data ?? []) profiles.set(p.user_id,p)
    }
    res.setHeader('Cache-Control','no-store, private')
    return res.status(200).json({users:publicUsers.map(u => {
      const p = profiles.get(u.id)
      return {user_id:u.id,full_name:p?.full_name || null,email:p?.email || u.email || null,
        phone:p?.phone || u.phone || null,city:p?.city || null,last_sign_in_at:u.last_sign_in_at || null}
    })})
  } catch (error) {
    return res.status(500).json({error:'Failed to retrieve accounts'})
  }
}
