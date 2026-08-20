# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 진행상황 전달용 최신 스냅샷입니다. 전체 구조 기준은
`VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.

## 현재 작업

`applications` migration을 운영 Supabase에 적용하고, 격리된 구직자·기업
테스트 계정과 전용 공고로 실제 지원/RLS 흐름을 검증했다.

## 변경 내용

- `0001_applications.sql`의 확정 정책이 운영 DB에 적용됐다.
- `VIECGANBAN_STRUCTURE_BASELINE.md`를 applications 동작 상태로 갱신했다.
- E2E용 application과 공고는 테스트 종료 시 삭제했으며 활성 테스트 공고는 0건이다.
- 페이지/PDF 지연 로딩과 게스트 applications 조회 차단은 커밋 `ec81157`에 반영돼 있다.

## 테스트 결과

- applications E2E/RLS 세부 검증: 18/18 통과
- 지원 생성 최초 상태 `submitted`: 통과
- 중복 지원 unique 차단(`23505`): 통과
- 기업 지원자 조회: 통과
- 구직자 상태 변경 차단: 통과
- 기업 reviewing → interview → accepted → rejected 변경: 전부 통과
- 각 단계 구직자 상태 조회: 전부 통과
- 기업의 보호 열 변경 차단(`42501`): 통과
- 구직자 지원 취소: 통과
- 크롤링 공고 내부 지원 차단(`42501`): 통과

## 발견된 문제

- Supabase 클라이언트 권한에는 Auth 사용자 삭제 API가 없어 E2E 전용 Auth 계정은
  자동 삭제하지 못했다. 계정은 가짜 `example.com` 주소와 `test_account=true`
  메타데이터만 사용하며 실제 개인정보는 포함하지 않는다.
- `message_threads`/`messages`/`interviews`는 아직 운영 DB에 적용되지 않았다.

## 다음 결정사항

1. 다음 확정 기술 작업: `0002_messages.sql`이 기존 1:1 스레드 설계와 소유권
   정책을 안전하게 강제하는지 최종 검토하고 최소 보강한다.
2. messages 적용·E2E 완료 후 `0003_interviews.sql`을 동일 절차로 진행한다.
3. Supabase Dashboard에서 `test_account=true`인 E2E Auth 계정을 정리한다.
