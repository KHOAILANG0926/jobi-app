// 알림 지역 키워드 migration 생성기(Lee 2026-11-03 "알림 34개로 맞추기").
// 사용: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/data/gen-alert-region-keywords.mjs <migration 파일>
// 키워드는 src/lib/regionKeywords.ts(화면 지역 판정과 같은 공식 자료)에서만 만든다. 손으로 고치지 않는다.
import { writeFileSync } from 'node:fs'
import { regionKeywords } from '../../src/lib/regionKeywords.ts'

const out = process.argv[2]
if (!out) throw new Error('migration 파일 경로 필요')
const rows = regionKeywords()
const ids = [...new Set(rows.map((r) => r.regionId))]
const q = (s) => `'${s.replace(/'/g, "''")}'`
const values = rows.map((r) => `  (${q(r.regionId)}, ${q(r.keyword)})`).join(',\n')
const sql = `-- 알림 지역을 공식 34개 성으로 맞춘다(Lee 2026-11-03 "알림 34개로 맞추기", 화면 지역 판정과 같은 기준).
-- 생성: scripts/data/gen-alert-region-keywords.mjs (src/lib/regionKeywords.ts) — 손으로 고치지 않는다.
-- 1) job_alert_region_keywords를 새 키워드 ${rows.length}개(지역 ${ids.length}개)로 교체
-- 2) 알림 설정의 옛 성 id(bacgiang → bacninh, longan → tayninh)를 합쳐진 성 id로 바꾸고 중복 제거
-- 파일 하나가 한 트랜잭션(migrations-apply의 psql -1). 확인 실패 시 RAISE로 전체 취소.

delete from public.job_alert_region_keywords;
insert into public.job_alert_region_keywords (region_id, keyword)
select v.region_id, public.job_alert_normalize_text(v.keyword)
from (values
${values}
) as v(region_id, keyword)
on conflict do nothing;

do $$
declare n int;
begin
  -- 옛 성을 고른 알림 조건 수(합쳐진 성으로 바뀌어 지역이 넓어지는 조건) — 운영 적용 기록에 남긴다(Lee 2026-11-10 #625 조건 2)
  select count(*) into n from public.job_alert_preferences where region_ids && array['bacgiang', 'longan'];
  raise notice '옛 성(bacgiang·longan) 알림 조건 %건 → 합쳐진 성(bacninh·tayninh)으로', n;
end $$;

update public.job_alert_preferences p
set region_ids = (
  select array_agg(distinct x order by x)
  from unnest(p.region_ids) as r(id)
  cross join lateral (select case r.id when 'bacgiang' then 'bacninh' when 'longan' then 'tayninh' else r.id end as x) m
)
where p.region_ids && array['bacgiang', 'longan'];

do $$
declare n int;
begin
  select count(distinct region_id) into n from public.job_alert_region_keywords;
  if n <> ${ids.length} then raise exception '알림 지역 키워드 지역 수 % (기대 ${ids.length})', n; end if;
  if exists (select 1 from public.job_alert_region_keywords where region_id in ('bacgiang', 'longan')) then
    raise exception '옛 성 id 키워드가 남음';
  end if;
  if exists (select 1 from public.job_alert_preferences where region_ids && array['bacgiang', 'longan']) then
    raise exception '알림 설정에 옛 성 id가 남음';
  end if;
  if public.job_alert_detect_regions('KCN Đình Trám, Việt Yên, Bắc Giang') <> array['bacninh'] then
    raise exception '옛 Bắc Giang 주소가 Bắc Ninh으로 잡히지 않음: %', public.job_alert_detect_regions('KCN Đình Trám, Việt Yên, Bắc Giang');
  end if;
end $$;
`
writeFileSync(out, sql)
console.log(out, rows.length, 'keywords,', ids.length, 'regions')
