#!/bin/bash
# VPS 자동 설치 스크립트 (Ubuntu 22.04)
# 사용법: bash deploy.sh
set -e

echo "🚀 크롤러 VPS 설치 시작..."

# 시스템 패키지 설치
sudo apt update && sudo apt install -y python3 python3-pip git curl

# 프로젝트 클론 (이미 있으면 pull)
if [ -d "$HOME/jobi" ]; then
  echo "📂 기존 디렉토리 업데이트 중..."
  cd "$HOME/jobi" && git pull origin master
else
  git clone https://github.com/KHOAILANG0926/jobi-app.git "$HOME/jobi"
  cd "$HOME/jobi"
fi

cd "$HOME/jobi/crawler"

# Python 패키지 설치
pip3 install -r requirements.txt

# Playwright 브라우저 설치
playwright install chromium
playwright install-deps chromium

# .env 설정
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  .env 파일에 SUPABASE_SERVICE_ROLE_KEY를 입력하세요:"
  echo "    nano $HOME/jobi/crawler/.env"
else
  echo "✅ .env 파일 이미 존재"
fi

# crontab 등록 (매일 01:00 UTC = 08:00 베트남 시간)
CRON_JOB="0 1 * * * cd $HOME/jobi/crawler && python3 crawl_topcv.py >> /var/log/crawl.log 2>&1"
(crontab -l 2>/dev/null | grep -v "crawl_topcv"; echo "$CRON_JOB") | crontab -

echo ""
echo "✅ 설치 완료!"
echo "   테스트: cd $HOME/jobi/crawler && python3 crawl_topcv.py"
echo "   로그:   tail -f /var/log/crawl.log"
