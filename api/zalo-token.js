import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edhuesdnuxlbcfephutq.supabase.co'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, code_verifier, app_id } = req.body ?? {}
  const appSecret = process.env.ZALO_APP_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!appSecret || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing env vars' })
  }
  if (!code || !code_verifier || !app_id) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // 1. Exchange Zalo auth code for access_token
  const tokenRes = await fetch('https://oauth.zaloapp.com/v4/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'secret_key': appSecret,
    },
    body: new URLSearchParams({
      app_id,
      app_secret: appSecret,
      code,
      grant_type: 'authorization_code',
      code_verifier,
    }).toString(),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return res.status(400).json({ error: 'Zalo token exchange failed', detail: tokenData })
  }

  // 2. Get Zalo user profile
  // Zalo는 베트남 밖 IP의 /me 호출을 -501로 막는다(Vercel 함수는 미국 리전).
  // 그래서 베트남 VPS의 중계 서버(crawler/zalo_relay.py)를 거쳐 조회한다.
  const relayUrl = process.env.ZALO_RELAY_URL
  const relayKey = process.env.ZALO_RELAY_KEY
  if (!relayUrl || !relayKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing relay env vars' })
  }
  const userRes = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Relay-Key': relayKey },
    body: JSON.stringify({ access_token: tokenData.access_token }),
  })
  const zaloUser = await userRes.json()
  if (!zaloUser.id) {
    return res.status(400).json({ error: 'Failed to get Zalo user info', detail: zaloUser })
  }

  // 3. Create or reuse Supabase user
  const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const syntheticEmail = `zalo_${zaloUser.id}@viecganban.vn`

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: { name: zaloUser.name, role: 'seeker', zalo_id: zaloUser.id },
  })

  // Ignore "already registered" error
  if (createError && !createError.message.toLowerCase().includes('already')) {
    return res.status(500).json({ error: 'User creation failed', detail: createError.message })
  }

  // 4. Generate one-time magic-link token so client can open a real Supabase session
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return res.status(500).json({ error: 'Failed to generate session token', detail: linkError?.message })
  }

  return res.status(200).json({
    hashed_token: linkData.properties.hashed_token,
    name: zaloUser.name,
  })
}
