-- Approved scope: require original-source occupation evidence before any publication.
-- No Auth/RLS/UI/coordinate changes. Existing R1-R8 validation remains in force.
-- Review this SQL before applying to Production. Tests use an isolated database.
begin;
create or replace function public.job_occupation_publish_reason(p_code text, p_evidence text, p_source text)
returns text language sql stable set search_path = pg_catalog, public as $$
 select case
  when nullif(btrim(p_code),'') is null then 'occupation_unclassified'
  when not exists(select 1 from public.occupation_master where code=p_code and level in (4,5)) then 'occupation_invalid_code'
  when nullif(btrim(p_evidence),'') is null then 'occupation_missing_evidence'
  when nullif(btrim(p_source),'') is null then 'occupation_missing_source'
  when position(lower(normalize(btrim(p_evidence), NFC)) in lower(normalize(p_source, NFC)))=0 then 'occupation_evidence_not_in_source'
  else 'ok' end;
$$;
create or replace function public.enforce_occupation_publication()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
 if coalesce(new.active,false) and public.job_occupation_publish_reason(
      new.occupation_code,new.occupation_evidence,new.source_text) <> 'ok' then
   new.active := false;
 end if;
 return new;
end;
$$;
-- ALL updates: active-only OCR/admin changes and edits to original evidence cannot bypass it.
-- Runs after existing policy, OCR and R8 evidence validation triggers.
drop trigger if exists trg_zzzz_occupation_publication on public.local_jobs;
create trigger trg_zzzz_occupation_publication before insert or update on public.local_jobs
 for each row execute function public.enforce_occupation_publication();
-- Repair the legacy electronics evidence copied from a generated title, using only
-- the exact duty phrase present in the preserved original (CTY KDA case).
-- No job IDs, title changes, inferred occupation codes or fabricated source text.
update public.local_jobs set occupation_evidence = substring(source_text from '(?i)(linh kiện tai nghe)')
 where occupation_code='82022'
   and lower(normalize(occupation_evidence,NFC))='làm linh kiện tai nghe'
   and source_text ~* 'linh kiện tai nghe'
   and position(lower(normalize(occupation_evidence,NFC)) in lower(normalize(source_text,NFC)))=0;
-- Hold existing unclassified public records, preserve originals and admin visibility decisions.
update public.local_jobs set active=false
 where active is true and public.job_occupation_publish_reason(occupation_code,occupation_evidence,source_text)<>'ok';
insert into public.job_posting_rules(rule_key,content,decided_on,incidents,machine_checkable,block_mode,implementation)
values ('R8_publication_requires_original_evidence',
 '공개 전 실제 업무를 공식 직업분류와 대조한다. 공식 4·5단계 코드와 원문 근거가 없으면 관리자·수집·OCR 모두 비공개 보류. OCR 성공은 업무 확인이 아님. 코드·근거 유무 검사는 의미 일치의 자동 증명이 아님.',
 date '2026-10-17', null, '가능', '보류',
 'trigger trg_zzzz_occupation_publication / job_occupation_publish_reason(); scripts/ocr/ocr-compare.mjs')
on conflict(rule_key) do update set content=excluded.content, decided_on=excluded.decided_on,
 machine_checkable=excluded.machine_checkable,block_mode=excluded.block_mode,implementation=excluded.implementation;
commit;
