## 2026-10-21 12:40
- 변경: 메뉴 업종 링크, 공단 핀(parkLocate·POI 선택), 휴대폰 지도 첫 화면 맞춤, fitPins, 위치 자동 사용, 상세 지도 핀 공유·JobVietMap 최신 값
- 남은 문제: 위치가 핀보다 먼저 오면 핀이 화면 밖(fix/fit-after-pins 미반영), B안 데모 대기, 업종 자동 분류

## 2026-10-20 22:05
- 변경: #179 공단 표에 없는 KCN 핀(parkLocate)·메뉴 업종 링크 수정, #180 같은 이름 공단 POI 선택 + 재판정 migration 2개
- 검증: 67/67·tsc·build, 운영 DB 적용·deploy-verify 통과, 운영 촬영: 지도 핀 2개, ?cat=san_xuat_xay_dung 공고 2건

## 2026-10-20 20:20
- 변경: #177 첫 방문 위치 허용 창 + PC 기준 해시 갱신. 도면 가지(#141) 재측정·check 통과, 결정 0008 PR #175
- 검증: 65/65·tsc·build, mobile-home 통과, deploy-verify 39428820913 통과, 운영 번들에 창 포함 확인

## 2026-10-20 07:05
- 발견: 운영 /api/location-hook·/api/admin-auto-location 시작부터 500(FUNCTION_INVOCATION_FAILED) — Vercel이 src .ts(확장자 없는 import)를 못 읽음. #153 이후 위치 찾기가 한 번도 안 돌았음
- 변경: #172 vite.api.config.mjs → dist/api-lib/auto-location-runtime.js, 두 함수가 그 파일 사용(includeFiles)
- 검증: GitHub Actions에서 운영 호출 405/401/503(정상 응답), 재판정 응답 200, #4828 area·#4824 located 공개 유지

## 2026-10-20 06:55
- 요청: 두루뭉술 문구는 기타란 / 못 찾은 공고는 삭제 말고 목록 만들어 저녁 8시 알림(Lee 10-20)
- 변경: #169 KIND_RULES 3개, #170 locationLevel(no_info/our_miss)·map_r1_unlocated·delete_no_info·unlocated_report·03:00 재판정 cron, 14일 삭제 제거
- 검증: 65/65 시험·tsc·build, #4828 동 중심·#4824 KCN으로 찾음 로컬 재현, 운영 DB 적용·deploy-verify 통과
- 예약 점검: 20:00 trig_01QD9erq4V4WAUqD8ydyTJpw
- 남은 문제: 결정 문서 0008

## 2026-10-20 06:20
- 요청: 빠진 줄은 공개를 막지 말고 자동으로 채우기 + 규칙에 없는 종류는 Lee와 칸을 정해 새 규정(Lee 10-20)
- 변경: src/lib/jobDetailFill.ts(+test), scripts/ocr/detail-fill.mjs, job-ocr-check.yml 보충 단계, 'MỨC LƯƠNG' 소제목 04 인식
- 검증: 정답표 #4824·#4828, 로컬 DB로 2회 실행 중복 없음·규정 추가 시 07→칸 이동 확인, 64/64 시험·tsc·build
- commit: e6cbbb6 (#167) / deploy-verify 통과 / 운영 DB 보충 확인(#4828 8줄, #4824 7줄)
- 예약 점검 trig_01UPYmvMx2btwzLHUEvcEv9o 매일 08:52
- 남은 문제: 새 종류 13줄 칸 결정 대기

## 2026-10-19 23:45
요청: 상세요강 칸 구성(알바몬 참고)·사진 칸·진행 알림 프로세스.
변경: #163(상세요강 01~07 + 08 사진 칸, 핑크 세로 막대·글머리표, 사진 썸네일 누르면 크게), #164(결정 0007 공고 상세 구성, 열림·Lee 승인 대기), #165(08 사진 칸 제목 막대 제거 + CLAUDE.md "진행 알림·화면 변경 프로세스").
수정 파일: src/lib/jobDetailSections.ts·test, src/pages/JobDetail.tsx, src/index.css, CLAUDE.md, docs/decisions/*/0007.
검증: 정답표 시험(#4824·#4828), PR 필수 검사 통과, #165 Vercel 운영 배포 success(9b926f7). deploy-verify: 통과(run 39287685481).
남은 문제: #4828 상세요강 누락 줄("Không cửa từ…", 회사 소개) + OCR 누락 검사(Lee 답 대기), #154 재작성, 위치 허용, 번지 형식, 도면 재측정.

## 2026-10-19 21:30
요청: 위치 못 찾는 원인·대안 검토, 상세 근무지 문구·Google 길찾기 시각 효과.
변경: #156(기록 가지 배포 중단), #157(TomTom 시험 API 서버 출입증 + 시험 워크플로), #160(동 지역 문구 줄임), #161(핀·글자 물결·지도 누르면 Google·스쿠터). #158 status 가지 배포 중단(라벨 대기). #159 원 테두리 효과는 Lee 반대로 닫음.
검증: deploy-verify #157 39182709533, #160 39262166710 통과. TomTom 시험 run 39182912711. 데모 촬영으로 모바일 줄바꿈·칸 밖 이탈 발견 후 수정.
남은 문제: 위치 허용 요청, #154 재작성, 번지 형식 인식, 도면 재측정.

## 2026-10-19 00:00
요청: #4828 지도 원인 → Lee 결정(새 주소 형식, 저장 즉시 위치 찾기, 키는 Vercel 한 곳, 못 찾은 공고 비공개→삭제), Vercel 배포 한도 원인.
변경: #152(2단계 주소·저장 좌표 재사용, 운영 확인), #153(저장 즉시 위치 찾기 — DB 적용, Vercel 코드 배포 한도로 미반영), #154(결정 0006, Lee 확인 대기), #156(기록 가지 배포 중단, 대기). 시험 PR #151 닫음(GitHub VietMap 키 401).
검증: 각 PR 테스트 64/64·tsc·build. deploy-verify 39142616608 통과(#152), 39143169739 실패(#153, 배포 한도).
남은 문제: 배포 한도 해제 대기, #154 Lee 승인, 주간 규칙 보강 예약, 도면 재측정.

## 2026-10-18 21:45
요청: Lee 결정 — 근무조건 칸 내용이 끊어지면 안 됨, 최대 3줄 / 지도 불일치 원인 파악.
변경: PR #148(src/lib/conditionLines.ts·test, src/components/ConditionLines.tsx, JobDetail.tsx, index.css, scripts/layout/measure.mjs).
검증: tsc·build·단위 시험 통과, PR 검사 전부 통과, 브랜치 빌드 측정(run 39135430474) 꺾임 0, 운영 deploy-verify 통과(run 39135606656). commit 70cd250, master push, 운영 배포.
지도 원인: wardArea.parseWardUnit 2단계 주소 미인식 → MAP-R1 unresolved → 성 중심(HANDOFF 참고). 코드 수정 안 함.
남은 문제: 도면 재측정, #136 임의 변경 Lee 답 대기, 지도 수정 지시 대기.
