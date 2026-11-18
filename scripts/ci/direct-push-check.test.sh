#!/usr/bin/env bash
# direct-push-check.sh 시험: 가짜 gh로 '병합 직후 연결이 늦게 생김'(잘못된 경보 원인)·'진짜 직접 push'·'다른 PR 병합 커밋'·'조회 실패'를 본다.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/gh" <<'G'
#!/usr/bin/env bash
# 가짜 gh: FAKE_EMPTY_TIMES번까지는 빈 목록, 그 뒤 FAKE_PRS를 돌려준다. FAKE_FAIL=1이면 조회 실패.
[ "${FAKE_FAIL:-0}" = 1 ] && exit 1
n=$(cat "$FAKE_COUNT" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$FAKE_COUNT"
if [ "$n" -le "${FAKE_EMPTY_TIMES:-0}" ]; then echo '[]'; else printf '%s' "$FAKE_PRS"; fi
G
chmod +x "$tmp/gh"
export PATH="$tmp:$PATH" REPO=o/r SHA=abc123 WAIT_SECONDS=0 ATTEMPTS=5
linked='[{"number":848,"merged_at":"2026-11-16T03:23:20Z","base":{"ref":"master"},"merge_commit_sha":"abc123"}]'
other='[{"number":7,"merged_at":"2026-11-16T03:23:20Z","base":{"ref":"master"},"merge_commit_sha":"zzz999"}]'
pass=0; failn=0
check() { # 이름 기대종료코드 빈횟수 PRS [FAIL]
  local name=$1 want=$2; rm -f "$tmp/c"
  FAKE_COUNT="$tmp/c" FAKE_EMPTY_TIMES=$3 FAKE_PRS=$4 FAKE_FAIL=${5:-0} bash "$here/direct-push-check.sh" >/dev/null 2>&1; local got=$?
  if [ "$got" = "$want" ]; then pass=$((pass+1)); else echo "FAIL: $name (기대 $want, 실제 $got)"; failn=$((failn+1)); fi
}
check '바로 연결됨' 0 0 "$linked"
check '병합 직후 연결이 늦게 생김(#849 사례) — 경보 안 함' 0 2 "$linked"
check '끝까지 연결 없음(진짜 직접 push) — 경보' 3 99 "$linked"
check '다른 PR 병합 커밋만 연결 — 경보' 3 0 "$other"
check '조회 실패 — 경보 대신 실패' 2 0 "$linked" 1
echo "direct-push-check: 통과 $pass, 실패 $failn"
[ "$failn" = 0 ]
