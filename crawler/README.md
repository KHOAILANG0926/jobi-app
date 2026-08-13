# 베트남 채용공고 크롤러

Python Playwright + stealth 모드로 Cloudflare 차단 없이 크롤링.
**반드시 베트남 현지 또는 싱가포르 IP VPS에서 실행** (GitHub Actions 등 데이터센터 IP는 차단됨).

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
python3 crawl_topcv.py
```

### 5. 자동화 (crontab)

```bash
crontab -e
```

아래 추가 (매일 오전 8시 베트남 시간 = UTC+7 기준 01:00 UTC):
```
0 1 * * * cd /home/ubuntu/jobi/crawler && python3 crawl_topcv.py >> /var/log/crawl.log 2>&1
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

python3 crawl_topcv.py
```

### 4. 자동화 (crontab)

```bash
crontab -e
# 아래 추가:
0 1 * * * cd /root/jobi/crawler && python3 crawl_topcv.py >> /var/log/crawl.log 2>&1
```

---

## 코드 업데이트

VPS에서 최신 코드 받기:

```bash
cd ~/jobi
git pull origin master
pip3 install -r crawler/requirements.txt  # 새 패키지 추가시
```

## 결과

- `jobs_output.json` — 로컬 JSON 저장 (항상)
- Supabase DB — `.env`에 KEY 있을 때만 자동 저장
- 로그: `/var/log/crawl.log`
