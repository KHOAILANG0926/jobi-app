-- 운영 점검(읽기 전용): 알림 지역 키워드가 34개 성 기준이다.
do $check$
begin
  if (select count(distinct region_id) from public.job_alert_region_keywords) <> 34 then raise exception '알림 지역 수가 34가 아님'; end if;
  if exists (select 1 from public.job_alert_region_keywords where region_id in ('bacgiang', 'longan')) then raise exception '옛 성 id 키워드가 남음'; end if;
  if public.job_alert_detect_regions('Thành phố Lạng Sơn, Lạng Sơn') <> array['langson'] then raise exception 'Lạng Sơn 판정 틀림'; end if;
  if public.job_alert_detect_regions('Lương Sơn, Hòa Bình') <> array['phutho'] then raise exception 'Hòa Bình 판정 틀림'; end if;
  if has_table_privilege('anon', 'public.job_alert_region_keywords', 'insert') or has_table_privilege('authenticated', 'public.job_alert_region_keywords', 'insert') then
    raise exception '알림 키워드 표 쓰기가 외부에 열림';
  end if;
end $check$;
