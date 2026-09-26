# 베트남 채용공고 크롤러

Python Playwright + stealth 모드로 Cloudflare 차단 없이 크롤링.
**반드시 베트남 현지 또는 싱가포르 IP VPS에서 실행** (GitHub Actions 등 데이터센터 IP는 차단됨).

> Vieclam24h/VietnamWorks 크롤러의 확정된 동작 기준(신규/기존 판정, 다중 근무지
> 보존, 좌표 등급, 지역 검증, 거리검색 제외 규칙 등)은
> [`docs/CRAWLER_BASELINE.md`](../docs/CRAWLER_BASELINE.md)에 기록돼 있다.
> **이 기준을 바꾸는 코드 변경은 먼저 그 문서에서 기존 기준·바꾸려는 이유·
> 영향 범위를 제시한 뒤에 진행한다.** 각 기준이 왜 지금 형태가 됐는지의 근거
> (원인/재현/수정/테스트/커밋)는 [`docs/CRAWLER_FIX_HISTORY.md`](../docs/CRAWLER_FIX_HISTORY.md),
> 실제 실행·검증 이력과 미확인 항목은 [`docs/WORK_STATUS.md`](../docs/WORK_STATUS.md)에
> 있다 — 새 작업을 시작하기 전 이 세 문서를 먼저 읽는다.

운영 기준: **AZDIGI/Vietnam VPS에서 매일 20:00 Vietnam time에 `run_daily.sh` 실행**.
`run_daily.sh`는 Vieclam24h crawler를 항상 실행하고, Facebook cookie가 `.env`에 있으면 Facebook crawler도 이어서 실행한다.

---

## 환경변수 설정

```bash
cp .env.example .env
nano .env   # SUPABASE_SERVICE_ROLE_KEY 입력
```

`.env` 파일 (절대 git에 커밋하지 말 것):
```
SUPABASE_URL=https://edhuesdnuxlbcfephutq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_여기에입력

# Facebook crawler 사용 시만 입력
FB_C_USER=
FB_XS=
FB_DATR=
FB_FR=
```

---

## Option A: AWS 싱가포르 (ap-southeast-1)

### 1. EC2 인스턴스 생성
- Region: **Asia Pacific (Singapore) ap-southeast-1**
- AMI: Ubuntu 22.04 LTS
- Instance type: t3.micro (무료 티어: t2.micro)
- Security group: SSH (22번) 허용

### 2. 자동 설치 스크립트

VPS 접속 후 아래 스크립트 실행:

```bash
# deploy.sh 다운로드 후 실행
curl -sSL https://raw.githubusercontent.com/KHOAILANG0926/jobi-app/master/crawler/deploy.sh | bash
```

또는 직접 실행:

```bash
#!/bin/bash
set -e

# Python 3.11 + pip 설치
sudo apt update && sudo apt install -y python3.11 python3-pip git

# 프로젝트 클론
git clone https://github.com/KHOAILANG0926/jobi-app.git ~/jobi
cd ~/jobi/crawler

# 의존성 설치
pip3 install -r requirements.txt

# Playwright 브라우저 설치
playwright install chromium
playwright install-deps chromium

# 환경변수 설정
cp .env.example .env
echo "⚠️  .env 파일을 편집하여 SUPABASE_SERVICE_ROLE_KEY를 입력하세요"
```

### 3. .env 편집

```bash
nano ~/jobi/crawler/.env
```

### 4. 테스트 실행

```bash
cd ~/jobi/crawler
./run_daily.sh
```

### 5. 자동화 (crontab)

```bash
crontab -e
```

아래 추가 (매일 저녁 8시 베트남 시간 = UTC+7 기준 13:00 UTC):
```
0 13 * * * cd /home/ubuntu/jobi/crawler && ./run_daily.sh >> /home/ubuntu/jobi/crawler/crawl_daily.log 2>&1
```

---

## Option B: AZDIGI 베트남 로컬 VPS

베트남 현지 IP → Cloudflare 차단 가능성 더 낮음.

### 1. 가입 및 구매
- 사이트: https://azdigi.com
- 추천 플랜: Cloud VPS Mini (Ubuntu 22.04)
- 결제: 베트남 계좌 또는 국제 카드

### 2. SSH 접속 후 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Python + 의존성
sudo apt install -y python3 python3-pip git

# 프로젝트 클론
git clone https://github.com/KHOAILANG0926/jobi-app.git ~/jobi
cd ~/jobi/crawler

# Python 패키지 설치
pip3 install -r requirements.txt

# Playwright 브라우저 + 시스템 의존성
playwright install chromium
playwright install-deps chromium
```

### 3. 환경변수 + 실행

```bash
cp .env.example .env
nano .env   # KEY 입력

./run_daily.sh
```

### 4. 자동화 (crontab)

```bash
crontab -e
# 아래 추가 (매일 20:00 Vietnam time):
0 13 * * * cd /root/jobi/crawler && ./run_daily.sh >> /root/jobi/crawler/crawl_daily.log 2>&1
```

---

## Zalo relay TLS (Caddy)

`crawler/zalo_relay.py`(Zalo `/me` 조회를 이 VPS 경유로 중계 — Zalo가
베트남 밖 IP의 조회를 막아서 필요)는 `install_zalo_relay.sh`가 설치하는
그대로는 `localhost:8787`에서 **평문 HTTP만** 서빙한다. 이 VPS(AZDIGI,
`103.221.223.71`)엔 이 프로젝트용 도메인이 없어서, DNS를 새로 설정하지
않고도 실제 신뢰되는 TLS 인증서를 받으려고 **sslip.io**(IP를 그대로
호스트명으로 매핑해주는 공개 wildcard DNS, 소유권 검증 없이 그 IP 서버가
직접 인증서를 받을 수 있음)를 썼다:

- 도메인: `103-221-223-71.sslip.io` (IP `103.221.223.71`을 그대로 인코딩 —
  sslip.io 쪽에서 자동으로 그 IP로 풀림, 별도 DNS 레코드 설정 필요 없음).
- **Caddy**(`apt install caddy`)가 `:443`에서 이 도메인으로 자동 Let's
  Encrypt 인증서를 받아서, `/etc/caddy/Caddyfile`에 설정된 대로
  `localhost:8787`(zalo_relay.py)로 그대로 넘겨준다:
  ```caddyfile
  103-221-223-71.sslip.io {
      reverse_proxy localhost:8787
  }
  ```
- `ufw`(방화벽)를 활성화해서 `22`(SSH)/`80`/`443`만 외부에 열고, **8787은
  외부에서 막았다**(Caddy가 같은 서버 안에서 loopback으로 붙으므로 외부
  공개가 필요 없음) — `install_zalo_relay.sh`를 다시 실행해도 이제
  8787을 다시 열지 않는다(2026-09-26 수정, 예전엔 열었었음).
- Vercel Production의 `ZALO_RELAY_URL`은 이제
  `https://103-221-223-71.sslip.io/zalo/me`를 쓴다. `api/zalo-token.js`가
  이 값이 `https://`로 시작하지 않으면 로그인 자체를 503으로 막도록 돼
  있으니(계정 탈취/평문전송 방지 가드), **이 값을 절대 다시 http://로
  되돌리지 말 것**.
- Caddy는 인증서를 자동 갱신한다(Let's Encrypt 90일 주기, 별도 조치
  불필요) — 다만 이 VPS가 재설치되거나 IP가 바뀌면 `Caddyfile`의 도메인과
  Vercel의 `ZALO_RELAY_URL`을 새 IP 기준으로 다시 맞춰야 한다.

## 코드 업데이트

VPS에서 최신 코드 받기:

```bash
cd ~/jobi
git pull origin master
pip3 install -r crawler/requirements.txt  # 새 패키지 추가시
```

## 결과

- `jobs_output.json` — 로컬 JSON 저장 (항상)
- `facebook_jobs.json` — Facebook cookie가 있을 때 저장
- Supabase DB — `.env`에 KEY 있을 때만 자동 저장
- 로그: `~/jobi/crawler/crawl_daily.log`

## Facebook cookie 갱신

Facebook crawler 로그에 아래 메시지가 나오면 `.env`의 Facebook cookie가 만료됐거나
checkpoint/로그아웃 상태다.

```txt
Facebook 쿠키 인증 실패
mobile fallback도 로그인 벽 표시
```

이 경우 PC 브라우저에서 Facebook에 다시 로그인한 뒤 개발자 도구의 Cookies에서
아래 값을 새로 복사해 VPS의 `crawler/.env`에 갱신한다.

```env
FB_C_USER=
FB_XS=
FB_DATR=
FB_FR=
```

갱신 후 VPS에서 수동 확인:

```bash
cd /root/jobi/crawler
FACEBOOK_CRAWLER_TIMEOUT=20m CRAWLER_TARGET_COUNT=80 ./run_daily.sh
tail -n 120 crawl_daily.log
```
