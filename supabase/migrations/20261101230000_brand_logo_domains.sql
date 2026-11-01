-- 2026-11-01 Lee: "대기업들은 자체 로고가 있잖아 그거 넣어줘" — 화면은 브랜드 domain의 공식 사이트 아이콘(favicon)을 로고로 보여 준다.
-- 공식 사이트 주소를 확인한 브랜드만 domain을 넣는다(확인 못 한 브랜드는 그대로 이름 첫 글자·색).
--   highlandscoffee.com.vn (공식 채용 사이트 careers.highlandscoffee.com.vn), trungnguyenlegend.com(공식 사이트), wallacevn.com(공식 사이트, 2026-11-01 조회),
--   greensm.com(Xanh SM 공식 뉴스 사이트).
begin;
update public.job_brands set domain = v.domain, updated_at = now()
from (values ('highlands-coffee', 'highlandscoffee.com.vn'), ('trung-nguyen-legend', 'trungnguyenlegend.com'),
             ('wallace', 'wallacevn.com'), ('xanh-sm-gsm', 'greensm.com')) as v(slug, domain)
where job_brands.slug = v.slug and job_brands.domain is distinct from v.domain;
commit;
