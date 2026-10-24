import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export default async function adminAccessHandler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Phương thức không được hỗ trợ'})
  const header = req.headers?.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return res.status(401).json({error:'Yêu cầu đăng nhập'})
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
  if (!key) return res.status(503).json({error:'Nhật ký chưa được cấu hình'})
  const client = createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:{user},error} = await client.auth.getUser(token)
  if (error || !user) return res.status(401).json({error:'Phiên đã hết hạn'})
  if (user.app_metadata?.role !== 'admin') return res.status(403).json({error:'Không có quyền quản trị'})
  const ua = String(req.headers['user-agent'] ?? '').slice(0,400)
  const forwarded = String(req.headers['x-vercel-forwarded-for'] ?? '')
  const remote = forwarded.split(',')[0].trim() || req.socket?.remoteAddress || null
  const {error:insertError} = await client.from('admin_access_events').insert({
    admin_user_id:user.id,event_type:'admin_page_access',
    ip_address:remote, user_agent:ua, request_id:randomUUID(),
  })
  if (insertError) return res.status(500).json({error:'Không thể ghi nhật ký truy cập'})
  return res.status(200).json({ok:true})
}
