-- 구직 희망조건 저장 → 공고 매칭 → 새 공고 앱 내 알림 (1차, 2026-09-27 사용자 지시).
--
-- 범위: 로그인 구직자가 지역·이동거리·업무·희망급여·근무시간을 각각 '필수/선호'로
-- 지정해 저장/수정/중지하고, 새 공고가 필수조건을 "확인된 상태로" 전부 충족할 때만
-- 앱 안 알림을 만든다. 자연어 AI 입력·조건부 허용·외부 알림(이메일/Zalo)·기업용
-- 구직자 검색·통계는 이번 범위 밖이다. 기업에 구직자 조건/위치를 공개하는 경로는
-- 만들지 않는다(모든 테이블이 본인 행만 접근 가능).
--
-- 판정 원칙: 조건마다 'match'(충족) / 'mismatch'(불일치) / 'unknown'(정보 미확인)
-- 세 가지로만 판정한다. 공고에 정보가 없거나 비교 근거가 없으면(급여 협의, 다른
-- 지급 주기, 근무시간 미표기, 신뢰 좌표 없음 등) 절대 충족으로 추정하지 않고
-- 'unknown'으로 둔다. 판정 로직은 이 파일의 job_alert_evaluate() 한 곳에만 있고,
-- 화면(job_alert_match_jobs RPC)과 알림 생성(job_alert_generate_notifications)이
-- 같은 함수를 쓴다 — 화면과 알림의 판정이 어긋나지 않게 하기 위함.
--
-- 알림 생성 시점: pg_cron 15분 배치. local_jobs INSERT 트리거로 하지 않는 이유 —
-- 크롤러는 local_jobs를 먼저 넣고 job_work_locations(지역·좌표)를 나중에 넣으므로
-- INSERT 순간에는 지역이 항상 'unknown'이 된다. 배치는 (preference_id, job_id)
-- UNIQUE로 중복 없이, 조건 생성(또는 재개) 이후 최근 14일 안에 들어온 공고만
-- 대상으로 한다. 나중에 정보가 채워져 필수조건을 충족하게 된 공고도 다음 배치에서
-- 1회 알림된다.
--
-- 집 위치(이동거리 조건): 원문 주소는 DB에 저장하지 않는다(클라이언트가 좌표로만
-- 변환해서 보냄). 구직자가 명시적으로 동의한 경우에만 저장하고, numeric(6,3)/
-- numeric(7,3) 컬럼 타입 자체가 소수점 3자리(약 100m)로 반올림하므로 클라이언트가
-- 더 정밀한 값을 보내도 서버에 정밀 좌표가 남지 않는다. 본인만 조회/수정/삭제 가능.
--
-- 1차 배포 범위: 운영 공고에 거리 판정 가능한 좌표가 0건(2026-09-27 조회: 좌표 있는
-- 근무지 102행 전부 미검증 ward)이라 프론트에서 거리 조건 선택과 집 위치 수집을 끈다
-- (src/lib/jobAlerts.ts DISTANCE_MATCHING_ENABLED=false). 스키마·판정은 거리 조건을
-- 그대로 지원하므로 위치 데이터 보강 후 프론트 플래그만 켜면 된다.

begin;

-- ---------------------------------------------------------------------------
-- 1. 텍스트 정규화 + 지역 키워드 (src/data/jobRegions.ts의 JOB_REGIONS와 동일 목록,
--    src/lib/jobAlerts.test.ts가 두 목록이 같은지 검사한다)
-- ---------------------------------------------------------------------------

-- src/lib/jobCoords.ts normalizeViText()와 같은 규칙(소문자, 성조 제거, đ→d,
-- 영숫자 외 공백, 공백 1칸).
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

truncate public.job_alert_region_keywords;
insert into public.job_alert_region_keywords (region_id, keyword)
select v.region_id, public.job_alert_normalize_text(v.keyword)
from (values
  ('hanoi', 'ha noi'), ('hanoi', 'hanoi'), ('hanoi', 'ha dong'), ('hanoi', 'cau giay'), ('hanoi', 'dong da'),
  ('hanoi', 'hoan kiem'), ('hanoi', 'long bien'), ('hanoi', 'nam tu liem'), ('hanoi', 'bac tu liem'),
  ('hanoi', 'hai ba trung'), ('hanoi', 'tay ho'), ('hanoi', 'thanh xuan'), ('hanoi', 'hoa binh'),
  ('hanoi', 'luong son'), ('hanoi', 'ky son'),
  ('haiphong', 'hai phong'), ('haiphong', 'ngo quyen'), ('haiphong', 'le chan'), ('haiphong', 'kien an'),
  ('haiphong', 'hai duong'), ('haiphong', 'chi linh'), ('haiphong', 'cam giang'), ('haiphong', 'tu ky'),
  ('haiphong', 'nam sach'), ('haiphong', 'kinh mon'),
  ('quangninh', 'quang ninh'), ('quangninh', 'ha long'), ('quangninh', 'cam pha'), ('quangninh', 'mong cai'),
  ('quangninh', 'uong bi'), ('quangninh', 'lang son'), ('quangninh', 'dong dang'),
  ('bacninh', 'bac ninh'), ('bacninh', 'tu son'), ('bacninh', 'yen phong'), ('bacninh', 'tien du'), ('bacninh', 'que vo'),
  ('bacgiang', 'bac giang'), ('bacgiang', 'viet yen'), ('bacgiang', 'yen the'), ('bacgiang', 'hiep hoa'), ('bacgiang', 'lang giang'),
  ('hunguyen', 'hung yen'), ('hunguyen', 'my hao'), ('hunguyen', 'pho noi'), ('hunguyen', 'yen my'), ('hunguyen', 'kim dong'),
  ('hunguyen', 'khoai chau'), ('hunguyen', 'thai binh'), ('hunguyen', 'dong hung'), ('hunguyen', 'quynh phu'), ('hunguyen', 'vu thu'),
  ('thainguyen', 'thai nguyen'), ('thainguyen', 'song cong'), ('thainguyen', 'pho yen'), ('thainguyen', 'dai tu'), ('thainguyen', 'bac kan'),
  ('phutho', 'phu tho'), ('phutho', 'viet tri'), ('phutho', 'lam thao'), ('phutho', 'vinh phuc'), ('phutho', 'vinh yen'),
  ('phutho', 'phuc yen'), ('phutho', 'lap thach'),
  ('ninhbinh', 'ninh binh'), ('ninhbinh', 'tam diep'), ('ninhbinh', 'hoa lu'), ('ninhbinh', 'nam dinh'), ('ninhbinh', 'my loc'),
  ('ninhbinh', 'y yen'), ('ninhbinh', 'ha nam'), ('ninhbinh', 'phu ly'), ('ninhbinh', 'duy tien'),
  ('thanhhoa', 'thanh hoa'), ('thanhhoa', 'sam son'), ('thanhhoa', 'bim son'),
  ('nghean', 'nghe an'), ('nghean', 'vinh'), ('nghean', 'tp vinh'), ('nghean', 'cua lo'),
  ('hatinh', 'ha tinh'), ('hatinh', 'hong linh'), ('hatinh', 'ky anh'),
  ('quangtri', 'quang tri'), ('quangtri', 'dong ha'), ('quangtri', 'quang binh'), ('quangtri', 'dong hoi'), ('quangtri', 'ba don'),
  ('hue', 'hue'), ('hue', 'thua thien hue'), ('hue', 'phu hau'), ('hue', 'tp hue'),
  ('danang', 'da nang'), ('danang', 'danang'), ('danang', 'hai chau'), ('danang', 'son tra'), ('danang', 'cam le'),
  ('danang', 'lien chieu'), ('danang', 'quang nam'), ('danang', 'hoi an'), ('danang', 'tam ky'), ('danang', 'dien ban'),
  ('quangngai', 'quang ngai'), ('quangngai', 'tu nghia'), ('quangngai', 'son ha'),
  ('gialai', 'gia lai'), ('gialai', 'pleiku'), ('gialai', 'an khe'), ('gialai', 'binh dinh'), ('gialai', 'quy nhon'),
  ('daklak', 'dak lak'), ('daklak', 'buon ma thuot'), ('daklak', 'buon ho'),
  ('khanhhoa', 'khanh hoa'), ('khanhhoa', 'nha trang'), ('khanhhoa', 'cam ranh'), ('khanhhoa', 'phu yen'),
  ('khanhhoa', 'tuy hoa'), ('khanhhoa', 'song cau'), ('khanhhoa', 'ninh thuan'), ('khanhhoa', 'phan rang'),
  ('lamdong', 'lam dong'), ('lamdong', 'da lat'), ('lamdong', 'bao loc'), ('lamdong', 'dak nong'), ('lamdong', 'gia nghia'),
  ('lamdong', 'binh thuan'), ('lamdong', 'phan thiet'), ('lamdong', 'la gi'),
  ('hcm', 'ho chi minh'), ('hcm', 'tp ho chi minh'), ('hcm', 'tp hcm'), ('hcm', 'hcm'), ('hcm', 'sai gon'),
  ('hcm', 'quan 1'), ('hcm', 'quan 3'), ('hcm', 'quan 7'), ('hcm', 'binh thanh'), ('hcm', 'thu duc'), ('hcm', 'go vap'),
  ('hcm', 'tan binh'), ('hcm', 'phu nhuan'), ('hcm', 'binh duong'), ('hcm', 'thu dau mot'), ('hcm', 'di an'),
  ('hcm', 'thuan an'), ('hcm', 'tan uyen'), ('hcm', 'ba ria'), ('hcm', 'vung tau'), ('hcm', 'ba ria vung tau'), ('hcm', 'br vt'),
  ('dongnai', 'dong nai'), ('dongnai', 'bien hoa'), ('dongnai', 'long thanh'), ('dongnai', 'trang bom'),
  ('tayninh', 'tay ninh'), ('tayninh', 'tay ninh city'), ('tayninh', 'go dau'), ('tayninh', 'trang bang'),
  ('longan', 'long an'), ('longan', 'tan an'), ('longan', 'ben luc'), ('longan', 'duc hoa'), ('longan', 'tien giang'),
  ('longan', 'my tho'), ('longan', 'cai lay'), ('longan', 'go cong'),
  ('dongthap', 'dong thap'), ('dongthap', 'cao lanh'), ('dongthap', 'sa dec'), ('dongthap', 'hong ngu'),
  ('angiang', 'an giang'), ('angiang', 'long xuyen'), ('angiang', 'chau doc'), ('angiang', 'kien giang'),
  ('angiang', 'rach gia'), ('angiang', 'ha tien'), ('angiang', 'phu quoc'),
  ('vinhlong', 'vinh long'), ('vinhlong', 'vinh long city'), ('vinhlong', 'ben tre'), ('vinhlong', 'tra vinh'),
  ('cantho', 'can tho'), ('cantho', 'ninh kieu'), ('cantho', 'cai rang'), ('cantho', 'soc trang'),
  ('cantho', 'hau giang'), ('cantho', 'vi thanh'),
  ('camau', 'ca mau'), ('camau', 'bac lieu'), ('camau', 'soc trang')
) as v(region_id, keyword)
on conflict do nothing;

alter table public.job_alert_region_keywords enable row level security;
drop policy if exists job_alert_region_keywords_read on public.job_alert_region_keywords;
create policy job_alert_region_keywords_read on public.job_alert_region_keywords
  for select to authenticated using (true);
revoke all privileges on table public.job_alert_region_keywords from anon, authenticated;
grant select on table public.job_alert_region_keywords to authenticated;

-- 텍스트에서 지역 id 집합을 뽑는다. 긴 키워드부터 매칭하고 매칭된 구간을 지워서
-- "vinh long"(Vĩnh Long) 안의 "vinh"(Nghệ An의 Vinh)처럼 짧은 키워드가 긴 지명의
-- 일부로 잘못 잡히지 않게 한다. 단어 경계(앞뒤 공백)로만 매칭한다.
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

-- ---------------------------------------------------------------------------
-- 2. 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.job_alert_home_locations (
  seeker_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- 소수점 3자리 ≈ 110m. 타입 자체가 반올림을 강제한다(원문 주소 컬럼 없음).
  lat numeric(6, 3) not null check (lat between -90 and 90),
  lng numeric(7, 3) not null check (lng between -180 and 180),
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Điều kiện của tôi',
  status text not null default 'active',
  -- 이 시각 이후 들어온 공고만 알림 대상(생성 시 now(), 중지→재개 시 다시 now()).
  alerts_since timestamptz not null default now(),

  region_ids text[] not null default '{}',
  region_importance text,

  categories text[] not null default '{}',
  category_importance text,

  salary_min integer,
  salary_period text,
  salary_importance text,

  work_start time,
  work_end time,
  accept_rotating boolean not null default false,
  hours_importance text,

  max_distance_km numeric(5, 1),
  distance_importance text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_alert_preferences_name_len check (char_length(name) between 1 and 60),
  constraint job_alert_preferences_status_check check (status in ('active', 'paused')),
  constraint job_alert_preferences_importance_check check (
    coalesce(region_importance, 'required') in ('required', 'preferred')
    and coalesce(category_importance, 'required') in ('required', 'preferred')
    and coalesce(salary_importance, 'required') in ('required', 'preferred')
    and coalesce(hours_importance, 'required') in ('required', 'preferred')
    and coalesce(distance_importance, 'required') in ('required', 'preferred')
  ),
  constraint job_alert_preferences_region_check check (
    (region_importance is null) = (cardinality(region_ids) = 0)
    and cardinality(region_ids) <= 10
  ),
  constraint job_alert_preferences_category_check check (
    (category_importance is null) = (cardinality(categories) = 0)
    and cardinality(categories) <= 13
  ),
  constraint job_alert_preferences_salary_check check (
    (salary_importance is null) = (salary_min is null)
    and (salary_min is null) = (salary_period is null)
    and (salary_min is null or salary_min > 0)
    and (salary_period is null or salary_period in ('hour', 'day', 'month'))
  ),
  constraint job_alert_preferences_hours_check check (
    (hours_importance is null) = (work_start is null)
    and (work_start is null) = (work_end is null)
    and (work_start is null or work_start <> work_end)
  ),
  constraint job_alert_preferences_distance_check check (
    (distance_importance is null) = (max_distance_km is null)
    and (max_distance_km is null or max_distance_km between 0.5 and 200)
  ),
  -- 필수조건이 하나도 없으면 "모든 공고 충족"이 되어 알림이 폭주하므로 금지.
  constraint job_alert_preferences_has_required check (
    'required' in (
      coalesce(region_importance, ''), coalesce(category_importance, ''),
      coalesce(salary_importance, ''), coalesce(hours_importance, ''),
      coalesce(distance_importance, '')
    )
  )
);

create index if not exists job_alert_preferences_seeker_idx
  on public.job_alert_preferences (seeker_id);

create table if not exists public.job_alert_notifications (
  id bigint generated always as identity primary key,
  seeker_id uuid not null references auth.users(id) on delete cascade,
  preference_id uuid not null references public.job_alert_preferences(id) on delete cascade,
  job_id bigint not null references public.local_jobs(id) on delete cascade,
  -- 알림 생성 시점의 판정 결과(조건별 status/reason) — 이후 공고가 바뀌어도
  -- "왜 이 알림이 왔는지"를 그대로 보여주기 위한 스냅샷.
  result jsonb not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- "지우기"는 행 삭제가 아니라 숨김 — 행을 지우면 UNIQUE 중복 차단 근거가
  -- 사라져 같은 공고가 다시 알림될 수 있으므로.
  dismissed_at timestamptz,
  constraint job_alert_notifications_unique unique (preference_id, job_id)
);

create index if not exists job_alert_notifications_seeker_idx
  on public.job_alert_notifications (seeker_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. 트리거: updated_at / alerts_since / 소유자 고정 / 최대 5개 / 거리조건 동의 확인
-- ---------------------------------------------------------------------------

create or replace function public.job_alert_preferences_before_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.alerts_since := now();
    if (select count(*) from public.job_alert_preferences p where p.seeker_id = new.seeker_id) >= 5 then
      raise exception 'job_alert_limit_reached' using errcode = 'P0001';
    end if;
  else
    -- 소유자/생성시각은 바꿀 수 없다.
    new.seeker_id := old.seeker_id;
    new.created_at := old.created_at;
    if old.status = 'paused' and new.status = 'active' then
      new.alerts_since := now();
    else
      new.alerts_since := old.alerts_since;
    end if;
  end if;
  new.updated_at := now();

  if new.max_distance_km is not null and not exists (
    select 1 from public.job_alert_home_locations h where h.seeker_id = new.seeker_id
  ) then
    raise exception 'job_alert_home_location_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists job_alert_preferences_before_write on public.job_alert_preferences;
create trigger job_alert_preferences_before_write
  before insert or update on public.job_alert_preferences
  for each row execute function public.job_alert_preferences_before_write();

create or replace function public.job_alert_home_locations_before_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    new.seeker_id := old.seeker_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_alert_home_locations_before_write on public.job_alert_home_locations;
create trigger job_alert_home_locations_before_write
  before insert or update on public.job_alert_home_locations
  for each row execute function public.job_alert_home_locations_before_write();

-- ---------------------------------------------------------------------------
-- 4. RLS — 본인(활성 구직자) 행만. 기업/타 사용자/anon 접근 경로 없음.
-- ---------------------------------------------------------------------------

create or replace function public.job_alert_is_active_seeker()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and public.is_account_active(auth.uid())
    and exists (
      select 1 from public.account_roles ar
      where ar.user_id = auth.uid() and ar.role = 'seeker'
    );
$$;

revoke all on function public.job_alert_is_active_seeker() from public, anon;
grant execute on function public.job_alert_is_active_seeker() to authenticated;

alter table public.job_alert_home_locations enable row level security;
alter table public.job_alert_preferences enable row level security;
alter table public.job_alert_notifications enable row level security;

drop policy if exists job_alert_home_select_own on public.job_alert_home_locations;
drop policy if exists job_alert_home_insert_own on public.job_alert_home_locations;
drop policy if exists job_alert_home_update_own on public.job_alert_home_locations;
drop policy if exists job_alert_home_delete_own on public.job_alert_home_locations;
create policy job_alert_home_select_own on public.job_alert_home_locations
  for select to authenticated using (seeker_id = auth.uid());
create policy job_alert_home_insert_own on public.job_alert_home_locations
  for insert to authenticated
  with check (seeker_id = auth.uid() and public.job_alert_is_active_seeker());
create policy job_alert_home_update_own on public.job_alert_home_locations
  for update to authenticated
  using (seeker_id = auth.uid() and public.job_alert_is_active_seeker())
  with check (seeker_id = auth.uid());
-- 동의 철회(삭제)는 계정 상태와 무관하게 본인이면 항상 가능.
create policy job_alert_home_delete_own on public.job_alert_home_locations
  for delete to authenticated using (seeker_id = auth.uid());

drop policy if exists job_alert_pref_select_own on public.job_alert_preferences;
drop policy if exists job_alert_pref_insert_own on public.job_alert_preferences;
drop policy if exists job_alert_pref_update_own on public.job_alert_preferences;
drop policy if exists job_alert_pref_delete_own on public.job_alert_preferences;
create policy job_alert_pref_select_own on public.job_alert_preferences
  for select to authenticated using (seeker_id = auth.uid());
create policy job_alert_pref_insert_own on public.job_alert_preferences
  for insert to authenticated
  with check (seeker_id = auth.uid() and public.job_alert_is_active_seeker());
create policy job_alert_pref_update_own on public.job_alert_preferences
  for update to authenticated
  using (seeker_id = auth.uid() and public.job_alert_is_active_seeker())
  with check (seeker_id = auth.uid());
create policy job_alert_pref_delete_own on public.job_alert_preferences
  for delete to authenticated using (seeker_id = auth.uid());

drop policy if exists job_alert_notif_select_own on public.job_alert_notifications;
drop policy if exists job_alert_notif_update_own on public.job_alert_notifications;
create policy job_alert_notif_select_own on public.job_alert_notifications
  for select to authenticated using (seeker_id = auth.uid());
create policy job_alert_notif_update_own on public.job_alert_notifications
  for update to authenticated
  using (seeker_id = auth.uid())
  with check (seeker_id = auth.uid());

revoke all privileges on table public.job_alert_home_locations from anon, authenticated;
revoke all privileges on table public.job_alert_preferences from anon, authenticated;
revoke all privileges on table public.job_alert_notifications from anon, authenticated;

grant select, delete on table public.job_alert_home_locations to authenticated;
grant insert (lat, lng, consented_at) on table public.job_alert_home_locations to authenticated;
grant update (lat, lng, consented_at) on table public.job_alert_home_locations to authenticated;

grant select, delete on table public.job_alert_preferences to authenticated;
grant insert (
  name, status, region_ids, region_importance, categories, category_importance,
  salary_min, salary_period, salary_importance, work_start, work_end, accept_rotating,
  hours_importance, max_distance_km, distance_importance
) on table public.job_alert_preferences to authenticated;
grant update (
  name, status, region_ids, region_importance, categories, category_importance,
  salary_min, salary_period, salary_importance, work_start, work_end, accept_rotating,
  hours_importance, max_distance_km, distance_importance
) on table public.job_alert_preferences to authenticated;

-- 알림은 클라이언트가 만들거나 지울 수 없다(생성은 아래 SECURITY DEFINER 배치만).
grant select on table public.job_alert_notifications to authenticated;
grant update (read_at, dismissed_at) on table public.job_alert_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 판정 함수 (화면·알림 공용, 단일 소스)
-- ---------------------------------------------------------------------------

create or replace function public.job_alert_haversine_km(lat1 double precision, lng1 double precision,
                                                        lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = pg_catalog
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- 반환 형태:
-- { "overall": "match"|"unknown"|"mismatch",
--   "preferred_met": n, "preferred_total": n,
--   "criteria": { "<key>": { "importance": "required"|"preferred",
--                            "status": "match"|"mismatch"|"unknown",
--                            "reason": "<code>" }, ... } }
-- overall: 필수 중 하나라도 mismatch → mismatch, 아니면 필수 중 하나라도 unknown →
-- unknown, 아니면 match. 선호조건은 overall에 영향 없고 정렬용 개수만 센다.
create or replace function public.job_alert_evaluate(
  p_pref public.job_alert_preferences,
  p_job public.local_jobs,
  p_home_lat double precision,
  p_home_lng double precision
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  criteria jsonb := '{}'::jsonb;
  st text;
  rs text;
  job_regions text[] := '{}';
  loc record;
  trusted_count int := 0;
  untrusted_count int := 0;
  nearest double precision;
  d double precision;
  job_start int;
  job_end int;
  win_start int;
  win_end int;
  overall text := 'match';
  pref_met int := 0;
  pref_total int := 0;
  k text;
  c jsonb;
begin
  -- 지역 --------------------------------------------------------------------
  if p_pref.region_importance is not null then
    job_regions := public.job_alert_detect_regions(
      coalesce(p_job.location, '') || ' ; ' || coalesce(array_to_string(p_job.recruitment_regions, ' ; '), '')
    );
    for loc in
      select w.raw_address, w.resolved_province from public.job_work_locations w where w.job_id = p_job.id
    loop
      job_regions := job_regions || public.job_alert_detect_regions(
        coalesce(loc.raw_address, '') || ' ; ' || coalesce(loc.resolved_province, '')
      );
    end loop;
    if job_regions && p_pref.region_ids then
      st := 'match'; rs := 'region_matched';
    elsif cardinality(job_regions) > 0 then
      st := 'mismatch'; rs := 'region_other';
    else
      st := 'unknown'; rs := 'region_missing';
    end if;
    criteria := criteria || jsonb_build_object('region',
      jsonb_build_object('importance', p_pref.region_importance, 'status', st, 'reason', rs));
  end if;

  -- 업무(대분류) ------------------------------------------------------------
  if p_pref.category_importance is not null then
    if p_job.category is null or p_job.category in ('', 'khac', 'other') then
      st := 'unknown'; rs := 'category_missing';
    elsif p_job.category = any(p_pref.categories) then
      st := 'match'; rs := 'category_matched';
    else
      st := 'mismatch'; rs := 'category_other';
    end if;
    criteria := criteria || jsonb_build_object('category',
      jsonb_build_object('importance', p_pref.category_importance, 'status', st, 'reason', rs));
  end if;

  -- 희망급여 — 같은 통화(VND)·같은 지급 주기끼리만 비교, 환산 없음 ------------
  if p_pref.salary_importance is not null then
    if p_job.salary_negotiable is true then
      st := 'unknown'; rs := 'salary_negotiable';
    elsif p_job.salary_min is null and p_job.salary_max is null then
      st := 'unknown'; rs := 'salary_missing';
    elsif p_job.salary_currency is distinct from 'VND' then
      st := 'unknown'; rs := 'salary_other_currency';
    elsif p_job.salary_period is distinct from p_pref.salary_period then
      st := 'unknown'; rs := 'salary_other_period';
    elsif p_job.salary_min is not null and p_job.salary_min >= p_pref.salary_min then
      st := 'match'; rs := 'salary_meets';
    elsif p_job.salary_max is not null and p_job.salary_max < p_pref.salary_min then
      st := 'mismatch'; rs := 'salary_below';
    else
      -- 범위가 희망액에 걸쳐 있거나("8-12 triệu" vs 10), 상한만 있어 하한을 모름.
      st := 'unknown'; rs := 'salary_range_straddles';
    end if;
    criteria := criteria || jsonb_build_object('salary',
      jsonb_build_object('importance', p_pref.salary_importance, 'status', st, 'reason', rs));
  end if;

  -- 근무시간 — 공고 근무시간이 희망 시간대 안에 완전히 들어가야 충족 ------------
  if p_pref.hours_importance is not null then
    if p_job.shift_type = 'rotating' then
      if p_pref.accept_rotating then
        st := 'match'; rs := 'hours_rotating_accepted';
      else
        st := 'mismatch'; rs := 'hours_rotating';
      end if;
    elsif p_job.work_start_time is null or p_job.work_end_time is null then
      st := 'unknown'; rs := 'hours_missing';
    else
      -- 분 단위, 자정을 넘는 구간은 끝을 +1440으로 편다.
      win_start := extract(hour from p_pref.work_start)::int * 60 + extract(minute from p_pref.work_start)::int;
      win_end := extract(hour from p_pref.work_end)::int * 60 + extract(minute from p_pref.work_end)::int;
      if win_end <= win_start then win_end := win_end + 1440; end if;
      job_start := extract(hour from p_job.work_start_time)::int * 60 + extract(minute from p_job.work_start_time)::int;
      job_end := extract(hour from p_job.work_end_time)::int * 60 + extract(minute from p_job.work_end_time)::int;
      if job_end <= job_start then job_end := job_end + 1440; end if;
      if job_start < win_start then
        job_start := job_start + 1440; job_end := job_end + 1440;
      end if;
      if job_start >= win_start and job_end <= win_end then
        st := 'match'; rs := 'hours_within';
      else
        st := 'mismatch'; rs := 'hours_outside';
      end if;
    end if;
    criteria := criteria || jsonb_build_object('hours',
      jsonb_build_object('importance', p_pref.hours_importance, 'status', st, 'reason', rs));
  end if;

  -- 이동거리 — 신뢰 가능한 공고 좌표(exact, 또는 ward+원문검증)만 사용 ------------
  if p_pref.distance_importance is not null then
    if p_home_lat is null or p_home_lng is null then
      st := 'unknown'; rs := 'distance_home_missing';
    else
      for loc in
        select w.lat, w.lng, w.coordinate_accuracy, w.location_verified
        from public.job_work_locations w where w.job_id = p_job.id
      loop
        if loc.lat is not null and loc.lng is not null and (
          loc.coordinate_accuracy = 'exact'
          or (loc.coordinate_accuracy = 'ward' and loc.location_verified)
        ) then
          trusted_count := trusted_count + 1;
          d := public.job_alert_haversine_km(p_home_lat, p_home_lng, loc.lat, loc.lng);
          if nearest is null or d < nearest then nearest := d; end if;
        else
          untrusted_count := untrusted_count + 1;
        end if;
      end loop;
      if nearest is not null and nearest <= p_pref.max_distance_km then
        st := 'match'; rs := 'distance_within';
      elsif trusted_count > 0 and untrusted_count = 0 then
        st := 'mismatch'; rs := 'distance_too_far';
      else
        -- 좌표가 없거나, 확인된 근무지는 멀지만 확인 안 된 다른 근무지가 있음.
        st := 'unknown'; rs := 'distance_job_coordinate_missing';
      end if;
    end if;
    criteria := criteria || jsonb_build_object('distance',
      jsonb_build_object('importance', p_pref.distance_importance, 'status', st, 'reason', rs)
      || case when nearest is not null
              then jsonb_build_object('km', round(nearest::numeric, 1)) else '{}'::jsonb end);
  end if;

  -- 종합 --------------------------------------------------------------------
  for k, c in select * from jsonb_each(criteria) loop
    if c->>'importance' = 'required' then
      if c->>'status' = 'mismatch' then
        overall := 'mismatch';
      elsif c->>'status' = 'unknown' and overall = 'match' then
        overall := 'unknown';
      end if;
    else
      pref_total := pref_total + 1;
      if c->>'status' = 'match' then pref_met := pref_met + 1; end if;
    end if;
  end loop;

  return jsonb_build_object(
    'overall', overall,
    'preferred_met', pref_met,
    'preferred_total', pref_total,
    'criteria', criteria
  );
end;
$$;

revoke all on function public.job_alert_evaluate(public.job_alert_preferences, public.local_jobs, double precision, double precision) from public, anon;
grant execute on function public.job_alert_evaluate(public.job_alert_preferences, public.local_jobs, double precision, double precision) to authenticated;

-- 공고가 "지금 알림/매칭 대상이 될 수 있는 상태"인지 — 공개·활성·미숨김·마감 전
-- (베트남 날짜 기준, 마감일 당일은 포함).
create or replace function public.job_alert_job_is_open(p_job public.local_jobs)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select p_job.active is true
    and p_job.admin_hidden is false
    and (p_job.application_deadline is null
         or p_job.application_deadline >= (now() at time zone 'Asia/Ho_Chi_Minh')::date);
$$;

-- 화면용 RPC(SECURITY INVOKER) — RLS 그대로 적용: 조건은 본인 것만 읽히고,
-- 공고는 공개 공고만 읽힌다. 열린 공고 전체에 대한 판정을 돌려준다.
create or replace function public.job_alert_match_jobs(p_preference_id uuid)
returns table (job_id bigint, result jsonb)
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  pref public.job_alert_preferences;
  home public.job_alert_home_locations;
begin
  select * into pref from public.job_alert_preferences p where p.id = p_preference_id;
  if not found then
    raise exception 'job_alert_preference_not_found' using errcode = 'P0002';
  end if;
  select * into home from public.job_alert_home_locations h where h.seeker_id = pref.seeker_id;

  return query
    select j.id, public.job_alert_evaluate(pref, j, home.lat::double precision, home.lng::double precision)
    from public.local_jobs j
    where public.job_alert_job_is_open(j)
    order by j.created_at desc nulls last, j.id desc;
end;
$$;

revoke all on function public.job_alert_match_jobs(uuid) from public, anon;
grant execute on function public.job_alert_match_jobs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 알림 생성 배치 (SECURITY DEFINER, 클라이언트 실행 불가, pg_cron 전용)
-- ---------------------------------------------------------------------------

create or replace function public.job_alert_generate_notifications()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pref public.job_alert_preferences;
  home public.job_alert_home_locations;
  j public.local_jobs;
  res jsonb;
  inserted integer := 0;
  n integer;
begin
  for pref in
    select p.* from public.job_alert_preferences p
    where p.status = 'active'
      and public.is_account_active(p.seeker_id)
      and exists (select 1 from public.account_roles ar where ar.user_id = p.seeker_id and ar.role = 'seeker')
  loop
    home := null;
    select * into home from public.job_alert_home_locations h where h.seeker_id = pref.seeker_id;

    for j in
      select lj.* from public.local_jobs lj
      where public.job_alert_job_is_open(lj)
        and lj.created_at >= greatest(pref.alerts_since, now() - interval '14 days')
        and not exists (
          select 1 from public.job_alert_notifications x
          where x.preference_id = pref.id and x.job_id = lj.id
        )
    loop
      res := public.job_alert_evaluate(pref, j, home.lat::double precision, home.lng::double precision);
      if res->>'overall' = 'match' then
        insert into public.job_alert_notifications (seeker_id, preference_id, job_id, result)
        values (pref.seeker_id, pref.id, j.id, res)
        on conflict (preference_id, job_id) do nothing;
        get diagnostics n = row_count;
        inserted := inserted + n;
      end if;
    end loop;
  end loop;
  return inserted;
end;
$$;

revoke all on function public.job_alert_generate_notifications() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'job-alert-notifications';
select cron.schedule(
  'job-alert-notifications',
  '*/15 * * * *',
  $$select public.job_alert_generate_notifications()$$
);

commit;
