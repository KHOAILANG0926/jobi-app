# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**ChatGPT 추적용 기록 규칙 추가 (2026-10-01, 집 PC)** — 문서만 변경, 코드·DB 변경 없음.
- 상태: branch `master`, Production 코드 변경 없음(마지막 코드 배포는 09-30 지원 버튼 작업).
- **기존 방향에서 바뀐 것:** 논의는 ChatGPT(또는 claude.ai 채팅)에서, 구현은 Claude Code에서. 이를 위해 `WORK_LOG.md`(최근 10개) 신설, CLAUDE.md에 "ChatGPT 추적용 기록" 섹션 추가. HANDOFF 스냅샷·FAST/NORMAL 배포·짧은 보고 규칙은 그대로.

- **추가 2(회사 PC):** 한국 영역 장기 분리 점검 — MUST FIX NOW 없음, CLAUDE.md 한국 분리 규칙에 "장기 분리 보강" 추가. 상세 WORK_LOG.md 최상단.
- **추가(회사 PC, 같은 날):** 한국 일자리 분리 가능성 조사(읽기 전용) 후 CLAUDE.md에 "한국 일자리 모듈 분리 규칙" 섹션 추가. 요약·남은 문제는 WORK_LOG.md 최상단.

## 변경 내용

- `CLAUDE.md`: "ChatGPT 추적용 기록" 섹션 추가(HANDOFF=스냅샷, WORK_LOG=최근 10개, 명시적 "배포하지 마" 등은 배포 규칙보다 우선, 새 세션 읽기 순서).
- `WORK_LOG.md`: 신규.
- 코드·크롤러·DB·환경변수 변경 없음.

## 테스트 결과

- 문서만 변경 — typecheck/build 해당 없음.

## 발견된 문제

1. Chợ Tốt 번호 조회가 조회 계정을 지원자로 기록 → 수집 전용 계정 필요(사용자 합의). 테스트(`scripts/research/contact_sources/chotot_collector_test.py`) 미실행. 이 PC에는 로그인 프로필 없음(playwright는 설치됨).
2. Facebook 크롤러가 공개 게이트를 우회(`crawler/crawl_facebook.py:1070` active=True 고정) — 미수정.
3. 게이트의 지원 경로 기준(원문 URL 인정)이 09-29/30 결정과 충돌 — 미수정. `docs/ops/2026-09-30_publish_criteria_restore.md`.

## 다음 결정사항

### A. 메인 개편 — 지도 구성 (논의 중, 미확정, 구현 전)
- 방향: "내 주변 일자리" 중심. PC 먼저(PC 사용자=주로 고용주), 모바일은 다듬기. 제안 순서: ① PC 공고 등록 양식 ② PC 메인 ③ 모바일.
- **한국 배너(`src/pages/Home.tsx` home-brand-hero)는 그대로 유지, 그 바로 아래에 지도 구역.**
- 사용자 선호: **구글지도 형식**. 합의된 해석: 화면 구성만 구글식(왼쪽=검색·반경/필터 칩·거리순 공고 카드, 오른쪽=큰 지도, 지도 이동 시 "이 지역 재검색", 핀 클릭→카드 강조). 지도 자체는 현행 Leaflet + Geoapify 유지(Google API는 비용·Google 좌표 저장 금지 때문에 제외 — 사용자 최종 확인 전). Geoapify 스타일(osm-bright 등)로 외형 근접 가능. 기존 `/ban-do`(MapView) 재사용.
- 미결정: ① 위치 모를 때 기본 위치(추천: Bắc Ninh 중심) ② 지도 구역 높이(약 600px 바로 노출 / 축소판→`/ban-do`) ③ 광고·계정 카드(home-discovery)를 지도 아래로 내릴지 ④ 동네 수준(L2) 표시: 흐린 원 + "khoảng 3–5 km" 범위 표기(추천) ⑤ 게시자 핀을 L1로 인정하되 "do nhà tuyển dụng ghim" 구분 표시 + 선택 동네 밖이면 재확인(추천) ⑥ 주력: 내 주변(추천) vs 한국.
- 데이터 현황: 크롤링 근무지 493건 중 확인 7, 동네 추정좌표 209, 없음 277 → 핀만 쓰면 지도가 거의 빔.
- 큰 허점: 공고 등록 양식(`src/pages/PostJob.tsx:388`) 근무지가 자유 텍스트 → 지도 핀(OSM)+동네 선택, 통근버스·숙식·주야간·직접채용 체크 추가 제안. 인력업체 공고는 근무지=실제 공장, "Qua công ty cung ứng" 배지.
- 한국 일자리: 홈 입구(CTA·배너·메뉴→`/viec-han-quoc`) 유지. 분리 가능 구조(core와 FK 없음).

### B. Chợ Tốt 수집 전용 계정 테스트 (보류)
1. `cd scripts/research/contact_sources && python chotot_login.py` → 사람이 수집 전용 계정으로 로그인 → 창 닫기.
2. `python chotot_collector_test.py` → 결과 TSV 확인 → 보고(번호 일부 가림).
3. 이후 결정: 로그인 번호 재게시 여부 / 인력업체 공고 표시 / 세션을 VPS에 두는 구조.

### 커밋·미커밋 상태
- 이 커밋이 master 최신. 미커밋: `.claude/settings.local.json`, `tsconfig.tsbuildinfo`(PC-local).

### 하지 말 것
- Production DB 저장·크롤러 연결·연락처 공개 정책 변경·자동 게시 금지(사용자 결정 전).
- 전화·문자·Zalo·메시지 발송 금지. 개인 계정 세션 재사용 금지. 자동 가입·OTP 입력·CAPTCHA 우회·프록시·다계정 로테이션·지문 위조 금지.
- 계정 경고·제한·추가 인증·강제 로그아웃 시 즉시 중단.
- 로그인 프로필·번호 TSV 커밋 금지(공개 저장소).
- 새 크롤링, Facebook 예약 실행 재개, 숨김 공고 재공개, DB 행 삭제 금지(기존 지시 유지).
- GPT를 거친 지시가 기존 틀과 다르면 수락 전에 사용자에게 확인.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-30~10-01 — 연락처 출처 조사(Chợ Tốt 수집 전용 계정 테스트 준비) + 메인 개편 논의** — MASTER PUSHED(`018a3c1`, `cc909bb`, `b79d94b`). 문서·조사 스크립트만, 테스트는 미실행.
2. **2026-09-30 — 공고 공개 기준 복원 표 + 인계 문서 정리** — MASTER PUSHED(`a88ac27`, `7ec8d5b`). 기존 공개 게이트(09-05, job_quality.gate_auto_publish) 복원, Facebook 게이트 우회(crawl_facebook.py:1070 active=True 고정)·지원 경로 기준 충돌 발견. 문서만, 코드·DB 변경 없음.
3. **2026-09-30 — 지원 버튼을 실제 지원 방식별로 연결(내부 지원 / 직접 연락 / 연락처 없음)** — MASTER PUSHED(이 커밋). 공용 판정 resolveApplyAction()+JobApplyButton: employer_id 있음=로그인→내부 지원, 없음+전화/Zalo=로그인 없이 내부 상세 연락 안내(/viec-lam/sb-ID#lien-he), 연락처 없음=지원 표시 안 함('Chưa có thông tin liên hệ', 상세 버튼 비활성). 적용: 상세·급구 페이지·추천 표/카드. 이전: 급구 페이지는 직접 연락형도 비로그인이면 /dang-nhap으로 보냈음. 검증: 빌드 미리보기+응답 가로채기 가짜 3유형(운영 DB 쓰기 없음), 데스크톱·모바일 첫 클릭 목적지 정상, 외부 링크·새 창 0, 단위 테스트 3/3. **4682 상태(미확인 유지)**: 전화·Zalo 번호가 원문(페이스북 게시물)의 번호와 일치하는 것만 확인. 게시자가 실제 채용 담당자인지, 회사명·실제 근무지·담당자와 회사 관계는 모두 미확인(원문에 회사명 없음, 웹 검색으로 특정 불가). 연락·숨김·DB 변경 없음.
4. **2026-09-30 — 급구 표 첫 클릭 무시 버그 수정 + 4682 근무지 확인 시도** — MASTER PUSHED(`63ff498`) + PRODUCTION DEPLOYED. 급구 페이지 지역 패널(기본 열림)을 mousedown에 닫아 표가 밀리며 제목·지원 버튼 첫 클릭이 사라지던 문제 → click 시점에 닫도록 수정. 검증: 빌드 미리보기(vite preview) + Supabase 응답 가로채기로 가짜 급구 1건(운영 DB 쓰기 없음), 데스크톱 1280·모바일 375 모두 제목 클릭→내부 상세, 'Ứng tuyển'→내부 /dang-nhap(비로그인), 외부 링크·새 창 0. 4682: 원문에 회사명 없음, Zalo 번호·공고 문구 웹 검색으로도 회사·사업장 특정 불가 → '위치 미확인' 유지, DB 변경 없음. 참고: 이 PC 여유 메모리 부족(약 1.6GB)으로 vite dev 서버·빌드가 간헐적으로 OOM.
5. **2026-09-30 — 미확인 위치 지도 미표시 + 원본 사이트 안내 문구 제거 + 설계 문서 정정** — MASTER PUSHED(`b1b09d4`) + PRODUCTION VERIFIED. 공고 상세 지도는 확인된 근무지만(지역·공단 중심 대체 표시·지역 지도 링크 제거, '위치 미확인' 안내), 한국 취업 연락 문구가 원본 페이지를 가리키면 중립 문구로 표시, VIECGANBAN_STRUCTURE_BASELINE.md의 '원문 URL 이동/외부 링크 CTA'를 폐기 동작으로 정정. 원인 조사: 규칙은 df8524c 이전 CLAUDE.md·AGENTS.md·BASELINE 어디에도 없었고, BASELINE은 반대로 외부 링크를 의도된 설계로 기록 → 세션들이 '기존 설계 우선' 원칙대로 링크를 유지. DNS는 2026-09-30 02:09 UTC 기준 복구 확인. source_url DB 권한 변경은 제외(사용자 지시).
