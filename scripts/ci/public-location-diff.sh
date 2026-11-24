#!/usr/bin/env bash
# 격리 DB migration 적용 전후 차이(public-location-snapshot.sql 출력 두 개) → 로그·실행 요약.
# 차이는 기록만 하고, 실패로 보는 것은 하나뿐(지도 위치 절대 원칙·지점별 독립 공고 전환에서 위치를 조용히 잃는 경우):
#   적용 전 핀(확정 좌표)이 있던 공고가 적용 뒤에도 공개인데 핀 0개이고 위치 보류함에도 없음.
set -euo pipefail
file=$1 before=$2 after=$3
changes=$(diff "$before" "$after" | grep '^[<>]' || true)
{
  echo "### 격리 DB 전후 차이 — $(basename "$file")"
  if [[ -z "$changes" ]]; then echo "- 공고 공개 상태·위치 원본·위치 보류함 변화 없음"; else
    echo "- 바뀐 줄 $(grep -c . <<<"$changes")개 (< 적용 전, > 적용 뒤)"; echo '```'; head -60 <<<"$changes"; echo '```'; fi
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
pins() { awk -F'|' '$1=="point" && $4=="pin"{print $2}' "$1" | sort -u; }
public() { awk -F'|' '$1=="job" && $3=="public"{print $2}' "$1" | sort -u; }
held() { awk -F'|' '$1=="hold" && $2!=""{print $2}' "$1" | sort -u; }
lost=$(comm -12 <(pins "$before") <(public "$after") | comm -23 - <(pins "$after") | comm -23 - <(held "$after") || true)
if [[ -n "$lost" ]]; then
  echo "::error::$(basename "$file"): 적용 전 핀이 있던 공개 공고가 적용 뒤 핀 0개이고 위치 보류함에도 없음 — 공고 ${lost//$'\n'/, }"
  exit 1
fi
