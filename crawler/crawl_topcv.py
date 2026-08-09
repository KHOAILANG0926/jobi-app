"""
TopCV.vn 채용공고 크롤러
- Python Playwright + stealth 모드
- 베트남 VPS에서 실행 권장 (현지 IP = Cloudflare 차단 없음)
- 실행: python crawl_topcv.py
- 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (없으면 JSON 파일로 저장)
"""

import asyncio
import json
import os
import re
from datetime import date

from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

# ── Supabase 설정 (선택) ──────────────────────────────────────────
try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://edhuesdnuxlbcfephutq.supabase.co")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None
except Exception:
    supabase = None

TARGET_COUNT = 100  # 수집할 공고 수
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
    if re.search(r"bán hàng|thu ngân|cửa hàng|siêu thị|sales|kinh doanh", t):
        return "retail"
    return "other"


async def crawl_topcv() -> list[dict]:
    jobs = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
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
            url = f"https://www.topcv.vn/tim-viec-lam-moi-nhat?page={page_num}"
            print(f"  📄 페이지 {page_num} 로딩: {url}")

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2000)
            except Exception as e:
                print(f"  ❌ 페이지 로딩 실패: {e}")
                break

            # __NEXT_DATA__ JSON 파싱 시도
            next_data = await page.evaluate("""() => {
                const el = document.getElementById('__NEXT_DATA__')
                if (el) {
                    try { return JSON.parse(el.textContent) }
                    catch { return null }
                }
                return null
            }""")

            page_jobs = []

            if next_data:
                props = next_data.get("props", {}).get("pageProps", {})
                raw_jobs = (
                    props.get("jobs") or
                    props.get("data", {}).get("jobs") or
                    props.get("jobList") or
                    []
                )
                for item in raw_jobs:
                    title = item.get("title") or item.get("name") or ""
                    company = (item.get("company") or {}).get("name") or item.get("company_name") or ""
                    location = ""
                    locs = item.get("working_location") or item.get("locations") or []
                    if locs:
                        location = locs[0].get("name") or locs[0].get("city") or ""
                    salary = item.get("salary") or item.get("salary_display") or ""
                    deadline = (item.get("expired_at") or item.get("deadline") or "")[:10]
                    if title:
                        page_jobs.append({
                            "title": title,
                            "company": company,
                            "location": location or "Hồ Chí Minh",
                            "salary": salary,
                            "description": f"[source:topcv] {item.get('description') or ''}",
                            "category": guess_category(title),
                            "posted_at": TODAY,
                            "urgent": False,
                            "employer_phone": "",
                            "application_deadline": deadline,
                        })

            # DOM 파싱 fallback
            if not page_jobs:
                page_jobs = await page.evaluate("""() => {
                    const items = []
                    const cards = document.querySelectorAll(
                        '.job-item, [class*="job-item"], [class*="JobCard"], [data-job-id], .job-list-item'
                    )
                    cards.forEach(el => {
                        const title = (
                            el.querySelector('h3, h2, [class*="title"], [class*="job-name"]')
                        )?.innerText?.trim()
                        const company = el.querySelector('[class*="company"]')?.innerText?.trim()
                        const location = el.querySelector('[class*="location"], [class*="city"]')?.innerText?.trim()
                        const salary = el.querySelector('[class*="salary"]')?.innerText?.trim()
                        if (title && title.length > 3) {
                            items.push({ title, company: company||'', location: location||'', salary: salary||'' })
                        }
                    })
                    return items
                }""")
                page_jobs = [
                    {
                        **j,
                        "description": "[source:topcv] ",
                        "category": guess_category(j["title"]),
                        "posted_at": TODAY,
                        "urgent": False,
                        "employer_phone": "",
                        "application_deadline": "",
                        "location": j.get("location") or "Hồ Chí Minh",
                    }
                    for j in page_jobs
                ]

            if not page_jobs:
                print(f"  ⚠️  페이지 {page_num}에서 공고를 찾지 못했습니다. 중단합니다.")
                # 디버그: 페이지 타이틀 출력
                title = await page.title()
                print(f"  📄 페이지 타이틀: {title}")
                break

            jobs.extend(page_jobs)
            print(f"  ✅ 페이지 {page_num}: {len(page_jobs)}개 수집 (누계: {len(jobs)}개)")
            page_num += 1

            if len(jobs) >= TARGET_COUNT:
                break

            await page.wait_for_timeout(1500)  # 요청 간 딜레이

        await browser.close()

    return jobs[:TARGET_COUNT]


def deduplicate(jobs: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for j in jobs:
        key = f"{j['title']}_{j['company']}".lower()
        if key not in seen:
            seen.add(key)
            result.append(j)
    return result


def save_to_json(jobs: list[dict], filename: str = "jobs_output.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON 저장: {filename} ({len(jobs)}개)")


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    # 최근 7일 기존 공고 가져와서 중복 제외
    existing = supabase.table("jobs").select("title, company").gte("posted_at", "2020-01-01").execute()
    existing_keys = {
        f"{r['title']}_{r['company']}".lower()
        for r in (existing.data or [])
    }

    new_jobs = [j for j in jobs if f"{j['title']}_{j['company']}".lower() not in existing_keys]

    if not new_jobs:
        print("  ℹ️  모두 중복 공고입니다.")
        return

    # 50개씩 배치 insert
    for i in range(0, len(new_jobs), 50):
        batch = new_jobs[i:i+50]
        result = supabase.table("jobs").insert(batch).execute()
        print(f"  ✅ Supabase 저장: {i+len(batch)}/{len(new_jobs)}개")


async def main():
    print("🚀 TopCV 크롤링 시작")
    print("─" * 50)

    jobs = await crawl_topcv()
    jobs = deduplicate(jobs)

    print(f"\n📊 수집 완료: {len(jobs)}개")

    # JSON 저장 (항상)
    save_to_json(jobs)

    # Supabase 저장 (KEY 있을 때만)
    save_to_supabase(jobs)

    print("\n✨ 완료!")


if __name__ == "__main__":
    asyncio.run(main())
