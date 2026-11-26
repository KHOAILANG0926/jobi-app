#!/usr/bin/env bash
# crawl-slot.sh·crawl-catchup.sh 시험 — 가짜 gh로 '오늘 자리' 판정·호출 여부·값을 확인한다(네트워크·열쇠 없음).
# 증명하는 것: ① 예약과 같은 자리·목록 위치(0=02:23, 10=08:23) ② 정기+보충 합쳐 자리당 하루 1번(20건 상한) ③ 동시 실행·늦게 도는 예약과 겹쳐도 중복 수집 없음
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
cat > "$D/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = workflow ]; then echo "workflow $*" >> "$D/calls"; [ -n "${FAIL_DISPATCH:-}" ] && exit 1; exit 0; fi
[ -n "${FAIL_RUNS:-}" ] && exit 1
case "$2" in *crawl.yml/runs*) cat "$D/runs.json";; *) exit 1;; esac
GH
chmod +x "$D/gh"
fail=0; TODAY=2026-11-26
# 실행 하나: 번호 제목목록위치 건수 상태 결론 생성시각
r() { printf '{"id":%s,"display_title":"채용공고 자동 크롤링 · 목록 위치 %s · %s건","status":"%s","conclusion":%s,"created_at":"%s"}' "$1" "$2" "$3" "$4" "$5" "$6"; }
runs() { local IFS=,; echo "{\"workflow_runs\":[$*]}" > "$D/runs.json"; }
slot() { D="$D" PATH="$D:$PATH" REPO=o/r GH_TOKEN=x TODAY_UTC=$TODAY CRAWL_SLOT_ME="${ME:-0}" bash "$ROOT/scripts/ci/crawl-slot.sh" taken "$1" >/dev/null 2>&1; echo $?; }
catchup() { : > "$D/calls"; D="$D" PATH="$D:$PATH" REPO=o/r GH_TOKEN=x GITHUB_STEP_SUMMARY=/dev/null NOW_UTC="$1" bash "$ROOT/scripts/ci/crawl-catchup.sh" >/dev/null 2>&1; echo $? > "$D/rc"; }
expect() { # 이름 실제 기대
  if [ "$2" = "$3" ]; then echo "통과: $1"; else echo "실패: $1 (실제 $2, 기대 $3)"; fail=1; fi
}
calls() { grep -c '^workflow' "$D/calls"; }
ok_ev() { # 이름 기대호출수 [기대문자열]
  local n; n=$(calls); local rc; rc=$(cat "$D/rc")
  if [ "$n" != "$2" ] || [ "$rc" != 0 ] || { [ -n "${3:-}" ] && ! grep -q -- "$3" "$D/calls"; }; then echo "실패: $1 (호출 $n, 종료 $rc)"; fail=1; else echo "통과: $1"; fi
}

# ── crawl-slot.sh: 자리 판정
runs;                                                                  expect "빈 날 → 두 자리 모두 빔" "$(slot 0)$(slot 10)" 11
runs "$(r 10 0 10 completed '"success"' ${TODAY}T03:10:00Z)";          expect "오늘 성공한 위치 0 → 0은 참·10은 빔" "$(slot 0)$(slot 10)" 01
runs "$(r 10 10 10 completed '"success"' ${TODAY}T03:10:00Z)";         expect "위치 10 성공 → 0은 빔·10은 참(10과 0을 혼동 안 함)" "$(slot 0)$(slot 10)" 10
runs "$(r 10 0 10 completed '"success"' 2026-11-25T03:10:00Z)";        expect "어제 성공은 오늘 자리를 채우지 않음" "$(slot 0)" 1
runs "$(r 10 0 10 completed '"failure"' ${TODAY}T03:10:00Z)" "$(r 11 0 10 completed '"cancelled"' ${TODAY}T04:00:00Z)"; expect "실패·취소 실행은 자리를 채우지 않음" "$(slot 0)" 1
runs "$(r 10 0 3 completed '"success"' ${TODAY}T03:10:00Z)";           expect "10건이 아닌 시험 실행은 세지 않음" "$(slot 0)" 1
runs "$(r 10 0 10 in_progress null ${TODAY}T03:10:00Z)";               expect "진행 중 실행은 자리를 채움(보충 쪽 시점)" "$(slot 0)" 0
runs "$(r 10 0 10 queued null ${TODAY}T03:10:00Z)";                    expect "대기 중 실행도 자리를 채움" "$(slot 0)" 0
# 동시 시작: 번호가 앞선 진행 중 실행만 센다 → 둘 다 건너뛰는 일이 없다
runs "$(r 10 0 10 in_progress null ${TODAY}T03:10:00Z)" "$(r 11 0 10 queued null ${TODAY}T03:10:01Z)"
ME=11 expect "나중 번호(11)는 앞선 진행 중(10)을 보고 건너뜀" "$(ME=11 slot 0)" 0
expect "먼저 번호(10)는 나중 번호(11)를 세지 않아 진행" "$(ME=10 slot 0)" 1
runs "$(r 10 0 10 completed '"success"' ${TODAY}T03:10:00Z)" "$(r 11 0 10 in_progress null ${TODAY}T12:00:00Z)"
expect "이미 성공한 실행이 있으면 번호와 무관하게 늦은 실행은 건너뜀" "$(ME=11 slot 0)" 0
FAIL_RUNS=1 expect "조회 실패 → 종료 2(부른 쪽이 정함)" "$(FAIL_RUNS=1 slot 0)" 2

# ── crawl-catchup.sh: 예약과 같은 자리·오프셋, 하루 20건 상한
runs;                                           catchup ${TODAY}T01:00:00Z; ok_ev "02:23 예약 전 → 부르지 않음" 0
runs;                                           catchup ${TODAY}T03:00:00Z; ok_ev "02:23 예약 뒤 유예(2h) 안 → 부르지 않음" 0
runs;                                           catchup ${TODAY}T05:00:00Z; ok_ev "위치 0 자리 비고 유예 지남 → 위치 0으로 1번(08:23 자리는 아직)" 1 "sample_offset=0"
grep -q "dry_run=true" "$D/calls" && grep -q "keep_for_save=true" "$D/calls" && grep -q "sample_limit=10" "$D/calls" && echo "통과: dry_run·보관·10건 고정" || { echo "실패: dry_run·보관·10건 고정"; fail=1; }
runs "$(r 10 0 10 completed '"success"' ${TODAY}T02:40:00Z)"; catchup ${TODAY}T05:00:00Z; ok_ev "오전 예약이 돌았고 오후는 아직 때 아님 → 부르지 않음" 0
runs "$(r 10 0 10 completed '"success"' ${TODAY}T02:40:00Z)"; catchup ${TODAY}T11:00:00Z; ok_ev "오전 예약 성공·오후(08:23) 누락 → 위치 10(앞 10건을 다시 받지 않음)" 1 "sample_offset=10"
runs "$(r 10 10 10 completed '"success"' ${TODAY}T08:40:00Z)"; catchup ${TODAY}T11:00:00Z; ok_ev "오후만 돌고 오전 누락 → 위치 0" 1 "sample_offset=0"
runs "$(r 10 0 10 completed '"success"' ${TODAY}T02:40:00Z)" "$(r 11 10 10 completed '"success"' ${TODAY}T08:40:00Z)"; catchup ${TODAY}T20:00:00Z; ok_ev "오늘 두 자리(20건) 모두 참 → 하루 상한, 부르지 않음" 0
runs "$(r 10 0 10 completed '"success"' ${TODAY}T02:40:00Z)" "$(r 11 10 10 in_progress null ${TODAY}T11:00:00Z)"; catchup ${TODAY}T11:30:00Z; ok_ev "보충이 이미 진행 중 → 다시 부르지 않음(운영 검사 동시 성공)" 0
runs "$(r 10 0 10 completed '"success"' 2026-11-25T02:40:00Z)" "$(r 11 10 10 completed '"success"' 2026-11-25T18:41:00Z)"; catchup ${TODAY}T05:00:00Z; ok_ev "어제 20건은 오늘 상한에 안 섞임 → 오늘 위치 0 보충" 1 "sample_offset=0"
runs;  FAIL_RUNS=1 catchup ${TODAY}T05:00:00Z; ok_ev "기록 조회 실패 → 부르지 않음·종료 0" 0
runs;  FAIL_DISPATCH=1 catchup ${TODAY}T05:00:00Z; ok_ev "호출 실패 → 종료 0" 1
# 같은 시각에 운영 검사 두 번 성공(두 번째는 첫 호출 뒤): 첫 호출이 실행으로 보이는 순간부터 두 번째는 부르지 않음
runs "$(r 12 0 10 queued null ${TODAY}T05:00:05Z)"; catchup ${TODAY}T05:00:30Z; ok_ev "첫 보충 호출 직후의 두 번째 운영 검사 → 부르지 않음" 0

# ── crawl-slot.sh gate: crawl.yml slot 잡이 쓰는 판정 — 조회 실패에서도 하루 20건 상한을 지킨다(닫힌 방향)
gate() { D="$D" PATH="$D:$PATH" REPO=o/r GH_TOKEN=x TODAY_UTC=$TODAY CRAWL_SLOT_ME="${ME:-0}" bash "$ROOT/scripts/ci/crawl-slot.sh" gate "$1" "$2" 2>/dev/null; echo "rc=$?"; }
runs;                                                         expect "gate: 빈 자리 → 진행(skip=false)" "$(gate 0 10 | tr '\n' ' ')" "skip=false rc=0 "
runs "$(r 10 0 10 completed '"success"' ${TODAY}T03:10:00Z)"; expect "gate: 찬 자리 → 건너뜀(skip=true)" "$(gate 0 10 | tr '\n' ' ')" "skip=true rc=0 "
runs;                                                         expect "gate: 조회 실패 → 건너뜀(skip=true) — 상한 확인 불가면 수집 안 함" "$(FAIL_RUNS=1 gate 0 10 | tr '\n' ' ')" "skip=true rc=0 "
FAIL_RUNS=1 expect "gate: 조회 실패에서 두 자리 모두 건너뜀(20건 초과 불가)" "$(FAIL_RUNS=1 gate 0 10 | head -1)$(FAIL_RUNS=1 gate 10 10 | head -1)" "skip=trueskip=true"
runs;                                                         expect "gate: 10건이 아닌 시험 실행은 판정 대상 아님(조회 실패여도 진행)" "$(FAIL_RUNS=1 gate 0 3 | tr '\n' ' ')" "skip=false rc=0 "
runs;                                                         expect "gate: 자리 밖 목록 위치(20)는 판정 대상 아님" "$(gate 20 10 | tr '\n' ' ')" "skip=false rc=0 "
# 조회 실패로 건너뛴 자리는 조회가 되는 때 보충이 채운다(상한은 그대로 — 그 자리는 아직 안 찼으므로)
runs;                                                         catchup ${TODAY}T05:00:00Z; ok_ev "조회 실패로 건너뛴 자리 → 조회되면 보충이 같은 자리를 채움" 1 "sample_offset=0"
exit $fail
