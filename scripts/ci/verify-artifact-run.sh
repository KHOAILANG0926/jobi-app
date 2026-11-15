#!/usr/bin/env bash
# S4(#808): 다른 실행의 artifact를 받아 쓰기 전에 그 실행이 '믿을 수 있는 실행'인지 확인한다.
# 브랜치에서 만든 워크플로가 같은 이름의 artifact를 만들어 run id만 넘기면, master 실행이 그 가짜 결과를 운영 DB에 넣을 수 있었다.
# 통과 조건(모두): 지금 실행이 master / 그 실행이 같은 저장소·지정 워크플로 파일·master·허용한 실행 방식·성공·master 이력 안 커밋.
# 사용: verify-artifact-run.sh <run_id> <.github/workflows/파일.yml> [허용 이벤트, 쉼표 구분 — 기본 workflow_dispatch]
#       (GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REF 필요)
set -euo pipefail
run_id=${1:-}; want_path=${2:-}; events=${3:-workflow_dispatch}
fail() { echo "::error title=artifact 출처 확인 실패::$1"; exit 1; }
[[ "$run_id" =~ ^[0-9]+$ ]] || fail "run id 형식 오류: '$run_id'"
[[ "$want_path" =~ ^\.github/workflows/[A-Za-z0-9._-]+\.ya?ml$ ]] || fail "워크플로 파일 형식 오류: '$want_path'"
[ "${GITHUB_REF:-}" = refs/heads/master ] || fail "이 작업은 master에서만 artifact를 받는다(지금: ${GITHUB_REF:-없음})"
repo=${GITHUB_REPOSITORY:?}
json=$(gh api "repos/$repo/actions/runs/$run_id") || fail "실행 $run_id 조회 실패"
got() { printf '%s' "$json" | jq -r "$1"; }
[ "$(got .repository.full_name)" = "$repo" ] || fail "다른 저장소 실행"
[ "$(got .head_repository.full_name)" = "$repo" ] || fail "포크에서 온 실행"
[ "$(got .path)" = "$want_path" ] || fail "다른 워크플로 파일의 실행: $(got .path)"
[ "$(got .head_branch)" = master ] || fail "master가 아닌 브랜치의 실행: $(got .head_branch)"
[[ "$events" =~ ^[a-z_]+(,[a-z_]+)*$ ]] || fail "허용 이벤트 형식 오류"
case ",$events," in *",$(got .event),"*) ;; *) fail "허용하지 않은 실행 방식: $(got .event)";; esac
[ "$(got .status)" = completed ] && [ "$(got .conclusion)" = success ] || fail "성공한 실행이 아님: $(got .status)/$(got .conclusion)"
# head_sha가 지금 master 이력 안에 있는지(브랜치에서 master라는 이름만 흉내 낸 실행 방지 — head_branch는 실행 시 ref 이름일 뿐)
sha=$(got .head_sha)
st=$(gh api "repos/$repo/compare/$sha...master" --jq .status) || fail "커밋 비교 실패"
case "$st" in identical|ahead) ;; *) fail "실행 커밋 ${sha:0:7}이 master 이력에 없음($st)";; esac
echo "artifact 출처 확인: 실행 $run_id ($want_path, master ${sha:0:7}, $(got .event), 성공)"
