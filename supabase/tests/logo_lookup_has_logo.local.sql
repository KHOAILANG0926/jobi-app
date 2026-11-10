-- has_logo 기록: 한도 초과로 남았던 공고가 이미 로고·사진을 갖게 되면 has_logo로 끝나 다시 시도 목록에서 빠진다.
do $t$
declare r text; bad boolean := false;
begin
  insert into public.local_jobs(id, company, location) values (990101, 'Cty B', 'Bắc Ninh');
  r := public.job_logo_lookup_record(990101, 'quota', null, 'p9');
  if (select logo_lookup->>'result' from public.local_jobs where id = 990101) <> 'quota' then raise exception 'quota 기록 실패'; end if;
  r := public.job_logo_lookup_record(990101, 'has_logo', 'evil.com', 'p9');
  if r <> 'has_logo' then raise exception 'has_logo 결과 오류: %', r; end if;
  if (select logo_lookup->>'result' from public.local_jobs where id = 990101) <> 'has_logo'
     or (select company_domain from public.local_jobs where id = 990101) is not null then
    raise exception 'has_logo 기록 오류(도메인은 비어야 함)';
  end if;
  begin
    r := public.job_logo_lookup_record(990101, 'bogus', null, null);
  exception when others then bad := true;
  end;
  if not bad then raise exception '모르는 결과 값을 받음'; end if;
  -- 예전 결과 값은 그대로
  r := public.job_logo_lookup_record(990101, 'found', 'www.Netco.com.vn', 'p1');
  if r <> 'found' then raise exception '기존 found 동작 바뀜: %', r; end if;
  raise notice 'logo has_logo CI cases passed';
end $t$;
