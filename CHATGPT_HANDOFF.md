# HANDOFF — 2026-11-07 오후 (Claude) · 주소 읽기 한 곳·중복 4단계·FB 쿠키

## 1. 현재 상태
- master a943767(#513 주소 읽기 한 곳) — Vercel 배포·deploy-verify 42347185802 성공 [직접 확인].
- 주소 읽기(Lee 11-07, 기존 방향 변경): 원문 주소는 src/lib/addressReader.ts 한 곳에서만 읽는다(급여 salaryReader와 같은 방식). Facebook 수집기는 주소를 읽지 않고 원문(source_text)만 보냄 → 위치 확인 서버(api/location-hook precheck)가 읽은 "주소, 지역"을 공고 위치로 저장(crawler/ingest_gateway.require_location). 사이트 주소 칸 있는 소스(TopCV)는 그 칸 먼저. 다시 수집은 location-hook read_address(지도 조회 없음). 빠진 주소 = 사례를 addressReader.test.ts에 추가 → 함수 수정(소스·공고별 규칙 금지). CLAUDE.md 「수집 첫 단계」 절.
- 중복 4단계 운영 중(회사 코드·같은 일·같은 위치 → 확실=비공개, 애매=비공개+관리자 🔁 Nghi trùng lặp). 기존 공고는 판정 제외.
- 공고: #5595 EAGLEON 등록·비공개(업무 미기재·직업분류 없음, 프로세스대로). #5599 NETCO POST 공개(핀 대략 위치).
- 크롤러 위치 확인 401(키 글자 다름) 해결(#507~#510). 검사표 핀 정확도 = 화면 기준(exact+확인)(#511).
- Facebook 쿠키 11-07 11:07 갱신(VPS IP 경유). 유지 기간 측정 중. VPS 공간 1.2G 남음(옛 실행기 정리), root 정리(snap·apt 약 0.5GB)는 미실행.
- VPS AZDIGI 3개월 결제(11-07), 다음 납부 2027-02 초 — 기한 전 Lee에게 알림.

## 2. 다음 할 일 3개
1. Facebook 1건씩 천천히 등록(원문 업무 먼저 읽기 → facebook-preview-read.yml).
2. Facebook 쿠키 만료 시점 기록·보고.
3. Muaban 읽기 시험 / Haidilao(R3 출처) / Chợ Tốt 이의 결과 — Lee 지시 시.

## 3. 필수 규칙
- 확인하고 말한다(추측 금지), 기존 프로세스 먼저 확인, 덧대기 금지. 보고는 한국어·최종 보고만·짧게.
- 운영 DB 직접 SQL·번호 지정 덮어쓰기 금지, DDL·데이터 변경은 STRICT(Lee 승인).
- 비밀값(키·쿠키) 어디에도 출력 금지. 로그인은 Lee가 VPS에서.
- 완료 = PR → 검사 → 병합 → 배포 → deploy-verify → 화면 확인 → HANDOFF·WORK_LOG.
