# 베트남 채용공고 크롤러

## VPS 설치 방법 (Ubuntu 기준)

```bash
# 1. Python 의존성 설치
pip install -r requirements.txt

# 2. Playwright 브라우저 설치
playwright install chromium
playwright install-deps chromium

# 3. 환경변수 설정 (Supabase에 바로 저장하려면)
export SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# 4. 실행
python crawl_topcv.py
```

## 결과
- `jobs_output.json` 파일로 저장됨
- SUPABASE_SERVICE_ROLE_KEY 설정 시 DB에도 자동 저장

## 자동화 (crontab)
```bash
# 매일 오전 8시 자동 실행
0 1 * * * cd /home/ubuntu/crawler && python crawl_topcv.py >> /var/log/crawl.log 2>&1
```
