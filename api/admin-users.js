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

export function createAdminUsersHandler(injectedDependencies) {
  return async function adminUsersHandler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const token = bearerToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })

    const { userId, status, reason = '' } = req.body || {}
    if (typeof userId !== 'string' || !userId || !['active', 'suspended'].includes(status) || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Invalid request' })
    }

    let deps
    try {
      deps = injectedDependencies || runtimeDependencies(token)
      const caller = await deps.verifyCaller(token)
      if (caller?.app_metadata?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
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
