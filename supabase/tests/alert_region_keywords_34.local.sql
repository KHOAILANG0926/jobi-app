-- 알림 지역이 34개 성 기준으로 잡힌다(점검 #3: 랑선이 꽝닌으로, 옛 Hòa Bình이 Hà Nội로 잡히던 문제).
do $t$
begin
  if public.job_alert_detect_regions('Thành phố Lạng Sơn, Lạng Sơn') <> array['langson'] then
    raise exception 'Lạng Sơn → %', public.job_alert_detect_regions('Thành phố Lạng Sơn, Lạng Sơn');
  end if;
  if public.job_alert_detect_regions('Lương Sơn, Hòa Bình') <> array['phutho'] then
    raise exception 'Hòa Bình → %', public.job_alert_detect_regions('Lương Sơn, Hòa Bình');
  end if;
  if public.job_alert_detect_regions('Phường Thanh Bình, Hải Châu, Đà Nẵng') <> array['danang'] then
    raise exception 'Codex #625 성 이름 우선: %', public.job_alert_detect_regions('Phường Thanh Bình, Hải Châu, Đà Nẵng');
  end if;
  if public.job_alert_detect_regions('Tiểu KCN Ba Bên, Từ Sơn') <> array['bacninh'] then
    raise exception '성 이름 없으면 군·구: %', public.job_alert_detect_regions('Tiểu KCN Ba Bên, Từ Sơn');
  end if;
  if public.job_alert_detect_regions('Hạ Long, Quảng Ninh') <> array['quangninh'] then
    raise exception 'Quảng Ninh → %', public.job_alert_detect_regions('Hạ Long, Quảng Ninh');
  end if;
  if (select region_ids from public.job_alert_preferences where name = 'test 34') <> array['bacninh', 'hanoi', 'tayninh'] then
    raise exception '옛 성 id 바꾸기: %', (select region_ids from public.job_alert_preferences where name = 'test 34');
  end if;
  raise notice 'alert region keywords 34 CI cases passed';
end $t$;
