# HANDOFF — 2026-11-27 (Claude) · 이슈 #1140 Muaban 읽기 시험
## 1. 현재 작업
- 이슈 #1140: Chợ Tốt 읽기 시험(crawler/chotot_probe.py)을 본뜬 Muaban 읽기 시험(저장·키·정기 실행 없음). 확인 3가지 = ① VPS에서 로그인 없이 박닌 목록 ② 상세의 제목·회사·주소·본문 ③ 전화번호 노출/가림.
## 2. 변경 내용
- 추가: crawler/muaban_probe.py(목록 1 + 상세 2회, 2~4초 간격, 차단 문구·403·429면 즉시 중단, 번호는 끝 3자리만 출력), crawler/test_muaban_probe.py(네트워크 없는 순수 함수 시험).
- 하지 못한 것: 수동 실행 워크플로(.github/workflows)는 .github 변경 금지 규칙으로 이 작업에서 만들지 않음 — 사람 세션에서 crawl-chotot-probe.yml을 본떠 추가 필요(같은 실행기·contents: read·workflow_dispatch만, 실행 명령 python3 -u muaban_probe.py).
- 이전 HANDOFF 본문은 WORK_LOG.md 끝으로 옮김.
## 3. 테스트 결과
- 이 실행에서는 시험·tsc·build를 실행하지 못함: sandbox-run.sh 호출과 python 직접 실행이 도구 권한 차단(작업 디렉터리 밖 경로·승인 필요). [미확인] 게시 단계·PR 검사에서 확인 필요.
- 실제 muaban.net 응답은 확인하지 않음(네트워크 요청 0회). 목록 주소(/viec-lam/bac-ninh)·__NEXT_DATA__ 구조는 추정이며 실제 실행 결과로 정정해야 함.
## 4. 발견된 문제
- 워크플로 파일 부재로 작업자가 workflow_dispatch로 실행할 수 없음(위 2). 로그인 열쇠는 이 단계에서 필요 없음 — 전화번호가 가려져 있으면 그때 별도 이슈로 대표 결정.
## 5. 다음 결정사항
- Lee/사람 세션: muaban probe 워크플로 추가(.github) 승인·작성 → 작업자가 workflow_dispatch 실행 → 결과를 #701 「다른 수집원」과 #1140에 기록. 소스 순서 규정(Muaban → Chợ Tốt → Facebook → Vieclam24h) 유지.
