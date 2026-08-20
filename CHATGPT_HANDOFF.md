# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

messages 운영 E2E를 완료하고, 다음 확정 작업인 interviews의 SQL/RLS와 저장 계층을 기존 기업 주도 일정 생성 설계 안에서 보강했다.

## 변경 내용

- `0002_messages.sql`을 운영 DB에 적용하고 CLI migration 이력을 실제 상태(`0001/0002/0004`)와 맞췄다.
- messages 실제 E2E에서 직접등록 공고 스레드, 양방향 송수신, Realtime, 타인 접근 차단, 소유권·역할 위조 차단, 빈 본문·크롤링 공고 차단을 검증했다.
- 실패 응답 시 오류 표시와 작성 내용 보존, 크롤링 공고 메시지 CTA 숨김을 실제 브라우저로 검증했다.
- `0003_interviews.sql`은 기업 소유 직접등록 공고의 실제 application 조합만 일정 생성·수정 가능하게 보강하고 소유권 열 UPDATE를 차단했다.
- `scheduleInterview`는 보호 열까지 다시 쓰는 upsert 대신 기존 일정 조회 후 일정 필드만 갱신하도록 변경했다.
- 지원 상태 변경 실패를 boolean으로 전달해 면접 일정 모달이 잘못된 성공 메시지를 표시하지 않도록 수정했다.
- Supabase CLI 임시 연결 메타데이터가 커밋되지 않도록 `supabase/.temp/`를 ignore 처리했다.
- 합성 E2E 데이터는 사용자 SQL 실행 후 공고·스레드·메시지·Auth 계정 잔여가 모두 0임을 확인했다.
- 기업 세션이 지원자 목록을 구직자 상태 알림으로 잘못 처리하던 조회를 차단했다.
- 게스트·기업 세션의 Profile에서 구직자 전용 applications/messages/interviews 조회와 Realtime 구독이 시작되지 않도록 역할 가드를 추가했다.
- 알림·확인한 지원 상태·마감 알림 localStorage 키를 사용자 ID(게스트 포함)별로 분리해 같은 브라우저에서 계정 전환 시 이전 계정 알림이 노출되지 않도록 했다.
- 기업 메시지 INSERT 성공 후 스레드 읽음 메타데이터 갱신만 실패한 경우 전송 실패로 오인해 재시도 중복 메시지가 생기지 않도록 성공 결과를 유지한다.

## 테스트 결과

- messages 운영 E2E/RLS/Realtime/UI: 22/22 통과
- interviews 정적 정책 검증: 통과
- interviews 상태 변경 실패 전파 회귀 검증: 통과
- 알림 역할 가드 회귀 검증: 통과
- 메시지/Profile 역할 가드 회귀 검증: 통과
- 게스트 `/ho-so` 보호 API 요청: 0건(브라우저 검증)
- 알림 계정 scope 정적 검증 및 브라우저 localStorage 격리: 통과
- 기업 메시지 저장 완료 후 결과 전파 회귀 검증: 통과
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- messages E2E 합성 데이터 정리 완료. 마지막 검증에서 공고·스레드·메시지·Auth 계정 잔여가 모두 0이다.
- `0003_interviews.sql`은 아직 운영 DB에 적용되지 않아 실제 E2E를 실행할 수 없다.
- 지정된 미추적 HTML 파일은 건드리지 않았다.

## 다음 결정사항

1. 원격 DB 작업이 다시 허용되는 시점에 최신 `0003_interviews.sql`을 적용하고 기업 생성·재예약·구직자 조회·Realtime·타인/소유권/지원관계 위조 차단을 실제 E2E 검증한다.
2. 그 전까지는 applications/messages/interviews 채용 흐름의 로컬 오류 처리와 불필요한 인증 조회를 계속 점검한다.
