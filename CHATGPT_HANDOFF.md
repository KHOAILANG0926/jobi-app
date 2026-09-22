# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**GEO/AI 검색 대응 SSR — 2026-09-22 다섯 번째 라운드까지 진행.**
사용자가 "대표 페이지 관리 구조와 noindex/canonical 정책은 승인"했고,
이번 라운드는 그 위에 **대표 페이지별 title/description/H1 개별화 +
URL 정규화**를 추가했다. **"전체 완료" 처리는 계속 보류.**

- **공고 상세(`/viec-lam/:id`) + 급구 목록(`/viec-lam/tuyen-gap`) SSR:
  IMPLEMENTED + VERIFIED.**
- **일반 검색(`/viec-lam/tim-kiem`) 노출 + 대표 페이지 관리 구조
  (canonical/robots/sitemap 정책): 사용자 승인 완료.**
- **대표 페이지별 title/description/H1 개별화 + canonical URL 정규화
  (이번 라운드): IMPLEMENTED + VERIFIED(로컬).**
- 급구 목록에 같은 구조 적용, commit, master push, Production 배포 —
  **전부 계속 보류**(사용자 지시).

## 변경 내용 (이번 라운드)

### 1. 대표 페이지별 title/description/H1 개별화
- [src/lib/representativeSearchPages.ts](src/lib/representativeSearchPages.ts)에
  `buildRepresentativePageCopy(normalizedQuery, jobCount)` 추가 — 업직종
  대표는 `Việc làm {업직종명} mới nhất | Việt Gần Bạn` / 지역 대표는
  `Việc làm tại {지역명} mới nhất | Việt Gần Bạn` 형식으로 title·
  description·H1을 만든다. **실제 필터명(CATEGORY_LABELS/지역 라벨)과
  실제 활성 공고 수만 쓰고, 급여·근무조건처럼 데이터에 없는 내용은
  넣지 않음**(사용자 지시 그대로 반영, 코드 주석에도 명시).
- [api/ssr.js](api/ssr.js): 대표 페이지 요청이면 이 함수로 `<title>`/
  `<meta description>`을 교체(공고 상세 페이지와 같은 방식).
- [src/pages/JobSearchPage.tsx](src/pages/JobSearchPage.tsx): 화면 H1도
  **같은 함수**로 계산 — SSR(api/ssr.js)과 클라이언트(컴포넌트)가 서로
  다른 문구를 만들 여지가 구조적으로 없다(함수 하나 공유). 대표 후보가
  아니면(기본 페이지/비대표 조합) 기존 공통 문구("Tìm việc làm") 그대로.

### 2. 대표 후보 정리 — `khac` 제외
`khac`("기타")는 검색 의도가 불명확하다는 지시로 후보 목록에서 제거.
나머지 업직종 10개 + 지역 10개(총 20개)는 여전히 **초기 후보**로 유지
(최종 확정 아님). 공고 수가 줄어도 대표 자격 자체는 유지되고, sitemap
포함 여부만 기존 정책대로 별도 판단(코드 로직 변경 없음 — 애초에 이미
그렇게 설계돼 있었음, 이번엔 `khac`만 목록에서 뺐다).

### 3. URL 정규화 — 대표 canonical에서 sort/page/UTM 제거
[src/lib/representativeSearchPages.ts](src/lib/representativeSearchPages.ts)의
`normalizeSearchQuery()` 재작성 — `sort`/`page`/`pageSize`/`utm_*`는
결과 "내용"을 안 바꾸는 파라미터라 대표 여부 판정·canonical 생성 둘 다
에서 무시한다. `q`/`sub`/`brand`/`urgent`/`today`(실제 결과 집합을
바꾸는 파라미터)가 하나라도 있으면 여전히 비대표로 취급. 파라미터
순서·존재 여부와 무관하게 항상 같은 정규화 결과가 나오므로(직접
문자열을 새로 조립, 원본 순서를 안 씀) 쿼리 순서가 달라도 동일 대표
URL로 수렴함을 실측 확인.

## 테스트 결과 (실측, 4개 케이스 전부)

| 케이스 | 예시 URL | title | description | H1 | canonical | robots |
|---|---|---|---|---|---|---|
| 대표 업직종 | `?cat=am_thuc_do_uong` | `Việc làm Ẩm thực · Đồ uống mới nhất \| Việt Gần Bạn` | `Xem 45 việc làm Ẩm thực · Đồ uống đang tuyển...` | `Việc làm Ẩm thực · Đồ uống mới nhất` | 자기 자신 | 없음(색인가능) |
| 대표 지역 | `?region=hcm` | `Việc làm tại TP. Hồ Chí Minh mới nhất \| Việt Gần Bạn` | `Xem 145 việc làm tại TP. Hồ Chí Minh...` | `Việc làm tại TP. Hồ Chí Minh mới nhất` | 자기 자신 | 없음(색인가능) |
| 비대표(결과27건) | `?cat=van_phong&q=nhan` | 공통 제목 | 공통 문구 | `Tìm việc làm`(공통) | 자기 자신(쿼리 그대로) | `noindex, follow` |
| 빈 결과 | `?q=zzzz...` | 공통 제목 | 공통 문구 | `Tìm việc làm`(공통) | 자기 자신 | `noindex, follow` |

- curl(SSR raw HTML)과 브라우저 `document.title`/`meta[name=description]`/
  `.page-header__title`/`link[rel=canonical]`/`meta[name=robots]`를
  직접 대조 — **완전히 일치**(hydration 전후 드리프트 없음).
- URL 정규화 검증: `?sort=salary&cat=van_phong` / `?cat=van_phong&sort=salary`
  / `?utm_source=...&page=3&cat=van_phong&pageSize=50` 세 가지 전부
  canonical이 동일하게 `.../tim-kiem?cat=van_phong`로 수렴, 세 번째
  케이스(utm+page+pageSize 포함)도 noindex 안 붙고 정상적으로 대표
  페이지 title이 뜸을 확인.
- `npx tsc --noEmit` / `npm run build` / `npm test`(6/6, workScheduleParse
  17/17): 전부 클린.
- sitemap.xml: `khac` 완전히 빠짐(0건), 대표 combo 정확히 20개로 감소
  확인. 공고 상세/급구 목록 라우트 회귀 없음(200/canonical 그대로).
- 브라우저 콘솔: 대표 카테고리/지역 페이지 둘 다 에러 0건(기존에도
  있던 무관한 ServiceWorker 경고 제외).

## 발견된 문제

없음.

## 다음 결정사항 (사용자 확인 필요)

1. 남은 20개 대표 후보 최종 확정 여부(여전히 "초기 후보").
2. 급구 목록에도 같은 대표 페이지 구조(고정 후보 목록 + 개별화 문구)를
   적용할지 — 계속 보류 중, 급구 공고가 늘어난 뒤 판단 권장.
3. Vercel Preview 실제 런타임 검증 — 여전히 SSO 보호로 막혀 있음(이전
   라운드부터 동일, 이번엔 건드리지 말라는 지시로 시도 안 함).
4. commit / master push / Production 배포 — 계속 보류 중, 지시만 있으면
   진행 가능.
