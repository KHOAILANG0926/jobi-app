-- 20261110120000_alert_region_keywords_34.sql 시험 DB 준비.
-- 알림 migration(20260927090000_job_alerts.sql) 전체는 시험용 공고 표에 없는 칸을 써서 그대로 못 부른다 →
-- 이 시험에 필요한 부분(글자 정리·키워드 표·지역 찾기 함수)만 그 파일에서 그대로 옮기고, 알림 설정 표는 쓰는 칸만 둔다.
create or replace function public.job_alert_normalize_text(input text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select trim(regexp_replace(regexp_replace(
    translate(
      lower(normalize(coalesce(input, ''), NFC)),
      'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
      'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
    ),
    '[^a-z0-9\s]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

create table if not exists public.job_alert_region_keywords (
  region_id text not null,
  keyword text not null,
  primary key (region_id, keyword)
);


create or replace function public.job_alert_detect_regions(input text)
returns text[]
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  hay text := ' ' || public.job_alert_normalize_text(input) || ' ';
  kw record;
  found text[] := '{}';
begin
  if hay = '  ' then
    return found;
  end if;
  for kw in
    select region_id, keyword from public.job_alert_region_keywords
    order by length(keyword) desc, keyword
  loop
    if position(' ' || kw.keyword || ' ' in hay) > 0 then
      if not kw.region_id = any(found) then
        found := found || kw.region_id;
      end if;
      hay := replace(hay, ' ' || kw.keyword || ' ', ' | ');
    end if;
  end loop;
  return found;
end;
$$;

create table if not exists public.job_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid,
  name text not null,
  region_ids text[] not null default '{}'
);
insert into public.job_alert_preferences (seeker_id, name, region_ids)
values (null, 'test 34', array['bacgiang', 'bacninh', 'longan', 'hanoi']);
