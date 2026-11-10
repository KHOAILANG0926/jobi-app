-- 읽기 전용(Lee 2026-11-10 "예" — 급여를 못 읽은 공고 원인 확인): 최근 3일 수집 공고 중 급여 칸이 빈 공고의
-- 원문에서 급여 관련 줄만 보여 준다. 저장소가 공개라 전화번호(0으로 시작하는 10자리)는 가린다. 데이터 변경 없음.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '::notice::#' || j.id || ' ' || left(coalesce(j.title, ''), 50) || ' | '
       || left(regexp_replace(l, '(?<![0-9])0[0-9](?:[ .-]?[0-9]){8}(?![0-9])', '[số điện thoại]', 'g'), 200)
  from public.local_jobs j, regexp_split_to_table(coalesce(j.source_text, ''), chr(10)) l
 where j.origin = 'crawler' and j.created_at > now() - interval '3 days' and j.salary is null
   and (l || ' ') ~* '(lương|thu nhập|triệu|thưởng|vnđ|đ/|[0-9] ?k[^[:alpha:]]|[0-9]tr[^[:alpha:]])'
 order by j.id
 limit 60;
