/**
 * Standalone regression tests for accountRoles.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/accountRoles.test.ts`.
 */
import { checkIsEmployer, type MinimalSupabaseClient, type MinimalQueryBuilder } from './accountRoles.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
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

async function main(): Promise<void> {
  const tests = [
    testCheckIsEmployerTrueWhenRoleRowExists,
    testCheckIsEmployerFalseWhenOnlySeekerRole,
    testCheckIsEmployerFalseWhenNoRoleRowAtAll,
    testCheckIsEmployerFalseForDifferentUser,
    testCheckIsEmployerQueriesAccountRolesNotUserMetadata,
    testCheckIsEmployerFalseForEmptyUserId,
  ]
  for (const test of tests) {
    await test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} accountRoles tests passed`)
}

main()
