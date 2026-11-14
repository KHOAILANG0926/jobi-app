#!/usr/bin/env bash
# wait-migration-before-deploy.sh 시험(S3-5, #808): 임시 git 저장소 + 가짜 gh로 9가지 경우의 배포 진행(0)/보류(1)를 확인한다.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" && cat > "$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
printf '%b' "${RUNS:-}"
GH
chmod +x "$tmp/bin/gh"
cd "$tmp" && git init -q repo && cd repo && git config user.email t@t && git config user.name t
echo a > a && git add . && git commit -qm base && P=$(git rev-parse HEAD)
mkdir -p supabase/migrations && echo x > supabase/migrations/1.sql && git add . && git commit -qm mig && M=$(git rev-parse HEAD)
echo b > b && git add . && git commit -qm after && H=$(git rev-parse HEAD)
echo c > c && git add . && git commit -qm later && L=$(git rev-parse HEAD)
fail=0
check() { # 이름 기대값 RUNS PROD
  local got
  PATH="$tmp/bin:$PATH" RUNS="$3" PROD="$4" REPO=o/r WAIT_TRIES=2 WAIT_SEC=0 bash "$here/wait-migration-before-deploy.sh" >/dev/null 2>&1; got=$?
  if [ "$got" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1 (기대 $2, 결과 $got)"; fail=1; fi
}
check '이 DB 변경을 포함한 실행 성공 → 배포' 0 "1\t$H\tcompleted\tsuccess\n" "$P"
check '이 DB 변경을 포함한 실행 실패 → 보류' 1 "2\t$M\tcompleted\tfailure\n" "$P"
check 'DB 변경 이전 실행만 있음 → 보류' 1 "3\t$P\tcompleted\tsuccess\n" "$P"
check '실패 뒤 더 새 실행 성공 → 배포' 0 "5\t$H\tcompleted\tsuccess\n4\t$M\tcompleted\tfailure\n" "$P"
check '실행 중 → 시간 초과 보류' 1 "6\t$H\tin_progress\t\n" "$P"
check '운영 이후 DB 변경 없음 → 배포' 0 "" "$H"
check '운영 버전 모름 + 이미 적용 → 배포' 0 "9\t$L\tcompleted\tsuccess\n" ""
check '운영 버전 모름 + 미적용 → 보류' 1 "8\t$P\tcompleted\tsuccess\n" ""
check '운영 커밋이 저장소에 없음 + 이미 적용 → 배포' 0 "9\t$L\tcompleted\tsuccess\n" "deadbeef"
exit $fail
