# PR48 확정 정책 v3 — 일반 영업·교대 판매 허용 (2026-10-12)
[직접 확인] master `9157ced522d024b2c378958f623beffbdfeb1aba`; 시작 PR48 head `fb4d3f13f244d6db20a11b859c21cea626eb0405`, 같은 codex/job-posting-policy. AGENTS/CLAUDE/HANDOFF 원문 조회. Draft·미병합 유지.
[기존 기록] 사용자 전달 Claude 운영 조회: SHA fb4d3f1 공개101건 allow97/review4/exclude0, #4750 원문 exclude. 본 세션은 이를 운영 DB 재조회하지 않았다.
[직접 확인] 사용자 확정 결정에 따라 JSON version2026-10-12-v3와 JS/Python 판정기를 동시에 수정했다. 제외/검토 증거 없는 일반 영업은 allow. 기존 금융/대출/채권추심·명시적 B2B 계약·전문 고수입 인센티브·본문 부족·혼합 primary 업무 검사는 유지한다.
[직접 확인] 브랜드+소매 납품 대상 증거는 market 제목 없이도 allow; 브랜드 단독은 b2b_signal 검토를 풀지 않는다. 기존 market 경로도 유지한다. b2b_signal만 있으면 review, retail/shift(ca1/ca2, xoay ca 등) 증거가 있으면 그 검토를 면제한다. 전문 인센티브 증거가 있으면 shift만으로 허용하지 않는다.

## 기존53개의 결과 변화 — 3개
[직접 확인] functions V8에서 v2/v3 순수 JS 평가기를 같은53 input으로 실행(네트워크/DB 없음)하고 decision 비교했다. 변경3개만 expected를 조정했으며 나머지50개는 동일:
- unclear-sales: review(unclear_sales_role)→allow(ordinary_sales_without_exclusion_evidence). 제외 증거 없는 일반 영업.
- sales-loan-benefit: review→allow. 직원 대출 복지 언급이 전담 대출영업 증거가 아니고, 일반 영업 모호성은 이번 확정 정책에 따라 허용.
- synthetic-v2-market-no-evidence: review→allow. 소비재 납품 특정 경로 증거가 없어도 금융/B2B계약/전문 인센티브 증거 없는 일반 시장영업은 허용.
[직접 확인] 반환 version은 v2→v3이므로 모든 사례의 version 문자열은 변경된다. decision 변화와 version 변화는 구분한다.

## 사용자 설명 기반 합성4개
[직접 확인] synthetic-4689-kinhdo-outlets: Kinh Đô, 오토바이·30~35 tạp hóa/điểm bán 방문·진열·납품 및 đại lý 단어, market 제목 없음 →allow. consumer_retail_distribution_sales reason을 별도 assertion.
[직접 확인] synthetic-4725-aqua-shifts: AQUA 판매상담·교대, 매장 단어 없음 →allow.
[직접 확인] synthetic-4729-samsung-dealer-shifts: Samsung 판매·đại lý·ca1/ca2/xoay ca →allow.
[직접 확인] synthetic-4740-unilever-display: Unilever 일반판매·판촉/진열, 매장 단어 없음 →allow.
[기존 기록] 이는 사용자 설명을 바탕으로 만든 합성 입력이지 실제 운영 원문이 아니다. #4750 원문 직접 검증이나 운영101건 검증으로 보고하지 않는다. 기존 원문16건 manifest는 미확보 기록으로 유지한다.
[직접 확인] 전체57 shared fixture 기대결과 allow30/review9/exclude18, 57×7 mock 공개쓰기 경로·재유입/재공개·금융 오차단 검사에 사용한다. 추가 standalone dealer word review 및 shift+전문 인센티브 review 경계 검사를 JS/Python에 넣었다.

## 검사 기록
[직접 확인] 초기 Python run38186570390은 추가 경계 테스트에서 “Chăm sóc đại lý”를 단순 단어 증거로 취급해 예상 review와 실제 primary-dealer exclude가 달라 실패했다. 단어만 나오는 “Thông tin sản phẩm do đại lý giới thiệu”로 테스트 입력을 교정했고 정책의 primary dealer 제외 규칙은 변경하지 않았다.
[추정] 최종 tsc/npm/build/Python/CI는 실제 로그 조회 후 기록한다. 로컬 명령은 helper setup 오류로 실행 불가여서 원격 Actions의 오프라인 검사만 사용한다.

## 남은 범위·금지 유지
[직접 확인] 운영101 재판정은 요청대로 Claude 확인 대상이며 본 세션에서는 조회하지 않는다. DB 공통 강제·관리자 예외·review 보존은 pending 설계 상태, raw RPC/SQL/service-role/race 우회는 남는다.
[직접 확인] 수집 workflow의 if:false/daily 무인자 중지 유지. 병합·배포·DB 변경·수집 실행/재개 없음. WORK_LOG 보류, 보호 STATUS/location guard/한국 모듈/PR46 보고서 수정 없음.
[직접 확인] 수정 파일: policy/job-posting-rules.json, policy/job-posting-fixtures.json, src/lib/jobPostingPolicy.mjs, src/lib/jobPostingPolicy.test.ts, crawler/job_posting_policy.py, crawler/test_job_posting_policy.py, 이 문서와 HANDOFF.

## 코드 원문 근거

### [직접 확인] src/lib/jobPostingPolicy.mjs:43
```
  const sales = matches('sales_role', fields.title)
  // Consumer-distributor outlet supply is allowed; brand alone is insufficient.
  if (sales && !matches('b2b_title', fields.title)
      && ((matches('consumer_distribution', fields.company + ' ' + text) && matches('retail_supply', fields.description))
          || (matches('market_sales', text)
              && (matches('consumer_distribution', fields.company + ' ' + text) || matches('retail_supply', fields.description)))))
    return result('allow', 'consumer_retail_distribution_sales')
  const retail = matches('retail_primary', fields.title + ' ' + fields.description)
```

### [직접 확인] src/lib/jobPostingPolicy.mjs:54
```
    : result('exclude', 'primary_b2b_field_dealer_sales')
  if (sales && matches('b2b_signal', fields.title + ' ' + fields.description)
      && !retail && !matches('shift_work', text))
    return result('review', 'unclear_b2b_role')
  // Income never excludes a job. Store/mart/factory/QC salaries do not trigger this.
  if (sales && !retail && matches('professional_sales', fields.title)
      && matches('incentive', fields.description + ' ' + fields.salary)
      && matches('high_income', fields.description + ' ' + fields.salary))
```

### [직접 확인] src/lib/jobPostingPolicy.mjs:62
```
    return result('review', 'professional_incentive_sales')
  if (sales && !retail) return result('allow', 'ordinary_sales_without_exclusion_evidence')
  return result('allow', 'no_excluded_role_evidence')
}
export function hasExcludedMoneyRole(job) {
  return ['dedicated_finance_sales', 'dedicated_debt_collection']
    .includes(evaluateJobPostingPolicy(job).reason)
}
```

### [직접 확인] crawler/job_posting_policy.py:65
```
        return result("review", "mixed_retail_b2b") if retail else result("exclude", "primary_b2b_field_dealer_sales")
    if sales and _matches("b2b_signal", text) and not retail and not _matches("shift_work", text):
        return result("review", "unclear_b2b_role")
    pay = fields["description"] + " " + fields["salary"]
    if sales and not retail and _matches("professional_sales", fields["title"]) and _matches("incentive", pay) and _matches("high_income", pay):
        return result("review", "professional_incentive_sales")
    if sales and not retail:
        return result("allow", "ordinary_sales_without_exclusion_evidence")
```

### [직접 확인] policy/job-posting-rules.json:120
```
  ],
  "shift_work": [
    "\\bca (1|2)\\b",
    "\\bxoay ca\\b",
    "\\b(lam|lam viec|ban hang|tu van) (theo )?ca\\b",
    "\\bshift work\\b"
  ]
}
```

