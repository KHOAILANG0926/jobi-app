-- 대표 사진·로고 보완 + 외부 API 월 한도 (Lee 2026-11-07 "진행", 1번 전체 보완).
-- ① 외부 API 월 사용 횟수 표 + 예약 함수: 정해진 한도에 닿으면 더 부르지 않는다(Google 무료 한도 보호).
--    google_text_search(위치 확인 회사 검색, Pro 무료 5,000/월) → 4,500에서 멈춤.
--    google_place_website(사진 없는 공고의 회사 웹사이트, Enterprise 무료 1,000/월) → 900에서 멈춤.
--    한도는 호출하는 쪽이 넘기지 않고 이 표(external_api_limits)에만 있다.
-- ② 공고의 회사 웹사이트 주소(company_domain, 공개 칸): 사진·브랜드 로고가 없는 공고만, 위치 확인에서 찾은 Google 장소의
--    웹사이트로 채운다. 화면은 그 사이트 아이콘을 로고로 쓴다(브랜드 로고와 같은 방식). 등록 입구로는 받지 않는다.
--    logo_lookup(비공개 칸): 찾기 결과(found/none/no_place/quota/excluded)와 장소 번호 — 같은 공고를 다시 묻지 않는다.
-- ③ NETCO POST 브랜드 등록(Lee 2026-11-03 브랜드 기준: 공식 출처 지점 3곳 이상, 공고 주소가 실제 지점과 일치).
--    공식 사이트 netco.com.vn 「Hệ thống bưu cục」 81곳, 「CHI NHÁNH BẮC NINH: Tiểu KCN Ba Bên, Phù Chẩn, Từ Sơn, Bắc Ninh」 = 공고 #5599 근무지.

do $pre$
begin
  if to_regclass('public.local_jobs') is null or to_regclass('public.job_brands') is null or to_regclass('public.job_brand_aliases') is null then
    raise exception 'logo lookup: 필요한 표 없음';
  end if;
  if to_regclass('public.external_api_calls') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs'
                and column_name in ('company_domain', 'logo_lookup')) then
    raise exception 'logo lookup: 이미 적용됨';
  end if;
end $pre$;

-- ① 외부 API 월 한도
create table public.external_api_limits (
  api text primary key check (api ~ '^[a-z_]+$'),
  monthly_limit integer not null check (monthly_limit >= 0),
  note text not null
);
comment on table public.external_api_limits is '외부 API 월 한도(Lee 2026-11-07). 무료 한도보다 낮게 둔다. 바꾸려면 migration.';
insert into public.external_api_limits (api, monthly_limit, note) values
  ('google_text_search', 4500, 'Google Places Text Search Pro(이름·주소·좌표) 무료 5,000/월'),
  ('google_place_website', 900, 'Google Place Details Enterprise(websiteUri) 무료 1,000/월');

create table public.external_api_calls (
  api text not null references public.external_api_limits(api),
  month date not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (api, month)
);
comment on table public.external_api_calls is '외부 API 월 사용 횟수(베트남 시간 기준 달). external_api_reserve만 늘린다.';
alter table public.external_api_limits enable row level security;
alter table public.external_api_calls enable row level security;
revoke all on public.external_api_limits, public.external_api_calls from public, anon, authenticated;

-- 한 번 부르기 전에 예약: 한도 안이면 횟수를 1 늘리고 true, 닿았으면 false(부르지 않음).
create function public.external_api_reserve(p_api text) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare lim integer; m date := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date; n integer;
begin
  select monthly_limit into lim from public.external_api_limits where api = p_api;
  if lim is null then raise exception 'external_api_reserve: 모르는 API %', p_api; end if;
  insert into public.external_api_calls (api, month, calls) values (p_api, m, 1)
    on conflict (api, month) do update set calls = external_api_calls.calls + 1
    where external_api_calls.calls < lim
  returning calls into n;
  return n is not null and n <= lim;
end $$;
revoke all on function public.external_api_reserve(text) from public, anon, authenticated;
grant execute on function public.external_api_reserve(text) to service_role;

-- ② 회사 웹사이트(로고)
alter table public.local_jobs
  add column company_domain text check (company_domain is null or company_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  add column logo_lookup jsonb;
comment on column public.local_jobs.company_domain is
  '회사 공식 웹사이트 도메인(Lee 2026-11-07). 사진·브랜드 로고가 없을 때 화면이 이 사이트 아이콘을 로고로 쓴다. job_logo_lookup_record만 쓴다.';
comment on column public.local_jobs.logo_lookup is '로고 찾기 결과(비공개): result=found/none/no_place/quota/excluded, place_id, checked_at.';
grant select (company_domain) on public.local_jobs to anon, authenticated;

-- 등록 입구·다른 경로로는 쓰지 못하게: 새 공고는 비우고, 기록 함수가 켠 표시가 없으면 바뀐 값을 되돌린다.
create function public.job_logo_lookup_guard() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if coalesce(current_setting('jobi.logo_lookup_writer', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.company_domain := null; new.logo_lookup := null;
  else
    new.company_domain := old.company_domain; new.logo_lookup := old.logo_lookup;
  end if;
  return new;
end $$;
create trigger trg_job_logo_lookup_guard before insert or update of company_domain, logo_lookup on public.local_jobs
  for each row execute function public.job_logo_lookup_guard();

-- 기록 함수(서버만): 페이스북·Zalo·구글·쇼핑몰·구인 사이트 주소는 회사 사이트로 쓰지 않는다.
create function public.job_logo_lookup_record(p_job bigint, p_result text, p_domain text, p_place_id text) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare d text := lower(nullif(btrim(coalesce(p_domain, '')), '')); r text := p_result; n integer;
begin
  if r not in ('found', 'none', 'no_place', 'quota') then raise exception 'logo lookup: 결과 값 오류 %', r; end if;
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

-- ③ NETCO POST 브랜드
insert into public.job_brands (name, slug, category, domain, initial, color, active, featured, verified_branches, evidence_url, evidence_note, verified_on) values
  ('NETCO POST', 'netco-post', 'delivery', 'netco.com.vn', 'N', '#0a8f3c', true, true, 81,
   'https://netco.com.vn/vi/contact/post-offices',
   'Trang chính thức 「Hệ thống bưu cục」 liệt kê 81 bưu cục; CHI NHÁNH BẮC NINH: Tiểu KCN Ba Bên, Phù Chẩn, Từ Sơn, Bắc Ninh = tin #5599. Thanh Niên 04/01/2024: 93 chi nhánh trên 63 tỉnh thành.', '2026-11-07')
on conflict (slug) do nothing;
insert into public.job_brand_aliases (brand_id, alias, is_primary)
select b.id, v.alias, v.is_primary from public.job_brands b
join (values ('netco-post', 'NETCO POST', true), ('netco-post', 'Netco Post', false)) as v(slug, alias, is_primary) on v.slug = b.slug
on conflict (brand_id, alias) do nothing;
