"""
vieclam24h.vn 채용공고 크롤러
- Python Playwright + stealth 모드
- 베트남 VPS에서 실행 (Cloudflare 차단 없음)
- 실행: python3 crawl_topcv.py
- 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import asyncio
import json
import os
import re
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

load_dotenv(Path(__file__).parent / ".env")

try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except Exception:
    supabase = None

TARGET_COUNT = 100
TODAY = date.today().isoformat()


def guess_category(text: str) -> str:
    t = text.lower()
    if re.search(r"nhà máy|sản xuất|công nhân|kho|lắp ráp|kỹ thuật|điện tử|cơ khí", t):
        return "factory"
    if re.search(r"cà phê|cafe|nhà hàng|bếp|phục vụ|bartender|pha chế", t):
        return "cafe"
    if re.search(r"giao hàng|shipper|tài xế|xe máy|vận chuyển|delivery", t):
        return "delivery"
    if re.search(r"vệ sinh|giúp việc|dọn dẹp|tạp vụ", t):
        return "cleaning"
    if re.search(r"bán hàng|thu ngân|cửa hàng|siêu thị|sales|kinh doanh|bán lẻ|bán sỉ", t):
        return "retail"
    return "other"


async def crawl_vieclam24h() -> list[dict]:
    jobs = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="vi-VN",
            timezone_id="Asia/Ho_Chi_Minh",
        )
        page = await context.new_page()
        await stealth_async(page)

        page_num = 1
        while len(jobs) < TARGET_COUNT:
            url = f"https://vieclam24h.vn/tim-kiem-viec-lam?page={page_num}"
            print(f"  📄 페이지 {page_num} 로딩: {url}")

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"  ❌ 로딩 실패: {e}")
                break

            title = await page.title()
            if "Attention" in title or "cloudflare" in title.lower():
                print(f"  ⛔ Cloudflare 차단: {title}")
                break

            # 공고 카드 수집
            page_jobs = await page.evaluate("""() => {
                const items = []
                const cards = document.querySelectorAll("a[href*='/viec-lam-']")
                cards.forEach(el => {
                    const href = el.getAttribute('href') || ''
                    if (!href.includes('.html')) return
                    const text = el.innerText || ''
                    const lines = text.split('\\n').map(s => s.trim()).filter(Boolean)
                    if (lines.length < 1) return
                    const title = lines[0]
                    const company = lines[1] || ''
                    const salary = lines.find(l => l.includes('triệu') || l.includes('VND') || l.includes('Thỏa thuận')) || ''
                    const location = lines.find(l => l.includes('Hồ Chí Minh') || l.includes('Hà Nội') || l.includes('Bình Dương') || l.includes('Đồng Nai')) || ''
                    if (title && title.length > 3) {
                        items.push({ title, company, salary, location, href })
                    }
                })
                return items
            }""")

            if not page_jobs:
                print(f"  ⚠️  페이지 {page_num}에서 공고 없음. 종료.")
                break

            # 중복 제거 후 변환
            seen = {j["title"] + j.get("company", "") for j in jobs}
            new_jobs = []
            for j in page_jobs:
                key = j["title"] + j.get("company", "")
                if key not in seen:
                    seen.add(key)
                    new_jobs.append({
                        "title": j["title"],
                        "company": j.get("company", ""),
                        "location": j.get("location") or "Hồ Chí Minh",
                        "salary": j.get("salary", ""),
                        "description": f"[source:vieclam24h] https://vieclam24h.vn{j.get('href','')}",
                        "category": guess_category(j["title"]),
                        "posted_at": TODAY,
                        "urgent": False,
                        "employer_phone": "",
                        "application_deadline": "",
                    })

            jobs.extend(new_jobs)
            print(f"  ✅ 페이지 {page_num}: {len(new_jobs)}개 수집 (누계: {len(jobs)}개)")
            page_num += 1
            await page.wait_for_timeout(1500)

        await browser.close()

    return jobs[:TARGET_COUNT]


def save_to_json(jobs: list[dict], filename: str = "jobs_output.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON 저장: {filename} ({len(jobs)}개)")


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    existing = supabase.table("jobs").select("title, company").gte("posted_at", "2020-01-01").execute()
    existing_keys = {
        f"{r['title']}_{r['company']}".lower()
        for r in (existing.data or [])
    }

    new_jobs = [j for j in jobs if f"{j['title']}_{j['company']}".lower() not in existing_keys]

    if not new_jobs:
        print("  ℹ️  모두 중복 공고입니다.")
        return

    for i in range(0, len(new_jobs), 50):
        batch = new_jobs[i:i+50]
        supabase.table("jobs").insert(batch).execute()
        print(f"  ✅ Supabase 저장: {i+len(batch)}/{len(new_jobs)}개")


async def main():
    print("🚀 vieclam24h 크롤링 시작")
    print("─" * 50)

    jobs = await crawl_vieclam24h()

    print(f"\n📊 수집 완료: {len(jobs)}개")
    save_to_json(jobs)
    save_to_supabase(jobs)
    print("\n✨ 완료!")


if __name__ == "__main__":
    asyncio.run(main())
