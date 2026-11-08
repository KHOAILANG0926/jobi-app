-- Lee 2026-11-08 "3,4,5,6적용" → 5번 B안("B로 바꾸고 데모 먼저" → "마무리먼저"), 6번 1:1 문의, 4번 고용형태 3개 추가.
-- 1) local_jobs.description_html: 공고 등록 '간편 템플릿'으로 쓴 상세모집요강 모양(HTML). 상세 ④에 그대로 보인다. 없으면 기존처럼 글자.
--    화면에서 보일 때 다시 정리(스크립트·이벤트 제거)한다. 공개 조회 허용(다른 공개 칸과 같음).
-- 2) employment_type_extra: 알바몬처럼 고용형태를 하나 더(최대 2개) — contract(Hợp đồng)·internship(Thực tập)·collaborator(Cộng tác viên).
--    기존 employment_type(필수 1개)·기존 공고는 그대로. 새 칸 추가만(기존 제약 변경 없음).
-- 3) support_inquiries: 고객센터 1:1 문의. 누구나 넣기(상태 'new'만), 읽기·처리는 관리자만(public.is_admin()).
-- 충돌·전제 누락은 RAISE로 전체 취소.
do $pre$
begin
  if to_regclass('public.local_jobs') is null then raise exception 'template_inquiry: local_jobs 없음'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'description_html') then
    raise exception 'template_inquiry: description_html 이미 있음';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'employment_type_extra') then
    raise exception 'template_inquiry: employment_type_extra 이미 있음';
  end if;
  if to_regclass('public.support_inquiries') is not null then raise exception 'template_inquiry: support_inquiries 이미 있음'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'template_inquiry: is_admin() 없음'; end if;
end $pre$;

-- 1) 템플릿 상세모집요강
alter table public.local_jobs add column description_html text
  check (description_html is null or length(description_html) <= 200000);
comment on column public.local_jobs.description_html is '공고 등록 간편 템플릿으로 쓴 상세모집요강 HTML — 상세 ④에 그대로(Lee 2026-11-08 B안). 없으면 description 글자.';
grant select (description_html) on public.local_jobs to anon, authenticated;

-- 2) 고용형태 하나 더
alter table public.local_jobs add column employment_type_extra text
  check (employment_type_extra is null or employment_type_extra in ('contract', 'internship', 'collaborator'));
comment on column public.local_jobs.employment_type_extra is '추가 고용형태(알바몬 최대 2개) — contract·internship·collaborator(Lee 2026-11-08 4번).';
grant select (employment_type_extra) on public.local_jobs to anon, authenticated;

-- 3) 1:1 문의
create table public.support_inquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  audience text not null check (audience in ('seeker', 'employer')),
  category text not null check (length(category) between 1 and 60),
  name text not null check (length(btrim(name)) between 1 and 100),
  contact text not null check (length(btrim(contact)) between 3 and 200),
  message text not null check (length(btrim(message)) between 5 and 4000),
  status text not null default 'new' check (status in ('new', 'done')),
  admin_note text check (admin_note is null or length(admin_note) <= 2000)
);
comment on table public.support_inquiries is '고객센터 1:1 문의(Lee 2026-11-08 6번). 넣기는 누구나, 읽기·처리는 관리자만.';
alter table public.support_inquiries enable row level security;
create policy support_inquiries_insert on public.support_inquiries for insert to anon, authenticated
  with check (status = 'new' and admin_note is null and (user_id is null or user_id = auth.uid()));
create policy support_inquiries_admin_select on public.support_inquiries for select to authenticated using (public.is_admin());
create policy support_inquiries_admin_update on public.support_inquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert (audience, category, name, contact, message) on public.support_inquiries to anon, authenticated;
grant select, update (status, admin_note) on public.support_inquiries to authenticated;
