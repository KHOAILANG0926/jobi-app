# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`Việc làm` 6개 서브메뉴(전체/저장/최근본/맞춤/추천/급구) 구현 후, "코드 경로상
안전"으로만 판단하고 실제 검증하지 않았던 3항목(모바일 메뉴 실제 터치, 계정
전환 시 저장 목록 분리, 급구+지역 필터)을 실제로 재현·검증 완료했다 — 계정
전환 항목은 재요청에 따라 데이터 계층 확인에서 **실제 저장한 공고 화면 + 실제
저장/해제 버튼**까지 포함하도록 한 번 더 강화 검증했다(`AuthContext`의 `user`
상태를 React 레벨에서 모의 전환, 운영 로그인/계정 생성 없음). 3항목 전부 통과.
상세 기준·검증 방법·결과는 [`docs/JOBS_MENU_BASELINE.md`](docs/JOBS_MENU_BASELINE.md)
§10 참고. 이번에 commit → master push → Vercel Production 배포까지 진행한다
(사용자 승인 완료, MANDATORY WORK MODE의 NORMAL 작업 흐름).

## 변경 내용

1. `Việc làm` 6개 메뉴 신규 구현(저장/최근본/맞춤/추천/급구 5개 신규 페이지,
   전체는 기존 Home 재사용) — 상세는 `docs/JOBS_MENU_BASELINE.md` §1~§8.
2. 검증 과정에서 발견한 실제 결함 3건 수정:
   - 모바일 드롭다운이 `.header-tabs__nav`의 overflow-x:auto로 인해 실제로
     안 보이던 결함 → `Layout.tsx`에서 모바일만 `createPortal`로 렌더링.
   - 급구 목록에 마감된 공고가 섞여 나오던 결함 → `UrgentJobsPage.tsx`에
     마감일 필터 추가.
   - 저장 목록 계정 scope 누락(`NotificationContext.tsx`가 `loadSavedJobIds()`를
     scope 없이 호출) → 수정.
3. 참고: 이 커밋에는 원격에 먼저 반영돼 있던
   [`37fcf27`](https://github.com/KHOAILANG0926/jobi-app/commit/37fcf27)
   (migration 0017 파일명을 운영 DB에 실제 적용된 버전에 맞춘 문서·마이그레이션
   정리 — DB는 이미 목표 상태였고 DDL은 실행하지 않음, 0017 블로커는 해소
   확인됨)가 fast-forward 병합되어 이미 포함돼 있다 — 이번 Việc làm 메뉴
   작업과 무관한 별도 세션 결과물이며 내용을 변경하지 않았다.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build` 전부 통과(수정마다 재실행), 배포 전
  최종 빌드도 통과.
- 모바일 메뉴: 실제 렌더링된 모바일 DOM에 진짜 `click` 이벤트를 디스패치해
  열기→1.5초 대기(자동 안 닫힘)→5개 신규 메뉴 링크 각각 선택→이동, 외부 탭
  닫힘까지 확인(OS 레벨 터치 시뮬레이션 툴은 자동화 환경 제약으로 사용 못함).
- 계정 전환 분리: React Fiber로 `AuthContext.setUser`를 찾아 `user` 상태를
  게스트→mock A→로그아웃→mock B로 모의 전환하며, 매 단계 실제
  `/viec-lam/sb-*` 저장 버튼과 실제 `/viec-lam/da-luu` 화면으로 확인. 저장
  해제도 실제 화면 버튼으로 검증. 결함 없음.
- 급구+지역 필터: React 내부 상태(`JobsProvider.setJobs`)에 로컬 테스트
  데이터 4건 주입(운영 DB 미접촉) — 수정 전 결함 재현, 수정 후 정상화, 지역
  선택·초기화·결과없음까지 확인.

## 발견된 문제

- 이번 작업으로 발견한 결함 3건은 전부 수정 완료 — 남은 미확인 항목 없음.
- 모바일 물리 기기 실제 육안 확인, 급구 필터의 실제 운영 데이터(urgent=true
  이면서 마감된 공고) 유입 후 재확인은 여전히 안 됨 — 데이터/환경이 없어서.

## 다음 결정사항

1. commit/push/Vercel 배포 완료 확인 후, 운영 사이트에서 6개 메뉴 연결만
   1회 확인(승인된 범위).
2. 실제 물리 모바일 기기에서의 최종 육안 확인은 필요 시 별도 진행.
3. migration 0017 블로커는 `37fcf27`로 해소 확인됨(위 참고). migration
   0020(admin_* EXECUTE 축소)은 여전히 별도 승인 대기 — Việc làm 메뉴
   작업과는 무관.
