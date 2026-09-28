#!/bin/sh
# 회사 PC(LAPTOP-1GF55Q0D) 공개키를 root authorized_keys에 추가 (중복이면 건너뜀, 기존 키 유지)
set -e
cd "$(dirname "$0")"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
if grep -qF "$(cut -d" " -f2 jobi_vps_hp.pub)" ~/.ssh/authorized_keys 2>/dev/null; then echo "이미 등록됨 OK"; else cat jobi_vps_hp.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo OK; fi
