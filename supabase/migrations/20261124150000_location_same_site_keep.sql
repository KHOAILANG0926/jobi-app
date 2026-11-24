-- 지도 정상화 W6 (Lee 2026-11-24): 확정 출처와 관계없이 같은 사업장의 확정 좌표를 지킨다.
--  · 단순 주소·회사명 표기 변경으로 확정 좌표를 초기화하지 않는다. 실제 이전·다른 지점은 기존 절차(무효화 → 위치 확인) 그대로.
--  · 번지 없는 공단 주소도 범위. 단 공단명·행정구역 일치만으로 같은 사업장으로 보지 않는다.
--  · Google 위치 확정 정책·위치 확인 순서(Google → VietMap → Goong)·관리자 확정 재사용 열쇠(다른 공고는 같은 회사 이름+같은 주소 글자)는 그대로.
-- 원인(20261026231445): 공고의 회사·위치 글자가 바뀌면 트리거 job_identity_changed가 그 줄을 invalidate — 이 쓰기는 확정 줄 보호를 거치지 않아
--   표기만 바뀌어도 확정 좌표·근거가 지워졌다. 회사 이름이 조금이라도 바뀌면 모든 줄이 지워졌다.
-- 같은 사업장 판정(한 곳: location_private.same_site_address — 같은 공고의 같은 줄 안에서만 쓴다):
--   ① 주소 열쇠(admin_location_key)가 같다, 또는
--   ② 한쪽이 다른 쪽의 낱말 단위 앞부분이고 짧은 쪽에 번지 숫자가 있다(20261124130000과 같은 규칙), 또는
--   ③ 번지가 없으면: 한쪽이 다른 쪽의 낱말 단위 앞부분이고, 덧붙은 꼬리가 그 줄에 저장된 행정구역 이름(동·구·성) 전체와 단위 낱말(tp·tinh·huyen…)로만
--      이뤄지고 숫자가 없다. 즉 주소 글자는 그대로이고 뒤에 지역만 붙거나 빠진 경우다. 공단 이름이 같아도 로트·번호·'mở rộng'·'2' 같은 꼬리가 다르면 같지 않다.
-- 회사 이름 표기 변경 = 성조·대소문자·문장부호·띄어쓰기만 다름(기존 열쇠 함수 admin_location_key로 같음). 법인 형태 줄임말(CTY↔Công ty)은 다루지 않는다.
-- 바꾸는 곳: ⓐ 판정 함수 추가 ⓑ write_location의 같은 지점 줄 찾기(20261124130000)가 그 함수를 쓰게(③ 추가) ⓒ 트리거가 같은 사업장 확정 줄을 건너뜀
--   ⓓ 관리자 확정 자격(eligible_memory·valid_memory_targets): 이미 그 확정을 가진 줄은 회사 이름 표기만 바뀌어도 자격 유지(다른 공고로의 재사용 열쇠는 그대로).
-- 찾는 줄이 없으면 RAISE로 전체 취소.
begin;
create function location_private.same_site_address(p_a text, p_b text, p_regions text[]) returns boolean
language plpgsql stable set search_path=pg_catalog as $$
declare a text:=public.admin_location_key(p_a); b text:=public.admin_location_key(p_b); s text; l text; tail text; r text;
 unit constant text:='\m(thanh pho|thi xa|thi tran|viet nam|tp|tx|tt|tinh|huyen|quan|xa|phuong|vn)\M';
begin
 if coalesce(a,'')='' or coalesce(b,'')='' then return false; end if;
 if a=b then return true; end if;
 if length(a)<=length(b) then s:=a; l:=b; else s:=b; l:=a; end if;
 if not starts_with(l||' ', s||' ') then return false; end if;
 if s ~ '[0-9]' then return true; end if;
 tail:=substr(l, length(s)+1);
 if tail ~ '[0-9]' then return false; end if;
 tail:=' '||btrim(regexp_replace(regexp_replace(tail, unit, ' ', 'g'), '\s+', ' ', 'g'))||' ';
 for r in select x from (select distinct btrim(regexp_replace(regexp_replace(public.admin_location_key(n), unit, ' ', 'g'), '\s+', ' ', 'g')) x
   from unnest(coalesce(p_regions,'{}'::text[])) n) q where x<>'' order by length(x) desc, x loop
  tail:=replace(replace(tail, ' '||r||' ', ' '), ' '||r||' ', ' ');
 end loop;
 return btrim(tail)='';
end$$;
revoke all on function location_private.same_site_address(text,text,text[]) from public;
grant execute on function location_private.same_site_address(text,text,text[]) to location_writer;

do $patch$
declare migration_role text:=current_user;
 original_set boolean:=pg_has_role(current_user,'location_writer','SET');
 original_memberships jsonb:=(select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=current_user::regrole);
 original_create boolean:=has_schema_privilege('location_writer','location_private','CREATE');
 definition text; patched text;
 ak text := 'public.admin_location_key(addr)';
 xk text := 'public.admin_location_key(x.raw_address)';
 old_pred text; new_pred text;
begin
 old_pred := xk || $q$<>'' and (starts_with($q$ || xk || $q$||' ',$q$ || ak || $q$||' ') or starts_with($q$ || ak || $q$||' ',$q$ || xk || $q$||' '))$q$
  || $q$ and (case when length($q$ || ak || $q$)<=length($q$ || xk || $q$) then $q$ || ak || ' else ' || xk || $q$ end) ~ '[0-9]'$q$;
 new_pred := xk || $q$<>'' and location_private.same_site_address(x.raw_address,addr,array[x.province,x.district,x.ward,x.resolved_province]||coalesce(x.resolved_wards,'{}'::text[]))$q$;
 select pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure) into definition;
 patched := replace(definition, old_pred, new_pred);
 if (length(definition)-length(replace(definition, old_pred, '')))/length(old_pred) <> 2 then raise exception 'same-store predicate not found exactly twice in write_location';end if;
 if not original_set then execute format('grant location_writer to %I with inherit false, set true',migration_role);end if;
 if not original_create then grant create on schema location_private to location_writer;end if;
 execute 'set local role location_writer';
 execute patched;
 execute format('set local role %I',migration_role);
 if not original_create then revoke create on schema location_private from location_writer;end if;
 if not original_set then execute format('revoke location_writer from %I',migration_role);end if;
 if has_schema_privilege('location_writer','location_private','CREATE') is distinct from original_create
 or (select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=migration_role::regrole) is distinct from original_memberships then raise exception 'temporary writer permissions not restored';end if;
end$patch$;

-- ⓒ 트리거: 본문 전체를 다시 쓴다(20261026231445 뒤로 바뀐 적 없음 — 아래 확인에서 옛 줄이 없으면 취소).
do $guard$ begin
 if position('perform location_private.write_location(new.id,''invalidate'',jsonb_build_object(''address'',w.raw_address,''new_address'',new.location));'
   in pg_get_functiondef('location_private.job_identity_changed()'::regprocedure)) = 0
  or position('same_site_address' in pg_get_functiondef('location_private.job_identity_changed()'::regprocedure)) > 0 then
  raise exception 'job_identity_changed is not the expected version';
 end if;
end$guard$;
create or replace function location_private.job_identity_changed() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare w record;o record;company_changed boolean;same_company boolean;moved boolean;begin
 if tg_op='UPDATE' and new.company is not distinct from old.company and new.location is not distinct from old.location then return null;end if;
 if tg_op='UPDATE' then
  company_changed:=location_private.company_identity(new.company) is distinct from location_private.company_identity(old.company);
  -- W6: 성조·대소문자·문장부호·띄어쓰기만 다른 회사 이름은 같은 회사(표기 변경).
  same_company:=not company_changed or coalesce(public.admin_location_key(new.company)<>'' and public.admin_location_key(new.company)=public.admin_location_key(old.company),false);
  -- Parent text changes invalidate the corresponding source, through the writer.
  for w in select * from public.job_work_locations where job_id=new.id order by id loop
   moved:=coalesce(public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
      and public.admin_location_key(new.location)<>public.admin_location_key(old.location),false);
   if company_changed or moved then
    -- W6: 같은 사업장의 확정 줄(출처 무관)은 표기 변경으로 초기화하지 않는다. 줄의 주소 글자는 그대로 둔다(확정 근거의 열쇠).
    --     새 글자로 이미 다른 확정 줄이 있으면 기존대로(아래), 좌표 없는 같은 사업장 줄이 생겨 있으면 그 줄만 정리한다.
    if same_company and w.lat is not null and w.lng is not null and (w.location_verified or w.point_authority in ('admin_confirmed','auto_reuse'))
     and (not moved or (location_private.same_site_address(old.location,new.location,array[w.province,w.district,w.ward,w.resolved_province]||coalesce(w.resolved_wards,'{}'::text[]))
      and not exists(select 1 from public.job_work_locations other where other.job_id=new.id and other.id<>w.id
       and public.admin_location_key(other.raw_address)=public.admin_location_key(new.location)
       and other.lat is not null and (other.location_verified or other.point_authority in ('admin_confirmed','auto_reuse'))))) then
     if moved then
      for o in select id from public.job_work_locations other where other.job_id=new.id and other.id<>w.id
       and public.admin_location_key(other.raw_address)=public.admin_location_key(new.location) order by id loop
       perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',o.id));
      end loop;
     end if;
     continue;
    end if;
    if public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
     and nullif(btrim(new.location),'') is null then
     perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',w.id));
    elsif public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
     and nullif(btrim(new.location),'') is not null then
     if exists(select 1 from public.job_work_locations other where other.job_id=new.id and other.id<>w.id
      and public.admin_location_key(other.raw_address)=public.admin_location_key(new.location)) then
      perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',w.id));
     else
      perform location_private.write_location(new.id,'invalidate',jsonb_build_object('address',w.raw_address,'new_address',new.location));
     end if;
    else
     perform location_private.write_location(new.id,'invalidate',jsonb_build_object('address',w.raw_address));
    end if;
   end if;
  end loop;
  perform location_private.reconcile_company(location_private.company_identity(old.company));
 end if;
 perform location_private.reconcile_company(location_private.company_identity(new.company));
 return null;
end$$;

-- ⓓ 관리자 확정 자격(20261110160000의 두 view, 칸은 그대로):
--   · 원 공고의 회사 이름이 표기만 바뀌어도 그 확정은 유효하다(예전: 글자가 완전히 같아야 함).
--   · 이미 그 확정을 가진 줄(point_candidate_id)은 공고의 회사 이름 표기만 바뀌어도 자격 유지. 새로 재사용하는 조건(같은 회사 이름+같은 주소 글자)은 그대로.
create or replace view location_private.eligible_memory with (security_invoker = true) as
 select location_private.company_identity(c.company_snapshot) company_identity,
  public.admin_location_key(c.address_snapshot) address_key,
  c.id source_candidate_id, c.lat, c.lng, c.place_precision, c.reviewed_at approved_at, c.reviewed_by approved_by
 from public.job_location_candidates c
 join public.admin_confirmed_location_memory m on m.source_candidate_id = c.id and m.active
 join public.local_jobs origin_job on origin_job.id = c.job_id
 where c.status = 'approved' and c.reviewed_by is not null and c.reviewed_at is not null
 and c.evidence not like 'AUTO REUSE:%'
 and c.place_precision in ('entrance', 'building', 'site') and nullif(btrim(c.evidence), '') is not null
 and c.lat between 8 and 24 and c.lng between 102 and 110
 and m.approved_by = c.reviewed_by and m.approved_at = c.reviewed_at and m.lat = c.lat and m.lng = c.lng and m.place_precision = c.place_precision
 and m.address_key = public.admin_location_key(c.address_snapshot)
 and public.admin_location_key(origin_job.company) <> '' and public.admin_location_key(origin_job.company) = public.admin_location_key(c.company_snapshot)
 and (public.admin_location_key(origin_job.location) = public.admin_location_key(c.address_snapshot)
  or exists(select 1 from public.job_work_locations ow where ow.job_id = origin_job.id
   and public.admin_location_key(ow.raw_address) = public.admin_location_key(c.address_snapshot)));

create or replace view location_private.valid_memory_targets with (security_invoker = true) as
with targets as (
 select j.id job_id, j.company, w.raw_address address, w.id work_location_id from public.local_jobs j
 join public.job_work_locations w on w.job_id = j.id
 union all select j.id, j.company, j.location, null::bigint from public.local_jobs j
 where nullif(btrim(j.location), '') is not null and not exists(select 1 from public.job_work_locations w where w.job_id = j.id)
), eligible as (
 select t.*, e.source_candidate_id, e.lat, e.lng, e.place_precision, e.approved_at, e.approved_by,
 row_number() over(partition by t.job_id, public.admin_location_key(t.address) order by e.approved_at desc, e.source_candidate_id desc) preference
 from targets t join location_private.eligible_memory e
 on e.address_key = public.admin_location_key(t.address)
 and (e.company_identity = location_private.company_identity(t.company)
  or (public.admin_location_key(e.company_identity) = public.admin_location_key(t.company)
   and exists(select 1 from public.job_work_locations held where held.id = t.work_location_id and held.point_candidate_id = e.source_candidate_id)))
)
select * from eligible where preference = 1;
commit;
