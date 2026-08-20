# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 진행상황 전달용 최신 스냅샷입니다. 전체 구조 기준은
`VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.

## 현재 작업

`applications` 운영 E2E를 완료하고, 다음 확정 작업인 messages 흐름의 migration과
프론트 오류 처리를 기존 1:1 스레드 설계 안에서 최소 보강했다.

## 변경 내용

- `0002_messages.sql`에서 기업 직접등록 공고만 스레드를 만들 수 있도록 공고
  `employer_id` 일치와 NOT NULL을 강제했다.
- 스레드 UPDATE 권한을 읽음 플래그와 `updated_at` 열로 제한해
  `job_id/seeker_id/employer_id` 위조를 차단했다.
- 메시지는 스레드 당사자만 자신의 역할로 전송하며 빈 본문은 DB에서 차단한다.
- 정책과 realtime 등록을 재실행 가능하게 만들었다.
- 크롤링 공고에서는 인앱 메시지 CTA를 숨긴다.
- 구직자/기업 메시지 전송 함수가 성공 여부를 반환하고, 실패 시 성공 UI를 표시하거나
  작성 내용을 잃지 않도록 수정했다.

## 테스트 결과

- applications E2E/RLS: 18/18 통과
- applications 테스트 application/활성 공고 정리: 완료(활성 테스트 공고 0건)
- messages migration 정책 정적 검증 7개 항목: 통과
- `npx tsc --noEmit`: 통과
- messages 운영 E2E: `0002_messages.sql` 미적용으로 대기

## 발견된 문제

- 운영 DB에 `message_threads`와 `messages`가 아직 없다.
- Supabase Auth 클라이언트에는 사용자 삭제 권한이 없어 E2E 전용 Auth 계정은
  Dashboard에서 `test_account=true` 기준으로 정리해야 한다.
- `interviews`도 아직 운영 DB에 적용되지 않았다.

## 다음 결정사항

1. 운영 Supabase SQL Editor에서 최신 `supabase/migrations/0002_messages.sql`
   전체를 실행한다.
2. 격리 계정과 전용 공고로 스레드 생성·양방향 전송·역할 위조 차단·소유권 열 변경
   차단·크롤링 공고 차단·읽음 플래그를 E2E 검증한다.
3. messages E2E 완료 후 `0003_interviews.sql` 검토와 최소 보강을 진행한다.
