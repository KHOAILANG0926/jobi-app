import { supabase } from './supabase'

/** 본인 한 줄(user_id가 기본 키인 표)을 저장한다: 먼저 고치고, 줄이 없으면 새로 넣는다.
 *  이유: user_profiles·user_cvs는 authenticated에게 user_id 열 UPDATE 권한이 없다(소유 열은 못 바꿈, 0006·0007).
 *  `upsert`(ON CONFLICT DO UPDATE)는 user_id까지 SET에 넣어 실제 PostgREST에서 42501로 거부된다 — 격리 실제 스택 E2E로 확인(#1070 F).
 *  동시에 두 번 처음 저장하면 뒤 요청의 insert가 23505로 지므로 그때 한 번 더 고친다. */
export async function saveOwnRow(table: 'user_profiles' | 'user_cvs', userId: string, values: Record<string, unknown>): Promise<void> {
  const update = async () => {
    const { data, error } = await supabase.from(table).update(values).eq('user_id', userId).select('user_id')
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  }
  if (await update()) return
  const { error } = await supabase.from(table).insert({ user_id: userId, ...values })
  if (!error) return
  if (error.code === '23505' && (await update())) return
  throw new Error(error.message)
}
