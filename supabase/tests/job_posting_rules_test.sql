-- 규칙 R1~R5 실제 DB 시험 (KDA 사례 그대로). job-rules-apply.yml이 psql로 실행한다.
-- 시험 공고는 active=false·admin_hidden=true로 넣고, 끝나면 삭제한다(삭제 0건 확인까지 포함).
-- 결과는 job_posting_rules.last_tested_at / last_test_result에 기록한다(자동 시험만 채움).
do $t$
declare
  res jsonb := '{}'::jsonb;
  ok boolean;
  v record;
  src constant text := 'TUYỂN GẤP - Công ty KDA - Liên hệ: NGOC ANH DUONG - SĐT 08.778.807.56 - Tuổi 14-50t - KCN VSIP Bắc Ninh';
  mark constant text := '[RULE-TEST-20261013]';
  id1 bigint; id2 bigint;
begin
  delete from public.local_jobs where title like mark || '%';

  -- R1: "08.778.807.56"과 "0877.880.756"이 둘 다 0877880756으로 저장
  begin
    insert into public.local_jobs (title, company, origin, active, admin_hidden, employer_phone, contact_zalo, source_text, source_url, contact_name, age_min, age_max)
    values (mark||' R1','KDA','admin',false,true,'08.778.807.56','0877.880.756',src,'test://x','NGOC ANH DUONG',14,50) returning id into id1;
    select employer_phone, contact_zalo into v from public.local_jobs where id = id1;
    ok := v.employer_phone = '0877880756' and v.contact_zalo = '0877880756' and public.job_phones_equal('08.778.807.56','0877 880 756');
  exception when others then ok := false; end;
  res := res || jsonb_build_object('R1_phone_digits_only', ok);

  -- R2: 임의 policy_decision을 넣어도 트리거 값으로 바뀜(INSERT, UPDATE 모두)
  begin
    insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text, source_url, policy_decision)
    values (mark||' R2','KDA','admin',false,true,'KDA test','test://x','allow:FAKE@hand-written') returning id into id2;
    select policy_decision into v from public.local_jobs where id = id2;
    ok := v.policy_decision is distinct from 'allow:FAKE@hand-written'
          and v.policy_decision = public.job_policy_decision(mark||' R2','KDA',null,'other',null);
    update public.local_jobs set policy_decision = 'allow:FAKE2' where id = id2;
    select policy_decision into v from public.local_jobs where id = id2;
    ok := ok and v.policy_decision <> 'allow:FAKE2';
  exception when others then ok := false; end;
  res := res || jsonb_build_object('R2_decision_columns_code_only', ok);

  -- R3: source_text가 빈 admin 공고는 거부 / source_url·images 둘 다 없어도 거부
  begin
    begin
      insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text, source_url)
      values (mark||' R3','KDA','admin',false,true,'','test://x');
      ok := false;
    exception when check_violation then ok := sqlerrm like 'job_rule_R3%'; end;
    if ok then
      begin
        insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text)
        values (mark||' R3b','KDA','admin',false,true,'KDA text');
        ok := false;
      exception when check_violation then ok := sqlerrm like 'job_rule_R3%'; end;
    end if;
  exception when others then ok := false; end;
  res := res || jsonb_build_object('R3_source_evidence_required', ok);

  -- R5: 성조 붙인 "Ngọc Anh Dương"은 거부, 원문 그대로 "NGOC ANH DUONG"은 통과
  begin
    begin
      insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text, source_url, contact_name, age_min, age_max)
      values (mark||' R5a','KDA','admin',false,true,src,'test://x','Ngọc Anh Dương',14,50);
      ok := false;
    exception when check_violation then ok := sqlerrm like 'job_rule_R5%'; end;
    if ok then
      insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text, source_url, contact_name, age_min, age_max)
      values (mark||' R5b','KDA','admin',false,true,src,'test://x','NGOC ANH DUONG',14,50);
    end if;
  exception when others then ok := false; end;
  res := res || jsonb_build_object('R5_verbatim_names', ok);

  -- R6: 원문에 14-50t가 있는데 age_min·age_max가 비면 거부
  begin
    begin
      insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text, source_url, contact_name)
      values (mark||' R6','KDA','admin',false,true,src,'test://x','NGOC ANH DUONG');
      ok := false;
    exception when check_violation then ok := sqlerrm like 'job_rule_R6%'; end;
  exception when others then ok := false; end;
  res := res || jsonb_build_object('R6_age_preserved', ok);

    -- R7 보호: service_role이 ocr_text를 쓰려 하면 거부
  begin
    insert into public.local_jobs (title, company, origin, active, admin_hidden, source_text, source_url, contact_name, age_min, age_max)
    values (mark||' R7','KDA','admin',false,true,src,'test://x','NGOC ANH DUONG',14,50) returning id into id1;
    begin
      set local role service_role;
      update public.local_jobs set ocr_text = 'AI가 쓴 값' where id = id1;
      reset role;
      ok := false;
    exception when insufficient_privilege then
      reset role;
      ok := sqlerrm like 'job_rule_R7%' or sqlerrm like 'permission denied%';
    end;
    update public.local_jobs set ocr_text = '기계가 쓴 값' where id = id1;   -- 소유자 계정은 가능
    select ocr_text into v from public.local_jobs where id = id1;
    ok := ok and v.ocr_text = '기계가 쓴 값';
  exception when others then reset role; ok := false; end;
  res := res || jsonb_build_object('R7_ocr_crosscheck', ok);

  -- R7 공개 전 대조: images가 있으면 ocr_check ok 전까지 active=false 강제, ok(해시 일치)면 공개 유지
  begin
    -- 2026-10-18: 직업분류 공개 게이트(20261017070517) 이후 공개 시험 공고는 원문 근거가 있는 직업코드가 필요하다.
    insert into public.local_jobs (title, company, description, origin, active, admin_hidden, source_text, source_url, images, contact_name, age_min, age_max, occupation_code, occupation_evidence)
    values (mark||' R7gate','KDA','Cong nhan dong goi','admin',true,false,'Cong ty KDA tuyen gap lam linh kien tai nghe','test://x','["job-images/x.png"]',null,18,50,'82022','linh kien tai nghe') returning id into id1;
    select active into v from public.local_jobs where id = id1;
    ok := v.active = false;
    update public.local_jobs set ocr_check = jsonb_build_object('status','ok','images_hash',md5(images::text)) , active = true where id = id1;
    select active into v from public.local_jobs where id = id1;
    ok := ok and v.active = true;
    update public.local_jobs set images = '["job-images/y.png"]', active = true where id = id1;   -- images 바뀜 → 해시 불일치
    select active into v from public.local_jobs where id = id1;
    ok := ok and v.active = false;
  exception when others then ok := false; end;
  res := res || jsonb_build_object('R7_ocr_crosscheck', coalesce((res->>'R7_ocr_crosscheck')::boolean, true) and ok);

  -- U2: age_min 14 공고도 공개 유지(게시 허용 결정), 18도 공개
  begin
    insert into public.local_jobs (title, company, description, origin, active, admin_hidden, age_min, age_max, source_text, occupation_code, occupation_evidence)
    values (mark||' U2a','KDA','Cong nhan dong goi','legacy',true,false,14,50,'Lam linh kien tai nghe','82022','linh kien tai nghe') returning id into id1;
    insert into public.local_jobs (title, company, description, origin, active, admin_hidden, age_min, age_max, source_text, occupation_code, occupation_evidence)
    values (mark||' U2b','KDA','Cong nhan dong goi','legacy',true,false,18,50,'Lam linh kien tai nghe','82022','linh kien tai nghe') returning id into id2;
    ok := (select active from public.local_jobs where id = id1) = true and (select active from public.local_jobs where id = id2) = true;
  exception when others then ok := false; end;
  res := res || jsonb_build_object('U2_age_min_under_15', ok);

  -- 정리: 시험 공고 삭제 후 0건 확인
  delete from public.local_jobs where title like mark || '%';
  if exists (select 1 from public.local_jobs where title like mark || '%') then
    raise exception '시험 공고 삭제 실패';
  end if;

  update public.job_posting_rules r
     set last_tested_at = now(),
         last_test_result = case when (res ->> r.rule_key)::boolean then '통과' else '실패' end
   where res ? r.rule_key;
end $t$;
