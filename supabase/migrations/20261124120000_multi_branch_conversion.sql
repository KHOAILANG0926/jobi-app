-- 2순위(Lee 2026-11-24): 기존 운영 DB 다중 지점 공고 전환. 규정: CLAUDE.md 「지점별 독립 공고」(공고 단위 = 원문 글 1 + 물리적 지점 1).
-- dry-run: scripts/ops/jobs/multi-branch-conversion-preview.sql (ops-run-sql 실행 45314812701 — 대상 3건, 지점 8곳).
-- Lee 2026-11-24 확정 기준(공고 번호가 아니라 규칙으로 고른다):
--   ① 확정 위치(정문 gate 또는 확인된 exact) 지점이 하나도 없는 다중 지점 공고는 그대로 둔다 — 공개 상태·근무지 줄·원문 모두 그대로(새 공고 없음).
--   ② 확정 위치 지점이 있는 공고는 그 지점을 기존 공고 번호에 남긴다.
--   ③ 나머지 지점은 기존 위치 검색·확정 정책을 그대로 탄다: 위치 보류함(research_artifacts location-hold, status held)에 원문과 함께 넣고,
--      다음 보류 다시 확인(crawler/ingest_gateway.retry_held — Google → VietMap → Goong, 못 찾으면 7일 뒤 다시·최대 2번)이 찾은 지점만
--      같은 입구(ingest_job, 지점 위치 branch_location)로 독립 공고를 만든다. 위치 검색 순서·확정 기준·재확인 정책은 바꾸지 않는다.
--   ④ 기존 공고에서 그 지점 줄은 위치 원본 쓰기 함수로만 지운다(write_location 'delete' — 지우기 전 줄 전체가 location_private.retained_rows·write_log에 남음).
--   ⑤ 기존 공고의 위치 글자(local_jobs.location)가 남는 지점과 다르면 정식 입구(ingest_job, sql_file, update_fields=location)로만 고친다.
-- 중복 전환 방지: 보류함 줄 이름 = 'branch-split:<공고>:<지점 식별자>'의 md5(같은 지점은 한 줄, on conflict do nothing) + 다시 실행하면 대상이 없다(남는 지점 1곳).
-- 범위 밖(확정 위치 지점이 2곳 이상인 공고)은 dry-run에 없던 경우라 RAISE로 전체 취소한다(승인 범위 밖 전환 금지).
-- 복구: retained_rows(원래 줄 전체) + 보류함 meta(from_job_id·work_location_id·branch_key)로 원래 공고에 줄을 다시 쓸 수 있다(docs/plans/2026-11-24-multi-branch-conversion.md 3절).
do $pre$
begin
  if to_regprocedure('location_private.write_location(bigint,text,jsonb)') is null then raise exception 'multi-branch: 위치 원본 쓰기 함수 없음'; end if;
  if to_regprocedure('public.ingest_job(jsonb)') is null then raise exception 'multi-branch: 정식 입구(ingest_job) 없음'; end if;
  if to_regprocedure('public.admin_location_key(text)') is null then raise exception 'multi-branch: admin_location_key 없음'; end if;
  if to_regclass('location_private.retained_rows') is null then raise exception 'multi-branch: 이력 보관(retained_rows) 없음'; end if;
  if to_regclass('public.research_artifacts') is null then raise exception 'multi-branch: 위치 보류함(research_artifacts) 없음'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'research_artifacts'
       and column_name in ('kind', 'name', 'payload', 'meta')) <> 4 then raise exception 'multi-branch: 보류함 칸(kind·name·payload·meta) 다름'; end if;
end $pre$;

do $conv$
declare
  tr record; wr record; j public.local_jobs; keep_key text; keep_addr text; n_keep int; hold_name text; payload jsonb; stamp text;
begin
  stamp := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"');
  for tr in
    select x.job_id from (
      select w.job_id, coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) as k from public.job_work_locations w) x
     group by x.job_id having count(distinct x.k) > 1 order by x.job_id
  loop
    select * into j from public.local_jobs where id = tr.job_id for update;
    select count(distinct coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address))),
           min(coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)))
      into n_keep, keep_key
      from public.job_work_locations w
     where w.job_id = j.id and w.lat is not null and w.lng is not null
       and (w.point_kind = 'gate' or (w.point_kind = 'exact' and w.location_verified));
    if n_keep = 0 then
      raise notice 'multi-branch: #% 확정 위치 지점 없음 — 그대로 둠(기준 ①)', j.id;
      continue;
    elsif n_keep > 1 then
      raise exception 'multi-branch: #% 확정 위치 지점 %곳 — dry-run·승인 범위 밖, 전체 취소', j.id, n_keep;
    end if;
    select w.raw_address into keep_addr from public.job_work_locations w
     where w.job_id = j.id and coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) = keep_key
     order by w.sort_order, w.id limit 1;
    for wr in
      select x.*, coalesce(nullif(x.normalized_address, ''), public.admin_location_key(x.raw_address)) as k
        from public.job_work_locations x where x.job_id = j.id order by x.sort_order, x.id
    loop
      continue when wr.k = keep_key;
      hold_name := md5('branch-split:' || j.id || ':' || wr.k);
      payload := (to_jsonb(j) - array['id', 'created_at', 'updated_at', 'active', 'admin_hidden', 'origin', 'policy_decision', 'ocr_text', 'ocr_check',
                   'publish_gate_reason', 'last_verified_at', 'crawler_version', 'inspect_hold', 'duplicate_of', 'company_id',
                   'location', 'lat', 'lng', 'latitude', 'longitude', 'location_verified', 'coordinate_accuracy'])
                 || jsonb_build_object('location', wr.raw_address, 'branch_location', wr.raw_address,
                                       'work_locations', jsonb_build_array(jsonb_build_object('raw_address', wr.raw_address)));
      insert into public.research_artifacts(kind, name, payload, meta)
      values ('location-hold', hold_name, payload,
              jsonb_build_object('status', 'held', 'reason', 'branch_split', 'held_at', stamp, 'attempts', 0, 'next_at', stamp,
                                 'from_job_id', j.id, 'work_location_id', wr.id, 'branch_key', wr.k))
      on conflict (kind, name) do nothing;
      if not exists (select 1 from public.research_artifacts r where r.kind = 'location-hold' and r.name = hold_name) then
        raise exception 'multi-branch: #% 지점 % 보류함 보관 실패 — 줄을 지우지 않고 전체 취소', j.id, wr.id;
      end if;
      perform location_private.write_location(j.id, 'delete', jsonb_build_object('work_location_id', wr.id));
      if not exists (select 1 from location_private.retained_rows r where r.job_id = j.id and (r.row_data->>'id')::bigint = wr.id) then
        raise exception 'multi-branch: #% 지점 줄 % 이력 보관 확인 실패 — 전체 취소', j.id, wr.id;
      end if;
      raise notice 'multi-branch: #% 지점 줄 % → 위치 보류함(기존 위치 검색·확정 정책)', j.id, wr.id;
    end loop;
    if public.admin_location_key(coalesce(j.location, '')) is distinct from keep_key then
      if coalesce(btrim(j.source_text), '') = '' then raise exception 'multi-branch: #% 원문 없음 — 정식 입구로 위치 글자를 고칠 수 없음, 전체 취소', j.id; end if;
      perform public.ingest_job(jsonb_build_object('channel', 'sql_file', 'job_id', j.id, 'update_fields', jsonb_build_array('location'),
                                                   'location', keep_addr, 'source_text', j.source_text, 'source', j.source, 'source_url', j.source_url));
      raise notice 'multi-branch: #% 위치 글자 → 남는 지점 주소', j.id;
    end if;
  end loop;
end $conv$;
