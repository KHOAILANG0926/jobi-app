#!/usr/bin/env python3
"""Zalo 사용자 정보 조회 중계 서버 (베트남 IP 전용).

Zalo는 베트남 밖 IP에서 /me 호출 시 -501로 개인정보를 막는다.
Vercel 함수(미국)가 이 VPS(베트남)를 거쳐 graph.zalo.me/v2.0/me 를 호출한다.

- POST /zalo/me  body: {"access_token": "..."}  header: X-Relay-Key
- 표준 라이브러리만 사용 (추가 설치 없음)
- 환경변수: ZALO_RELAY_KEY (필수), ZALO_RELAY_PORT (기본 8787)
"""
import hmac
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KEY = os.environ.get("ZALO_RELAY_KEY", "")
PORT = int(os.environ.get("ZALO_RELAY_PORT", "8787"))
ZALO_ME = "https://graph.zalo.me/v2.0/me?fields=id,name,picture"


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/zalo/me":
            return self._send(404, {"error": "not found"})
        if not KEY or not hmac.compare_digest(self.headers.get("X-Relay-Key", ""), KEY):
            return self._send(401, {"error": "unauthorized"})
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 8192)
            token = json.loads(self.rfile.read(length) or b"{}").get("access_token", "")
        except (ValueError, json.JSONDecodeError):
            return self._send(400, {"error": "bad request"})
        if not token:
            return self._send(400, {"error": "missing access_token"})
        req = urllib.request.Request(ZALO_ME, headers={"access_token": token})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return self._send(200, json.loads(r.read()))
        except urllib.error.HTTPError as e:
            return self._send(502, {"error": "zalo http error", "status": e.code})
        except Exception as e:  # noqa: BLE001
            return self._send(502, {"error": "zalo request failed", "detail": str(e)})

    def log_message(self, fmt, *args):  # 토큰이 로그에 남지 않도록 경로/상태만 기록
        print("%s %s" % (self.address_string(), fmt % args), flush=True)


if __name__ == "__main__":
    if not KEY:
        raise SystemExit("ZALO_RELAY_KEY 환경변수가 필요합니다.")
    print(f"zalo relay listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
