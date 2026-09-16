/**
 * Standalone regression tests for accountRoles.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/accountRoles.test.ts`.
 */
import { checkIsEmployer, checkIsAdmin, type MinimalSupabaseClient, type MinimalQueryBuilder, type MinimalAuthClient } from './accountRoles.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertTrue(value: unknown, label: string): void {
  if (!value) throw new Error(label)
}

interface FakeCall {
  method: string
  args: unknown[]
}

/** account_roles 테이블 하나만 아는 가짜 Supabase 클라이언트 — 실제 체인
 * (.from('account_roles').select('role').eq('user_id', x).eq('role', 'employer'))
 * 을 기록하고, 미리 넣어둔 행 중 필터를 통과하는 것만 돌려준다. */
function makeFakeClient(rows: Record<string, unknown>[]): { client: MinimalSupabaseClient; calls: FakeCall[] } {
  const calls: FakeCall[] = []
  function builder(currentRows: Record<string, unknown>[]): MinimalQueryBuilder {
    return {
      select(columns: string) {
        calls.push({ method: 'select', args: [columns] })
        return builder(currentRows)
      },
      eq(column: string, value: unknown) {
        calls.push({ method: 'eq', args: [column, value] })
        return builder(currentRows.filter((r) => r[column] === value))
      },
      then(resolve) {
        return Promise.resolve(resolve({ data: currentRows, error: null }))
      },
    }
  }
  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ method: 'from', args: [table] })
        return builder(table === 'account_roles' ? rows : [])
      },
    },
  }
}

async function testCheckIsEmployerTrueWhenRoleRowExists(): Promise<void> {
  const { client } = makeFakeClient([{ user_id: 'u1', role: 'employer' }])
  const result = await checkIsEmployer('u1', client)
  assertEqual(result, true, 'account_roles has a matching employer row -> true')
}

async function testCheckIsEmployerFalseWhenOnlySeekerRole(): Promise<void> {
  // 실사례: 같은 유저가 seeker 행만 있고 employer 행은 없는 경우 — 값이
  // 섞여 있어도 role='employer' 필터를 통과하는 행이 없으면 false여야 한다.
  const { client } = makeFakeClient([{ user_id: 'u1', role: 'seeker' }])
  const result = await checkIsEmployer('u1', client)
  assertEqual(result, false, "user has only a 'seeker' account_roles row -> false, never trust user_metadata")
}

async function testCheckIsEmployerFalseWhenNoRoleRowAtAll(): Promise<void> {
  const { client } = makeFakeClient([])
  const result = await checkIsEmployer('u1', client)
  assertEqual(result, false, 'no account_roles row at all -> false')
}

async function testCheckIsEmployerFalseForDifferentUser(): Promise<void> {
  // 다른 유저의 employer 행이 있어도 자기 자신(user_id)으로 필터링되지
  // 않으면 절대 true가 되면 안 된다.
  const { client } = makeFakeClient([{ user_id: 'someone-else', role: 'employer' }])
  const result = await checkIsEmployer('u1', client)
  assertEqual(result, false, "another user's employer row must not leak into this user's check")
}

async function testCheckIsEmployerQueriesAccountRolesNotUserMetadata(): Promise<void> {
  // 이 테스트가 진짜로 지키는 것: user_metadata를 전혀 안 보고 account_roles
  // 테이블만 쿼리하는지 — 호출 기록으로 확인한다.
  const { client, calls } = makeFakeClient([{ user_id: 'u1', role: 'employer' }])
  await checkIsEmployer('u1', client)
  const fromCalls = calls.filter((c) => c.method === 'from')
  assertEqual(fromCalls.length, 1, 'must query exactly one table')
  assertEqual(fromCalls[0].args[0], 'account_roles', 'must query account_roles, never user_metadata or any other table')
  const eqCalls = calls.filter((c) => c.method === 'eq')
  assertEqual(
    eqCalls.some((c) => c.args[0] === 'user_id' && c.args[1] === 'u1'),
    true,
    'must filter by the actual user_id (auth.uid()-equivalent), not trust a client-supplied role claim',
  )
  assertEqual(
    eqCalls.some((c) => c.args[0] === 'role' && c.args[1] === 'employer'),
    true,
    'must filter for role=employer specifically',
  )
}

async function testCheckIsEmployerFalseForEmptyUserId(): Promise<void> {
  const { client, calls } = makeFakeClient([{ user_id: '', role: 'employer' }])
  const result = await checkIsEmployer('', client)
  assertEqual(result, false, 'empty userId must never resolve true (no logged-in user -> not an employer)')
  assertEqual(calls.length, 0, 'empty userId should short-circuit without even querying')
}

/** 2026-09-15 사용자 지시로 추가: 예전엔 error를 확인하지 않아 "권한 없음"과
 *  "조회 실패"가 똑같이 false로 뭉개졌다 — 이제는 예외를 던져야 한다
 *  (RequireEmployer가 이 예외로 두 상태를 구분해서 처리한다). */
async function testCheckIsEmployerThrowsOnQueryError(): Promise<void> {
  const failingClient: MinimalSupabaseClient = {
    from(_table: string): MinimalQueryBuilder {
      const builder: MinimalQueryBuilder = {
        select: () => builder,
        eq: () => builder,
        then: (resolve) => Promise.resolve(resolve({ data: null, error: { message: 'network error' } })),
      }
      return builder
    },
  }
  let threw = false
  try {
    await checkIsEmployer('u1', failingClient)
  } catch {
    threw = true
  }
  assertTrue(threw, 'checkIsEmployer must throw (not silently return false) when the account_roles query itself fails')
}

/** 2026-09-15 사용자 지시로 추가(Astra 조사, RequireAdmin.tsx 동일 문제) —
 *  checkIsAdmin()도 auth.getUser() 실패 시 예외를 던져야 한다. */
function makeFakeAuthClient(user: { app_metadata?: { role?: string } } | null, error: unknown = null): MinimalAuthClient {
  return { auth: { getUser: () => Promise.resolve({ data: { user }, error }) } }
}

async function testCheckIsAdminTrueWhenAppMetadataRoleIsAdmin(): Promise<void> {
  const client = makeFakeAuthClient({ app_metadata: { role: 'admin' } })
  const result = await checkIsAdmin(client)
  assertEqual(result, true, 'app_metadata.role === "admin" -> true')
}

async function testCheckIsAdminFalseForNonAdminRole(): Promise<void> {
  const client = makeFakeAuthClient({ app_metadata: { role: 'seeker' } })
  const result = await checkIsAdmin(client)
  assertEqual(result, false, 'app_metadata.role !== "admin" -> false, never trust anything else')
}

async function testCheckIsAdminFalseWhenNoUser(): Promise<void> {
  const client = makeFakeAuthClient(null)
  const result = await checkIsAdmin(client)
  assertEqual(result, false, 'no user in response -> false')
}

async function testCheckIsAdminThrowsOnQueryError(): Promise<void> {
  const client = makeFakeAuthClient(null, { message: 'network error' })
  let threw = false
  try {
    await checkIsAdmin(client)
  } catch {
    threw = true
  }
  assertTrue(threw, 'checkIsAdmin must throw (not silently return false) when auth.getUser() itself fails')
}

async function main(): Promise<void> {
  const tests = [
    testCheckIsEmployerTrueWhenRoleRowExists,
    testCheckIsEmployerFalseWhenOnlySeekerRole,
    testCheckIsEmployerFalseWhenNoRoleRowAtAll,
    testCheckIsEmployerFalseForDifferentUser,
    testCheckIsEmployerQueriesAccountRolesNotUserMetadata,
    testCheckIsEmployerFalseForEmptyUserId,
    testCheckIsEmployerThrowsOnQueryError,
    testCheckIsAdminTrueWhenAppMetadataRoleIsAdmin,
    testCheckIsAdminFalseForNonAdminRole,
    testCheckIsAdminFalseWhenNoUser,
    testCheckIsAdminThrowsOnQueryError,
  ]
  for (const test of tests) {
    await test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} accountRoles tests passed`)
}

main()
