"""
vieclam24h.vn 채용공고 크롤러
- 카테고리 페이지에서 실제 공고 수집
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

TARGET_COUNT = 500
TODAY = date.today().isoformat()

CATEGORY_URLS = [
    # 직종별
    "https://vieclam24h.vn/viec-lam-ban-hang-kinh-doanh-o13.html",
    "https://vieclam24h.vn/viec-lam-nha-may-o7.html",
    "https://vieclam24h.vn/viec-lam-khach-san-nha-hang-du-lich-o5.html",
    "https://vieclam24h.vn/viec-lam-van-tai-kho-van-o25.html",
    "https://vieclam24h.vn/viec-lam-ban-si-ban-le-quan-ly-cua-hang-o6.html",
    "https://vieclam24h.vn/viec-lam-giao-hang-o44.html",
    "https://vieclam24h.vn/viec-lam-bao-ve-tap-vu-ve-sinh-o14.html",
    "https://vieclam24h.vn/viec-lam-xay-dung-o22.html",
    "https://vieclam24h.vn/viec-lam-ke-toan-kiem-toan-o2.html",
    "https://vieclam24h.vn/viec-lam-cong-nghe-thong-tin-o1.html",
    "https://vieclam24h.vn/viec-lam-hanh-chinh-van-phong-o3.html",
    "https://vieclam24h.vn/viec-lam-nhan-su-o10.html",
    "https://vieclam24h.vn/viec-lam-tai-xe-o45.html",
    "https://vieclam24h.vn/viec-lam-giao-duc-dao-tao-o4.html",
    "https://vieclam24h.vn/viec-lam-y-te-duoc-o21.html",
    # 지역별
    "https://vieclam24h.vn/viec-lam-bac-ninh.html",
    "https://vieclam24h.vn/viec-lam-binh-duong.html",
    "https://vieclam24h.vn/viec-lam-ha-noi.html",
    "https://vieclam24h.vn/viec-lam-ho-chi-minh.html",
    "https://vieclam24h.vn/viec-lam-dong-nai.html",
    "https://vieclam24h.vn/viec-lam-hai-phong.html",
    "https://vieclam24h.vn/viec-lam-da-nang.html",
    "https://vieclam24h.vn/viec-lam-can-tho.html",
]


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


async def crawl_category(page, url: str) -> list[dict]:
    print(f"  📄 로딩: {url}")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(3000)

    title_text = await page.title()
    if "Attention" in title_text:
        print("  ⛔ Cloudflare 차단")
        return []

    # 스크롤로 더 로드
    for _ in range(5):
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1500)

    raw_jobs = await page.evaluate("""() => {
        const items = []
        const seen = new Set()
        document.querySelectorAll("a[href]").forEach(el => {
            const href = el.getAttribute('href') || ''
            if (!href.includes('.html')) return
            if (!href.match(/id\\d+/)) return
            if (seen.has(href)) return
            seen.add(href)
            const lines = (el.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean)
            if (!lines[0] || lines[0].length < 5) return
            const title = lines[0]
            const company = lines.find(l => l.length > 2 && l !== title) || ''
            const salary = lines.find(l => l.includes('triệu') || l.includes('VND') || l.includes('Thỏa thuận') || l.includes('Cạnh tranh')) || ''
            const location = lines.find(l => ['Hồ Chí Minh','Hà Nội','Bình Dương','Đồng Nai','Cần Thơ','Đà Nẵng','Bắc Ninh','Hải Phòng'].some(c => l.includes(c))) || ''
            const fullHref = href.startsWith('http') ? href : 'https://vieclam24h.vn' + href
            const img = el.querySelector('img')
            const logoUrl = img ? (img.src || img.getAttribute('data-src') || '') : ''
            items.push({ title, company, salary, location, href: fullHref, logoUrl })
        })
        return items
    }""")

    print(f"    수집: {len(raw_jobs)}개")
    return raw_jobs


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

        all_raw = []
        seen_hrefs = set()

        for cat_url in CATEGORY_URLS:
            if len(all_raw) >= TARGET_COUNT:
                break
            raw = await crawl_category(page, cat_url)
            for j in raw:
                if j["href"] not in seen_hrefs:
                    seen_hrefs.add(j["href"])
                    all_raw.append(j)

        await browser.close()

        jobs = []
        seen_titles = set()
        for j in all_raw:
            key = (j["title"] + j.get("company", "")).lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)
            logo = j.get("logoUrl", "")
            jobs.append({
                "title": j["title"],
                "company": j.get("company", ""),
                "location": j.get("location") or "Hồ Chí Minh",
                "salary": j.get("salary", ""),
                "description": f"[source:vieclam24h] {j.get('href', '')}",
                "category": guess_category(j["title"]),
                "posted_at": TODAY,
                "urgent": False,
                "employer_phone": "",
                "application_deadline": None,
                "active": True,
                "image_url": logo if logo and logo.startswith("http") and "vieclam24h" in logo else None,
            })
            if len(jobs) >= TARGET_COUNT:
                break

        return jobs


def save_to_json(jobs: list[dict], filename: str = "jobs_output.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON 저장: {filename} ({len(jobs)}개)")


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    # vieclam24h 출처 공고만 삭제 (수동 등록 공고는 절대 건드리지 않음)
    supabase.table("local_jobs").delete().like("description", "%[source:vieclam24h]%").execute()
    print("  🗑️  기존 vieclam24h 공고 교체")

    for i in range(0, len(jobs), 50):
        batch = jobs[i:i+50]
        supabase.table("local_jobs").insert(batch).execute()
        print(f"  ✅ Supabase 저장: {i+len(batch)}/{len(jobs)}개")


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
