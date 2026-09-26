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
command -v ufw >/dev/null && ufw status | grep -q active && ufw allow 8787/tcp || true
sleep 1
curl -s http://127.0.0.1:8787/health && echo
echo
echo "=== Vercel에 넣을 값 ==="
echo "ZALO_RELAY_URL=http://103.221.223.71:8787/zalo/me"
grep ZALO_RELAY_KEY "$ENV_FILE"
