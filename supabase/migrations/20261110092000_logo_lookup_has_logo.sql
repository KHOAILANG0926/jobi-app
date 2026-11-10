-- 로고 찾기 기록에 'has_logo'(이미 로고·사진 있음) 결과 추가(Codex #619 P2, Lee 2026-11-10 "이미 로고가 확인된 공고는 재시도 대상에서 제외").
-- 한도 초과(quota)로 남은 공고가 그 뒤 사진을 받거나 새 브랜드와 맞으면 다시 시도할 필요가 없다. 지금은 기록 함수가
-- found/none/no_place/quota만 받아 그런 공고가 quota로 남고, 다시 시도 목록(번호 순, 한 번에 최대 10건)을 계속 차지했다.
-- 바뀌는 것: 기록 함수가 받는 결과 값에 has_logo 하나 추가(나머지 본문·권한·보호 장치 그대로). 공고 데이터 변경 없음.
do $pre$
begin
  if to_regprocedure('public.job_logo_lookup_record(bigint,text,text,text)') is null then raise exception 'logo has_logo: 기록 함수 없음'; end if;
  if pg_get_functiondef('public.job_logo_lookup_record(bigint,text,text,text)'::regprocedure) like '%has_logo%' then
    raise exception 'logo has_logo: 이미 적용됨';
  end if;
end $pre$;

create or replace function public.job_logo_lookup_record(p_job bigint, p_result text, p_domain text, p_place_id text) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare d text := lower(nullif(btrim(coalesce(p_domain, '')), '')); r text := p_result; n integer;
begin
  if r not in ('found', 'none', 'no_place', 'quota', 'has_logo') then raise exception 'logo lookup: 결과 값 오류 %', r; end if;
  if r = 'found' then
    d := regexp_replace(d, '^www\.', '');
    if d is null or d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then r := 'none'; d := null;
    elsif d ~ '(^|\.)(facebook\.com|fb\.com|fb\.me|zalo\.me|zaloapp\.com|google\.com|goo\.gl|business\.site|linkedin\.com|tiktok\.com|youtube\.com|instagram\.com|shopee\.vn|lazada\.vn|tiki\.vn|sendo\.vn|topcv\.vn|vieclam24h\.vn|vietnamworks\.com|careerviet\.vn|careerlink\.vn|mywork\.com\.vn|jobsgo\.vn|joboko\.com|timviecnhanh\.com|itviec\.com|chotot\.com|muaban\.net|yellowpages\.vn|trangvangvietnam\.com|masothue\.com|wordpress\.com|blogspot\.com|wixsite\.com)$' then
      r := 'excluded'; d := null;
    end if;
  else
    d := null;
  end if;
  perform set_config('jobi.logo_lookup_writer', 'on', true);
  update public.local_jobs set company_domain = d,
         logo_lookup = jsonb_build_object('result', r, 'place_id', nullif(p_place_id, ''), 'checked_at', now())
   where id = p_job;
  get diagnostics n = row_count;
  perform set_config('jobi.logo_lookup_writer', '', true);
  if n <> 1 then raise exception 'logo lookup: 공고 % 없음', p_job; end if;
  return r;
end $$;
revoke all on function public.job_logo_lookup_record(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.job_logo_lookup_record(bigint, text, text, text) to service_role;
comment on column public.local_jobs.logo_lookup is '로고 찾기 결과(비공개): result=found/none/no_place/quota/excluded/has_logo, place_id, checked_at.';
