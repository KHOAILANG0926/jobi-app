## 2026-11-10 새벽 — Google 한도: 사업장 중복 검색 줄임·한도 초과 보류·로고 재시도·30일 저장·시험 몫 (Lee 11-09 5개 지시)
- ① 같은 사업장 = 회사 핵심 이름 + (번지+도로 또는 공단) + 원래 성 → Google 결과 저장 열쇠 하나(googleCacheKeys, 위치·로고·업종 같은 함수). 번지·도로·공단(번호 포함)·성이 다르면 다른 열쇠, 예전 글자 열쇠 결과도 그대로 읽음. 고르는 판정(pickCompanyPlace)은 공고마다 그대로.
- ② 한도 초과(우리 월 한도·Google 429)·확인 서버 오류 = google_quota/precheck_unavailable → 크롤러 입구가 버리지 않고 보류함(research_artifacts location-hold, 지우지 않음)에 넣고 다음 수집 실행 첫머리에 최대 5건 다시 확인(아직 한도면 첫 건에서 멈춤, 14일 지나면 expired 표시). '못 찾음'은 지금처럼 수집 안 함.
- ③ 로고 quota는 영구 결과 아님: 다시 묻고, 정기 검사(job-ocr-check)가 30분마다 6시간 지난 quota 최대 10건 다시 시도(location-hook logo_retry). Google 429도 quota.
- ④ 약관: 새 Google 결과에 저장 시각, 30일 지난 결과는 안 씀. 정기 검사가 30일 지난 Google 결과를 장소 번호만 남기고 비움(줄 삭제 없음, scripts/ops/google-cache-expire.mjs). 남은 판단(Lee): 공고 위치 원본에 Google 좌표 영구 저장, Google 아닌 지도에 Google 결과 표시.
- ②-2 위치 못 찾은 공고(Lee 11-09 "예"): 공고 목록에 넣지 않고 같은 보류함에 비공개 보관(unfound), 7일 뒤 다시 확인 최대 2번, 찾으면 같은 입구로 등록. 수수료 소개소·회사 이름 없음은 보관 안 함. CLAUDE.md 「수집 첫 단계」 줄 갱신.
- ⑤ 시험 몫 google_text_search_test 600/월(migration 20261110090000, 한 줄 추가) — 시험 도구가 Pro·IDs 모두 먼저 예약, Pro는 운영 몫에도. 시험은 베트남 날짜 하루 한 번, 실행당 SearchText 40회.
- 검증: tsc · npm test 116/116 · build · 크롤러 입구 시험(보류·재시도) · 로컬 PostgreSQL에서 migration·운영 점검.

## 2026-11-09 밤 — #560 회사 이름·이름 비교·주소 읽기 공통 고침 (Lee "먼저 공통 로직 개선, 잘못 확정 0건")
- 고친 곳(한 곳씩, 모든 경로 공통): companyReader(댓글 아래 무시·"quán cạnh ngã 6"류 위치 설명 버림·CTY 줄 뒤 상여/공단 말 떼기·제목 대시 일반화·[지역] 머리 떼기·partime), addressReader(댓글 무시·주소 이름표 값이 가게 이름이면 다음 번지 줄), companyPlaceSearch(업종 머리말 묶음 빼기·짧은 지도 이름 8자 이상·따로 쓴 Việt/Nam 유지·**원문 번지 거리/공단과 다른 후보는 고르지 않음**).
- 시험: 30건 실제 원문·Google 후보로 사례 추가(바로 읽기 9, 고르기 4, 보류 9). 예전 기대값 3곳 변경: EAGLEON 이름에서 공단 말 뺌, KCN 원문인데 Google이 시내 거리면 따르지 않음(locationProcess), logoLookup 시험 후보 주소를 실제처럼.
- 검증: tsc · npm test 115/115 · build. Codex 지적 7건 반영(왕복 5회 넘어 needs-lee).
- 수정 전후 [직접 확인 run 42607934688 → 42618711506, Bắc Ninh 30건, Pro 방식]: 위치 찾음 1 → 4(Trung Nguyên 27 Kinh Dương Vương · New Phoenix · Kingsport · Fushan VSIP — 원문과 대조해 모두 맞음), 잘못 확정 0. 다른 거리·공단 후보 보류: Minh Nguyệt·Đại Tân Việt. 4단계는 같은 표본에서 5건이지만 Sen Tài Thu를 Pro와 다른 곳(10.9km)으로 잡음 → 정확도 위험.
## 2026-11-09 밤 — #579 연락처 없는 공고 PC 안내 상자 겹침 (Lee "2번")
- 원인: 연락처 없을 때도 연락 상자가 제목 줄 오른쪽 절대 위치라, 키 큰 안내 상자가 아래 표·지도를 덮음.
- 변경: 연락처 없을 때만(jd2-aside--no-contact) PC에서 흐름 안에 둠. 연락처 있을 때 Gọi/Zalo 배치(승인된 틀)는 그대로, 모바일 그대로.
- 검증 [직접 확인]: 로컬 빌드 미리보기(/xem-truoc-tin) PC 1366 — 전화 없음: 겹침 0, 전화 있음: 기존 절대 위치 그대로. tsc·시험·빌드 통과.
## 2026-11-09 밤 — #612 자동 작업 권한: 개인 설정 파일 저장소에서 뺌 (Lee "3번부터")
- 원인 [직접 확인]: .claude/settings.local.json(개인 PC 권한 223줄 + defaultMode bypassPermissions)이 저장소에 올라가 GitHub의 Claude 자동 작업 3개가 그 설정을 읽음 → --allowedTools가 제한이 아니었음.
- 변경: 파일을 저장소 추적에서 빼고 .gitignore(다른 PC가 pull하면 그 PC 파일도 지워짐 — 각자 다시 만들면 됨), issue-mention의 지우기 단계 삭제(필요 없어짐), claude-task·codex-response에 --permission-mode default, claude-task에 허용 목록(전엔 없음).

## 2026-11-09 저녁 — #560 시험 중단 사유 · #594 이슈 @claude 연결
- #560 시험(#608·#609·#611): 미리 보기 8개 그룹 중 새 글은 Bắc Ninh 30건뿐(나머지 그룹은 몇 달 전 글). 시험의 Google 호출은 모두 API_KEY_INVALID — Vercel이 민감 값으로 둔 GOOGLE_PLACES_API_KEY는 env pull로 받을 수 없음(받은 값 길이 11). 운영 Google은 정상(business-search-compare 42599813839 오류 0). 같은 원인 2회 실패로 시험 중단, Lee 결정 대기(키를 GitHub Secret에 추가 vs 관리자 전용 서버 시험 API). 시험 예약으로 운영 카운터 54회 사용.
- 30건 분석 [직접 확인]: 주소 글 없음 8(공단 이름만 'Quế Võ 3'·'Nam Sơn'·'Phố Nếnh' 등), 회사 이름 잘못 읽음 약 9('quán cạnh ngã 6'·'BẢNG TIN'·'Hotel 06 Ngô Tất Tố' 등), 회사 이름 없음 4, 체인 지점 7.
- #594: 이슈 @claude 받는 곳이 없었음 → #610 claude-auto issue-mention(읽기 전용, 개인 bypass 설정 제외 — Codex P0), #594에서 시험 성공(run 42602216824). 남은 것: GPT 쪽 자동 수신(Codex 환경 생성 — Lee), #612 다른 자동 작업의 bypass 설정.

## 2026-11-09 오후 — #560 위치 확인 방식 비교 시험 도구 (Lee 승인 "200건 시험")
- 요청: 운영 공고·DB 변경 없이 시험 데이터로 현재 방식(Google Text Search Pro) vs 4단계(시험 장부 → IDs Only 무료 → Autocomplete+Details Essentials → Pro) 비교.
- 변경: scripts/ops/location-ladder-compare.mjs(+test), .github/workflows/location-ladder-compare.yml(수동). 판정은 운영과 같은 함수(resolveAutoLocation·precheckVerdict), 캐시 메모리만, 운영 DB는 공고·핀·캐시 쓰기 없음, Google Pro 호출만 운영 월 한도 예약(external_api_reserve)으로 셈(Codex 지적 반영).
- 거부 분석 [직접 확인]: Facebook 저장 시도 15건 중 저장 5 · 위치 거부 8(대략 위치만 5, 주소 글 없음 1, 원래 성 밖 1, 확인 서버 응답 없음 1) · 기타 2. 앞서 보고한 '16건'은 로그 줄 중복으로 두 번 센 것.
- 남은 것: 미리 보기 8개 그룹 실행 → 비교 실행 → 결과 보고, VietMap 저장 문의 메일(Lee 승인 후 발송).

## 2026-11-09 오후 — AI 팀 Co-work 자동 협업 연결 (Lee 최우선)
- #598 Codex 지적 → GitHub Actions Claude 자동 수정·답·재검사 요청 다시 켬, #601 실행 기록(결과·거절 명령·오류) 표시, #602 실행 전 npm ci.
- 원인 확인: 예전 2초 실패(#582) = 구독 열쇠 무효(401) → Lee가 새 열쇠 등록(11-09 13:05).
- #600 실제 시험: Codex 지적 → Claude 자동 수정 push(ae52377)·답 → (Lee 계정 재검토 요청) → Codex 통과 → 봇 병합 → 운영 배포 검사 통과.
- 남은 연결: Codex가 claude[bot]의 재검토 요청에 반응 안 함(10분 확인) → Codex 자동 검토 설정(Lee) 필요.

## 2026-11-09 낮 — 검사표 확대·헤더 검사 연결 (Lee 승인)
- #592 검사표에 '붙인 뒤에도 빠진 줄' 표시(공개 영향 없음), 예약 작업 「상세요강 새 종류 줄 알림」은 운영 DB 조회 대신 검사표 이슈 + STATUS 읽기.
- #593 자동 작업 대상 밖 공고(고용주 직접 등록·기준 시각 이전) 읽기 전용 검사 — 첫 실행 7건 검사(모두 11-01 이전, 고용주 공고 0건), DB 변경 없음. #596 알림 단계 크기 초과 실패 고침.
- #586 PC 헤더 운영 검사: deploy-verify(보호 파일) 대신 운영 배포 끝에서 workflow_dispatch로 부름, workflow_run 시작 삭제(중복 없음). #591 닫음.
- 대기: 운영 SQL 전용 낮은 권한 계정(방향 승인, 비밀번호 만들기 방법 Lee 결정 대기).

## 2026-11-09 오전 — Codex 대기 판정 보완·운영 SQL 좁히기 (Lee "예", "좁히기")
- 확인 [직접]: Codex 요약 '미해결' 표시는 리뷰 대화 해결 상태와 안 맞음(#581·#584·#585) → 기존 답 표시(claude-codex-reply)로 판정.
- #587: 예전 커밋 Codex 지적에 답 없으면 30분 통과 안 함, Codex 없이 운영·보안·DB 파일 바뀐 PR은 needs-lee로 멈춤(check-repository-policy 기존 목록 재사용).
- 운영 SQL: master·Lee 계정 실행만, 허용 = 입구로 기존 공고 고치기 1줄(job_id+update_fields) + 조회, 입구 호출 뒤 읽기 전용(DB가 쓰기 거부, 로컬 PostgreSQL 16 확인), 실행 전 입구 호출 권한 확인. 예전 파일 4개(cleanup·kda×2·mao-yen)는 이제 실행 안 됨(실행 끝난 기록).
- 남은 것: 접속 계정이 관리자급인지 첫 실행 로그로 확인 → 관리자급이면 전용 계정 분리는 Lee 결정(비밀값 변경).

## 2026-11-09 오전 — 구조 단순화 1차 (Lee "덧붙이기 전에 고치기·합치기·지우기")
- 상세 틀 3→2(Lee "적용"): 예전 Quyền lợi 틀 3건(sb-4878·4879·4982)을 새 4칸 틀로, 그 틀 전용 코드(splitQuyenLoi·takeRequirementLines·Quyền lợi 상자·contactHost quyenloi) 삭제. KDA·데이터 그대로.
- 함께 낸 PR: #583 Codex 자동 대응 잡 중지(실행 0회), #584 안 쓰는 파일 15개·자동 작업 3개 삭제, #585 DB 검사 파일별 예외 27곳 → 이름 규칙(setup/local), #587 Codex 줄 지적은 처음 단 커밋 기준, #588 규칙 문서 513→371줄 + 원칙 8·PR 양식·Codex 검토 기준. 해결된 경보 글 21개 닫음.
- 조사만(Lee 결정 대기): 「운영 - 지정 SQL 실행」은 수정·삭제 문장을 막지 않아 승인 절차 우회 가능 → 입구 호출·조회만 허용하는 제한안. #586 운영 헤더 검사 11-04 이후 미실행.
- 검증: tsc·npm test 119/119·build·desktop baseline 8/8.
