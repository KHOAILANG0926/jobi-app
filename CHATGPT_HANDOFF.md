# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 **진행상황 전달용**입니다. 전체 구조 기준은 `VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.
작업할 때마다 아래 내용을 최신 상태로 갱신합니다(과거 이력 누적 X, 최신 스냅샷 유지).

---

## 현재 작업
`applications`(지원) 기능을 실제 운영 가능한 상태로 만드는 작업. `message_threads`/`messages`/`interviews`는 이번 작업에서 손대지 않음.
**DB에는 아직 아무것도 실행하지 않은 상태** — SQL 준비 + 코드 수정까지만 완료, 지시대로 실행 전에 멈춤.

## 변경 내용
- **`supabase/migrations/0001_applications.sql`**: 권한 모델 강화 반영(아직 미실행)
  - INSERT: `seeker_id = auth.uid()` + `status`는 항상 `'submitted'`로 고정 + `employer_id`가 실제 `local_jobs.employer_id`와 일치해야 함(위조 방지)
  - UPDATE: 해당 공고 기업(`employer_id = auth.uid()`)만, `status`는 `reviewing/interview/accepted/rejected` 중으로만(USING+WITH CHECK 둘 다 적용)
  - DELETE: 구직자 본인(`seeker_id = auth.uid()`)만 — "지원 취소" 용도
- **`src/lib/applicationsStorage.ts`**: `cancelApplication(id)` 함수 신규 추가(DELETE 기반 취소)
- **`src/pages/Profile.tsx`**: 구직자 지원 상태 `<select>` 제거 → 읽기전용 배지로 교체, "Hủy đơn"(지원 취소, confirm 확인 포함) 버튼 추가
- **`src/pages/EmployerDashboard.tsx`**: 상태 변경 `<select>`에서 `submitted`를 선택 가능한 타깃 옵션에서 제외(현재 상태가 submitted일 때만 비활성 옵션으로 표시)

## 테스트 결과
- `npx tsc --noEmit`, `npm run build` 통과(기존 무관 에러 1건만 존재)
- 브라우저 스모크 테스트: 신규 구직자 계정으로 Profile "Việc đã ứng tuyển" 탭 정상 렌더(빈 상태), 신규 기업 계정으로 EmployerDashboard "Ứng viên" 탭 정상 렌더(빈 상태) — 콘솔에 새로운 런타임 에러 없음, `applications`/`interviews` 테이블 미생성으로 인한 기존 PGRST205 에러만 존재(예상된 상태)
- **`applications` 테이블이 아직 없어 실제 지원 생성→상태변경→취소 전체 플로우는 테스트 못 함** — DB 반영 후 재검증 필요
- 테스트 계정 전부 정리 완료, 실서비스 데이터 영향 없음

## 발견된 문제
없음 — 이번 작업 범위에서 새로 발견된 문제 없음.

## 다음 결정사항
1. `supabase/migrations/0001_applications.sql`을 Supabase SQL Editor에서 실행할지
2. 실행 후 실제 지원 생성 → 기업 상태변경 → 구직자 취소 전체 플로우 재검증 필요
3. `message_threads`/`messages`/`interviews`는 언제 이어서 진행할지
