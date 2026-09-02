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
from job_quality import (
    canonical_job_key,
    compute_job_updates,
    extract_salary_from_text,
    normalize_location,
    normalize_salary,
    normalize_whitespace,
    split_work_locations,
    validate_job_payload,
)
from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
print(f"  Supabase: {'연결됨' if supabase else '없음 (URL/KEY 확인 필요)'}")

TARGET_COUNT = int(os.getenv("CRAWLER_TARGET_COUNT", "500"))
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
            if (!lines[0]) return
            // Badge/label lines that can render before the real title on some card
            // templates (sponsored slots, category grid view, etc.) — confirmed live
            // on vieclam24h cards. lines[0] used to be trusted blindly as the title,
            // so when one of these came first the badge became the "title" and the
            // real title got bumped into the "company" slot instead.
            // (job_quality.py's parse_listing_card_lines() mirrors this in pure Python
            // for unit testing — keep both in sync if this changes.)
            const TITLE_BADGE_LINES = new Set(['Không cần CV', 'HOT', 'Tin ưu tiên'])
            const title = lines.find(l => !TITLE_BADGE_LINES.has(l)) || lines[0]
            // The length sanity check has to run on the resolved title, not lines[0] —
            // a short badge as lines[0] (e.g. "HOT", 3 chars) must not disqualify an
            // otherwise-valid card whose real title is further down.
            if (title.length < 5) return
            const company = lines.find(l => l.length > 2 && l !== title && !TITLE_BADGE_LINES.has(l)) || ''
            const salary = lines.find(l => l.includes('triệu') || l.includes('VND') || l.includes('Thỏa thuận') || l.includes('Cạnh tranh')) || ''
            // Search location keywords only outside the title line — otherwise a job
            // whose title happens to mention a city (e.g. "... _ Hà Nội") with no
            // separate location line on the card gets its own title mistaken for location.
            const location = lines.filter(l => l !== title).find(l => ['Hồ Chí Minh','Hà Nội','Hải Phòng','Quảng Ninh','Bắc Ninh','Bắc Giang','Hưng Yên','Thái Nguyên','Phú Thọ','Ninh Bình','Thanh Hóa','Nghệ An','Hà Tĩnh','Quảng Trị','Huế','Đà Nẵng','Quảng Ngãi','Gia Lai','Đắk Lắk','Khánh Hòa','Lâm Đồng','Đồng Nai','Tây Ninh','Long An','Đồng Tháp','An Giang','Vĩnh Long','Cần Thơ','Cà Mau'].some(c => l.includes(c))) || ''
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
            const TARGET = ['Mô tả công việc', 'Yêu cầu công việc', 'Quyền lợi', 'Địa điểm làm việc']
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
        result = result or {"deadline": None, "sections": {}}
        if not result.get("sections"):
            # DOM heading selectors occasionally miss SPA detail layouts; keep a
            # bounded body fallback so crawler jobs are not saved as URL-only.
            body_text = await page.locator("body").inner_text(timeout=5000)
            fallback = normalize_whitespace(body_text)[:1800]
            if fallback:
                result["sections"] = {"Mô tả công việc": fallback}
        return result
    except Exception as exc:
        print(f"    ⚠️  상세 수집 실패: {url} ({exc})")
        return {"deadline": None, "sections": {}}


def format_description(sections: dict) -> str:
    order = ["Mô tả công việc", "Yêu cầu công việc", "Quyền lợi"]
    parts = []
    for key in order:
        if key in sections and sections[key]:
            content = str(sections[key]).strip()[:2000]
            parts.append(f"## {key}\n{content}")
    return "\n\n".join(parts)[:5000]


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
            key = canonical_job_key(j["title"], j.get("company", ""))
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
            title = normalize_whitespace(j["title"])
            company = normalize_whitespace(j.get("company", ""))

            # 블랙리스트(사무직) 공고 수집 단계 제외
            if is_blacklisted(title, company):
                skipped += 1
                continue

            logo = j.get("logoUrl", "")
            desc_text = format_description(detail.get("sections", {}))
            description = f"[source:vieclam24h] {desc_text}" if desc_text else f"[source:vieclam24h] {j.get('href', '')}"
            # 'Địa điểm làm việc' 섹션(있을 때만)에서 실제 근무지 주소를 추출한다.
            # 회사 개요/연락처 섹션(예: QTSC 본사 주소)은 이 heading 밑에 오지 않으므로
            # fetch_job_detail의 heading 경계 추출 자체가 혼입을 막는다.
            work_location_section = detail.get("sections", {}).get("Địa điểm làm việc", "")
            work_locations = split_work_locations(work_location_section)

            # 분류: 제목 + 회사 + 본문 첫 300자 활용
            category = classify(title, company, desc_text)

            job = {
                "title": title,
                "company": company,
                # 리스트 카드 키워드 매칭이 실패해 location이 비어오면(예: 대도시
                # 목록에 없는 지역), 제목 + 실제 근무지 주소 섹션에서 다시 찾는다 —
                # sb-4312 버그(Hưng Yên 근무인데 fallback으로 Hồ Chí Minh 저장) 재발 방지.
                "location": normalize_location(j.get("location"), detail_text=f"{title} {work_location_section}"),
                "salary": normalize_salary(j.get("salary")) if normalize_whitespace(j.get("salary")) else extract_salary_from_text(desc_text),
                "description": description,
                "category": category,
                "posted_at": TODAY,
                "urgent": False,
                "employer_phone": "",
                "application_deadline": deadline,
                "active": True,
                "origin": "crawler",
                "admin_hidden": False,
                "image_url": logo if logo and logo.startswith("http") else None,
                "source_url": j.get("href") or None,
            }
            quality_errors = validate_job_payload(job, source="vieclam24h", today=TODAY)
            if quality_errors:
                skipped += 1
                print(f"    ⏩ 품질 스킵: {title[:70]} ({', '.join(quality_errors)})")
                continue
            # local_jobs 컬럼이 아닌 임시 필드 — save_to_supabase에서 job_work_locations
            # insert에만 쓰고 local_jobs insert 페이로드에서는 제거한다.
            job["_work_locations"] = work_locations
            jobs.append(job)
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

    # 기존 vieclam24h 공고(핵심 필드 포함) 조회 — 매칭은 여전히 canonical_job_key
    # (title+company)로 하되, 이미 있는 공고라도 salary/deadline/description/
    # location 중 실제로 바뀐 값이 있으면 update한다(예전엔 무조건 skip).
    existing_raw = supabase.table("local_jobs") \
        .select("id,title,company,salary,application_deadline,description,location") \
        .like("description", "%[source:vieclam24h]%") \
        .execute()
    existing_by_key = {
        canonical_job_key(r.get("title", ""), r.get("company", "")): r
        for r in (existing_raw.data or [])
    }
    print(f"  📋 기존 vieclam24h 공고: {len(existing_by_key)}개")

    new_jobs = []
    updated = 0
    unchanged = 0
    for j in jobs:
        key = canonical_job_key(j["title"], j["company"])
        existing_row = existing_by_key.get(key)
        if existing_row is None:
            new_jobs.append(j)
            continue
        field_updates = compute_job_updates(existing_row, j)
        if not field_updates:
            unchanged += 1
            continue
        supabase.table("local_jobs").update(field_updates).eq("id", existing_row["id"]).execute()
        updated += 1
    print(f"  ➕ 신규 공고: {len(new_jobs)}개 / 🔄 업데이트: {updated}개 / ⏭️ 변경 없음: {unchanged}개")

    inserted = 0
    work_location_rows_total = 0
    for i in range(0, len(new_jobs), 50):
        batch = new_jobs[i:i+50]
        # local_jobs에는 실제 컬럼만 보낸다 — _work_locations는 별도 테이블용 임시 필드.
        local_jobs_batch = [
            {k: v for k, v in job.items() if k != "_work_locations"}
            for job in batch
        ]
        result = supabase.table("local_jobs").insert(local_jobs_batch).execute()
        inserted += len(batch)
        print(f"  ✅ Supabase 저장: {inserted}/{len(new_jobs)}개")

        inserted_rows = result.data or []
        work_location_rows = []
        for job, row in zip(batch, inserted_rows):
            job_id = row.get("id")
            locations = job.get("_work_locations") or []
            if not job_id or not locations:
                continue
            for idx, addr in enumerate(locations):
                work_location_rows.append({
                    "job_id": job_id,
                    "raw_address": addr,
                    "sort_order": idx,
                })
        if work_location_rows:
            supabase.table("job_work_locations").insert(work_location_rows).execute()
            work_location_rows_total += len(work_location_rows)

    if work_location_rows_total:
        print(f"  📍 근무지 주소 저장: {work_location_rows_total}건 (job_work_locations)")

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
