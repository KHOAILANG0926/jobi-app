-- "Thương hiệu" 브랜드 마스터를 코드 하드코딩(src/data/brandDirectory.ts)에서
-- 운영 데이터로 전환한다. 2026-09-10 사용자 지시: 신규 공고가 계속 쌓이는
-- 구조에서 브랜드 추가마다 코드 수정/배포가 필요한 것은 부적합 — 등록
-- 브랜드는 관리자가 Supabase에서 관리하고, 신규 브랜드는 "후보 탐지 →
-- 관리자 승인" 절차를 거쳐서만 공개된다(신규 회사라고 자동 공개하지 않음).
--
-- local_jobs는 전혀 건드리지 않는다(데이터 삭제/재작성 없음) — 이 마이그레이션은
-- 전부 새 테이블/함수 추가(additive)이며, 브랜드-공고 매칭은 여기서 만드는
-- job_brand_aliases를 클라이언트가 기존 normalizeViText 부분일치 로직으로
-- 매 렌더마다 다시 계산하는 방식을 그대로 유지한다(기존 computeBrandCounts
-- 패턴과 동일) — DB 트리거나 크롤러(Python) 쪽 변경은 필요 없다.

begin;

create table public.job_brands (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  category text not null check (category in ('fastfood','cafe','bakery','convenience','delivery')),
  domain text,
  initial text not null,
  color text not null,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.job_brands is
  '"Thương hiệu" 메가메뉴/franchise-jobs 대상 브랜드 마스터. 관리자 승인을 거친
   브랜드만 존재한다(자동 공개 없음). active=false는 메뉴에서 숨기되 데이터는
   보존(완전 삭제 금지). featured는 관리자가 직접 지정 — 예전처럼 활성 공고 수
   임계값으로 자동 계산하지 않는다(2026-09-10 사용자 지시).';

create table public.job_brand_aliases (
  id bigint generated always as identity primary key,
  brand_id bigint not null references public.job_brands(id) on delete cascade,
  alias text not null,
  -- 브랜드당 정확히 1개만 true — Mega Menu/franchise-jobs 클릭 시 Home.tsx의
  -- 기존 ?brand= 부분일치 필터로 그대로 넘길 "대표 alias"(예전 brandDirectory.ts의
  -- linkTo와 동일 역할). 여러 alias 중 어느 것이든 매칭 자체는 동일하게 되므로
  -- UI 클릭 링크 값의 선택 문제일 뿐 — 삽입 순서에 기대지 않고 명시적으로 고정한다.
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (brand_id, alias)
);
comment on table public.job_brand_aliases is
  '브랜드별 회사명/공고제목 매칭 문자열. 클라이언트가 normalizeViText로 대소문자/
   베트남어 발음구별기호/공백을 정규화해 job.company·job.title 부분일치를 본다
   (src/data/brandDirectory.ts의 jobMatchesBrand와 동일 로직). "GSM"/"SM"/
   "Coffee" 같은 단독 범용 단어는 admin_upsert_brand()가 거부한다(아래 참고).';

create table public.job_brand_candidate_dismissals (
  company_key text primary key,
  dismissed_by uuid references auth.users(id),
  dismissed_at timestamptz not null default now(),
  note text not null default ''
);
comment on table public.job_brand_candidate_dismissals is
  '관리자가 "무시"한 브랜드 후보 회사명(normalizeViText 정규화 키). 후보 탐지는
   local_jobs를 매 조회마다 다시 스캔하는 파생 결과라 별도 후보 테이블이 없고,
   이 테이블 하나로 "다시 뜨지 않아야 할 후보"만 기억한다. 해당 회사가 나중에
   실제로 브랜드 승인되면 admin_upsert_brand()가 이 행을 자동 삭제한다.';

alter table public.job_brands enable row level security;
alter table public.job_brand_aliases enable row level security;
alter table public.job_brand_candidate_dismissals enable row level security;

-- 공개 SELECT: active 브랜드/alias만(비로그인 방문자도 메가메뉴를 봄) — 관리자는
-- is_admin()으로 비활성 포함 전체를 추가로 본다(두 permissive 정책의 OR).
create policy job_brands_public_select on public.job_brands
  for select using (active = true);
create policy job_brands_admin_select on public.job_brands
  for select using (is_admin());

create policy job_brand_aliases_public_select on public.job_brand_aliases
  for select using (
    active = true
    and exists (select 1 from public.job_brands b where b.id = brand_id and b.active = true)
  );
create policy job_brand_aliases_admin_select on public.job_brand_aliases
  for select using (is_admin());

-- 후보 무시 목록은 관리자 전용(공개 정책 없음) — 일반 사용자/비로그인은 조회 불가.
create policy job_brand_candidate_dismissals_admin_select on public.job_brand_candidate_dismissals
  for select using (is_admin());

grant select on public.job_brands to anon, authenticated;
grant select on public.job_brand_aliases to anon, authenticated;
grant select on public.job_brand_candidate_dismissals to authenticated;

-- 쓰기는 전부 아래 SECURITY DEFINER 함수를 통해서만 이뤄진다(admin_set_job_hidden/
-- admin_handle_report와 동일 패턴) — 테이블에 직접 INSERT/UPDATE/DELETE RLS
-- 정책을 만들지 않는다.

create or replace function public.admin_upsert_brand(
  p_id bigint,
  p_name text,
  p_slug text,
  p_category text,
  p_domain text,
  p_initial text,
  p_color text,
  p_active boolean,
  p_featured boolean,
  p_aliases text[],
  p_clear_candidate_keys text[] default null
) returns public.job_brands
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller uuid := public.require_admin();
  result public.job_brands;
  -- 2026-09-10 사용자 지시: 짧고 범용적인 단독 alias(예: 단독 "GSM"/"SM"/
  -- "Coffee")는 브랜드 오탐 위험이 커 등록 자체를 막는다 — 정상 alias는
  -- 실제 회사/브랜드 고유명("Jollibee", "Xanh Và Thông Minh GSM" 등)이라
  -- 아래 목록과 정확히 일치하지 않는다.
  denylist text[] := array[
    'gsm','sm','coffee','cafe','food','mart','group','express','care',
    'plus','tech','shop','store','vietnam','viet nam','jsc','tnhh',
    'company','co','ltd','co ltd'
  ];
  a text;
  na text;
begin
  if p_aliases is null or array_length(p_aliases, 1) is null then
    raise exception 'at least one alias is required';
  end if;

  foreach a in array p_aliases loop
    na := lower(trim(regexp_replace(a, '\s+', ' ', 'g')));
    if na = '' then
      raise exception 'alias must not be empty';
    end if;
    if char_length(na) < 3 then
      raise exception 'alias "%" is too short to register safely', a;
    end if;
    if na = any(denylist) then
      raise exception 'alias "%" is too generic to register alone', a;
    end if;
  end loop;

  if p_id is null then
    insert into public.job_brands (name, slug, category, domain, initial, color, active, featured)
    values (p_name, p_slug, p_category, nullif(p_domain, ''), p_initial, p_color,
      coalesce(p_active, true), coalesce(p_featured, false))
    returning * into result;
  else
    update public.job_brands set
      name = p_name,
      slug = p_slug,
      category = p_category,
      domain = nullif(p_domain, ''),
      initial = p_initial,
      color = p_color,
      active = coalesce(p_active, active),
      featured = coalesce(p_featured, featured),
      updated_at = now()
    where id = p_id
    returning * into result;
    if result.id is null then raise exception 'brand not found'; end if;
  end if;

  delete from public.job_brand_aliases where brand_id = result.id;
  insert into public.job_brand_aliases (brand_id, alias, is_primary)
  select result.id, a, (ord = 1)
  from unnest(p_aliases) with ordinality as t(a, ord);

  if p_clear_candidate_keys is not null then
    delete from public.job_brand_candidate_dismissals
    where company_key = any (p_clear_candidate_keys);
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (
    caller,
    case when p_id is null then 'brand.create' else 'brand.update' end,
    'brand',
    result.id::text,
    jsonb_build_object('name', p_name, 'slug', p_slug, 'aliases', p_aliases, 'active', result.active, 'featured', result.featured)
  );

  return result;
end;
$function$;

create or replace function public.admin_dismiss_brand_candidate(
  p_company_key text,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller uuid := public.require_admin();
begin
  if p_company_key is null or trim(p_company_key) = '' then
    raise exception 'company_key is required';
  end if;

  insert into public.job_brand_candidate_dismissals (company_key, dismissed_by, note)
  values (p_company_key, caller, coalesce(p_note, ''))
  on conflict (company_key) do update set
    dismissed_at = now(),
    dismissed_by = excluded.dismissed_by,
    note = excluded.note;

  insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (caller, 'brand_candidate.dismiss', 'brand_candidate', p_company_key, jsonb_build_object('note', coalesce(p_note, '')));
end;
$function$;

-- 2026-09-10 0020_admin_functions_revoke_anon_execute_draft.sql(검토 대기 중인
-- 별도 하드닝 초안)와 같은 방향으로, 여기서 새로 만드는 함수는 처음부터
-- anon에는 권한을 주지 않는다(관리자는 항상 로그인된 authenticated 세션으로
-- 호출 — require_admin()이 비관리자는 어차피 막지만, 방어심층 원칙상 불필요한
-- 권한을 아예 주지 않는다). 이 revoke/grant는 이 두 새 함수에만 적용되며
-- 0020 초안이 다루는 기존 5개 함수는 건드리지 않는다(별도 승인 대기 유지).
revoke execute on function public.admin_upsert_brand(bigint, text, text, text, text, text, text, boolean, boolean, text[], text[]) from public, anon;
grant execute on function public.admin_upsert_brand(bigint, text, text, text, text, text, text, boolean, boolean, text[], text[]) to authenticated;
revoke execute on function public.admin_dismiss_brand_candidate(text, text) from public, anon;
grant execute on function public.admin_dismiss_brand_candidate(text, text) to authenticated;

-- 기존 13개 브랜드를 초기 데이터로 이전(src/data/brandDirectory.ts, 2026-09-10
-- 운영 DB 실측 기준 최종본과 완전히 동일한 name/matchKeys/category/domain/
-- initial/color) — 공고 수/매칭 결과를 바꾸지 않는다. featured는 이전 화면의
-- "count>=2 자동 노출" 결과와 동일하게 8개만 true로 시작한다(Americano Coffee
-- 12/Jollibee 6/Xanh SM 5/SPX Express 4/The Orange Coffee 3/McDonald's 2/
-- Tamba Coffee 2/Shopee 2) — 이후로는 관리자가 featured를 직접 바꾼다.
insert into public.job_brands (name, slug, category, domain, initial, color, active, featured) values
  ('Jollibee', 'jollibee', 'fastfood', 'jollibee.com.vn', 'J', '#ce1126', true, true),
  ('McDonald''s', 'mcdonalds', 'fastfood', 'mcdonalds.com', 'M', '#ffc72c', true, true),
  ('Pizza Hut', 'pizza-hut', 'fastfood', null, 'P', '#e4002b', true, false),
  ('Americano Coffee', 'americano-coffee', 'cafe', null, 'A', '#6f4e37', true, true),
  ('The Orange Coffee', 'the-orange-coffee', 'cafe', null, 'O', '#f97316', true, true),
  ('Tamba Coffee', 'tamba-coffee', 'cafe', null, 'T', '#8b4513', true, true),
  ('Seven Coffee', 'seven-coffee', 'cafe', null, 'S', '#4a2c2a', true, false),
  ('Trung Nguyên E-Coffee', 'trung-nguyen-e-coffee', 'cafe', null, 'T', '#7a3e10', true, false),
  ('BreadTalk', 'breadtalk', 'bakery', null, 'B', '#c0392b', true, false),
  ('GS25', 'gs25', 'convenience', null, 'G', '#00a651', true, false),
  ('SPX Express', 'spx-express', 'delivery', null, 'S', '#ee4d2d', true, true),
  ('Xanh SM (GSM)', 'xanh-sm-gsm', 'delivery', null, 'X', '#00b14f', true, true),
  ('Shopee', 'shopee', 'delivery', 'shopee.vn', 'S', '#ee4d2d', true, true);

-- is_primary는 예전 brandDirectory.ts의 linkTo 값과 정확히 동일한 alias에만
-- true를 준다 — Home.tsx의 ?brand= 클릭 필터 결과(표시되는 공고 수)가 마이그레이션
-- 전후로 달라지지 않도록 하기 위함(어떤 alias든 매칭 자체는 같지만, 클릭 링크에
-- 실어 보내는 텍스트는 기존과 동일하게 고정).
insert into public.job_brand_aliases (brand_id, alias, is_primary)
select b.id, v.alias, v.is_primary from public.job_brands b
join (values
  ('jollibee', 'Jollibee', true),
  ('mcdonalds', 'McDonald''s', true),
  ('mcdonalds', 'McDonald', false),
  ('pizza-hut', 'Pizza Hut', true),
  ('americano-coffee', 'Americano Coffee', true),
  ('the-orange-coffee', 'Orange Coffee', true),
  ('tamba-coffee', 'Tamba Coffee', true),
  ('seven-coffee', 'Seven Coffee', true),
  ('trung-nguyen-e-coffee', 'Trung Nguyên E Coffee', true),
  ('trung-nguyen-e-coffee', 'Trung Nguyên E-Coffee', false),
  ('breadtalk', 'Breadtalk', true),
  ('gs25', 'Gs 25', false),
  ('gs25', 'GS25', true),
  ('gs25', 'GS 25', false),
  ('spx-express', 'Spx Express', true),
  ('spx-express', 'SPX EXPRESS', false),
  ('xanh-sm-gsm', 'Xanh Và Thông Minh GSM', true),
  ('shopee', 'Shopee', true)
) as v(slug, alias, is_primary) on v.slug = b.slug;

commit;
