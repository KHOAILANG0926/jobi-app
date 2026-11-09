// Google 결과 저장 30일 정리(Lee 2026-11-09 "Google 결과 저장 방식이 약관에 맞는지 확인하고 필요한 부분만 수정").
// Google Maps Platform 약관: 장소 번호(place id)는 계속 저장해도 되고, 좌표 등 나머지 내용은 최대 30일까지만 임시 저장.
// 위치 확인 저장소(research_artifacts kind map-r1-query)의 Google 결과 중 30일 지난 것은 장소 번호만 남기고 나머지를 비운다
// (줄은 지우지 않음 — 표시 expired). 읽는 쪽(googleFresh)은 expired·30일 지난 결과를 쓰지 않고 필요할 때 다시 묻는다.
// 저장 시각: 새 결과는 cachedAt, 예전 결과는 줄 만든 시각(created_at).
// 필요 환경변수: SUPABASE_DB_URL
import pg from 'pg'

// Google 응답 모양만 고른다: Text Search({places:[…]}), Place Details 웹사이트({websiteUri}). VietMap·Goong 결과는 건드리지 않는다.
export const EXPIRE_SQL = `
with old as (
  select id from public.research_artifacts
   where kind = 'map-r1-query'
     and jsonb_typeof(payload->'data') = 'object'
     and (jsonb_typeof(payload->'data'->'places') = 'array' or (payload->'data') ? 'websiteUri')
     and coalesce((payload->'data'->>'expired')::boolean, false) = false
     and coalesce((payload->'data'->>'cachedAt')::timestamptz, created_at) < now() - interval '30 days'
   limit 2000
)
update public.research_artifacts a
   set payload = jsonb_build_object('data', jsonb_build_object(
         'expired', true,
         'expiredAt', now(),
         'places', coalesce((select jsonb_agg(jsonb_build_object('id', p->>'id'))
                               from jsonb_array_elements(case when jsonb_typeof(a.payload->'data'->'places') = 'array'
                                                              then a.payload->'data'->'places' else '[]'::jsonb end) p
                              where p ? 'id'), '[]'::jsonb)))
  from old where a.id = old.id
returning a.id`

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.SUPABASE_DB_URL
  if (!url) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
  const db = new pg.Client({ connectionString: url })
  await db.connect()
  try {
    const { rowCount } = await db.query(EXPIRE_SQL)
    console.log(`Google 결과 30일 정리: ${rowCount}건(장소 번호만 남김)`)
  } finally { await db.end() }
}
