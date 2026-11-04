# HANDOFF — 11-04 아침: 최신 상세 틀 디자인·여러 직무 급여·위치 절차 (2026-11-04 07:35, Claude)

## 1. 현재 상태
- master(운영) 663dce4 = PR #447, Production READY, deploy-verify 41744451652 통과.
- 상세 화면: 최신 4칸 틀(.jd2-page--v2)만 새 디자인(상자 높이 내용만큼·간격 24px·연한 테두리·머리 급여 PC 26px/모바일 22px·상세요강 문서형·보험 짧은 표시). 여러 직무 급여 칸 = 직무 | 금액 두 칸(roleSalaryRows). KDA(sb-4824)·예전 3건(sb-4878·4879·4982)은 그대로(Lee: 앞으로 들어오는 것만).
- 공고: #5342 Joy Thái(JoyThai 브랜드·식당 분류), #5368 Bảo An VCC(위치 Google 링크로 관리자 확정), #5405 Tâm Hồ Nhất Hạch(Google 주소). 검사표 연속 통과 7/10.
- 위치: 공단 밖 공고 회사 이름 찾기(Goong → Google) 추가. Google 단계는 Vercel에 키가 없어 꺼져 있음(비교 41668349505 전부 not_configured). 절차: 원문에 도로 없으면 Google에서 회사 주소 글자 → 주소 칸 → VietMap·Goong 계산, 이미 올라간 공고는 관리자 위치 확정(수동 도구 admin-location-confirm.yml: 공고 번호 + Google 지도 링크, 링크는 /place/…/data=!3d…!4d… 전체).
- 등록 방식 결정(Lee 11-04): 공고는 모아서 PR 한 번에(건당 시간 단축), 등록 전 검사표를 미리 돌림.

## 2. 다음 할 일
1. Lee: Vercel(Production)에 GOOGLE_PLACES_API_KEY(Places API New) 등록 → 브랜치 ops/recheck-area-pins-google(다시 찾기 migration) PR.
2. Lee: FB 수집기 — 쿠키 재등록 또는 수집기를 베트남 IP/전용 계정으로(결정 대기). 그동안은 Lee Chrome에서 글을 읽어 등록.
3. 모바일에서 여러 직무 급여 두 칸·새 디자인 화면 확인. 검사표 '정확한 위치' 오표시, DB만 바뀐 병합 뒤 deploy-verify 미시작(vercel-deploy가 push일 때 '앱 변경 없음' 기록만 남김 — workflow_run/수동 실행 필요).

## 3. 필수 규칙 (이번 지적)
- 결과만 보고. 중간보고 금지. 끝나면 바로 "완료". 모르면 먼저 확인하고 말할 것(이미 있는 키·설정 확인 없이 요청 금지).
- 얘기 끝나기 전에 작업 시작 금지. 시킨 범위만(예: "앞으로 들어가는 것만" → 기존 공고 손대지 않음).
- 같은 얘기 반복 금지. 이미 정한 건 다시 묻지 말 것. 시간 추정은 실제 작업 기준으로.
- 데모 링크는 https://jobi-demo-mshw1895-6089s-projects.vercel.app/… (고정 주소. CLAUDE.md의 jobi-git-… 형식은 옛 것).
