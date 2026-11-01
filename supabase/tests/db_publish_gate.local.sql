-- 20261101190000_db_publish_gate.sql 실제 PostgreSQL 시험(폐기용 DB)
do $test$
begin
  insert into public.local_jobs (id, origin, title, location, employer_phone, active, publish_gate_reason)
  values (9201, 'crawler', 'A', 'KCN Yên Phong', '0877 880 756', true, 'no_application_path');   -- 잘못 적어 보낸 값
  if (select publish_gate_reason from public.local_jobs where id = 9201) <> 'ok' then raise exception '① 계산값으로 덮어쓰지 않음'; end if;
  insert into public.local_jobs (id, origin, title, location, active, publish_gate_reason) values (9202, 'crawler', 'B', 'Bắc Ninh', true, 'ok');   -- 연락처 없음인데 ok라고 적음
  if (select publish_gate_reason <> 'no_application_path' or active from public.local_jobs where id = 9202) then raise exception '② 연락처 없는 수집 공고가 ok/공개됨'; end if;
  insert into public.local_jobs (id, origin, title, employer_phone, active) values (9203, 'crawler', 'C', '0912345678', true);
  if (select publish_gate_reason <> 'no_address_text' or active from public.local_jobs where id = 9203) then raise exception '③ 근무지 없는 수집 공고가 공개됨'; end if;
  insert into public.local_jobs (id, origin, title, location, active) values (9204, 'admin', 'D', 'x', true);
  if (select publish_gate_reason <> 'no_application_path' or not active from public.local_jobs where id = 9204) then raise exception '④ 관리자 공고는 기록만, 공개 유지'; end if;
  update public.local_jobs set publish_gate_reason = 'ok' where id = 9202;
  if (select publish_gate_reason from public.local_jobs where id = 9202) <> 'no_application_path' then raise exception '⑤ 수정으로 덮어쓰기 가능'; end if;
  delete from public.local_jobs where id in (9201, 9202, 9203, 9204);
  raise notice 'db_publish_gate local test: 5개 경우 통과';
end $test$;
