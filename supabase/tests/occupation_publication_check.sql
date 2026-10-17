-- Isolated test DB; all fixture changes rolled back.
begin;
do $$
declare state boolean;
begin
 if (select active from public.local_jobs where id=100) then raise exception 'FAIL: existing unclassified public job not held'; end if;
 if (select occupation_evidence from public.local_jobs where id=101) <> 'linh kiện tai nghe' then raise exception 'FAIL: legacy evidence not repaired from actual original'; end if;
 if not (select active from public.local_jobs where id=101) then raise exception 'FAIL: existing valid public job changed'; end if;
 insert into public.local_jobs(id,title,source_text,active) values
 (1,'Tuyển 1 bạn trẻ làm trên ĐT + Máy tính','Công việc nhẹ nhàng. Làm trên ĐT + Máy tính.',true);
 select active into state from public.local_jobs where id=1;
 if state then raise exception 'FAIL: ambiguous phone/computer job published without classification'; end if;
 update public.local_jobs set active=true where id=1;
 if (select active from public.local_jobs where id=1) then raise exception 'FAIL: active-only update bypassed classification'; end if;
 insert into public.local_jobs(id,source_text,occupation_code,occupation_evidence,active) values
 (2,'CTY KDA tuyển làm linh kiện tai nghe','82022','làm linh kiện tai nghe',true);
 if not (select active from public.local_jobs where id=2) then raise exception 'FAIL: valid source-backed classification blocked'; end if;
 -- A generated title/description cannot substitute for original evidence.
 insert into public.local_jobs(id,title,source_text,occupation_code,occupation_evidence,active) values
 (3,'thợ hàn','Công việc nhẹ nhàng','7212','thợ hàn',true);
 if (select active from public.local_jobs where id=3) then raise exception 'FAIL: generated title accepted as original evidence'; end if;
 update public.local_jobs set source_text='Nội dung đã thay đổi', active=true where id=2;
 if (select active from public.local_jobs where id=2) then raise exception 'FAIL: stale evidence kept public after source edit'; end if;
 update public.local_jobs set occupation_code=null,occupation_evidence=null,active=true where id=3;
 if (select active from public.local_jobs where id=3) then raise exception 'FAIL: clearing classification bypassed gate'; end if;
 begin
  insert into public.local_jobs(id,source_text,occupation_code,occupation_evidence,active) values(4,'thợ hàn','82','thợ hàn',true);
  raise exception 'FAIL: broad occupation code accepted';
 exception when check_violation then null;
 end;
 begin
  insert into public.local_jobs(id,source_text,occupation_code,occupation_evidence,active) values(5,'thợ hàn','7212','không có trong nguồn',true);
  raise exception 'FAIL: fabricated evidence accepted';
 exception when check_violation then null;
 end;
 raise notice 'occupation publication: 10 scenarios passed';
end $$;
rollback;
