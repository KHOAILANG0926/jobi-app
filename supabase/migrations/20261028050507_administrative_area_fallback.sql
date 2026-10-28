begin;
-- Reference area points only: not a second job coordinate authority. All job
-- writes still pass through write_location; exact human/source evidence wins.
create function location_private.administrative_area(p_address text) returns jsonb
language sql stable set search_path=pg_catalog as $fn$
 with normalized as (select ' '||public.admin_location_key(p_address)||' ' as text),
 matches as (select a from jsonb_array_elements($areas$[{"key":"province:quang ninh","aliases":["quang ninh"],"lat":21.223,"lng":107.181},{"key":"province:tay ninh","aliases":["tay ninh"],"lat":11.4121,"lng":106.14},{"key":"province:dien bien","aliases":["dien bien"],"lat":21.7487,"lng":103.226},{"key":"province:bac kan","aliases":["bac kan"],"lat":22.1476,"lng":105.874},{"key":"province:thai nguyen","aliases":["thai nguyen"],"lat":21.5812,"lng":105.887},{"key":"province:lai chau","aliases":["lai chau"],"lat":22.3502,"lng":103.255},{"key":"province:lang son","aliases":["lang son"],"lat":21.7826,"lng":106.724},{"key":"province:son la","aliases":["son la"],"lat":21.3011,"lng":104.159},{"key":"province:thanh hoa","aliases":["thanh hoa"],"lat":20.0917,"lng":105.215},{"key":"province:tuyen quang","aliases":["tuyen quang"],"lat":22.131,"lng":105.229},{"key":"province:yen bai","aliases":["yen bai"],"lat":21.7484,"lng":104.512},{"key":"province:hoa binh","aliases":["hoa binh"],"lat":20.7292,"lng":105.34},{"key":"province:hai duong","aliases":["hai duong"],"lat":20.9613,"lng":106.364},{"key":"province:hai phong","aliases":["hai phong"],"lat":20.79,"lng":106.635},{"key":"province:hung yen","aliases":["hung yen"],"lat":20.8085,"lng":106.076},{"key":"province:ha noi","aliases":["ha noi"],"lat":21.1306,"lng":105.872},{"key":"province:bac ninh","aliases":["bac ninh"],"lat":21.098,"lng":106.117},{"key":"province:vinh phuc","aliases":["vinh phuc"],"lat":21.3455,"lng":105.549},{"key":"province:ninh binh","aliases":["ninh binh"],"lat":20.2722,"lng":105.852},{"key":"province:ha nam","aliases":["ha nam"],"lat":20.5569,"lng":105.985},{"key":"province:nam dinh","aliases":["nam dinh"],"lat":20.2343,"lng":106.254},{"key":"province:phu tho","aliases":["phu tho"],"lat":21.3127,"lng":105.143},{"key":"province:bac giang","aliases":["bac giang"],"lat":21.3512,"lng":106.493},{"key":"province:thai binh","aliases":["thai binh"],"lat":20.5303,"lng":106.371},{"key":"province:ha tinh","aliases":["ha tinh"],"lat":18.3563,"lng":105.799},{"key":"province:nghe an","aliases":["nghe an"],"lat":19.3548,"lng":104.827},{"key":"province:quang binh","aliases":["quang binh"],"lat":17.4691,"lng":106.357},{"key":"province:dak lak","aliases":["dak lak"],"lat":12.7691,"lng":108.133},{"key":"province:gia lai","aliases":["gia lai"],"lat":13.8493,"lng":108.156},{"key":"province:khanh hoa","aliases":["khanh hoa"],"lat":12.6049,"lng":109.359},{"key":"province:lam dong","aliases":["lam dong"],"lat":11.5362,"lng":108},{"key":"province:ninh thuan","aliases":["ninh thuan"],"lat":11.6242,"lng":108.925},{"key":"province:phu yen","aliases":["phu yen"],"lat":13.1647,"lng":109.064},{"key":"province:binh duong","aliases":["binh duong"],"lat":11.1382,"lng":106.659},{"key":"province:tien giang","aliases":["tien giang"],"lat":10.4581,"lng":106.217},{"key":"province:dak nong","aliases":["dak nong"],"lat":12.1425,"lng":107.66},{"key":"province:binh phuoc","aliases":["binh phuoc"],"lat":11.6805,"lng":106.897},{"key":"province:binh dinh","aliases":["binh dinh"],"lat":14.1075,"lng":108.971},{"key":"province:kon tum","aliases":["kon tum"],"lat":14.7451,"lng":107.969},{"key":"province:quang nam","aliases":["quang nam"],"lat":15.6535,"lng":107.955},{"key":"province:quang ngai","aliases":["quang ngai"],"lat":14.9971,"lng":108.686},{"key":"province:quang tri","aliases":["quang tri"],"lat":16.7204,"lng":106.973},{"key":"province:thua thien hue","aliases":["thua thien hue","hue"],"lat":16.312,"lng":107.634},{"key":"province:da nang","aliases":["da nang"],"lat":16.0912,"lng":108.102},{"key":"province:ba ria vung tau","aliases":["ba ria vung tau"],"lat":10.3969,"lng":107.143},{"key":"province:binh thuan","aliases":["binh thuan"],"lat":11.1284,"lng":108.232},{"key":"province:dong nai","aliases":["dong nai"],"lat":11.1258,"lng":107.178},{"key":"province:an giang","aliases":["an giang"],"lat":10.5736,"lng":105.154},{"key":"province:can tho","aliases":["can tho"],"lat":10.2421,"lng":105.685},{"key":"province:dong thap","aliases":["dong thap"],"lat":10.6644,"lng":105.586},{"key":"province:ho chi minh","aliases":["ho chi minh"],"lat":10.409,"lng":106.926},{"key":"province:kien giang","aliases":["kien giang"],"lat":9.85962,"lng":105.284},{"key":"province:long an","aliases":["long an"],"lat":10.6869,"lng":106.134},{"key":"province:ben tre","aliases":["ben tre"],"lat":10.171,"lng":106.496},{"key":"province:hau giang","aliases":["hau giang"],"lat":9.84353,"lng":105.663},{"key":"province:bac lieu","aliases":["bac lieu"],"lat":9.33941,"lng":105.573},{"key":"province:ca mau","aliases":["ca mau"],"lat":9.05545,"lng":105.073},{"key":"province:soc trang","aliases":["soc trang"],"lat":9.5614,"lng":105.9},{"key":"province:tra vinh","aliases":["tra vinh"],"lat":9.82817,"lng":106.289},{"key":"province:vinh long","aliases":["vinh long"],"lat":10.1042,"lng":105.969},{"key":"province:cao bang","aliases":["cao bang"],"lat":22.7595,"lng":106.047},{"key":"province:ha giang","aliases":["ha giang"],"lat":22.7655,"lng":104.965},{"key":"province:lao cai","aliases":["lao cai"],"lat":22.3559,"lng":104.096},{"key":"city:bac ninh","aliases":["tp bac ninh","thanh pho bac ninh"],"parentKey":"province:bac ninh","lat":21.18608,"lng":106.07632,"proofType":"trusted_city_representative","source":"Bắc Ninh city Q33381 gazetteer"}]$areas$::jsonb) a, normalized n
 where exists(select 1 from jsonb_array_elements_text(a->'aliases') alias where n.text like '% '||alias||' %'))
 select case when count(*) filter(where a->>'key' like 'province:%')=1
 then case when count(*) filter(where a->>'key' like 'city:%')=1 then
 (jsonb_agg(a) filter(where a->>'key' like 'city:%'))->0
 when count(*)=1 and not(public.admin_location_key(p_address) ~ '(^| )(tp|thanh pho) '
 and min(a->>'key') not in ('province:ha noi','province:ho chi minh','province:hai phong','province:da nang','province:can tho')) then min(a::text)::jsonb end end from matches
$fn$;
revoke all on function location_private.administrative_area(text) from public,anon,authenticated,service_role;
grant execute on function location_private.administrative_area(text) to location_writer;
-- Patch the existing canonical writer rather than introduce another mutator.
do $patch$
declare migration_role text:=current_user;
 original_set boolean:=pg_has_role(current_user,'location_writer','SET');
 original_memberships jsonb:=(select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=current_user::regrole);
 original_create boolean:=has_schema_privilege('location_writer','location_private','CREATE');
 definition text; anchor text := ' if w.id is null then'; replacement text;
begin
 if not original_set then execute format('grant location_writer to %I with inherit false, set true',migration_role);end if;
 if not original_create then grant create on schema location_private to location_writer;end if;
 select pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure) into definition;
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'canonical writer fallback anchor changed';end if;
 replacement := $insert$
 -- A missing point is an approximate administrative area until admin review.
 -- Invalidation/revocation still clears evidence; automatic writes never erase
 -- a valid human or verified source point (the hierarchy above runs first).
 if kind='unresolved' and p_operation='upsert' then
  r:=location_private.administrative_area(addr);
  if r is null and not(public.admin_location_key(addr) ~ '(^| )(tp|thanh pho) ') then r:=location_private.administrative_area(j.location);end if;
  if r is not null then
   latv:=(r->>'lat')::float8;lngv:=(r->>'lng')::float8;
   kind:='area';precisionv:='area';verified:=false;authority:='auto_area';
   proof:=jsonb_build_object('source',coalesce(r->>'source','Natural Earth original administrative area '||(r->>'key')),'checkedAt',now(),
    'administrativeAreaKey',r->>'key','proofType',coalesce(r->>'proofType','province_polygon_reference'));
  end if;
 end if;
 if w.id is null then$insert$;
 execute 'set local role location_writer';
 execute replace(definition,anchor,replacement);
 execute format('set local role %I',migration_role);
 if not original_create then revoke create on schema location_private from location_writer;end if;
 if not original_set then execute format('revoke location_writer from %I',migration_role);end if;
 if has_schema_privilege('location_writer','location_private','CREATE') is distinct from original_create
 or (select jsonb_agg(to_jsonb(m) order by grantor) from pg_auth_members m where roleid='location_writer'::regrole and member=migration_role::regrole) is distinct from original_memberships then raise exception 'temporary writer permissions not restored';end if;
end$patch$;
-- An administrative approximation must not stop the more precise resolver.
do $priority$
declare definition text; anchor text:='point_kind=''unresolved''';begin
 select pg_get_functiondef('public.replace_job_work_locations(bigint,jsonb)'::regprocedure) into definition;
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'canonical replace resolver priority anchor changed';end if;
 execute replace(definition,anchor,'not location_verified');
end$priority$;
-- Normal job insertion/publication/identity edits also cover the case where no
-- work-location row exists yet. No separate map-side coordinate fallback.
create function location_private.ensure_administrative_pin() returns trigger
language plpgsql security definer set search_path=pg_catalog as $body$
declare target record;
begin
 if not new.active or new.admin_hidden then return null;end if;
 if not exists(select 1 from public.job_work_locations where job_id=new.id) then
  if nullif(btrim(new.location),'') is not null then
   perform location_private.write_location(new.id,'upsert',jsonb_build_object('address',new.location,'authority','unresolved'));
  end if;
 else
  for target in select raw_address from public.job_work_locations where job_id=new.id and point_kind='unresolved' order by id loop
   perform location_private.write_location(new.id,'upsert',jsonb_build_object('address',target.raw_address,'authority','unresolved'));
  end loop;
 end if;
 return null;
end$body$;
revoke all on function location_private.ensure_administrative_pin() from public,anon,authenticated,service_role;
create trigger trg_02_administrative_pin after insert or update of company,location,active,admin_hidden on public.local_jobs
 for each row execute function location_private.ensure_administrative_pin();
-- Existing missing points use exactly the same canonical path. Rows remain
-- location_verified=false, so the administrator confirmation queue keeps them.
do $backfill$
declare item record;
begin
 for item in select j.id,coalesce(w.raw_address,nullif(btrim(j.location),'')) address
 from public.local_jobs j left join public.job_work_locations w on w.job_id=j.id
 where j.active=true and j.admin_hidden=false
 and (w.id is null or w.point_kind='unresolved') order by j.id,w.id
 loop
  if item.address is not null then
   perform location_private.write_location(item.id,'upsert',jsonb_build_object('address',item.address,'authority','unresolved'));
  end if;
 end loop;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'canonical location integrity after administrative fallback';end if;
end$backfill$;
commit;
