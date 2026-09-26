#!/bin/bash
# Zalo 중계 서버 설치 (VPS에서 1회 실행): bash /root/jobi/crawler/install_zalo_relay.sh
set -e
ENV_FILE=/etc/zalo-relay.env
if [ ! -f "$ENV_FILE" ]; then
  echo "ZALO_RELAY_KEY=$(openssl rand -hex 32)" > "$ENV_FILE"
  echo "ZALO_RELAY_PORT=8787" >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi
cat > /etc/systemd/system/zalo-relay.service <<UNIT
[Unit]
Description=Zalo user-info relay (Vietnam IP)
After=network-online.target

[Service]
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/python3 /root/jobi/crawler/zalo_relay.py
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now zalo-relay
sleep 1
curl -s http://127.0.0.1:8787/health && echo
echo
# 2026-09-26 — 8787을 공인망에 직접 열지 않는다(예전엔 여기서 ufw allow
# 8787/tcp를 했었다). Caddy가 103-221-223-71.sslip.io로 443/HTTPS를 받아서
# localhost:8787로만 넘겨준다 — 자세한 건 crawler/README.md의
# "Zalo relay TLS(Caddy)" 절 참고. 8787은 로컬(localhost)에서만 필요하고
# 외부에는 절대 열지 않는다.
echo "=== Vercel에 넣을 값 (relay는 Caddy가 넘겨주는 HTTPS 주소를 쓴다) ==="
echo "ZALO_RELAY_URL=https://103-221-223-71.sslip.io/zalo/me"
grep ZALO_RELAY_KEY "$ENV_FILE"
