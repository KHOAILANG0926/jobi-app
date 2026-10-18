-- 2026-10-18: 공고 #4828 직업분류 지정(결정 0001·20261018090000 기준).
-- 원문 업무 "Sản xuất dây truyền dữ liệu, dây mạng." — 조립/기계 운전은 원문에 없어 추정하지 않는다.
-- 공식 1단계 '8'(Thợ lắp ráp và vận hành máy móc, thiết bị)까지만 지정. 세부 코드 미확정.
-- 공개(active)는 이 파일에서 바꾸지 않는다: OCR 재판독(R7)이 ok일 때 기존 공개 절차가 처리한다.
-- 이미 다른 코드가 있으면 건드리지 않는다(멱등).
begin;
update public.local_jobs
   set occupation_code = '8',
       occupation_evidence = 'Sản xuất dây truyền dữ liệu, dây mạng'
 where id = 4828
   and occupation_code is null
   and source_text like '%Sản xuất dây truyền dữ liệu, dây mạng%';
commit;
