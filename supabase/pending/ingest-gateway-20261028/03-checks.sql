-- 시험(롤백 안에서만): 입구 순서·중복·특례 없음·위치가 공개를 안 바꿈.
do $$ declare a bigint; b bigint; c bigint; jid bigint; before_n int; begin
  -- 새 크롤러 공고: 원문 보존 → 새 공고 → 위치는 canonical writer, 공개 여부는 공개 판정만으로.
  a := public.ingest_job(jsonb_build_object('channel','crawler_other','source','Fixture board','source_url','https://example.test/job/1',
        'source_text','Tuyển phụ bếp. Công ty Fixture Ingest. Gọi 0912 345 678. Địa chỉ: Phường Võ Cường, TP. Bắc Ninh',
        'title','Tuyển phụ bếp','company','Fixture Ingest','employer_phone','0912 345 678','location','Phường Võ Cường, TP. Bắc Ninh',
        'category','am_thuc_do_uong','occupation_code','9402','occupation_evidence','Tuyển phụ bếp'));
  if (select count(*) from public.job_ingest_log l join public.job_ingest_raw r on r.id=l.raw_id where r.job_id=a) <> 5 then
    raise exception 'all five steps must be logged in order';
  end if;
  if (select employer_phone from public.local_jobs where id=a) <> '0912345678' then raise exception 'existing R1 trigger must still run'; end if;
  -- 같은 원문이 다른 경로로 다시 들어와도 새 공고를 만들지 않는다(경로별 특례 없음).
  b := public.ingest_job(jsonb_build_object('channel','admin','source_text','Tuyển phụ bếp. Công ty Fixture Ingest. Gọi 0912 345 678. Địa chỉ: Phường Võ Cường, TP. Bắc Ninh',
        'company','Fixture Ingest','employer_phone','0912345678','title','x'));
  if b <> a then raise exception 'duplicate from another channel must resolve to the same job'; end if;
  -- 같은 source_url은 글자가 달라도 같은 공고.
  c := public.ingest_job(jsonb_build_object('channel','crawler_other','source_url','https://example.test/job/1','source_text','edited text','company','Other','title','y'));
  if c <> a then raise exception 'same source_url must dedupe'; end if;
  -- 판정 칸은 입구가 받지 않는다.
  begin
    perform public.ingest_job(jsonb_build_object('channel','crawler_other','source_text','another post 0987 000 111','company','Z','title','z','admin_hidden',true,'policy_decision','allow:forged'));
  exception when others then null; end;
  if exists(select 1 from public.local_jobs where company='Z' and policy_decision='allow:forged') then raise exception 'decision columns must not be accepted'; end if;
  -- 원문 없으면 거부.
  begin perform public.ingest_job(jsonb_build_object('channel','admin','company','NoText')); raise exception 'missing source_text accepted';
  exception when others then if sqlerrm not like 'ingest: source_text%' then raise; end if; end;
  -- 위치 못 찾음은 공개를 바꾸지 않는다.
  select id into jid from public.local_jobs where company='Bomunttl';
  update public.local_jobs set active=true where id=jid;
  perform public.map_r1_mark_unlocated(jid,'our_miss');
  if not (select active from public.local_jobs where id=jid) then raise exception 'location result must not hide a job'; end if;
end $$;
