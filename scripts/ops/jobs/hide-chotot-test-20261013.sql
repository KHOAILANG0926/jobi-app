-- 사용자 지적(2026-10-13 23:59): Chợ Tốt 시험 5건(#4819~4823) 공개는 사용자 의도가 아니었음. 원래대로 숨김.
update public.local_jobs set admin_hidden = true
where id in (4819,4820,4821,4822,4823) and origin = 'crawler'
returning id, active, admin_hidden;
