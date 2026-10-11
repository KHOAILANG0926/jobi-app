# PR48 판정 범위 조정 — 2026-10-12
[직접 확인] master `9157ced522d024b2c378958f623beffbdfeb1aba`; 시작 PR48 head `8b3441fcd7e25a728135aa018abac2e22000e568`, 같은 codex/job-posting-policy. AGENTS/CLAUDE/HANDOFF 조회; Draft 유지·병합/배포/DB/수집 실행 없음.
[직접 확인] 정책 version2026-10-12-v2. retail_primary에 điện máy/showroom/nội thất 추가, professional_sales는 sale executive와 sales executive 모두 인식.
[직접 확인] market 판매는 시장영업 문구 + 소비재/유통사 증거 또는 소매점 납품 대상이 있을 때 allow. 브랜드명/급여만으로 allow하지 않는다. 제목B2B + 본문 사업체 고객 + 방문/탐색 + 계약 증거는 retail/market 허용보다 먼저 exclude. 금융·대출·채권추심 판정은 계속 최우선이다.
[직접 확인] 원문 fixture는 **미완료**다. 아래 사용자 지정 ID만 알고 title/description/salary 운영 원문을 조회/제공받지 못했다. 운영 읽기 연결 미확보; 사용자에게 승인된 자료 위치 또는 연락처/키 제거 필드를 요청했다. 합성 사례를 실 공고 원문으로 꾸미지 않았다.
[기존 기록] 사용자 허용 기준: 매장4685,4690,4725,4729,4739,4757 및 시장4689,4691,4692,4701,4708,4715,4730,4731,4740. #4750은 차단.
[직접 확인] `policy/operational-fixture-requirements.json`은 원문 대기 manifest일 뿐 fixture가 아니다. 운영15 allow/1 exclude 기준은 원문16건 확보 후 고정해야 하며 지금 통과/완료로 보고하지 않는다.
[기존 기록] 운영101건 재판정은 사용자가 Claude의 별도 확인 대상으로 지정했다. 본 작업에서 운영101건을 조회하거나 판정한 결과는 없다.

## 기존39개 변화와 추가 합성 사례
[직접 확인] 원본39개 input/expected를 그대로 보존했다. functions V8 세션에서 이전·변경 JS 모듈의 import/export를 제거해 순수함수로 실행하고 동일39 inputs의 decision 비교 → 변화0. 실제 네트워크/DB 실행 아님. 정책 version은 v1→v2로 변경되므로 반환 version 문자열은 달라진다.
[직접 확인] 추가14개는 모두 `synthetic-v2-*`이며 실제 운영ID로 라벨링하지 않았다. 가전/가구/showroom/4브랜드 시장/소매납품 allow8, B2B계약·금융 exclude4, professional단수·정보부족시장 review2.
[직접 확인] 전체53개 기대결과 allow23/review12/exclude18. 원래39개의 expected decision 변경0. Python/JS reason/version parity와53×7 앱쓰기·내용변경·재공개·재유입·게스트 회귀 검사를 기존 체계에서 실행한다.
[추정] 특정 운영ID의 실제 원문이 어떤 단어/오탈자/서술을 쓰는지 모른다. 15건 실제 허용 및 #4750 실제 차단의 증거가 아니므로 원문을 추가하면 rule 재조정이 필요할 수 있다.

## 테스트
[직접 확인] Python [run38185718447](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38185718447), job114607482950 `Ran 6 tests in 0.163s / OK`, 기존 품질21/21·문법 성공. 원문16건 검증 미실행.
[추정] tsc/npm/build 결과는 최종 성공 로그 확인 후 추가한다.
[직접 확인] 수집 workflow의 if:false와 daily 무인자 중지 유지. STATUS 보호·location guard·한국 모듈·PR46 보고서·WORK_LOG 변경 없음. DB 공통 trigger/관리자예외 강제는 미구현 상태다.
[직접 확인] 수정 파일: policy/job-posting-rules.json, policy/job-posting-fixtures.json, policy/operational-fixture-requirements.json, src/lib/jobPostingPolicy.mjs, src/lib/jobPostingPolicy.test.ts, crawler/job_posting_policy.py, 이 문서와 HANDOFF.

## 실제 코드 원문

### [직접 확인] policy/job-posting-rules.json:65
```
  ],
  "retail_primary": [
    "\\b(cua hang|sieu thi|minimart|thu ngan|cashier|store assistant|shop assistant|retail assistant)\\b",
    "\\bretail store\\b",
    "\\b(dien may|showroom|noi that)\\b"
  ],
  "b2b_primary": [
    "\\b(quan ly|cham soc|phat trien) (he thong )?(dai ly|nha phan phoi)\\b",
    "\\b(tim kiem|gap go|tham|di tham|phat trien) (khach hang doanh nghiep|khach hang b2b|dai ly|nha phan phoi)\\b",
```

### [직접 확인] policy/job-posting-rules.json:80
```
  ],
  "professional_sales": [
    "\\b(chuyen vien|sales? executive|sales specialist|key account|bat dong san|professional sales)\\b"
  ],
  "incentive": [
    "\\b(hoa hong|commission|incentive)\\b"
  ],
  "high_income": [
    "\\b([2-9][0-9]|[1-9][0-9]{2,}) (trieu|million)\\b",
```

### [직접 확인] src/lib/jobPostingPolicy.mjs:38
```
  const text = fields.title + ' ' + fields.description
  // Explicit enterprise-contract B2B evidence wins over retail words/brands.
  if (matches('b2b_title', fields.title) && matches('business_customer', fields.description)
      && matches('customer_outreach', fields.description) && matches('business_contract', fields.description))
    return result('exclude', 'b2b_business_contract_sales')
  const sales = matches('sales_role', fields.title)
  // Consumer-distributor outlet supply is allowed; brand alone is insufficient.
  if (sales && !matches('b2b_title', fields.title) && matches('market_sales', text)
      && (matches('consumer_distribution', fields.company + ' ' + text) || matches('retail_supply', fields.description)))
```

### [직접 확인] src/lib/jobPostingPolicy.mjs:43
```
  const sales = matches('sales_role', fields.title)
  // Consumer-distributor outlet supply is allowed; brand alone is insufficient.
  if (sales && !matches('b2b_title', fields.title) && matches('market_sales', text)
      && (matches('consumer_distribution', fields.company + ' ' + text) || matches('retail_supply', fields.description)))
    return result('allow', 'consumer_retail_distribution_sales')
  const retail = matches('retail_primary', fields.title + ' ' + fields.description)
  const b2b = matches('b2b_primary', fields.title + ' ' + fields.description)
  if (sales && b2b) return retail
    ? result('review', 'mixed_retail_b2b')
```

### [직접 확인] crawler/job_posting_policy.py:50
```
    text = fields["title"] + " " + fields["description"]
    # Explicit enterprise-contract B2B wins over retail words/brands.
    if (_matches("b2b_title", fields["title"]) and _matches("business_customer", fields["description"])
            and _matches("customer_outreach", fields["description"]) and _matches("business_contract", fields["description"])):
        return result("exclude", "b2b_business_contract_sales")
    sales = _matches("sales_role", fields["title"])
    if (sales and not _matches("b2b_title", fields["title"]) and _matches("market_sales", text)
            and (_matches("consumer_distribution", fields["company"] + " " + text)
                 or _matches("retail_supply", fields["description"]))):
```

