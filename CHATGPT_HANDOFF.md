# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**연락처 확보 가능한 수집 출처 조사 — Chợ Tốt 수집 전용 계정 테스트 직전에서 중단(2026-09-30 회사 PC → 집 PC로 이동).**

배경: 원본 사이트 연결 금지(CLAUDE.md) 이후 크롤링 공고는 사이트 안 연락처(전화·Zalo)가 있어야 쓸 수 있다.
크롤링 282건 중 연락처 있는 공고는 4682 1건뿐(대형 채용사이트는 연락처를 공개하지 않는 구조).

### 사이트별 조사 결과 (읽기 전용, 공고 3~5건씩)

| 사이트 | 결과 | 분류 |
|---|---|---|
| muaban.net | 로그인 후 Hiện số 5/5 전체 번호(공고마다 POST /listing/v1/phone/show). 본문 번호 1/5. 개인 게시 위주·호찌민/하노이 중심·규모 작음 | B(확인) |
| Chợ Tốt (vieclamtot.com) | 로그인 후 박닌 5/5 전체 번호(GET gateway.chotot.com/v1/private/ad-listing/phone?e=암호화). **번호 조회 시 ats/candidate/channel/phone 요청 → 조회 계정이 지원자로 기록될 수 있음.** 박닌 686건, 전국 68,742건. 인력업체(같은 번호로 여러 회사) 존재 | B(확인) |
| Facebook 그룹 | 본문에 전화·Zalo 직접 기재. 기존 크롤러(예약 실행 중지 상태) | C |
| vieclam24h / TopCV / CareerViet / VietnamWorks | 비로그인 연락처·가림 번호·번호보기 버튼 없음, 온라인 지원만("Ứng tuyển") | D(로그인 미검증) |

- 요청 재현은 암호화돼 있어 하지 않는다(보호장치 우회 금지). 가능한 자동화는 로그인 세션 + 브라우저 클릭뿐.
- 로그인해야 보이는 번호를 우리 사이트에 재게시하는 방식은 **새 방향 — 사용자 최종 결정 전**.

## 변경 내용

- `scripts/research/contact_sources/chotot_login.py`: 전용 프로필(`chotot-collector-profile/`, 스크립트 옆 생성)로 로그인 창을 띄움. 사람이 직접 로그인 후 창을 닫음.
- `scripts/research/contact_sources/chotot_collector_test.py`: 박닌 최대 10건, 공고당 Hiện số 1회, 6초 간격, 경고·재인증·로그아웃 신호 시 즉시 중단. `direct/agency/unknown` 분류(agency는 근거 2개 이상일 때만) + 전화번호 중복 관계. 결과 TSV는 로컬 전용.
- `.gitignore`: 위 폴더의 `*-profile/`, `*.tsv` 제외(로그인 세션·번호 포함 → 공개 저장소에 올리면 안 됨).
- 코드·크롤러·DB 변경 없음.

## 테스트 결과

- muaban·Chợ Tốt 결과 TSV는 회사 PC 임시 폴더에만 있음(번호 포함, 커밋 안 함). 위 표가 요약.
- 수집 전용 계정 테스트(`chotot_collector_test.py`)는 **아직 미실행**.

## 발견된 문제

1. Chợ Tốt 번호 조회가 조회 계정을 지원자로 기록 → 개인 계정 사용 금지, 수집 전용 계정 필요(사용자 합의).
2. Facebook 크롤러가 공개 게이트를 우회(`crawler/crawl_facebook.py:1070` active=True 고정) — 별도 추적, 미수정.
3. 게이트의 지원 경로 기준(원문 URL 인정)이 09-29/30 결정과 충돌 — 미수정. 자세한 내용 `docs/ops/2026-09-30_publish_criteria_restore.md`.

## 다음 결정사항 / 집 PC에서 이어서 할 일

1. `git pull` 후 `pip install playwright && python -m playwright install chromium`(없으면).
2. `cd scripts/research/contact_sources && python chotot_login.py` → 뜨는 창에서 "Hiện số" → "Đăng nhập" 팝업으로 **수집 전용 계정** 로그인 → 창 닫기.
   (회사 PC 프로필은 옮겨지지 않음. 집 PC에서 새로 로그인해야 함.)
3. `python chotot_collector_test.py` → `chotot_collector_test_result.tsv` 확인 → 사용자 보고(번호는 채팅에서 일부 가림).
5. **메인 개편 논의(2026-10-01, 미확정 — 새 세션에서 이어감):**
   - 방향: "내 주변 일자리" 중심 재구성. 가입자가 없는 지금이 구조 변경 최적기(사용자 판단). 공고 확보는 크롤링·수작업·인력 채용으로 해결 가능하다고 사용자 판단 → "공고 없으니 이르다"는 반대 철회.
   - **PC 기준 먼저, 모바일은 다듬기.** PC 사용자는 주로 공고 작성자(고용주) → 제안 순서: ① PC 공고 등록 양식 ② PC 메인 ③ 모바일 구직 화면.
   - **가장 큰 허점:** 공고 등록 양식(`src/pages/PostJob.tsx:388`)의 근무지가 자유 텍스트 한 칸 — 좌표·지도 핀 없음. 크롤링 근무지 493건 중 확인 7, 동네(ward) 추정좌표 209, 좌표 없음 277.
   - **위치 수준 제안(미결정):** L1 정확(확인 또는 게시자 핀: 핀+거리+길찾기) / L2 동네(영역+"약 X km", 길찾기 없음) / L3 지역(반경 검색 제외, 지역 필터만) / L0 없음(비공개). 결정 필요: L2 거리 표시 허용 여부(현재 규칙은 확인된 근무지만), 게시자 핀을 L1로 볼지.
   - 등록 양식에 받을 항목 제안: 지도 핀(OSM 기반, Google 좌표 저장 금지)+동네 선택, 통근버스·숙식·주야간·직접채용 체크. 인력업체 공고는 근무지=실제 공장.
   - 와이어프레임(채팅에만, 파일 없음): 모바일=위치 바→반경 2/5/10km→필터→미니 지도→거리순 목록→공단별(KCN Quế Võ·VSIP·Yên Phong)→하단 탭(Chat 없음). PC=상단 바(위치·검색·반경·공고등록)→공단 줄→필터|목록|지도, 인력업체는 "Qua công ty cung ứng" 배지.
   - **한국 일자리:** 사용자에게 "나중에 메인 간판". 홈의 한국 자리는 의도된 입구(CTA·배너·메뉴 → `/viec-han-quoc`, 공고 없음) — 그대로 유지. 분리도 가능한 구조 확인(한국 테이블은 core와 FK 없음; 분리 시 홈 링크 3곳·관리자 카운트·저장목록 kr- 접두어·JobLocationMap 복사만 손보면 됨). 미결정: 주력이 한국인지 내 주변인지(브랜드명 Viecganban="내 근처 일자리"와의 관계).
4. 그 뒤 결정: 로그인 번호 재게시 방향 확정 여부 / 인력업체 공고 표시 방식 / 자동화 시 세션을 VPS에 두는 구조.

### 커밋·미커밋 상태
- 이 인계 커밋이 master 최신. 미커밋: `.claude/settings.local.json`, `tsconfig.tsbuildinfo`(PC-local).

### 하지 말 것
- Production DB 저장·크롤러 연결·연락처 공개 정책 변경·자동 게시 금지(사용자 결정 전).
- 전화·문자·Zalo·메시지 발송 금지. 개인 계정 세션 재사용 금지. 자동 가입·OTP 입력·CAPTCHA 우회·프록시·다계정 로테이션·지문 위조 금지.
- 계정 경고·제한·추가 인증·강제 로그아웃 시 즉시 중단.
- 로그인 프로필·번호 TSV 커밋 금지(공개 저장소).
- 새 크롤링, Facebook 예약 실행 재개, 숨김 공고 재공개, DB 행 삭제 금지(기존 지시 유지).
- GPT를 거친 지시가 기존 틀과 다르면 수락 전에 사용자에게 확인.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-30 — 공고 공개 기준 복원 표 + 인계 문서 정리** — MASTER PUSHED(`a88ac27`, `7ec8d5b`). 기존 공개 게이트(09-05, job_quality.gate_auto_publish) 복원, Facebook 게이트 우회(crawl_facebook.py:1070 active=True 고정)·지원 경로 기준 충돌 발견. 문서만, 코드·DB 변경 없음.
2. **2026-09-30 — 지원 버튼을 실제 지원 방식별로 연결(내부 지원 / 직접 연락 / 연락처 없음)** — MASTER PUSHED(이 커밋). 공용 판정 resolveApplyAction()+JobApplyButton: employer_id 있음=로그인→내부 지원, 없음+전화/Zalo=로그인 없이 내부 상세 연락 안내(/viec-lam/sb-ID#lien-he), 연락처 없음=지원 표시 안 함('Chưa có thông tin liên hệ', 상세 버튼 비활성). 적용: 상세·급구 페이지·추천 표/카드. 이전: 급구 페이지는 직접 연락형도 비로그인이면 /dang-nhap으로 보냈음. 검증: 빌드 미리보기+응답 가로채기 가짜 3유형(운영 DB 쓰기 없음), 데스크톱·모바일 첫 클릭 목적지 정상, 외부 링크·새 창 0, 단위 테스트 3/3. **4682 상태(미확인 유지)**: 전화·Zalo 번호가 원문(페이스북 게시물)의 번호와 일치하는 것만 확인. 게시자가 실제 채용 담당자인지, 회사명·실제 근무지·담당자와 회사 관계는 모두 미확인(원문에 회사명 없음, 웹 검색으로 특정 불가). 연락·숨김·DB 변경 없음.
3. **2026-09-30 — 급구 표 첫 클릭 무시 버그 수정 + 4682 근무지 확인 시도** — MASTER PUSHED(`63ff498`) + PRODUCTION DEPLOYED. 급구 페이지 지역 패널(기본 열림)을 mousedown에 닫아 표가 밀리며 제목·지원 버튼 첫 클릭이 사라지던 문제 → click 시점에 닫도록 수정. 검증: 빌드 미리보기(vite preview) + Supabase 응답 가로채기로 가짜 급구 1건(운영 DB 쓰기 없음), 데스크톱 1280·모바일 375 모두 제목 클릭→내부 상세, 'Ứng tuyển'→내부 /dang-nhap(비로그인), 외부 링크·새 창 0. 4682: 원문에 회사명 없음, Zalo 번호·공고 문구 웹 검색으로도 회사·사업장 특정 불가 → '위치 미확인' 유지, DB 변경 없음. 참고: 이 PC 여유 메모리 부족(약 1.6GB)으로 vite dev 서버·빌드가 간헐적으로 OOM.
4. **2026-09-30 — 미확인 위치 지도 미표시 + 원본 사이트 안내 문구 제거 + 설계 문서 정정** — MASTER PUSHED(`b1b09d4`) + PRODUCTION VERIFIED. 공고 상세 지도는 확인된 근무지만(지역·공단 중심 대체 표시·지역 지도 링크 제거, '위치 미확인' 안내), 한국 취업 연락 문구가 원본 페이지를 가리키면 중립 문구로 표시, VIECGANBAN_STRUCTURE_BASELINE.md의 '원문 URL 이동/외부 링크 CTA'를 폐기 동작으로 정정. 원인 조사: 규칙은 df8524c 이전 CLAUDE.md·AGENTS.md·BASELINE 어디에도 없었고, BASELINE은 반대로 외부 링크를 의도된 설계로 기록 → 세션들이 '기존 설계 우선' 원칙대로 링크를 유지. DNS는 2026-09-30 02:09 UTC 기준 복구 확인. source_url DB 권한 변경은 제외(사용자 지시).
5. **2026-09-30 — 원본 채용사이트 연결 전면 제거 + CLAUDE.md 규칙** — MASTER PUSHED(`df8524c`) + PRODUCTION DEPLOYED(01:39 UTC). 급구 표·급구 페이지 '↗ Xem tin gốc', 한국 취업 상세 'Xem tin gốc & Liên hệ' 제거, 공개 조회에서 source_url 미수신(JobsContext·fetchJobsData·jobRows·koreaJobsApi), 타입에서 sourceUrl 제거. CLAUDE.md '원본 채용사이트 연결 금지' 섹션 추가. **남은 것(STRICT, 승인 필요)**: DB 권한상 익명 API로 local_jobs.source_url·korea_jobs_public.source_url 직접 조회는 아직 가능. 공개 화면 확인은 viecganban.vn DNS 장애(Mắt Bão)로 미확인.
