-- PENDING ONLY. Never run against Production without separate DDL approval.
-- PostgreSQL UTF8 required. Transaction always rolls back; not an auto migration.
BEGIN;
CREATE OR REPLACE FUNCTION public.job_policy_normalize_v1(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT trim(regexp_replace(regexp_replace(normalize(regexp_replace(
    replace(normalize(lower(value), NFD), 'đ', 'd'), '[̀-ͯ]', '', 'g'), NFC),
    '[^a-z0-9가-힣[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'));
$$;
CREATE OR REPLACE FUNCTION public.evaluate_job_policy_v1(job jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $body$
DECLARE
  spec constant jsonb := $spec${
  "version": "job-posting-v1",
  "rules": [
    {
      "id": "finance_role",
      "decision": "exclude",
      "fields": [
        "title"
      ],
      "pattern": "(loan|credit|tin dung|tu van vay|cho vay|vay tien|tai chinh|대출|금융|여신)"
    },
    {
      "id": "debt_role",
      "decision": "exclude",
      "fields": [
        "title",
        "category"
      ],
      "pattern": "(thu hoi (cong )?no|nhac no|doi no|thu no|xu ly no( xau)?|debt collect(or|ion)|field collection|채권추심)"
    },
    {
      "id": "debt_duty",
      "decision": "exclude",
      "fields": [
        "description"
      ],
      "pattern": "(nhiem vu chinh|cong viec chinh|chuyen trach|chu yeu|primary dut(y|ies)|main responsibilit(y|ies)|주 업무).*(thu hoi no|nhac no|debt collection|채권추심)"
    },
    {
      "id": "finance_duty",
      "decision": "exclude",
      "fields": [
        "description"
      ],
      "pattern": "(tu van|ban|chao ban|gioi thieu|tiep thi|kinh doanh) (san pham )?(cho vay|vay|tin dung|the tin dung)|loan (sales|officer)|대출 (상담|모집|영업)|금융 상품 영업"
    },
    {
      "id": "b2b_role",
      "decision": "exclude",
      "fields": [
        "title"
      ],
      "pattern": "(b2b (sales|account)|sales b2b|kinh doanh b2b|kinh doanh khach hang doanh nghiep|quan ly dai ly|phat trien dai ly|dai dien thuong mai|영업.*대리점|대리점 관리|기업 대상 외근 영업)"
    },
    {
      "id": "b2b_duty",
      "decision": "exclude",
      "fields": [
        "description"
      ],
      "pattern": "(nhiem vu chinh|cong viec chinh|chu yeu|primary dut(y|ies)|main responsibilit(y|ies)|주 업무).*(quan ly dai ly|phat trien dai ly|khach hang doanh nghiep|b2b|대리점|기업 고객)|(di thi truong|ngoai thi truong|field sales).*(phat trien dai ly|quan ly dai ly|khach hang doanh nghiep)"
    },
    {
      "id": "incentive_sales",
      "decision": "review",
      "fields": [
        "title",
        "description"
      ],
      "pattern": "(hoa hong|commission|thu nhap khong gioi han|thu nhap cao|인센티브|고소득)",
      "requires": "sales",
      "unless": "local_work"
    },
    {
      "id": "unclear_b2b",
      "decision": "review",
      "fields": [
        "description"
      ],
      "pattern": "(khach hang doanh nghiep|quan ly dai ly|phat trien dai ly|b2b|대리점 관리|기업 고객)",
      "requires": "sales"
    },
    {
      "id": "ambiguous_role",
      "decision": "review",
      "fields": [
        "description"
      ],
      "pattern": "(cong viec se trao doi|trao doi khi phong van|lien he de biet them|details on interview|업무 미정)"
    }
  ],
  "sales": "(sales|kinh doanh|영업)",
  "local_work": "(cua hang|sieu thi|ban hang tai quay|thu ngan|retail|store|supermarket|san xuat|cong nhan|qc|kiem tra chat luong|매장|마트|생산|품질)",
  "negation": "(khong (lam|phai|ban|tu van)|not (a|involved)|no (loan|debt)|없음|아님|금지)",
  "messages": {
    "finance_role": "Không công khai: công việc chuyên về tài chính hoặc cho vay.",
    "finance_duty": "Không công khai: nhiệm vụ bán hoặc tư vấn sản phẩm cho vay.",
    "debt_role": "Không công khai: công việc chuyên thu hồi nợ.",
    "b2b_role": "Không công khai: công việc B2B hoặc quản lý đại lý.",
    "b2b_duty": "Không công khai: nhiệm vụ chính là B2B hoặc quản lý đại lý.",
    "incentive_sales": "Cần làm rõ nhiệm vụ và cơ cấu thu nhập trước khi công khai.",
    "unclear_b2b": "Cần làm rõ nhiệm vụ B2B trước khi công khai.",
    "unclear_sales": "Cần mô tả nơi làm việc và nhiệm vụ bán hàng trước khi công khai.",
    "missing_content": "Cần nhập tiêu đề và mô tả công việc trước khi công khai.",
    "ambiguous_role": "Cần làm rõ nhiệm vụ công việc trước khi công khai.",
    "policy_unavailable": "Không thể kiểm tra chính sách. Chưa công khai tin; vui lòng thử lại.",
    "debt_duty": "Không công khai: nhiệm vụ chính là thu hồi nợ."
  },
  "local_duty": "(ban hang tai (quay|cua hang|sieu thi)|lam viec tai (cua hang|sieu thi)|thu ngan|san xuat|dong goi|kiem tra chat luong|매장 판매|마트 계산|생산|품질 검사)",
  "generic_title": "^(tuyen (dung )?)?(nhan vien|nhan su|cong tac vien|staff|employee|직원|직원 모집)$",
  "substantive_duty": "(ban hang tai|thu ngan|san xuat|dong goi|kiem tra chat luong|van hanh|phuc vu|pha che|phu bep|giao hang|bao ve|ve sinh|ke toan|sua chua|cham soc khach hang|매장 판매|계산|생산|검사|배달|청소)"
}$spec$::jsonb;
  fields jsonb;
  role_text text;
  local_work boolean;
  rule jsonb;
  field_name text;
  review_reason text;
  reason text := 'allowed';
  decision text := 'allow';
BEGIN
  fields := jsonb_build_object(
    'title', public.job_policy_normalize_v1(coalesce(job->>'title', '')),
    'description', public.job_policy_normalize_v1(coalesce(job->>'description', '')),
    'category', public.job_policy_normalize_v1(coalesce(job->>'category', '')));
  role_text := (fields->>'title') || ' ' || (fields->>'description');
  local_work := (fields->>'title') ~ ('(^|[^a-z0-9])(?:' || (spec->>'local_work') || ')(?=$|[^a-z0-9])') OR (fields->>'description') ~ ('(^|[^a-z0-9])(?:' || (spec->>'local_duty') || ')(?=$|[^a-z0-9])');
  FOR rule IN SELECT value FROM jsonb_array_elements(spec->'rules') LOOP
    IF rule->>'unless' = 'local_work' AND local_work THEN CONTINUE; END IF;
    IF rule->>'requires' = 'sales' AND NOT role_text ~ ('(^|[^a-z0-9])(?:' || (spec->>'sales') || ')(?=$|[^a-z0-9])') THEN CONTINUE; END IF;
    FOR field_name IN SELECT jsonb_array_elements_text(rule->'fields') LOOP
      IF NOT (fields->>field_name) ~ ('(^|[^a-z0-9])(?:' || (rule->>'pattern') || ')(?=$|[^a-z0-9])') THEN CONTINUE; END IF;
      IF (fields->>field_name) ~ ('(^|[^a-z0-9])(?:' || (spec->>'negation') || ')(?=$|[^a-z0-9])') THEN
        review_reason := 'ambiguous_role'; CONTINUE;
      END IF;
      IF rule->>'decision' = 'exclude' THEN
        RETURN jsonb_build_object('decision','exclude','reason',rule->>'id','version',spec->>'version');
      END IF;
      review_reason := coalesce(review_reason,rule->>'id');
    END LOOP;
  END LOOP;
  IF fields->>'title' = '' OR fields->>'description' = '' THEN
    decision := 'review'; reason := 'missing_content';
  ELSIF review_reason IS NOT NULL THEN
    decision := 'review'; reason := review_reason;
  ELSIF (fields->>'title') ~ (spec->>'generic_title') AND NOT (fields->>'description') ~ ('(^|[^a-z0-9])(?:' || (spec->>'substantive_duty') || ')(?=$|[^a-z0-9])') THEN
    decision := 'review'; reason := 'ambiguous_role';
  ELSIF role_text ~ ('(^|[^a-z0-9])(?:' || (spec->>'sales') || ')(?=$|[^a-z0-9])')
    AND NOT local_work THEN
    decision := 'review'; reason := 'unclear_sales';
  END IF;
  RETURN jsonb_build_object('decision',decision,'reason',reason,'version',spec->>'version');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('decision','review','reason','policy_unavailable','version','job-posting-v1');
END;
$body$;
CREATE OR REPLACE FUNCTION public.guard_job_publication_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE verdict jsonb;
BEGIN
  IF NEW.active IS TRUE AND NEW.admin_hidden IS FALSE THEN
    verdict := public.evaluate_job_policy_v1(to_jsonb(NEW));
    IF verdict->>'decision' IS DISTINCT FROM 'allow' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='job_policy:' || coalesce(verdict->>'reason','policy_unavailable');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_job_publication_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.evaluate_job_policy_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.job_policy_normalize_v1(text) FROM PUBLIC;
-- Dedicated trusted owner required before approval. No runtime DDL role grants.
-- A separately approved RPC may expose decision/reason only, never source text.
CREATE TRIGGER job_publication_policy_v1
BEFORE INSERT OR UPDATE ON public.local_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_job_publication_v1();
-- No UPDATE/backfill of existing rows. No location approval SQL.
ROLLBACK;
