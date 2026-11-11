-- 한국 사이트(외국인 근로자 커뮤니티, 저장소 KHOAILANG0926/korea-site) 전용 표. Lee 2026-11-11 "DB 진행".
-- 같은 Supabase·같은 회원(auth.users)을 쓰되 ks_ 표로만 분리 → 커지면 ks_ 표만 떼어 옮긴다.
-- local_jobs·korea_jobs 계열과 FK·함수 결합 없음. 일자리는 새 표를 만들지 않고 기존 korea_jobs_public을 읽는다.
-- 원칙: 나라·언어는 값(host_country, lang), 개인정보 최소(실명·연락처 안 받음), 지우지 않고 hidden.

create table if not exists public.ks_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  gender text not null check (gender in ('nam','nu')),
  nationality text not null check (char_length(nationality) between 2 and 3),
  visa text not null default 'NONE' check (visa in ('E-9','E-8','H-2','E-7','D-2','D-4','D-10','F-2','F-4','F-5','F-6','NONE')),
  region text not null check (char_length(region) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ks_profiles_nickname_uq on public.ks_profiles (lower(nickname));

create table if not exists public.ks_posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.ks_profiles(user_id) on delete cascade,
  topic text not null check (topic in ('cong-viec','doi-cong-ty','visa','cuoc-song','hoi-dap')),
  title text not null check (char_length(title) between 4 and 100),
  body text not null check (char_length(body) between 4 and 5000),
  lang text not null default 'vi',
  host_country text not null default 'KR',
  hidden boolean not null default false, -- 신고·자동 검사로 숨김(삭제 아님)
  created_at timestamptz not null default now()
);
create index if not exists ks_posts_recent on public.ks_posts (created_at desc) where not hidden;

create table if not exists public.ks_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.ks_posts(id) on delete cascade,
  author_id uuid not null references public.ks_profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ks_comments_post on public.ks_comments (post_id, created_at);

create table if not exists public.ks_companies (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 80),
  region text not null check (char_length(region) between 1 and 40),
  industry text check (char_length(industry) <= 40),
  host_country text not null default 'KR',
  created_at timestamptz not null default now()
);
-- 같은 이름+지역은 한 회사로 모은다(회사별로 이야기가 쌓이게)
create unique index if not exists ks_companies_name_region_uq on public.ks_companies (host_country, lower(name), lower(region));

create table if not exists public.ks_reviews (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.ks_companies(id) on delete cascade,
  author_id uuid not null references public.ks_profiles(user_id) on delete cascade,
  author_visa text not null, -- 쓴 당시 비자(본인 프로필에서 서버가 채움)
  monthly_pay_manwon int check (monthly_pay_manwon between 0 and 2000),
  overtime text check (overtime in ('it','vua','nhieu')),
  dorm boolean,
  vietnamese_count int check (vietnamese_count between 0 and 10000),
  body text check (char_length(body) <= 3000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ks_reviews_company on public.ks_reviews (company_id, created_at desc);

-- 권한: 읽기는 누구나(숨김 제외), 쓰기는 로그인한 본인만. 고치기·지우기 정책 없음(hidden으로만).
alter table public.ks_profiles enable row level security;
alter table public.ks_posts enable row level security;
alter table public.ks_comments enable row level security;
alter table public.ks_companies enable row level security;
alter table public.ks_reviews enable row level security;

revoke all on public.ks_profiles, public.ks_posts, public.ks_comments, public.ks_companies, public.ks_reviews from anon, authenticated;
-- 프로필: 남에게는 닉네임·비자·지역만(성별·국적은 본인만 — ks_my_profile)
grant select (user_id, nickname, visa, region, created_at) on public.ks_profiles to anon, authenticated;
grant insert (user_id, nickname, gender, nationality, visa, region) on public.ks_profiles to authenticated;
grant update (visa, region, updated_at) on public.ks_profiles to authenticated; -- 성별·국적은 가입 뒤 못 바꿈
grant select on public.ks_posts, public.ks_comments, public.ks_companies, public.ks_reviews to anon, authenticated;
grant insert (author_id, topic, title, body, lang, host_country) on public.ks_posts to authenticated;
grant insert (post_id, author_id, body) on public.ks_comments to authenticated;
-- 회사·후기 쓰기는 ks_add_review 한 곳으로만(같은 회사 모으기 + 비자 위조 막기)

create policy ks_profiles_read on public.ks_profiles for select using (true);
create policy ks_profiles_insert on public.ks_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy ks_profiles_update on public.ks_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ks_posts_read on public.ks_posts for select using (not hidden);
create policy ks_posts_insert on public.ks_posts for insert to authenticated with check (auth.uid() = author_id);
create policy ks_comments_read on public.ks_comments for select using (not hidden);
create policy ks_comments_insert on public.ks_comments for insert to authenticated with check (auth.uid() = author_id);
create policy ks_companies_read on public.ks_companies for select using (true);
create policy ks_reviews_read on public.ks_reviews for select using (not hidden);

create or replace function public.ks_my_profile()
returns setof public.ks_profiles language sql stable security definer set search_path = public as $$
  select * from public.ks_profiles where user_id = auth.uid()
$$;

create or replace function public.ks_add_review(
  p_company text, p_region text, p_industry text,
  p_pay int, p_overtime text, p_dorm boolean, p_viet int, p_body text
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_visa text; v_company bigint;
begin
  select visa into v_visa from public.ks_profiles where user_id = auth.uid();
  if v_visa is null then raise exception 'ks_profile_required'; end if;
  insert into public.ks_companies (name, region, industry)
    values (btrim(p_company), btrim(p_region), nullif(btrim(p_industry), ''))
    on conflict (host_country, lower(name), lower(region)) do nothing;
  select id into v_company from public.ks_companies
    where host_country = 'KR' and lower(name) = lower(btrim(p_company)) and lower(region) = lower(btrim(p_region));
  insert into public.ks_reviews (company_id, author_id, author_visa, monthly_pay_manwon, overtime, dorm, vietnamese_count, body)
    values (v_company, auth.uid(), v_visa, p_pay, p_overtime, p_dorm, p_viet, nullif(btrim(p_body), ''));
  return v_company; -- 화면이 후기를 쓴 회사로 바로 이동
end $$;

revoke all on function public.ks_my_profile() from public, anon;
revoke all on function public.ks_add_review(text, text, text, int, text, boolean, int, text) from public, anon;
grant execute on function public.ks_my_profile() to authenticated;
grant execute on function public.ks_add_review(text, text, text, int, text, boolean, int, text) to authenticated;
