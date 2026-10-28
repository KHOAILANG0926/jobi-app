# Bomunttl 후속 — 공통 규칙 수정 (2026-10-28)

## 범위와 승인
Lee가 운영 sb-4982에서 지적한 위치·상단 빈칸/식사 범위·상세요강 가독성을 공통 경로로 수정한다. sb-4982/company ID 특례나 개별 DB UPDATE는 없다. Lee는 이 대화에서 상단 글 모형을 승인했다. KDA 칸의 배치·크기·순서와 CSS를 유지한다.

## 직접 확인한 코드 결과
- canonical writer에 근거 있는 행정 대표점을 area/auto_area/미확인으로 기록한다. 원문 지역 우선순위와 검증된 점 보호를 유지하고, 출처 원본/캐시/메인/상세가 같은 점을 쓴다. 관리자 확정 대기는 유지한다. source/context가 다른 복수 근무지를 섞거나 구체 target ID를 잃지 않는다.
- 원문 성 경계는 출처가 있는 원래 행정구역 polygon으로 검사한다. 박닌시 대표점은 공개 gazetteer(Q33381)의21.186080,106.076320과 원래 성 polygon으로 증명한다. 이 정확한 대표점의 도시 소속만 확인하며 임의 도시 좌표의 경계 증명으로 확대하지 않는다. 알려지지 않은 도시 경계는 실패로 보고한다.
- 기존 공고도 공통 표시 단계에서 직무별로 그룹화한다. 이름은 기존 항목별 칸 안의 묶음 제목 한 번만 표시한다. 상단은 역할 수/인원 미기재/원문 근무형태/직무별 휴무를 표시한다. 좁은 기존 칸에서 긴 문구가 넘치면 짧은 요약+Xem thêm를 유지하고 전체 값은 상세로 보낸다.
- 식사 아이콘/문구는 해당 직무를 명시한다. 구형 입력에서 meal_provided=true가 잘못 퍼졌어도 같은 공개 Job 모델에서 직무 범위를 적용한다. 원문의 부정 표현으로 식사를 약속하지 않는다.
- 권유 문구는07기타란. + thưởng + tip은 같은 직무의 급여 줄에 결합한다. 기존 저장된 접두어/다른 칸의 조각도 표시 단계에서 바로 처리하고 원문 숫자·글자는 보존한다. 실제 원문10h-10h는 고치지 않는다.
- 미해결 source에 전국 기본 좌표 지도를 그리는 경로는 제거했다. 원문 행정 근거가 없으면 같은 지도 슬롯에 확인 대기를 표시하며 전체 공개 핀 검사는 실패한다. 이는 임의 핀을 만들거나 전체 통과를 주장하는 예외가 아니다.

## 직접 확인한 시험
- npm test:85/85파일, tsc --noEmit, 전체 build 통과.
- Chromium390/1366: KDA 기준 브랜치와 이미지 없음/있음/실패 각각의 주요 틀 측정 일치. 복수직무 요약·모집 수/인원 구분·직무 한정 식사·그룹표시·기타란 권유 문구·급여 조각 결합 통과. 로컬 synthetic 공개 API 응답이며 운영 화면 결과가 아니다. screenshot은 /tmp/multi-role-browser에 있고 새 PR workflow가 같은 시험 결과를 artifact로 보존한다.
- 실제 폐기용 PostgreSQL/PostGIS: canonical→indexACL→행정 fallback의 기존 동시성/정합성 및 새 좌표 없음·행 없음·도시 대표점·다른 원래 성·상위 provider 재시도·검증점 보호·구체 target/복수 근무지·관리자 대기·권한복구 통과.
- 실제 registration→fallback→presentation-rules 결합 시험과 production_check 통과. 규칙 SQL PGlite preflight/멱등/점검도 통과.
- 독립 검토의 두 P2(복수 근무지의 잘못된 지역 결합, fallback target 누락)는 수정하고 targeted/실제 SQL 시험으로 검증했다. 재검토에서 차단 사항 없음.

## 운영에서 직접 확인한 한계
- NODE_USE_ENV_PROXY=1로 정상 익명 공개 REST만 읽었다. 공개 공고4건(4824,4828,4878,4879), canonical행4건 모두 핀 있음, 미확정3건. 조회 당시4982는 이 공개 집합에 반환되지 않았다. 비공개/삭제 여부는 추정하지 않았다.
- 기존4878좌표는 원래 성 polygon 안이지만 박닌시 대표점과 다르다. 현재 확보한 자료로 해당 임의 좌표의 도시 경계 소속은 증명할 수 없어 checker가 실패로 남긴다. 도시 밖이라는 주장이 아니다.
- 운영www.viecganban.vn는 ERR_TUNNEL_CONNECTION_FAILED로 실제 메인/상세 브라우저 검증 불가. 운영 수정·배포·전체 검사 통과·연속 통과 수는 주장하지 않는다.
- api.github.com CONNECT403이므로 PR 없이 브랜치 push만 한다. Claude가 PR 생성 후 정상 CI/봇 병합/migrations-apply/배포 확인을 이어가야 한다. 새 Public administrative pin verification workflow는 정상 운영 배포 검증 성공 뒤 모든 공개 main/detail/canonical점과 원문 행정구역을 대조하며 미증명도 실패로 보고한다.
- migration은 현재 공개 공고와 정상 future write를 처리한다. 과거 자동 숨김 기록은 기존 hook의 map_r1_mark_located 경로가 prev_active와 admin_hidden을 검사해 복원한다. 이 작업에서 개별 공고 재공개나 맹목적 active=true는 하지 않았다.

## 실패 원인 기록
기존 writer 소유권/CREATE제약으로 두 차례 migration 시험이 실패해 같은 수정 루프를 멈추고 보고했다. 트랜잭션 내부 임시 권한 후 정확한 기존 pg_auth_members 옵션/스키마 권한 복구를 검증하는 제한된 방식으로 수정했다. 기존 indexACL migration을 생략했던 시험 순서와 PG17 ADMIN-only membership 표현도 실제 fixture에 맞춰 교정했고, 최종 실제DB시험이 통과했다. 운영DB접근은 없었다.
