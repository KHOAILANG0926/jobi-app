"""
vieclam24h.vn 채용공고 크롤러
- 스크롤 방식으로 공고 수집
- 실행: python3 crawl_topcv.py
"""

import asyncio
import json
import os
import re
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright
try:
    from playwright_stealth import stealth_async
except ImportError:
    async def stealth_async(page): pass

load_dotenv(Path(__file__).parent / ".env")

from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
print(f"  Supabase: {'연결됨' if supabase else '없음 (URL/KEY 확인 필요)'}")

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
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        page = await browser.new_page(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="vi-VN",
        )
        await stealth_async(page)

        url = "https://vieclam24h.vn/tim-kiem-viec-lam"
        print(f"  📄 로딩: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        title_text = await page.title()
        print(f"  타이틀: {title_text}")
        if "Attention" in title_text:
            print("  ⛔ Cloudflare 차단")
            await browser.close()
            return []

        # 스크롤로 공고 더 로드
        prev_count = 0
        for i in range(20):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)
            cards = await page.query_selector_all("a[href*='/viec-lam-'][href*='.html']")
            print(f"  스크롤 {i+1}: {len(cards)}개")
            if len(cards) >= TARGET_COUNT:
                break
            if len(cards) == prev_count:
                break
            prev_count = len(cards)

        # 카드 데이터 추출
        raw_jobs = await page.evaluate("""() => {
            const items = []
            const seen = new Set()
            document.querySelectorAll("a[href*='/viec-lam-']").forEach(el => {
                const href = el.getAttribute('href') || ''
                if (!href.includes('.html')) return
                if (seen.has(href)) return
                seen.add(href)
                const lines = (el.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean)
                if (!lines[0] || lines[0].length < 3) return
                const title = lines[0]
                const company = lines[1] || ''
                const salary = lines.find(l => l.includes('triệu') || l.includes('VND') || l.includes('Thỏa thuận') || l.includes('Cạnh tranh')) || ''
                const location = lines.find(l => ['Hồ Chí Minh','Hà Nội','Bình Dương','Đồng Nai','Cần Thơ','Đà Nẵng'].some(c => l.includes(c))) || ''
                items.push({ title, company, salary, location, href })
            })
            return items
        }""")

        await browser.close()

        jobs = []
        for j in raw_jobs[:TARGET_COUNT]:
            jobs.append({
                "title": j["title"],
                "company": j.get("company", ""),
                "location": j.get("location") or "Hồ Chí Minh",
                "salary": j.get("salary", ""),
                "description": f"[source:vieclam24h] https://vieclam24h.vn{j.get('href', '')}",
                "category": guess_category(j["title"]),
                "posted_at": TODAY,
                "urgent": False,
                "employer_phone": "",
                "application_deadline": "",
            })

        return jobs


def save_to_json(jobs: list[dict], filename: str = "jobs_output.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON 저장: {filename} ({len(jobs)}개)")


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    existing = supabase.table("jobs").select("title, company").gte("posted_at", "2020-01-01").execute()
    existing_keys = {f"{r['title']}_{r['company']}".lower() for r in (existing.data or [])}
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
