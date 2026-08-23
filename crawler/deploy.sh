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
python3 -m pip install -r requirements.txt

# Playwright 브라우저 설치
python3 -m playwright install --with-deps chromium
chmod +x run_daily.sh

# .env 설정
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  .env 파일에 SUPABASE_SERVICE_ROLE_KEY를 입력하세요."
  echo "⚠️  Facebook crawler도 실행하려면 FB_C_USER / FB_XS 값을 추가하세요:"
  echo "    nano $HOME/jobi/crawler/.env"
else
  echo "✅ .env 파일 이미 존재"
fi

# crontab 등록 (매일 13:00 UTC = 20:00 베트남 시간)
CRON_JOB="0 13 * * * cd $HOME/jobi/crawler && ./run_daily.sh >> $HOME/jobi/crawler/crawl_daily.log 2>&1"
(crontab -l 2>/dev/null | grep -v "run_daily.sh"; echo "$CRON_JOB") | crontab -

echo ""
echo "✅ 설치 완료!"
echo "   테스트: cd $HOME/jobi/crawler && ./run_daily.sh"
echo "   로그:   tail -f $HOME/jobi/crawler/crawl_daily.log"
echo "   스케줄: 매일 20:00 Vietnam time"
