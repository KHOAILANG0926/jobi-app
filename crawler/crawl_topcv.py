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

from classifier import classify, is_blacklisted
from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
print(f"  Supabase: {'연결됨' if supabase else '없음 (URL/KEY 확인 필요)'}")

TARGET_COUNT = 500
TODAY = date.today().isoformat()

CATEGORY_URLS = [
    # ── 생활밀착형 10개 ──────────────────────────
    "https://vieclam24h.vn/viec-lam-khach-san-nha-hang-du-lich-o5.html",   # 식당·카페·호텔
    "https://vieclam24h.vn/viec-lam-nha-may-o7.html",                       # 공장·생산
    "https://vieclam24h.vn/viec-lam-giao-hang-o44.html",                    # 배달·배송
    "https://vieclam24h.vn/viec-lam-bao-ve-tap-vu-ve-sinh-o14.html",       # 경비·청소·잡부
    "https://vieclam24h.vn/viec-lam-ban-si-ban-le-quan-ly-cua-hang-o6.html", # 소매·마트
    "https://vieclam24h.vn/viec-lam-van-tai-kho-van-o25.html",              # 물류·창고
    "https://vieclam24h.vn/viec-lam-tai-xe-o45.html",                       # 운전기사
    "https://vieclam24h.vn/viec-lam-xay-dung-o22.html",                     # 건설·현장
    "https://vieclam24h.vn/viec-lam-ban-hang-kinh-doanh-o13.html",          # 판매(현장)
    "https://vieclam24h.vn/viec-lam-nong-lam-ngu-nghiep-o17.html",          # 농업·수산
    # ── 사무직 2개 ──────────────────────────────
    "https://vieclam24h.vn/viec-lam-ke-toan-kiem-toan-o2.html",             # 회계
    "https://vieclam24h.vn/viec-lam-hanh-chinh-van-phong-o3.html",          # 사무행정
    # ── 지역별 (혼합, 현장직 다수) ─────────────
    "https://vieclam24h.vn/viec-lam-binh-duong.html",
    "https://vieclam24h.vn/viec-lam-ho-chi-minh.html",
    "https://vieclam24h.vn/viec-lam-dong-nai.html",
    "https://vieclam24h.vn/viec-lam-ha-noi.html",
    "https://vieclam24h.vn/viec-lam-bac-ninh.html",
    "https://vieclam24h.vn/viec-lam-hai-phong.html",
    "https://vieclam24h.vn/viec-lam-da-nang.html",
    "https://vieclam24h.vn/viec-lam-can-tho.html",
    # ── 대표 브랜드 키워드 검색 (Thương hiệu 드롭다운 카드 실데이터 확보용) ──
    # URL 패턴은 실제 검색창 제출로 확인됨: /tim-kiem-viec-lam-nhanh?q=<keyword>
    "https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=Highlands+Coffee",
    "https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=WinMart",
    "https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=Grab",
]


# guess_category → classifier.py 의 classify() 로 위임 (하위호환 유지)
def guess_category(title: str, company: str = "", description: str = "") -> str:
    return classify(title, company, description)


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


async def fetch_job_detail(page, url: str) -> dict:
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(2000)
        result = await page.evaluate("""() => {
            // 마감일
            let deadline = null
            document.querySelectorAll('*').forEach(el => {
                if (deadline) return
                const t = el.innerText || ''
                if (t.includes('Hạn nộp') && t.length < 80) {
                    const m = t.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})/)
                    if (m) deadline = m[3] + '-' + m[2] + '-' + m[1]
                }
            })

            // 섹션별 본문 추출
            const TARGET = ['Mô tả công việc', 'Yêu cầu công việc', 'Quyền lợi']
            const sections = {}
            document.querySelectorAll('h2, h3, h4').forEach(h => {
                const heading = h.innerText?.trim() || ''
                const matched = TARGET.find(t => heading.includes(t))
                if (!matched) return
                let content = ''
                let el = h.nextElementSibling
                while (el && !['H2','H3','H4'].includes(el.tagName)) {
                    const items = el.querySelectorAll('li')
                    if (items.length > 0) {
                        items.forEach(li => {
                            const txt = li.innerText?.trim()
                            if (txt) content += '• ' + txt + '\\n'
                        })
                    } else {
                        const txt = el.innerText?.trim()
                        if (txt && txt.length > 3) content += txt + '\\n'
                    }
                    el = el.nextElementSibling
                }
                if (content.trim()) sections[matched] = content.trim()
            })
            return { deadline, sections }
        }""")
        return result or {"deadline": None, "sections": {}}
    except Exception:
        return {"deadline": None, "sections": {}}


def format_description(sections: dict) -> str:
    order = ["Mô tả công việc", "Yêu cầu công việc", "Quyền lợi"]
    parts = []
    for key in order:
        if key in sections and sections[key]:
            parts.append(f"## {key}\n{sections[key]}")
    return "\n\n".join(parts)


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

        # 중복 제거
        seen_titles = set()
        unique_raw = []
        for j in all_raw:
            key = (j["title"] + j.get("company", "")).lower()
            if key not in seen_titles:
                seen_titles.add(key)
                unique_raw.append(j)
        unique_raw = unique_raw[:TARGET_COUNT]

        # 각 공고 상세 페이지에서 마감일 + 본문 가져오기
        print(f"\n  📋 상세 페이지 수집 중 ({len(unique_raw)}개)...")
        jobs = []
        skipped = 0
        for idx, j in enumerate(unique_raw):
            detail = await fetch_job_detail(page, j["href"])
            deadline = detail.get("deadline")
            # 마감일이 오늘 이전이거나 오늘인 공고는 제외
            if deadline and deadline <= TODAY:
                skipped += 1
                continue
            title   = j["title"]
            company = j.get("company", "")

            # 블랙리스트(사무직) 공고 수집 단계 제외
            if is_blacklisted(title, company):
                skipped += 1
                continue

            logo = j.get("logoUrl", "")
            desc_text = format_description(detail.get("sections", {}))
            description = f"[source:vieclam24h] {desc_text}" if desc_text else f"[source:vieclam24h] {j.get('href', '')}"

            # 분류: 제목 + 회사 + 본문 첫 300자 활용
            category = classify(title, company, desc_text)

            jobs.append({
                "title": title,
                "company": company,
                "location": j.get("location") or "Hồ Chí Minh",
                "salary": j.get("salary", ""),
                "description": description,
                "category": category,
                "posted_at": TODAY,
                "urgent": False,
                "employer_phone": "",
                "application_deadline": deadline,
                "active": True,
                "image_url": logo if logo and logo.startswith("http") else None,
            })
            if (idx + 1) % 20 == 0:
                print(f"    {idx + 1}/{len(unique_raw)}개 완료 (제외: {skipped}개)")

        await browser.close()
        return jobs


def save_to_json(jobs: list[dict], filename: str = "jobs_output.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON 저장: {filename} ({len(jobs)}개)")


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    # 기존 vieclam24h 공고 title+company 세트 조회 (중복 방지용)
    existing_raw = supabase.table("local_jobs") \
        .select("title,company") \
        .like("description", "%[source:vieclam24h]%") \
        .execute()
    existing_keys = {
        (r["title"].strip().lower()[:60], r["company"].strip().lower()[:40])
        for r in (existing_raw.data or [])
    }
    print(f"  📋 기존 vieclam24h 공고: {len(existing_keys)}개")

    # 신규 공고만 필터링 (누적 추가)
    new_jobs = [
        j for j in jobs
        if (j["title"].strip().lower()[:60], j["company"].strip().lower()[:40]) not in existing_keys
    ]
    print(f"  ➕ 신규 공고: {len(new_jobs)}개 / 중복 스킵: {len(jobs) - len(new_jobs)}개")

    inserted = 0
    for i in range(0, len(new_jobs), 50):
        batch = new_jobs[i:i+50]
        supabase.table("local_jobs").insert(batch).execute()
        inserted += len(batch)
        print(f"  ✅ Supabase 저장: {inserted}/{len(new_jobs)}개")

    if not new_jobs:
        print("  ℹ️  새 공고 없음 — 기존 데이터 유지")


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
