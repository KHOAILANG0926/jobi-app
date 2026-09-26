import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edhuesdnuxlbcfephutq.supabase.co'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, code_verifier, app_id } = req.body ?? {}
  const appSecret = process.env.ZALO_APP_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const relayUrl = process.env.ZALO_RELAY_URL
  const relayKey = process.env.ZALO_RELAY_KEY

  if (!appSecret || !serviceKey || !relayUrl || !relayKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing env vars' })
  }
  // 2026-09-26 보안 검토 — 이 가드는 반드시 Zalo 토큰교환(아래 1번)보다도
  // 먼저 와야 한다. relay(crawler/zalo_relay.py)가 지금 평문 HTTP만 서빙해서
  // Zalo access_token과 X-Relay-Key가 Vercel↔VPS 구간에서 그대로 노출되는데,
  // 이 체크가 relay 호출 직전(2번)에만 있으면 매 요청마다 이미 Zalo API를
  // 한 번 불필요하게 호출한 뒤에야 막힌다 — 위험하진 않지만(oauth.zaloapp.com
  // 호출 자체는 HTTPS) 있으나 마나 한 순서다. HTTPS로 전환되기 전까지는
  // Zalo를 부르기도 전에 여기서 막는다. ZALO_RELAY_URL을 https://로 바꾸면
  // 자동으로 통과된다.
  if (!relayUrl.startsWith('https://')) {
    return res.status(503).json({
      error: 'Zalo login temporarily unavailable',
      detail: 'The Zalo profile relay is not using HTTPS yet — login is disabled until it does.',
    })
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
  // (relayUrl/relayKey 존재 확인 + HTTPS 가드는 핸들러 맨 위로 옮겼다 — Zalo
  // 토큰교환보다 먼저 막아야 하므로.)
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
    user_metadata: { name: zaloUser.name, role: 'seeker' },
    // zalo_id는 app_metadata에만 저장한다 — user_metadata는 로그인한 본인이
    // supabase.auth.updateUser({ data })로 직접 바꿀 수 있는 값이라 신원
    // 근거로 못 쓴다(app_metadata는 서비스 롤만 수정 가능, auth-js 타입
    // 정의로 확인). 2026-09-26: Production에 이미 배포됐던 이전 버전이
    // user_metadata.zalo_id + 소유권 검증 없이 바로 토큰을 내주고 있어서,
    // 공격자가 피해자의 zalo_id로 합성 이메일 계정을 먼저 만들어두면
    // 피해자의 실제 Zalo 로그인을 가로챌 수 있는 상태였다(계정 탈취) — 즉시
    // 아래 소유권 검증과 함께 고침.
    app_metadata: { zalo_id: zaloUser.id },
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

  // 기존 계정(이메일 일치)이 지금 로그인 중인 Zalo 사용자가 만든 게 맞는지
  // 확인 — app_metadata.zalo_id가 정확히 일치할 때만 허용한다. generateLink()
  // 는 이 체크와 무관하게 이미 유효한 hashed_token을 발급한 뒤이므로, 거부는
  // "토큰 미발급"이 아니라 "발급된 토큰을 응답에 포함하지 않고 버림"이다 —
  // 이메일 발송 없이 여기서만 쓰므로 그 토큰은 어디에도 전달되지 않고 Supabase
  // OTP 만료 시간이 지나면 소멸한다.
  const existingZaloId = linkData.user?.app_metadata?.zalo_id
  if (existingZaloId !== zaloUser.id) {
    return res.status(409).json({
      error: 'Email already in use by a different account',
      detail: 'This synthetic email is already associated with an account that was not created via Zalo login.',
    })
  }

  return res.status(200).json({
    hashed_token: linkData.properties.hashed_token,
    name: zaloUser.name,
  })
}
