# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

이전 승인분(브랜드 DB 전환, 메가메뉴 재설계, 급여 로직, 지원 경로, 기업/관리자
권한 오류 구분, 관리자 통계 합계)에 이어 **"Astra 조사" 후속 8개 항목을 전부
완료**했고, 그중 항목 2의 남은 결정사항이었던 **"기업이 자기 공고 지원자의
제출 정보(이름·전화·CV)만 보는 기능"도 migration/RLS 포함해 구현 완료**했다.

**보류(미실행, 사용자 결정 필요)**:
- **korea_jobs 구조 통합** — 한국 채용정보(`korea_jobs`)는 `employer_id`
  자체가 없는 순수 크롤링 테이블이라 지원서/메시지/면접 흐름에 구조적으로
  들어갈 수 없음. 현행 유지(외부 링크 연결)~전체 통합(큰 구조 변경)까지
  선택지 4가지를 조사·정리만 했고 실행 안 함.
- **공개 구직자 등록·인재검색(제안) 기능** — 기업이 지원자 풀과 무관하게
  구직자를 검색·제안하는 기능은 이번 CV 열람 기능 구현 시 사용자 지시로
  명시적으로 범위 제외됨. 별도 신규 기능이라 착수하지 않음.

commit 1건으로 이번 라운드 변경을 묶어 생성했고, **push/Vercel 배포는 하지
않았다**(아래 "변경 내용" 참고).

## 변경 내용

**Astra 후속 8개 항목**(전부 완료 — 각 항목 원인/수정/검증 세부 내역은 이
커밋의 diff와 이전 세션 로그 참고, 이 문서는 최신 스냅샷만 유지):
1. 관리자 통계가 죽은 localStorage 대신 실제 Supabase 데이터를 쓰도록 수정
   ([AdminDashboard.tsx](src/pages/AdminDashboard.tsx)).
2. 지원서 저장 시 이름/전화가 진입 화면에 따라 달라지던 버그, 프로필 미입력
   시 가짜 기본값("Nguyễn Văn A")이 실제 지원서에 들어가던 버그 수정
   ([JobDetail.tsx](src/pages/JobDetail.tsx), [useApply.ts](src/components/useApply.ts)).
3. 구직자 프로필 화면에서 메시지함이 항상 크래시하던 버그(Realtime 채널명
   충돌) 수정, 근거 없는 가짜 "입력 중..." 표시 제거
   ([MessagesInbox.tsx](src/components/MessagesInbox.tsx), [messagesStorage.ts](src/lib/messagesStorage.ts), [interviewStorage.ts](src/lib/interviewStorage.ts)).
4. 존재하지 않는 푸터 링크 4개 중 3개 제거, 1개는 기존 이메일로 연결
   ([Layout.tsx](src/components/Layout.tsx)).
5. DB 조회 실패 시 가짜 데모 공고 10개가 실제 데이터처럼 보이던 버그 수정,
   실패 상태 배너 추가 ([JobsContext.tsx](src/context/JobsContext.tsx), [Home.tsx](src/pages/Home.tsx)).
6. 지도 페이지의 위치 미지원 브라우저 에러 문구 누락 수정
   ([MapView.tsx](src/components/MapView.tsx)); 나머지 위치 상태 구분은 이전 세션에 이미 완료 확인.
7. `/viec-lam/goi-y` 딥링크 이슈 — 현재 코드베이스에서 재현 안 됨, 수정 없음.
8. `korea_jobs` 구조 조사 — 위 "보류" 참고, 코드 변경 없음.

**기업의 지원자 CV 열람 기능**(신규 구현):
- Migration [`20260916090000_application_cv_snapshot.sql`](supabase/migrations/20260916090000_application_cv_snapshot.sql)
  (Production 적용 완료) — `applications`에 `cv_snapshot`(jsonb)/
  `cv_photo_snapshot_path`(text) 추가. INSERT 트리거가 지원 순간
  `user_cvs.cv_data`를 스냅샷으로 복사(이후 프로필을 고쳐도 안 바뀜 —
  구직자 쪽엔 UPDATE 정책이 없어 DB 구조로 불변성 보장). CV 사진은
  `cv-photos/applications/<jobId>/<seekerId>/...`라는 새 불변 경로로 지원
  시점에 복사, storage RLS 신규 정책 2개(본인 쓰기 / 소유 기업+본인만
  읽기)만 추가 — 공개 URL 없음.
- `applications` 테이블 자체는 기존 RLS(`employer_id = auth.uid()`)가 이미
  "자기 공고만" 규칙이 있어 이 컬럼들에 별도 RLS 불필요.
- [accountCvStorage.ts](src/lib/accountCvStorage.ts)(`snapshotCvPhotoForApplication`/`loadApplicationCvPhoto` 추가),
  [applicationsStorage.ts](src/lib/applicationsStorage.ts)(스냅샷 필드 전달),
  [EmployerDashboard.tsx](src/pages/EmployerDashboard.tsx)(지원자 목록에 "Xem CV" 토글 — 이름/전화 + CV
  스냅샷만 표시, 다른 지원 이력·전체 프로필 검색 없음).

## 테스트 결과

- `npx tsc --noEmit` / `npm run build` / `npm test`(5개 파일, 34개 테스트)
  전부 통과.
- Production DB에 대해 실제 `auth.uid()`를 흉내내(`set_config` +
  `set local role authenticated`) RLS를 진짜로 태우는 방식으로 직접 검증:
  서로 다른 두 기업 계정 각각 자기 지원자만 보이고 상대방 몫은 안 보임,
  `cv_snapshot` 트리거 정상 동작, CV 사진도 소유 기업+본인만 조회 가능(무관한
  기업 2명은 전부 차단) — 테스트 데이터는 전부 롤백/정리해 운영 데이터에
  흔적 없음.
- 로컬 개발 서버에서 React Fiber 상태 주입 + `window.fetch`/`XMLHttpRequest`
  가로채기로 메시지함 크래시 재현/수정 확인, DB 조회 실패 시 에러 배너 확인,
  지도 미지원 브라우저 에러 문구 확인 등 화면 단위 검증도 각 항목마다 수행.

## 발견된 문제

- `applications_insert` RLS의 기존 조건 중 `l.employer_id = l.employer_id`
  (자기 자신과 비교 — 항상 참)는 원래 그 공고의 실제 소유자와 일치하는지
  검증하려던 것으로 보이는데 지금은 사실상 아무 것도 안 걸러냄. 이번
  마이그레이션과 무관한 기존 정책이라 손대지 않음 — 별도 확인 필요.
- `korea_jobs`는 `employer_id`가 없어 지원/메시지/면접 통합이 구조적으로
  불가능(위 "보류" 참고).

## 다음 결정사항

1. korea_jobs 구조 통합 방향 선택(현행 유지 기본값) 또는 보류 유지.
2. 공개 구직자 등록·인재검색 기능 신규 착수 여부.
3. `applications_insert`의 `l.employer_id = l.employer_id` 조건 수정 여부.
4. 이번 커밋 이후 push/Vercel 배포는 사용자 지시 있을 때 진행.
