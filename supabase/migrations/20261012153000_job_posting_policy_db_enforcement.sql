-- 공고 제외 정책 DB 강제 (2026-10-12 사용자 승인, Production 적용 완료)
-- 목적: 앱 화면을 거치지 않는 경로(anon REST 게스트 등록, service-role 스크립트, VPS 크롤러, SQL)까지
--       제외 대상 공고가 공개 상태로 저장되지 못하게 한다.
-- 동작: active=true AND admin_hidden=false 인 행만 검사.
--   exclude → 저장 거부(check_violation) / review → active=false 로 저장(관리자 JWT는 공개 허용) / allow → 그대로.
--   이미 공개된 행의 내용(title/company/description/category/salary)이 바뀌지 않은 UPDATE는 재평가하지 않음.
-- 규칙 원본: policy/job-posting-rules.json (version 2026-10-12-v3). JS 판정기: src/lib/jobPostingPolicy.mjs.
--   job_policy_rules()의 JSON은 원본 규칙에서 \b→\y 변환, debt 창(window) 규칙을 debt_win 정규식으로 펼친 것.
--   규칙 JSON을 바꾸면 이 함수도 새 마이그레이션으로 함께 바꿔야 한다(api/_job-policy-db-sync.test.ts가 불일치를 잡음).
-- 검증(적용 시 직접 확인): fixtures 57/57 일치, 운영 공개 101건 전부 allow, #4750 exclude,
--   트리거 시험 7건(원문 #4750 등록·숨김해제·채권추심·대출 제목변경 거부, 애매한 B2B 비공개 저장, 정상 공개, 단순 수정 통과).

alter table public.local_jobs add column if not exists policy_decision text;
comment on column public.local_jobs.policy_decision is 'DB 공고 정책 트리거 판정 결과(decision:reason@version). 2026-10-12 사용자 승인.';

create or replace function public.job_policy_rules() returns jsonb
language sql immutable set search_path = pg_catalog, public as $f$
  select '{"version":"2026-10-12-v3","debt_role":["\\ydebt (collector|collection)\\y","\\ythu no\\y"],"loan_role":["\\y(tu van|ho tro|moi gioi) (vay|cho vay|tin dung)\\y","\\y(loan officer|loan sales|credit sales|credit officer)\\y","\\y(nhan vien|chuyen vien) (tin dung|cho vay)\\y","\\ytu van tai chinh\\y","\\y(ban|tu van) the tin dung\\y","\\yfinancial (sales|advisor)\\y"],"sales_role":["\\y(sales|sale|kinh doanh|ban hang|telesales|tu van tai chinh)\\y","\\y(salesperson|salesman|saleswoman|business development|moi gioi|tu van bat dong san)\\y"],"loan_product":["\\y(vay tien|cho vay|khoan vay|tin dung|tai chinh tieu dung|loan|credit card)\\y"],"finance_company":["\\y(cong ty tai chinh|fe credit|home credit|mcredit|mirae asset|shinhan finance|vpbank finance)\\y"],"retail_primary":["\\y(cua hang|sieu thi|minimart|thu ngan|cashier|store assistant|shop assistant|retail assistant)\\y","\\yretail store\\y","\\y(dien may|showroom|noi that)\\y"],"b2b_primary":["\\y(quan ly|cham soc|phat trien) (he thong )?(dai ly|nha phan phoi)\\y","\\y(tim kiem|gap go|tham|di tham|phat trien) (khach hang doanh nghiep|khach hang b2b|dai ly|nha phan phoi)\\y","\\y(field sales|outside sales|dealer management|distributor management)\\y","\\y(b2b|khach hang doanh nghiep)\\y.{0,80}\\y(thi truong|ngoai thi truong|di thi truong|ngoai hien truong|di gap)\\y","\\y(manage|managing) (dealers|distributors)\\y"],"b2b_signal":["\\y(b2b|khach hang doanh nghiep|dai ly|nha phan phoi)\\y"],"professional_sales":["\\y(chuyen vien|sales? executive|sales specialist|key account|bat dong san|professional sales)\\y"],"incentive":["\\y(hoa hong|commission|incentive)\\y"],"high_income":["\\y([2-9][0-9]|[1-9][0-9]{2,}) (trieu|million)\\y","\\y([2-9][0-9] 000 000|[1-9][0-9]{2,} 000 000|[2-9][0-9]000000|[1-9][0-9]{2,}000000) (vnd|dong)\\y"],"ambiguous_title":["^(tuyen (dung )?(nhan vien|lao dong)|nhan vien|viec lam|cong viec|staff|hiring staff)$"],"loan_duty":["\\ytu van (san pham )?(khoan vay|cho vay|vay|tin dung)\\y","\\y(tiep can|tim kiem) khach hang (vay|vay tien)\\y","\\y(ban|tu van) the tin dung\\y","\\y(sell|selling|advise on) (loans|loan products|credit cards)\\y"],"b2b_title":["\\yb2b\\y"],"business_customer":["\\y(f b|fnb|doanh nghiep|khach hang doanh nghiep|business clients?|corporate clients?|cua hang|nha hang|quan ca phe|quan an)\\y"],"customer_outreach":["\\y(tim kiem|tiep can|di gap|gap go|tham|di tham|visit|visiting|prospect|prospecting|approach)\\y"],"business_contract":["\\y(hop dong|ky ket|ky hop dong|contract|contracts|contracting)\\y"],"market_sales":["\\y(sales? thi truong|kinh doanh thi truong|nhan vien thi truong)\\y"],"consumer_distribution":["\\y(coca cola|kinh do|unilever|panasonic|nha phan phoi|cong ty phan phoi|hang tieu dung|fmcg)\\y"],"retail_supply":["\\y(tap hoa|diem ban|cua hang ban le|cua hang|sieu thi|retail outlets?|retail shops?)\\y"],"shift_work":["\\yca (1|2)\\y","\\yxoay ca\\y","\\y(lam|lam viec|ban hang|tu van) (theo )?ca\\y","\\yshift work\\y"],"debt_win":["\\ythu hoi\\y.{0,15}\\yno\\y|\\yno\\y.{0,15}\\ythu hoi\\y","\\ythu hoi\\y.{0,15}\\ycong no\\y|\\ycong no\\y.{0,15}\\ythu hoi\\y","\\ythu hoi\\y.{0,15}\\ykhoan vay\\y|\\ykhoan vay\\y.{0,15}\\ythu hoi\\y","\\yxu ly\\y.{0,15}\\yno xau\\y|\\yno xau\\y.{0,15}\\yxu ly\\y","\\yxu ly\\y.{0,15}\\yno\\y|\\yno\\y.{0,15}\\yxu ly\\y","\\ynhac\\y.{0,15}\\yno\\y|\\yno\\y.{0,15}\\ynhac\\y","\\ynhac\\y.{0,15}\\ythanh toan\\y|\\ythanh toan\\y.{0,15}\\ynhac\\y","\\ydoi\\y.{0,2}\\yno\\y|\\yno\\y.{0,2}\\ydoi\\y","\\yfield\\y.{0,15}\\ycollection\\y|\\ycollection\\y.{0,15}\\yfield\\y"]}'::jsonb
$f$;

create or replace function public.job_policy_norm(x text) returns text
language sql stable set search_path = pg_catalog, public as $f$
  select trim(regexp_replace(public.unaccent(lower(coalesce(x,''))), '[^a-z0-9]+', ' ', 'g'))
$f$;

create or replace function public.job_policy_match(grp text, txt text) returns boolean
language sql stable set search_path = pg_catalog, public as $f$
  select exists (select 1 from jsonb_array_elements_text(public.job_policy_rules()->grp) p where txt ~ p)
$f$;

-- Mirror of src/lib/jobPostingPolicy.mjs evaluateJobPostingPolicy (rules 2026-10-12-v3).
create or replace function public.job_policy_decision(p_title text, p_company text, p_description text, p_category text, p_salary text)
returns text language plpgsql stable set search_path = pg_catalog, public as $f$
declare
  t text := public.job_policy_norm(p_title);
  co text := public.job_policy_norm(p_company);
  d text := public.job_policy_norm(regexp_replace(coalesce(p_description,''), '\[source:[^\]]*\]', '', 'gi'));
  ca text := public.job_policy_norm(p_category);
  s text := public.job_policy_norm(p_salary);
  td text; sales boolean; retail boolean; b2bt boolean; cdist boolean; rsup boolean; mkt boolean;
  v text := public.job_policy_rules()->>'version';
begin
  td := t || ' ' || d;
  if public.job_policy_match('debt_role', t) or public.job_policy_match('debt_role', ca)
     or public.job_policy_match('debt_win', t) or public.job_policy_match('debt_win', ca) then
    return 'exclude:dedicated_debt_collection@' || v; end if;
  if public.job_policy_match('loan_role', t) then return 'exclude:dedicated_finance_sales@' || v; end if;
  sales := public.job_policy_match('sales_role', t);
  if sales and (public.job_policy_match('loan_product', t) or public.job_policy_match('loan_duty', d)
      or (public.job_policy_match('finance_company', co) and not public.job_policy_match('retail_primary', t))) then
    return 'exclude:dedicated_finance_sales@' || v; end if;
  if t = '' or d = '' or public.job_policy_match('ambiguous_title', t) then return 'review:incomplete_role_evidence@' || v; end if;
  b2bt := public.job_policy_match('b2b_title', t);
  if b2bt and public.job_policy_match('business_customer', d) and public.job_policy_match('customer_outreach', d)
     and public.job_policy_match('business_contract', d) then return 'exclude:b2b_business_contract_sales@' || v; end if;
  cdist := public.job_policy_match('consumer_distribution', co || ' ' || td);
  rsup := public.job_policy_match('retail_supply', d);
  mkt := public.job_policy_match('market_sales', td);
  if sales and not b2bt and ((cdist and rsup) or (mkt and (cdist or rsup))) then
    return 'allow:consumer_retail_distribution_sales@' || v; end if;
  retail := public.job_policy_match('retail_primary', td);
  if sales and public.job_policy_match('b2b_primary', td) then
    return case when retail then 'review:mixed_retail_b2b@' else 'exclude:primary_b2b_field_dealer_sales@' end || v; end if;
  if sales and public.job_policy_match('b2b_signal', td) and not retail and not public.job_policy_match('shift_work', td) then
    return 'review:unclear_b2b_role@' || v; end if;
  if sales and not retail and public.job_policy_match('professional_sales', t)
     and public.job_policy_match('incentive', d || ' ' || s) and public.job_policy_match('high_income', d || ' ' || s) then
    return 'review:professional_incentive_sales@' || v; end if;
  if sales and not retail then return 'allow:ordinary_sales_without_exclusion_evidence@' || v; end if;
  return 'allow:no_excluded_role_evidence@' || v;
end $f$;

create or replace function public.enforce_job_posting_policy() returns trigger
language plpgsql set search_path = pg_catalog, public as $f$
declare d text;
begin
  if coalesce(NEW.active, false) and not coalesce(NEW.admin_hidden, false) then
    if TG_OP = 'UPDATE' and coalesce(OLD.active, false) and not coalesce(OLD.admin_hidden, false)
       and NEW.title is not distinct from OLD.title and NEW.company is not distinct from OLD.company
       and NEW.description is not distinct from OLD.description and NEW.category is not distinct from OLD.category
       and NEW.salary is not distinct from OLD.salary then
      return NEW;
    end if;
    d := public.job_policy_decision(NEW.title, NEW.company, NEW.description, NEW.category, NEW.salary);
    NEW.policy_decision := d;
    if d like 'exclude:%' then
      raise exception 'job_posting_policy_excluded: %', d using errcode = 'check_violation';
    elsif d like 'review:%' and not public.is_admin() then
      NEW.active := false;
    end if;
  end if;
  return NEW;
end $f$;

drop trigger if exists trg_enforce_job_posting_policy on public.local_jobs;
create trigger trg_enforce_job_posting_policy
  before insert or update on public.local_jobs
  for each row execute function public.enforce_job_posting_policy();
