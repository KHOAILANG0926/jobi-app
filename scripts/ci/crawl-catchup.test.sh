#!/usr/bin/env bash
# crawl-catchup.sh 시험 — 가짜 gh로 호출 여부·값을 확인한다(네트워크·열쇠 없음).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
cat > "$D/gh" <<'GH'
#!/usr/bin/env bash
if [ "$1" = workflow ]; then echo "workflow $*" >> "$D/calls"; [ -n "${FAIL_DISPATCH:-}" ] && exit 1; exit 0; fi
case "$2" in
  *actions/artifacts*) [ -n "${FAIL_ART:-}" ] && exit 1; cat "$D/art.json";;
  *crawl.yml/runs*) [ -n "${FAIL_RUNS:-}" ] && exit 1; cat "$D/runs.json";;
  *) exit 1;;
esac
GH
chmod +x "$D/gh"
fail=0
ago() { date -u -d "$1 hours ago" +%Y-%m-%dT%H:%M:%SZ; }
art() { echo "{\"artifacts\":[{\"expired\":false,\"created_at\":\"$(ago "$1")\"}]}" > "$D/art.json"; }
runs() { echo "{\"workflow_runs\":[{\"status\":\"$1\"}]}" > "$D/runs.json"; }
run() { : > "$D/calls"; D="$D" PATH="$D:$PATH" REPO=o/r GH_TOKEN=x GITHUB_STEP_SUMMARY=/dev/null "$@" bash "$ROOT/scripts/ci/crawl-catchup.sh" >/dev/null 2>&1; echo $? > "$D/rc"; }
check() { # 이름 기대호출수 [기대 문자열]
  local n; n=$(grep -c '^workflow' "$D/calls"); rc=$(cat "$D/rc")
  if [ "$n" != "$2" ] || [ "$rc" != 0 ] || { [ -n "${3:-}" ] && ! grep -q -- "$3" "$D/calls"; }; then echo "실패: $1 (호출 $n, 종료 $rc)"; fail=1; else echo "통과: $1"; fi
}
art 3;  runs completed; run env;                    check "최근 3시간 수집 있음 → 부르지 않음" 0
art 11; runs completed; run env NOW_HOUR_UTC=5;     check "11시간 수집 없음 → 1번, 오프셋 0·저장 없음" 1 "sample_offset=0"
grep -q "dry_run=true" "$D/calls" && grep -q "keep_for_save=true" "$D/calls" && echo "통과: dry_run·보관 고정" || { echo "실패: dry_run·보관 고정"; fail=1; }
art 11; runs completed; run env NOW_HOUR_UTC=14;    check "UTC 14시 → 오프셋 10" 1 "sample_offset=10"
art 11; runs in_progress; run env NOW_HOUR_UTC=5;   check "이미 진행 중 → 부르지 않음" 0
art 11; runs queued; run env NOW_HOUR_UTC=5;        check "이미 대기 중 → 부르지 않음" 0
art 11; runs completed; run env FAIL_ART=1;         check "보관물 조회 실패 → 부르지 않음·종료 0" 0
art 11; runs completed; run env FAIL_RUNS=1;        check "실행 조회 실패 → 부르지 않음·종료 0" 0
art 11; runs completed; run env FAIL_DISPATCH=1 NOW_HOUR_UTC=5; check "호출 실패 → 종료 0" 1
echo '{"artifacts":[{"expired":true,"created_at":"'"$(ago 1)"'"}]}' > "$D/art.json"; runs completed; run env NOW_HOUR_UTC=5; check "만료된 보관물은 세지 않음 → 1번" 1
exit $fail
