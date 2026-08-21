# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

집/회사 PC에서 동일한 GitHub 저장소와 작업 브랜치를 통해 Viecganban 작업을 이어갈 수 있도록 멀티-PC Git 흐름을 정리한다.

## 변경 내용

- 현재 PC 저장소를 `KHOAILANG0926/jobi-app` remote로 검증하고 최신 remote branch를 fetch했다.
- `master`는 통합 기준, `production`은 사용자 승인 후 운영 반영 기준, `work/*`는 승인 전 동기화 가능한 작업 브랜치로 구분했다.
- `IMPLEMENTED / VERIFIED / APPROVED / SYNCED / DEPLOYED` 상태를 서로 독립적으로 기록하도록 `AGENTS.md`와 `CLAUDE.md`를 갱신했다.
- AI가 수행 가능한 터미널/Git/파일 작업을 사용자에게 요구하지 않고, 새 PC에서 remote와 handoff를 먼저 복원하도록 규칙을 추가했다.
- 이번 작업에서는 Home UI 코드를 수정하지 않았다.

## 테스트 결과

- `origin`: `https://github.com/KHOAILANG0926/jobi-app.git` 확인.
- 기준 branch: `master`와 `origin/master`가 `d2477c3`로 일치.
- Production branch: `origin/production`은 `d7b5846`.
- Home UI 소스 변경 없음과 `AGENTS.md`·`CLAUDE.md`의 5단계 상태 규칙 일치를 확인했다.

## 발견된 문제

- 집 PC에만 남아 GitHub에 push되지 않은 변경은 이 PC와 GitHub에서 복원하거나 존재 여부를 확인할 수 없다.
- 따라서 집 PC 미Push Home UI 작업은 “확인 불가”이며, GitHub에 있다고 추정하거나 재구현하지 않는다.
- GitHub에서 복원 가능한 마지막 Home 관련 구현은 `d7b5846`이고, 이후 `d2477c3`은 상태 규칙 문서 변경이다.

## 다음 결정사항

1. 현재 문서 변경을 `work/multi-pc-sync`에 commit/push해 `SYNCED` 상태로 만든다.
2. 다른 PC에서는 `origin/work/multi-pc-sync`를 확인하고 이 문서부터 읽은 뒤 작업을 이어간다.
3. Home UI 후속 변경은 현재 작업에서 수행하지 않는다.
4. Production 반영은 사용자 승인 이후 별도 단계로 수행한다.
