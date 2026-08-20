# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 진행상황 전달용 최신 스냅샷입니다. 전체 구조 기준은
`VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.

## 현재 작업

`src/pages/AdminDashboard.tsx`의 `CATEGORY_LABELS`에서 누락된 `office`
카테고리 때문에 발생하던 TypeScript 빌드 차단 오류 1건을 수정했다.

## 변경 내용

- `CATEGORY_LABELS`에 기존 카테고리 정의 형식과 동일하게
  `office: '💼 Văn phòng'` 항목을 추가했다.
- 그 외 코드, UI, 구조는 변경하지 않았다.

## 테스트 결과

- `npx tsc --noEmit`: 통과(종료 코드 0)
- `npm run build`: 통과(종료 코드 0, Vite production build 완료)
- 빌드 결과에 500 kB 초과 청크 경고가 있으나 빌드 실패 요인은 아니다.

## 발견된 문제

- `applications`/`message_threads`/`messages`/`interviews` 4개 테이블이 실제
  Supabase DB에 아직 생성되지 않아 지원 → 메시지 → 면접 흐름은 미동작 상태다.
- `user_metadata.role` 기반 구직자/기업 구분은 서버 검증이 약하다. 현재 RLS는
  role이 아니라 `seeker_id`/`employer_id` 소유권 기준이라 영향은 제한적이다.
- Zalo 소셜 로그인 실제 인증 성공 여부는 확인되지 않았다.

## 다음 결정사항

1. 최우선: `supabase/migrations/0001_applications.sql`을 Supabase SQL Editor에서
   실행한 뒤 지원 생성 → 기업 상태 변경 → 구직자 취소 흐름을 검증한다.
2. 이후 `0002_messages.sql`, `0003_interviews.sql` 순서로 DB에 적용하고 각 흐름을
   검증한다.
3. 선택 사항: 대형 번들 청크 최적화와 Zalo 소셜 로그인 실인증 검증 여부를 결정한다.
