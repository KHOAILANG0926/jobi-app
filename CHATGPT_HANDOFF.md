# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 진행상황 전달용 최신 스냅샷입니다. 전체 구조 기준은
`VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.

## 현재 작업

`applications` 지원 기능의 확정 권한 정책을
`supabase/migrations/0001_applications.sql`에 반영했다. 운영 Supabase에는
아직 `applications` 테이블이 없으며 REST 확인 결과는 `PGRST205`다.

## 변경 내용

- 기업 직접등록 공고(`local_jobs.employer_id IS NOT NULL`)만 내부 지원 가능하도록
  INSERT 정책을 강화했다.
- 최초 상태를 `submitted`로 제한하고 허용 상태 CHECK 제약을 추가했다.
- `employer_id`를 NOT NULL로 강제하고 공고 소유 기업과 일치하도록 검증한다.
- 기업은 `status`와 `status_history` 열만 UPDATE할 수 있고, 구직자는 자기
  지원을 DELETE로만 취소하도록 권한을 제한했다.
- 정책과 realtime 등록을 재실행 가능하게 만들고, 신규 DB의 migration 순서에서도
  `local_jobs.employer_id`가 먼저 존재하도록 보완했다.

## 테스트 결과

- migration 정책 정적 검증 8개 항목: 통과
- `npx tsc --noEmit`: 통과(종료 코드 0)
- `npm run build`: 통과(종료 코드 0, Vite production build 완료)
- 운영 DB 확인: `local_jobs` HTTP 200, `applications` HTTP 404/`PGRST205`
- 7개 실제 지원/RLS 시나리오: 테이블 미적용으로 실행 대기

## 발견된 문제

- 운영 프로젝트 `edhuesdnuxlbcfephutq`에 `applications` 테이블이 아직 없다.
- 기존 `0001`은 `employer_id = NULL`인 크롤링 공고 지원을 허용할 수 있었고,
  기업이 상태 외 열도 UPDATE할 수 있었다. 이번 변경으로 migration 파일은 수정됐다.
- `message_threads`/`messages`/`interviews`도 아직 DB에 적용되지 않았다.
- production build에 500 kB 초과 청크 경고가 있으나 빌드 실패 요인은 아니다.

## 다음 결정사항

1. 최우선: 운영 Supabase SQL Editor에서 최신
   `supabase/migrations/0001_applications.sql` 전체를 실행한다.
2. 적용 직후 구직자 생성, 중복 차단, 기업 조회/상태 변경, 구직자 읽기/취소,
   크롤링 공고 차단 등 7개 실제 시나리오를 검증한다.
3. applications 검증 완료 전에는 `0002_messages.sql`과
   `0003_interviews.sql`을 적용하지 않는다.
