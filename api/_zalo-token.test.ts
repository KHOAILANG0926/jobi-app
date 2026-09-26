/**
 * 2026-09-25/26 보안 검토 — Zalo 계정 연결(app_metadata.zalo_id) 소유권
 * 검증 + relay HTTPS 강제 회귀 테스트. 조건식만 복사해 재현하지 않고, 실제
 * api/zalo-token.js의 default export 핸들러를 그대로 실행한다 — 외부
 * I/O(Zalo REST API 호출, VPS relay 호출, @supabase/supabase-js의
 * createClient()가 반환하는 admin 클라이언트)만 node:test의
 * mock.module()/전역 fetch 교체로 모킹한다. 운영 Auth 데이터는 전혀
 * 건드리지 않는다(전부 인메모리 가짜 응답).
 *
 * src/ 밖(api/)에 둔 이유: 이 파일은 process/node:test 같은 Node 전용
 * 전역을 쓰는데, tsconfig.json의 include가 "src"뿐이라 @types/node 없이도
 * tsc --noEmit이 이 파일을 아예 검사 대상에서 제외한다 — scripts/*.mjs가
 * 이미 쓰는 것과 같은 방식.
 *
 * 파일명이 밑줄로 시작하는 이유: Vercel은 api/ 아래 파일을 이름이 `.test.`를
 * 포함하든 말든 기본적으로 전부 서버리스 함수로 배포한다(파일/부모 디렉터리
 * 이름이 `_`나 `.`로 시작하는 것만 제외) — 밑줄 없이 두면 이 테스트가 실제
 * `/api/zalo-token.test`라는 공개 엔드포인트로 배포될 뻔했다(발견 즉시 수정).
 *
 * 실행: node --experimental-strip-types --experimental-test-module-mocks
 *   --import ./scripts/ts-extensionless-loader.mjs api/_zalo-token.test.ts
 * (scripts/run-tests.mjs가 --experimental-test-module-mocks를 붙이고
 * api/도 스캔하므로 `npm test`로도 실행됨.)
 */
import { mock } from 'node:test'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertTrue(value: unknown, label: string): void {
  if (!value) throw new Error(label)
}

interface AdminCall {
  method: 'createUser' | 'generateLink' | 'updateUserById'
  args: unknown[]
}

// 이 배열은 테스트 하나 실행마다 매번 비워서(resetAdminState) 시나리오 간
// 호출 기록이 섞이지 않게 한다.
let adminCalls: AdminCall[] = []
let createUserImpl: (args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
let generateLinkImpl: (args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

function resetAdminState(): void {
  adminCalls = []
  relayCalls.length = 0
  zaloTokenExchangeCalls.length = 0
  process.env.ZALO_RELAY_URL = FAKE_RELAY_URL_HTTPS
  createUserImpl = async () => ({ data: { user: null }, error: null })
  generateLinkImpl = async () => ({ data: null, error: { message: 'not configured' } })
}

// api/zalo-token.js는 매 요청마다 자체적으로 createClient(...)를 호출해
// admin 클라이언트를 만든다(의존성 주입 구조가 아님) — 그래서 실제 핸들러를
// 그대로 실행하면서 Supabase만 갈아끼우려면 모듈 자체를 모킹해야 한다.
mock.module('@supabase/supabase-js', {
  exports: {
    createClient: () => ({
      auth: {
        admin: {
          createUser: async (args: Record<string, unknown>) => {
            adminCalls.push({ method: 'createUser', args: [args] })
            return createUserImpl(args)
          },
          generateLink: async (args: Record<string, unknown>) => {
            adminCalls.push({ method: 'generateLink', args: [args] })
            return generateLinkImpl(args)
          },
          // 실제 핸들러는 이걸 호출하지 않는다 — "기존 계정의 app_metadata를
          // 검증 전에 덮어쓰지 않는지"를 직접 증명하기 위한 스파이. 언젠가
          // 누가 실수로 이걸 호출하는 코드를 추가하면 이 테스트가 바로 잡는다.
          updateUserById: async (...args: unknown[]) => {
            adminCalls.push({ method: 'updateUserById', args })
            return { data: null, error: null }
          },
        },
      },
    }),
  },
})

let currentZaloId = ''
let currentZaloName = 'Test User'
const relayCalls: unknown[] = []
const zaloTokenExchangeCalls: unknown[] = []
const FAKE_RELAY_URL_HTTPS = 'https://relay.example.test/zalo/me'

globalThis.fetch = (async (input: unknown) => {
  const url = String(input)
  if (url.startsWith('https://oauth.zaloapp.com/v4/access_token')) {
    zaloTokenExchangeCalls.push(url)
    return { json: async () => ({ access_token: 'fake-access-token' }) } as Response
  }
  if (url === process.env.ZALO_RELAY_URL) {
    relayCalls.push(url)
    return { json: async () => ({ id: currentZaloId, name: currentZaloName }) } as Response
  }
  throw new Error(`unexpected fetch() to ${url} — this test only expects Zalo/relay calls`)
}) as typeof fetch

process.env.ZALO_APP_SECRET = 'test-fake-app-secret-not-real'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-fake-service-role-key-not-real'
process.env.ZALO_RELAY_KEY = 'test-fake-relay-key-not-real'
process.env.ZALO_RELAY_URL = FAKE_RELAY_URL_HTTPS

const { default: handler } = await import('./zalo-token.js')

interface FakeRes {
  setHeader: (k: string, v: string) => void
  status: (code: number) => FakeRes
  json: (body: unknown) => FakeRes
  end: () => FakeRes
}

function makeReqRes(): { req: { method: string; body: unknown }; res: FakeRes; state: { statusCode: number; jsonBody: Record<string, unknown> | undefined } } {
  const state: { statusCode: number; jsonBody: Record<string, unknown> | undefined } = { statusCode: 0, jsonBody: undefined }
  const res: FakeRes = {
    setHeader: () => {},
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(body: unknown) {
      state.jsonBody = body as Record<string, unknown>
      return res
    },
    end() {
      return res
    },
  }
  const req = { method: 'POST', body: { code: 'fake-code', code_verifier: 'fake-verifier', app_id: 'fake-app-id' } }
  return { req, res, state }
}

async function testNewAccountStoresZaloIdInAppMetadata(): Promise<void> {
  resetAdminState()
  currentZaloId = 'zalo-new-1'
  currentZaloName = 'Nguyen Van A'
  createUserImpl = async () => ({ data: { user: { id: 'uuid-1' } }, error: null })
  generateLinkImpl = async () => ({
    data: {
      properties: { hashed_token: 'tok-new-1' },
      user: { app_metadata: { zalo_id: 'zalo-new-1' }, user_metadata: { name: 'Nguyen Van A', role: 'seeker' } },
    },
    error: null,
  })

  const { req, res, state } = makeReqRes()
  await handler(req as never, res as never)

  const createUserCall = adminCalls.find((c) => c.method === 'createUser')
  assertTrue(createUserCall, 'createUser must actually be called for a brand-new Zalo user')
  const createUserArgs = createUserCall!.args[0] as { email?: string; app_metadata?: { zalo_id?: string } }
  assertEqual(createUserArgs.email, 'zalo_zalo-new-1@viecganban.vn', 'createUser must be called with the synthetic email derived from the server-verified Zalo id')
  assertEqual(createUserArgs.app_metadata?.zalo_id, 'zalo-new-1', 'createUser must store the server-verified Zalo id in app_metadata.zalo_id (not user_metadata)')

  assertEqual(state.statusCode, 200, 'brand-new Zalo signup must succeed')
  assertEqual(state.jsonBody?.hashed_token, 'tok-new-1', 'a real hashed_token must be returned to the client on success')
}

async function testExistingAccountNotOverwrittenAndReturningLoginSucceeds(): Promise<void> {
  resetAdminState()
  currentZaloId = 'zalo-returning-1'
  createUserImpl = async () => ({ data: null, error: { message: 'User already registered' } })
  generateLinkImpl = async () => ({
    data: {
      properties: { hashed_token: 'tok-returning-1' },
      // 이전 실제 로그인 때 이미 심어져 있던 값 — 지금 이 요청에서 새로 써준 게 아니다.
      user: { app_metadata: { zalo_id: 'zalo-returning-1' }, user_metadata: {} },
    },
    error: null,
  })

  const { req, res, state } = makeReqRes()
  await handler(req as never, res as never)

  const updateCalls = adminCalls.filter((c) => c.method === 'updateUserById')
  assertEqual(updateCalls.length, 0, 'an existing account\'s metadata must never be written/overwritten before (or during) the ownership check')

  const generateLinkCall = adminCalls.find((c) => c.method === 'generateLink')
  assertTrue(generateLinkCall, 'generateLink must be called')
  assertEqual(
    JSON.stringify(generateLinkCall!.args[0]),
    JSON.stringify({ type: 'magiclink', email: 'zalo_zalo-returning-1@viecganban.vn' }),
    'generateLink must be called with only {type, email} — no metadata-writing fields — proving it cannot itself overwrite app_metadata',
  )

  assertEqual(state.statusCode, 200, 'a returning Zalo user (createUser -> already registered) must still be able to log back in')
  assertEqual(state.jsonBody?.hashed_token, 'tok-returning-1', 'returning login must receive a real hashed_token')
}

async function testForgedUserMetadataIsRejectedWithoutToken(): Promise<void> {
  resetAdminState()
  currentZaloId = 'zalo-victim-1'
  createUserImpl = async () => ({ data: null, error: { message: 'User already registered' } })
  generateLinkImpl = async () => ({
    data: {
      properties: { hashed_token: 'tok-should-never-reach-client' },
      // 공격자가 supabase.auth.updateUser({ data: { zalo_id } })로 자기 계정의
      // user_metadata에만 심은 상황 재현 — app_metadata는 비어있다.
      user: { app_metadata: {}, user_metadata: { zalo_id: 'zalo-victim-1' } },
    },
    error: null,
  })

  const { req, res, state } = makeReqRes()
  await handler(req as never, res as never)

  assertEqual(state.statusCode, 409, 'a user_metadata-only zalo_id (client-forgeable) must be rejected')
  assertTrue(!state.jsonBody || !('hashed_token' in state.jsonBody), 'the already-generated hashed_token must never be included in the rejection response')
}

async function testNoOwnershipLinkIsRejectedWithoutToken(): Promise<void> {
  resetAdminState()
  currentZaloId = 'zalo-noinfo-1'
  createUserImpl = async () => ({ data: null, error: { message: 'User already registered' } })
  generateLinkImpl = async () => ({
    data: {
      properties: { hashed_token: 'tok-should-never-reach-client' },
      user: { app_metadata: {}, user_metadata: {} },
    },
    error: null,
  })

  const { req, res, state } = makeReqRes()
  await handler(req as never, res as never)

  assertEqual(state.statusCode, 409, 'an existing account with no app_metadata.zalo_id at all must not be auto-connected by email match alone')
  assertTrue(!state.jsonBody || !('hashed_token' in state.jsonBody), 'no token may be returned when there is no trusted ownership link')
}

async function testHttpRelayIsRejectedBeforeCallingZaloOrRelay(): Promise<void> {
  resetAdminState()
  currentZaloId = 'zalo-whatever'
  process.env.ZALO_RELAY_URL = 'http://103.221.223.71:8787/zalo/me'
  createUserImpl = async () => ({ data: { user: { id: 'uuid-x' } }, error: null })
  generateLinkImpl = async () => ({
    data: { properties: { hashed_token: 'tok-should-never-reach-client' }, user: { app_metadata: { zalo_id: 'zalo-whatever' }, user_metadata: {} } },
    error: null,
  })

  const { req, res, state } = makeReqRes()
  await handler(req as never, res as never)

  assertEqual(state.statusCode, 503, 'a non-HTTPS relay URL must fail closed with 503, not silently use plaintext HTTP')
  assertTrue(!state.jsonBody || !('hashed_token' in state.jsonBody), 'no token may be returned while the relay is HTTP')
  // 2026-09-26: 이 가드는 Zalo 토큰교환(oauth.zaloapp.com)보다도 먼저 와야
  // 한다 — 이전 버전은 relay 호출 직전에만 있어서 매 요청이 이미 Zalo API를
  // 한 번 부른 뒤에야 막혔다(사용자가 직접 지적해서 재배치).
  assertEqual(zaloTokenExchangeCalls.length, 0, 'the Zalo token-exchange API must never be called while the relay is HTTP — the guard must run before it, not just before the relay call')
  assertEqual(relayCalls.length, 0, 'the relay must never actually be called over HTTP — the guard must run before the fetch')
  assertEqual(adminCalls.length, 0, 'no Supabase admin calls should happen at all when login is disabled by the HTTPS guard')
}

async function testDifferentZaloIdAlreadyLinkedIsRejectedWithoutToken(): Promise<void> {
  resetAdminState()
  currentZaloId = 'zalo-me-1'
  createUserImpl = async () => ({ data: null, error: { message: 'User already registered' } })
  generateLinkImpl = async () => ({
    data: {
      properties: { hashed_token: 'tok-should-never-reach-client' },
      user: { app_metadata: { zalo_id: 'zalo-someone-else' }, user_metadata: {} },
    },
    error: null,
  })

  const { req, res, state } = makeReqRes()
  await handler(req as never, res as never)

  assertEqual(state.statusCode, 409, 'an account already linked to a different Zalo id must be rejected')
  assertTrue(!state.jsonBody || !('hashed_token' in state.jsonBody), 'no token may be returned when the account belongs to a different Zalo id')
}

async function main(): Promise<void> {
  const tests = [
    testNewAccountStoresZaloIdInAppMetadata,
    testExistingAccountNotOverwrittenAndReturningLoginSucceeds,
    testForgedUserMetadataIsRejectedWithoutToken,
    testNoOwnershipLinkIsRejectedWithoutToken,
    testHttpRelayIsRejectedBeforeCallingZaloOrRelay,
    testDifferentZaloIdAlreadyLinkedIsRejectedWithoutToken,
  ]
  for (const test of tests) {
    await test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} zaloTokenHandler tests passed`)
}

await main()
