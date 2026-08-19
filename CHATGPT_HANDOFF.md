# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 **진행상황 전달용**입니다. 전체 구조 기준은 `VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.
작업할 때마다 아래 내용을 최신 상태로 짧게 갱신합니다(과거 이력 누적 X, 최신 스냅샷 유지).

---

## 현재 작업
크롤링 공고(`local_jobs.employer_id = NULL`)의 "고아 지원(orphaned application)" 문제 수정.
`applications` 테이블은 아직 DB에 생성되지 않은 상태(SQL만 준비됨, 실행 대기 중).

## 변경한 내용
- **`src/pages/PostJob.tsx`**: `useAuth()` 추가, 공고 등록 시 `employerId: user?.id` 전달 (이전엔 아예 안 보내서 항상 NULL 저장되던 버그 수정)
- **`src/context/JobsContext.tsx`**: `fetchJobs()`의 `select()` 컬럼 목록에 `employer_id` 추가 (DB엔 저장되는데 앱이 다시 안 읽어오던 버그 수정)
- **`src/pages/JobDetail.tsx`**: "Ứng tuyển ngay" 버튼 동작을 `job.employerId` 기준으로 분기
  - `employerId` 있음 (기업 직접등록 공고) → 기존 내부 지원 흐름 그대로
  - `employerId` 없음 (크롤링 공고) + `description`이 원본 URL인 경우 → 버튼이 "Xem tin gốc & Ứng tuyển ↗"로 바뀌며 새 탭으로 원본 이동
  - `employerId`도 없고 원본 URL도 없음 → 지원 요청 생성 안 함, Toast로 안내만
- **DB 스키마**: `local_jobs.employer_id uuid references auth.users(id)` 컬럼 추가 완료(nullable, 기존 362건+ 전부 NULL 유지, 실행됨)

## 테스트 결과
- 컬럼 추가 후 실제 테스트 계정으로 기업 공고 등록 → `employer_id` DB 저장 확인 → EmployerDashboard "내 공고"에 정상 조회 확인
- 크롤링 공고(예: id 3248)에서 지원 버튼 클릭 → Toast 안내만 뜨고 `applications` 테이블에 어떤 요청도 안 감(콘솔/네트워크로 확인)
- 기업 직접등록 공고에서 지원 버튼 클릭 → 기존과 동일하게 내부 지원 시도(현재는 `applications` 테이블이 없어서 실패하지만, 이건 오늘 수정과 무관한 기존 상태 — 회귀 아님)
- `npx tsc --noEmit`, `npm run build` 통과(기존 무관 에러 1건만 존재: AdminDashboard.tsx의 CATEGORY_LABELS office 누락)
- 테스트로 만든 계정/공고는 전부 정리 완료, 실서비스 데이터 영향 없음

## 발견된 문제
- **`applications`/`message_threads`/`messages`/`interviews` 4개 테이블이 아직 DB에 없음** — 관련 SQL(`supabase/migrations/0001~0003`)은 준비돼 있으나 미실행. 지원 상태 권한(구직자/기업 각각 뭘 바꿀 수 있는지)에 대한 RLS 강화안까지 설계는 끝났고 실행만 안 한 상태.
- `local_jobs` 자체의 RLS 정책 내용은 DB 직접 접근 권한이 없어 확인 불가.
- 그 외 알려진 항목은 `VIECGANBAN_STRUCTURE_BASELINE.md` 11·12번 참고.

## 다음에 결정할 사항
1. `applications` 테이블 생성 SQL(직전에 논의한, employer_id 검증 + 지원취소/상태변경 권한 분리 버전)을 지금 실행할지
2. 실행한다면 `message_threads`/`messages`/`interviews`도 이어서 순서대로 진행할지, 아니면 `applications`만 먼저 운영해볼지
3. Profile.tsx(구직자)/EmployerDashboard.tsx(기업)의 상태 변경 UI를 논의했던 권한 모델대로 최소 수정할지 여부
