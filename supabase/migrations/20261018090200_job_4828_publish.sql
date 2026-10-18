-- 2026-10-18: 공고 #4828 공개 요청(사용자 지시). 공개 여부는 DB 트리거가 최종 판단한다:
-- R7(OCR ok·이미지 해시 일치), 직업분류 게이트(코드+원문 근거), 정책 R4가 하나라도 안 맞으면 active=false로 남는다.
-- 관리자가 숨긴 공고(admin_hidden)는 되살리지 않는다.
begin;
update public.local_jobs set active = true
 where id = 4828 and admin_hidden = false and active = false;
commit;
