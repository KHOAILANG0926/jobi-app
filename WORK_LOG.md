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

## 2026-11-09 아침 — 공고 작성 화면·상세 템플릿 알바몬 맞춤 (Lee "적용")
- 요청: 알바몬 실제 공고(120083527)·알바몬 일반공고 작성 화면과 나란히 비교한 차이 고치기.
- 변경: 상세 템플릿 PC 가운데 정렬·빈 회사 이름 안내 글자 숨김·미리보기 창 글자체 Inter(AlbamonTemplate.tsx/.css). /dang-tin 흰 바탕(이 화면만), 업직종 짧은 버튼+선택 창(검색·Ngành|Chi tiết), 근무기간 7칸+Thỏa thuận 체크(글자 잘림), 사진 4칸+동영상 2칸 자리(동영상 저장 칸 없음 → sắp có), 불필요 안내 문구 삭제, Hình thức 0/2 숫자(PostJob.tsx/.css).
- 버그 수정: 고용주 사진이 저장소에만 올라가고 공고 image_url에 연결되지 않던 문제 → image_url + images(저장소 경로) 저장(JobsContext.tsx, ingest_job이 local_jobs 칸을 그대로 받음, DB 변경 없음).
- 알바몬 확인(Lee 크롬, 저장 없음): 공고사진 4칸(사진첩 최대 30장, 500KB 미만 jpg·gif·png), 동영상 2칸 = 유튜브 링크만(30분 이내).
- 검증: tsc·build 통과, 로컬 Playwright PC·모바일 화면 확인, 데모 Lee 크롬에서 확인.
- 남은 것: 동영상(유튜브 링크) 저장 칸 = DB 변경 → Lee 결정. 빠른 등록에 Tuyển liên tục 보일지 Lee 결정. #579(연락처 없는 미리보기 상자 겹침).

## 2026-11-09 새벽 — 밤 근무 4회차: 템플릿 모바일 미리보기 치우침 #577 (Claude)
- 발견(#571 확인 중): 간편 템플릿 'Xem trước' Mobile 새 창(420px)에서 내용이 왼쪽 43px·오른쪽 16px로 치우침. PC용 `body.amt-pvwin .amt-pv { margin-left: 27px }`이 `.amt-pv--m { margin: 0 auto }`를 덮음.
- 변경: src/components/template/AlbamonTemplate.css 한 줄 `body.amt-pvwin .amt-pv--m { margin-left: auto }`(새 창 미리보기만).
- 검증: tsc·npm test 119/119·build 통과, 로컬 Playwright 모바일 창 16/16px·PC 창 27px 그대로.
- #571: 같은 SHA(fa5e275) 로컬 화면으로 /dang-tin 템플릿 그림·흐림·검정 제목 PC·모바일 확인. 운영 주소 눈 확인은 이 환경 접속 막힘으로 남음.

## 2026-11-09 새벽 — 밤 근무 3회차: #570 운영 반영·#566 Codex 대기 장치·#575 봇 다시 보기 (Claude)
- #570(Lee "적용"): Codex P1(예전 저장 공고 흰 제목 위 흐림) → 흐림을 새 템플릿 클래스 amt-visual--fade에만(AlbamonTemplate.tsx·.css). 병합 f8aa798, deploy-verify 성공.
- #566: Codex P2(왕복 횟수 장치가 아무 계정 답이나 셈) → claude-auto.yml이 REPLY_AUTHORS만 셈 + 목록 일치 시험. 병합 1d6fd88.
- #575(#574): 예약 실행(*/15)이 안 돌아 Codex 대기 PR이 멈춤 → bot-pr-automerge.yml이 Codex 리뷰·요약 댓글·Claude 답 도착 때 다시 보고, 'Codex 검사 대기(x/30분)'이면 codex-wait-timer.yml이 남은 분 뒤 다시 부름. 병합 184d753.
- 검증: 각 tsc·npm test 119/119·build 로컬 통과, PR 필수 검사 통과, deploy-verify 42514709892·42514737829 성공.
- 남은 것: 운영 /dang-tin 템플릿 그림 PC·모바일 눈 확인(이 근무 환경은 운영 주소 접속 막힘, #571).

## 2026-11-08 밤 — 봇 병합 뒤 검사·문서만 바뀐 커밋도 운영 검사 (Claude 밤 근무)
- 발견: #565·#568(시험·문서만) 봇 병합 뒤 vercel-deploy가 workflow_dispatch로 돌아 "앱 변경 없음, 운영 그대로" 기록 단계(push 전용)를 건너뜀 → deploy-verify 시작 안 됨, 수동 시작 시 20분 대기 실패(#572).
- 변경: .github/workflows/vercel-deploy.yml — 그 기록 단계를 workflow_dispatch에도 실행하고, dispatch일 때 deploy-verify를 시작.
- 검증: YAML 읽기 확인. 실제 확인은 이 PR 병합 뒤 운영 검사 실행.

## 2026-11-08 밤 — 휴대폰 메인 검사(mobile-home) 고장 고침 #559 (Claude 밤 근무)
- 요청: ai-team 이슈 #559(지도 못 그리는 휴대폰에서 안내 45초 안 보여 실패).
- 원인: 11-05부터 WebGL이 없으면 안내 대신 대체 지도(RasterMapCanvas)를 그림. 안내는 바탕 그림을 못 받을 때만 나와 시험 기대가 낡음(화면 버그 아님). 11-05 fix/map-webgl-unavailable 실행부터 계속 실패.
- 변경: scripts/test-mobile-home.mjs — 안내 대신 대체 지도(data-map-provider="raster")가 보이는지 확인. 화면 코드 변경 없음.
- 검증: tsc·npm test 119/119·build 통과, 로컬 WebGL 막은 390px에서 대체 지도 표시 확인.

## 2026-11-08 — 간편 템플릿 B안·1:1 문의·추가 고용형태 (Claude)
- 요청: Lee "3,4,5,6적용" → 5번 "B로 바꾸고 데모 먼저"(데모 demo/template-detail) → "마무리먼저".
- DB(#552, 추가만): local_jobs.description_html·employment_type_extra(공개 조회), support_inquiries(넣기 누구나, 읽기·처리 관리자, RLS).
- 화면: 공고 등록 맨 아래 'Mô tả chi tiết tuyển dụng' = 간편 템플릿(78틀, 전용 사진 없는 57틀은 같은 업종 우리 사진 임시) → 결과 HTML 저장, 상세 ④가 그 모양 그대로(화면 뜬 뒤 정리해 넣음, 휴대폰은 모바일 틀 크기). 고용형태 하나 더(Hợp đồng·Thực tập·Cộng tác viên). /ho-tro 'Hỏi đáp 1:1' 작성·바닥 'Liên hệ 1:1' 연결, 관리자 '💬 Hỏi đáp 1:1' 탭.
- 시험: job-preview-check(템플릿 → 미리보기 ④), jobSchema 38칸.
- 남은 것: 알바몬 원본 템플릿 사진 출처·사용 조건 확인(브라우저 연결 필요), 에디터 탭(패키지 설치 필요), 상세 AI 배경(다음 작업).

## 2026-11-08 — 공고 등록 미리보기·입력 칸 추가(알바몬 3·4번) (Claude)
- 요청: Lee "3,4,5,6적용" — 이 PR은 DB 없는 3번·4번(고용형태 3개 추가 제외).
- 변경: PostJob 미리보기 PC·Mobile(오른쪽 상자·아래 막대) → /xem-truoc-tin 새 창이 JobDetail(previewJob)로 저장 전 입력값을 그대로 보여 줌(단추 막힘). 입력 칸: Không cần kinh nghiệm·Có thể đi làm cùng bạn bè·우대조건 선택 창(7개)·근무기간 Thỏa thuận·Phụ cấp ăn riêng·Có thời gian thử việc·Cách ứng tuyển·Tên người liên hệ(+저장). DB 새 칸 없이 preference·salary_note·상세요강 '채용 절차'에 넣음.
- 시험: scripts/layout/job-preview-check.mjs(app-screen).
- 남은 것: 5번(템플릿 표시 방식 A/B)·6번 1:1 문의·고용형태 3개 추가(DB) — Lee 답 대기.
