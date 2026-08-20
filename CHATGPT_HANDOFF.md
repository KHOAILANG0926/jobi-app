# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 진행상황 전달용 최신 스냅샷입니다. 전체 구조 기준은
`VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.

## 현재 작업

`applications` migration 적용 이후 실제 인증 테스트를 재개하려 했으나 현재
실행 환경에 구직자·기업 인증 세션이 없어 RLS 시나리오는 대기 중이다. 그동안
빌드의 대형 초기 번들 경고와 게스트의 불필요한 applications 조회 오류를 수정했다.

## 변경 내용

- 모든 페이지를 기존 라우트와 가드를 유지한 채 페이지 단위로 지연 로딩한다.
- CV PDF 모듈을 다운로드 시점에만 로드하고 `html2canvas`/`jspdf`를 별도
  vendor 청크로 분리했다.
- 게스트 상태에서는 `NotificationProvider`와 `Profile`이 인증 전용
  `applications` 조회·구독을 실행하지 않도록 수정했다.
- `0001_applications.sql`은 커밋 `b228bb6`에서 확정 정책으로 보강됐다.

## 테스트 결과

- 공개 홈, 프로필, 지도, 관리자 로그인 리다이렉트, 공고 상세 라우트 스모크: 통과
- 게스트 홈/프로필의 브라우저 콘솔 `loadApplications` 오류: 0건
- 초기 메인 JS 청크: 1,329.44 kB → 412.95 kB
- production build의 500 kB 초과 청크 경고: 해소
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- applications 7개 인증/RLS 시나리오: 구직자·기업 인증 세션 부재로 실행 대기

## 발견된 문제

- 최신 migration은 anon 권한을 의도적으로 제거하므로 anon REST의 `PGRST205`만으로
  테이블 미생성을 판단할 수 없다. 인증된 세션으로 확인해야 한다.
- 현재 Codex 브라우저에는 Supabase 대시보드 및 앱 테스트 계정 로그인 세션이 없다.
- `message_threads`/`messages`/`interviews` 검증은 applications 완료 후 진행한다.

## 다음 결정사항

1. 최우선: 기존 구직자·기업 테스트 계정으로 로그인해 지원 생성, 중복 차단,
   기업 조회/상태 변경, 구직자 읽기/취소, 크롤링 공고 차단 7개를 검증한다.
2. applications 검증이 끝난 뒤 `0002_messages.sql` 정책을 최종 검토한다.
3. 이어서 `0003_interviews.sql` 정책을 검토하되, 운영 DDL 적용 전 영향 범위를
   다시 확인한다.
