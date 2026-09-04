import { supabase } from './supabase.ts'

/**
 * fetchEmployerJobs()/checkIsEmployer()가 실제 Supabase 클라이언트 대신 테스트용
 * fake를 주입받을 수 있도록 하는 최소 인터페이스 — supabase-js의 복잡한 제네릭과
 * 싸우지 않고, 이 파일이 실제로 쓰는 메서드 체인만 구조적으로 흉내낸다.
 */
export interface MinimalQueryBuilder {
  select: (columns: string) => MinimalQueryBuilder
  eq: (column: string, value: unknown) => MinimalQueryBuilder
  then: <T>(
    resolve: (result: { data: Record<string, unknown>[] | null; error: unknown }) => T,
  ) => Promise<T> | T
}
export interface MinimalSupabaseClient {
  from: (table: string) => MinimalQueryBuilder
}

/**
 * 로그인한 사용자가 실제로 기업 역할인지 서버측 account_roles 테이블로 확인한다.
 *
 * 2026-09-04 사용자 지시("RequireEmployer가 user_metadata.role을 신뢰하지
 * 않고 실제 account_roles 또는 서버가 신뢰할 수 있는 역할 조회 결과를
 * 사용하도록 수정"): user_metadata.role은 로그인 후 사용자가 스스로
 * `supabase.auth.updateUser({ data: { role: 'employer' } })`로 바꿀 수 있어
 * (서버 검증 없음) 화면 접근 게이트로 신뢰할 수 없다. account_roles는
 * handle_new_auth_user_role() 트리거(SECURITY DEFINER, 가입 시 1회만
 * INSERT, on conflict do nothing)가 채우고 이후 사용자가 직접 쓸 수 있는
 * INSERT/UPDATE 정책이 전혀 없어(RLS 실측 확인, RLS_SECURITY_AUDIT.md 참고)
 * 가입 이후로는 불변이다 — 다만 그 값 자체가 "관리자가 검증한 사업자"라는
 * 뜻은 아니고 "가입 시 스스로 고른 값이 이후로 안 바뀐다"는 뜻일 뿐이라는
 * 점은 과장하지 않는다.
 *
 * 실제 쓰기 권한(local_jobs_employer_insert/update/delete RLS 정책)은 이미
 * 이 테이블(account_roles)을 근거로 판단하고 있었다 — 이 함수는 화면
 * 게이트(RequireEmployer)도 그 판단 기준과 일치시키는 것뿐, 새 권한
 * 체계를 만드는 게 아니다.
 */
export async function checkIsEmployer(
  userId: string,
  client: MinimalSupabaseClient = supabase as unknown as MinimalSupabaseClient,
): Promise<boolean> {
  if (!userId) return false
  const { data } = await client
    .from('account_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'employer')
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.length > 0
}
