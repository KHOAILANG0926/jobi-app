-- 읽기 전용(Lee 2026-10-28 "삭제 건수 집계 진행"): 위치 판정이 지운 공고 기록(map_r1_deleted_log) 집계.
-- 데이터 변경 없음. 결과는 GitHub Actions 주석(::notice::)으로만 출력한다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '::notice::위치 판정 삭제 기록 전체 ' || count(*) || '건'
       || coalesce(', 처음 ' || to_char(min(deleted_at) at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI'), '')
       || coalesce(', 마지막 ' || to_char(max(deleted_at) at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI'), '')
       || ' (베트남 시각)'
  from public.map_r1_deleted_log;
select '::notice::사유별 ' || reason || ' ' || count(*) || '건'
  from public.map_r1_deleted_log group by reason order by reason;
select '::notice::최근 7일 ' || count(*) || '건' from public.map_r1_deleted_log where deleted_at > now() - interval '7 days';
select '::notice::#' || job_id || ' ' || left(coalesce(title,''), 60) || ' — ' || reason || ' — '
       || to_char(deleted_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI')
  from public.map_r1_deleted_log order by deleted_at desc limit 30;
