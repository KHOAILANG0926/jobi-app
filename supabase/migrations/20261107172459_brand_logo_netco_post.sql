-- 브랜드 로고 그림 기록(Lee 2026-11-07 "1"): NETCO POST ← Lee 제공 위아래 두 줄 로고(NETCO 공식 페이스북 @netcopost 프로필 사진과 같은 그림).
-- 공식 사이트 netco.com.vn/logo.png는 한 줄 가로 로고라 정사각형 자리에서 글자가 작아 쓰지 않음. 페이스북 출처는 매달 자동 비교 대상이 아님(brand-logo-watch.yml이 건너뜀).
do $m$
declare n integer;
begin
  update public.job_brands set logo_url = '/brand-logos/netco-post.png', logo_source_url = 'https://www.facebook.com/netcopost',
         logo_sha256 = 'aa957786be13dff55a55e88171f96ad06237e81f24d20780b9b32b5eb993272d'
   where slug = 'netco-post' and domain = 'netco.com.vn';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '브랜드 로고 그림: netco-post 브랜드 없음'; end if;
end $m$;
