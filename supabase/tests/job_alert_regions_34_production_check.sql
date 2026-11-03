-- 운영 점검(읽기 전용): 알림 지역이 공식 34개 성 기준이다(20261103120000_job_alert_regions_34).
do $check$
declare n int;
begin
  select count(distinct region_id) into n from public.job_alert_region_keywords;
  if n <> 34 then raise exception '알림 지역 키워드 지역 수 % (기대 34)', n; end if;
  if exists (select 1 from public.job_alert_region_keywords where region_id in ('bacgiang', 'longan')) then
    raise exception '옛 성 id 키워드가 남음';
  end if;
  if exists (select 1 from public.job_alert_preferences where region_ids && array['bacgiang', 'longan']) then
    raise exception '알림 설정에 옛 성 id가 남음';
  end if;
  if public.job_alert_detect_regions('KCN Đình Trám, Việt Yên, Bắc Giang') <> array['bacninh'] then
    raise exception '옛 Bắc Giang 주소 판정 오류';
  end if;
  if not ('caobang' = any(public.job_alert_detect_regions('Thành phố Cao Bằng, Tỉnh Cao Bằng'))) then
    raise exception 'Cao Bằng 판정 오류';
  end if;
  raise notice 'job_alert_regions_34 production check passed';
end $check$;
