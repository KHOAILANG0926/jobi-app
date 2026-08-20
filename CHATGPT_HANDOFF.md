# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 **진행상황 전달용**입니다. 전체 구조 기준은 `VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.
작업할 때마다 아래 내용을 최신 상태로 갱신합니다(과거 이력 누적 X, 최신 스냅샷 유지).

---

## 현재 작업
`applications`(지원) 기능 재점검 — 기업 직접등록 공고만 내부 지원 허용, 구직자는 상태 직접
변경 불가·취소만 가능, 기업만 reviewing/interview/accepted/rejected 변경 가능이라는 확정
정책을 코드가 실제로 만족하는지 검증. (참고: `.github/workflows/claude-auto.yml`/`CLAUDE.md`
자동화 준비는 직전 작업에서 완료·push됨 — 커밋 `89d0b22`.)
**DB에는 여전히 아무것도 실행되지 않은 상태.**

## 변경 내용
이번 턴에는 코드 변경 없음 — 요청한 5개 항목(SQL/Profile.tsx/취소 기능/EmployerDashboard
옵션/UI 구조 유지)이 이전 세션에서 이미 전부 반영되어 있음을 파일 직접 확인으로 검증만 함:
- `supabase/migrations/0001_applications.sql`: 요청한 정책 그대로(seeker/employer 소유권,
  status 위조 방지, submitted로 되돌리기 금지) — 미실행 상태 유지
- `src/pages/Profile.tsx`: 상태 `<select>` 없음, 읽기전용 배지 + confirm 포함 "Hủy đơn"
  버튼으로 `cancelApplication` 호출
- `src/pages/EmployerDashboard.tsx`: 상태 옵션이 `reviewing/interview/accepted/rejected`만
  선택 가능(현재 상태가 submitted일 때만 비활성 옵션으로 표시)
- `src/pages/JobDetail.tsx`: `job.employerId` 없는(크롤링) 공고는 `canApplyInternally=false`로
  내부 지원 자체를 막고 원문 링크/안내로 분기 — 기존대로 유지됨

## 테스트 결과
- `applications` 테이블이 아직 DB에 없음을 anon 키로 라이브 재확인
  (`PGRST205: Could not find the table 'public.applications'`)
- `npx tsc --noEmit`, `npm run build` 둘 다 **실패** — 원인은 `src/pages/AdminDashboard.tsx`의
  `CATEGORY_LABELS`에 `office` 키 누락(`TS2741`). applications 코드와 무관하며, 이전 세션들에서도
  반복 발견되었으나 매번 범위 밖으로 판단해 손대지 않은 기존 에러. 이번에도 수정하지 않음.

## 발견된 문제
`CATEGORY_LABELS`(`office` 키 누락, `src/pages/AdminDashboard.tsx:56`)가 `tsc -b` 단계에서
전체 `npm run build`를 막고 있음 — applications와 무관하지만 지금 저장소 전체가 빌드
불가 상태라는 뜻이므로 다음 작업 전 수정 여부 결정 필요.

## 다음 결정사항
1. `CATEGORY_LABELS`에 `office` 키를 추가해 빌드를 통과시킬지(범위 밖이라 매번 보류해왔음)
2. `supabase/migrations/0001_applications.sql`을 Supabase SQL Editor에서 실행할지
3. 실행 후 지원 생성 → 기업 상태변경 → 구직자 취소 전체 플로우 실사용 재검증 필요
4. `message_threads`/`messages`/`interviews`는 언제 이어서 진행할지
