#!/usr/bin/env bash
# 격리 DB 전후 차이 판정 시험(3순위 2차): 위치를 조용히 잃으면 실패, 보류함으로 옮기거나 비공개가 되면 통과.
set -euo pipefail
d=$(mktemp -d); s=scripts/ci/public-location-diff.sh
printf 'job|1|public|x\npoint|1|10|pin|exact|21|105\njob|2|public|y\npoint|2|20|pin|gate|21|105\npoint|2|21|nopin|area|21|105\n' > "$d/b"
printf 'job|1|public|x\njob|2|public|y\npoint|2|20|pin|gate|21|105\n' > "$d/lost"
printf 'job|1|public|x\nhold|1|10|held\njob|2|public|y\npoint|2|20|pin|gate|21|105\n' > "$d/held"
printf 'job|1|private|x\njob|2|public|y\npoint|2|20|pin|gate|21|105\n' > "$d/private"
GITHUB_STEP_SUMMARY= bash $s t.sql "$d/b" "$d/b" >/dev/null || { echo '변화 없음이 실패함'; exit 1; }
if GITHUB_STEP_SUMMARY= bash $s t.sql "$d/b" "$d/lost" >/dev/null 2>&1; then echo '위치를 조용히 잃었는데 통과함'; exit 1; fi
GITHUB_STEP_SUMMARY= bash $s t.sql "$d/b" "$d/held" >/dev/null || { echo '보류함으로 옮긴 경우가 실패함'; exit 1; }
GITHUB_STEP_SUMMARY= bash $s t.sql "$d/b" "$d/private" >/dev/null || { echo '비공개가 된 경우가 실패함'; exit 1; }
echo 'public-location-diff.test.sh: 통과'
