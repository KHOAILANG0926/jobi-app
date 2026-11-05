# Claude 인수인계 — 2026-11-05 (Asia/Bangkok)

## 1. 현재 상태
- 사용자 최신 지시: "클로드가 하게 인수인계해". **우선 미완료는 #5438 실제 지도 위치 수정. Regal 사진 작업은 사용자 지시로 보류.** 이미 끝낸 코드 작업을 다시 만들지 말 것.
- [직접 확인] GitHub master: `8f2d718cac6c06cd3c5c8abaadf98663f2bc7fda`. PR#468(요약·위치 검색 절차)·PR#469(사진 완료 판정)은 병합됨. 절차 수정과 실제 공고 데이터 완료를 혼동하지 말 것.
- **#5438 NEW TEAM ROBOTICS VIETNAM 실제 위치는 미수정.** 공개 `/api/map-locations?ids=5438`: workLocationId1414, area,21.098/106.117,revision2,checkedAt2026-11-04T06:15:04.668Z. 이는 지역 대표점이다. Google 버튼은 회사명+주소 검색이며 실제 선택 장소 좌표를 아직 확보·확정하지 못했다.
- 원문 주소: NX 2-2, lô CN1-2 và CN1-3, KCN Yên Phong(khu mở rộng), xã Yên Trung, Bắc Ninh. 원본 파일 `scripts/ops/jobs/fb-new-teamrobotics-20261104.json`. 동명의 Bình Dương 업체와 혼동 금지. 공단 중심/기존 city 좌표를 실제 회사 좌표로 추정해 넣지 말 것.
- **인증 미비로 단정한 이전 설명은 철회.** [직접 확인] GitHub 연결 permissions admin/maintain/push=true. 기존 관리자 로그인·확정 E2E run42003962706 success. 비인증 GET401과 로컬 CLI오류는 전체 인증 부재의 증거가 아니다.
- [직접 확인] 이 대화 VM은 restricted/enforced, spec/observed revision1. Regal·Wallace·JOBI·api.github.com 직접 curl은 TLS 전 `CONNECT tunnel failed, response 403`(envoy). github.com 및 Supabase 공개 이미지는200. 환경 허용 목록 차단이며 업체 서버 자체403으로 확인된 것이 아니다. 다른 PC/Claude 환경에는 그대로 적용해 추측하지 말고 직접 재검증.
- GitHub/Vercel 연결 도구 조회는 정상이다. 이 ChatGPT 도구에는 workflow_dispatch 실행 함수가 없었음. 로컬 CLI `gh api`도 프록시 Forbidden. **Claude의 도구·브라우저·실행 경로는 다를 수 있으니 기존 연결부터 확인하고 재인증을 반복 요구하지 말 것.**
- **Regal Edu Vân Dương #5422: 사진 미교체·보류.** 마지막 운영 확인은 `/images/industry/cskh_kinh_doanh.jpg`. 원본 JSON의 logo_check=found_unstored. 특정 업체 사진을 골라 시각 확인한 사실 없음. 공식 개원 글은 두 지점 사진이 섞여 있으므로 임의 선택 금지(상세는 WORK_LOG).
- 완료된 공통 대표 이미지·상단 확대·WebGL fallback(#465~467), #468 상세 요약 연결, #469 완료 판정은 보존. #469는 수동 ingest-sql/공고JSON PR의 완료 주장만 강제하며 자동 검색·저장이나 모든 DB/API 경로 구현이 아님.

## 2. 다음 할 일 3개
1. `.claude/RULES_CORE.md` → `CLAUDE.md`·`AGENTS.md`를 읽고 원격 master/열린 PR·현재 운영을 다시 확인. 미커밋 파일을 덮어쓰지 말 것. 최신 master에서 안전한 작업 영역을 사용. 인터넷/브라우저는 실제 접속으로 판단하고 설정 안내만 반복하지 말 것.
2. #5438의 **실제 회사 위치 근거**를 확보한 뒤 기존 관리자 위치 확정 경로로 처리. `.github/workflows/admin-location-confirm.yml`(master, inputs job_id/ google_link) → `scripts/ops/admin-location-confirm.mjs` → 정상 관리자 API/canonical writer. 관리자 화면에서도 같은 처리가 가능하다. Google의 선택 장소 공유 링크 필요; 검색 URL/지도 화면 중심(@lat,lng)을 확정 좌표로 쓰지 말 것. 운영 SQL 직접 실행·공고번호 전용 패치로 우회하지 말 것.
3. 확정 후 공개 API·상세·메인 핀·Google 길찾기를 실제 비교하고 PC/모바일 깨짐·잘림까지 확인한 뒤 최종 보고. 실제 반영 전 완료라고 하지 말 것. **사진 보류는 사용자 재개 지시 전 유지.**

## 3. 필수 규칙
- 추가 허락 반복 금지. 단 실제 기술적 차단/사용자가 해야 하는 부분만 원문 오류와 범위를 보고. 키·토큰·쿠키·비밀번호를 출력/커밋하지 말 것.
- 로컬 push 금지, GitHub 연결 도구로 브랜치·커밋·PR. 필수 CI·기존 봇 병합·운영 검증 보호 우회 금지. 운영 DB 직접 SQL 조회/수정 금지.
- canonical 위치 원본은 job_work_locations. 번호 지정 보정·추정 좌표 승인·Google을 틀린 지역 대표점으로 옮겨 일치시키기 금지. 승인 틀/CSS/하단 사진/STATUS 보호.
- [직접 확인]/[기존 기록]/[추정]과 코드·절차·실제 데이터 완료를 구분, 최종5줄 이내. E2E 성공은 #5438 실제 수정 완료를 뜻하지 않는다.
- 로컬 상태: /workspace/jobi-app은 work@750ebcf+기존 다수 변경, /workspace/jobi-process-preview는52752ed+문서변경, /workspace/jobi-photo-process는bc3b142+문서변경. 이 변경을 reset/overwrite하지 말 것. 이 문서의 GitHub 인수인계 브랜치를 읽고 최신 master를 기준으로 재개할 것.
