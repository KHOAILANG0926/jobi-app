# 봇 병합 API 거절 사유 분류(Lee 2026-11-23 1순위: 일시 오류만 재시도, 영구 차단은 정확히 기록). 입력 = 서버가 돌려준 오류 글(문자열), 출력 = "permanent" | "transient" | "unknown".
#  permanent = 같은 head로는 다시 해도 같다(충돌·필수 검사/승인 대기·보호 규칙) → 재시도 예약 안 함, 사유만 기록(새 커밋·승인·검사 결과가 바뀌면 다음 정기 실행이 다시 판정)
#  transient = 서버 일시 오류·그 사이 기준/head가 바뀜 → 한도 안에서만 다시 확인
#  unknown   = 위 어디에도 안 맞음 → 원문 그대로 기록, 재시도는 정기 실행에 맡김(새 재시도 예약 없음)
ascii_downcase as $m
| if ($m | test("merge conflict|required status check|approving review is required|code owner|waiting on|protected branch|branch policy|not mergeable|is a draft")) then "permanent"
  elif ($m | test("head branch was modified|base branch was modified|http 50[0-4]|timed out|timeout|temporarily|rate limit|secondary rate|connection")) then "transient"
  else "unknown" end
