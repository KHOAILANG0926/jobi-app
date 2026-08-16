"""
Facebook 그룹 채용공고 크롤러 (쿠키 세션 방식)
- .env의 Facebook 쿠키로 로그인 세션 유지
- 실행: python3 crawl_facebook.py
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
print(f"  Supabase: {'연결됨' if supabase else '없음'}")

# Facebook 쿠키 (.env에서 로드)
FB_C_USER = os.getenv("FB_C_USER", "")
FB_XS     = os.getenv("FB_XS", "")
FB_DATR   = os.getenv("FB_DATR", "")
FB_FR     = os.getenv("FB_FR", "")

if not FB_C_USER or not FB_XS:
    print("  ⚠️  FB_C_USER, FB_XS 쿠키가 .env에 없습니다.")
    print("  → crawler/.env에 추가해주세요.")
    exit(1)

TODAY = date.today().isoformat()
TARGET_PER_GROUP = 30

TARGETS = [
    {"url": "https://www.facebook.com/groups/timvieclamthembacninh", "location": "Bắc Ninh"},
    {"url": "https://www.facebook.com/groups/vieclamthembinhduong",  "location": "Bình Dương"},
    {"url": "https://www.facebook.com/groups/timvieclamdanang",      "location": "Đà Nẵng"},
    {"url": "https://www.facebook.com/groups/vieclamtaihcm",         "location": "Hồ Chí Minh"},
    {"url": "https://www.facebook.com/groups/vieclamhanoi24h",       "location": "Hà Nội"},
    {"url": "https://www.facebook.com/groups/vieclamhaiphong",       "location": "Hải Phòng"},
    {"url": "https://www.facebook.com/groups/tuyendungdongnai",      "location": "Đồng Nai"},
    {"url": "https://www.facebook.com/groups/vieclamcantho",         "location": "Cần Thơ"},
]

JOB_KEYWORDS = [
    "tuyển", "cần tuyển", "tuyển dụng", "đang tuyển",
    "cần người", "tìm người", "nhân viên", "lương",
    "triệu", "full time", "part time", "ca làm", "tuyển gấp",
]


def is_job_post(text: str) -> bool:
    return any(kw in text.lower() for kw in JOB_KEYWORDS)


def extract_phone(text: str) -> str:
    cleaned = re.sub(r"[\s\.\-]", "", text)
    phones = re.findall(r"(?<!\d)(0[0-9]{9})(?!\d)", cleaned)
    return phones[0] if phones else ""


def extract_salary(text: str) -> str:
    patterns = [
        r"\d+[\.,]?\d*\s*[-–~]\s*\d+[\.,]?\d*\s*(?:triệu|tr)(?:/|\s*tháng|\s*month)?",
        r"(?:từ|from)\s*\d+[\.,]?\d*\s*(?:triệu|tr)",
        r"\d+[\.,]?\d*\s*(?:triệu|tr)(?:/|\s*tháng|\s*month)?",
        r"\d+\s*[-–]\s*\d+\s*\$",
        r"(?:thỏa thuận|thoả thuận|cạnh tranh)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return "Thỏa thuận"


def extract_title(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    # 공고 키워드 포함된 줄 우선
    for line in lines[:8]:
        if any(kw in line.lower() for kw in ["tuyển", "cần tuyển", "nhân viên", "tìm người", "tuyển dụng"]):
            if 5 < len(line) < 150:
                return line
    # 사람 이름이 아닌 첫 번째 줄
    for line in lines[:5]:
        if not is_person_name(line) and len(line) > 5:
            return line[:120]
    return lines[0][:120] if lines else "Tuyển dụng"


def extract_company(text: str) -> str:
    m = re.search(
        r"(?:công ty|cty|shop|cửa hàng|nhà hàng|quán|trung tâm)[:\s]+([^\n,\.]{3,60})",
        text, re.IGNORECASE
    )
    return m.group(1).strip() if m else ""


def extract_deadline(text: str) -> str | None:
    m = re.search(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})", text)
    if m:
        d, mo, y = m.groups()
        try:
            deadline = f"{y}-{int(mo):02d}-{int(d):02d}"
            if deadline > TODAY:
                return deadline
        except Exception:
            pass
    return None


def guess_category(text: str) -> str:
    t = text.lower()
    if re.search(r"nhà máy|sản xuất|công nhân|kho|lắp ráp|kỹ thuật|điện tử|cơ khí", t):
        return "factory"
    if re.search(r"cà phê|cafe|nhà hàng|bếp|phục vụ|bartender|pha chế", t):
        return "cafe"
    if re.search(r"giao hàng|shipper|tài xế|xe máy|vận chuyển", t):
        return "delivery"
    if re.search(r"vệ sinh|giúp việc|dọn dẹp|tạp vụ", t):
        return "cleaning"
    if re.search(r"bán hàng|thu ngân|cửa hàng|siêu thị|sales|kinh doanh", t):
        return "retail"
    return "other"


def build_cookies() -> list[dict]:
    cookies = [
        {"name": "c_user", "value": FB_C_USER, "domain": ".facebook.com", "path": "/"},
        {"name": "xs",     "value": FB_XS,     "domain": ".facebook.com", "path": "/"},
    ]
    if FB_DATR:
        cookies.append({"name": "datr", "value": FB_DATR, "domain": ".facebook.com", "path": "/"})
    if FB_FR:
        cookies.append({"name": "fr",   "value": FB_FR,   "domain": ".facebook.com", "path": "/"})
    return cookies


NOISE_PATTERNS = re.compile(
    r"(답글 달기|번역 보기|공유하기|팔로우|더 보기|답글 \d+개 보기|이종민 이름으로|댓글 달기"
    r"|\d+주|\d+일|\d+시간|\d+분 전"
    r"|·\n팔로우|·\n\d+[주일시분]"
    r"|\n\d+\n\d+\n)",
    re.MULTILINE
)

def clean_text(text: str) -> str:
    # 노이즈 패턴 제거
    text = NOISE_PATTERNS.sub("", text)
    # 연속 줄바꿈 정리
    text = re.sub(r"\n{3,}", "\n\n", text)
    # 앞뒤 공백 제거
    return text.strip()

def is_person_name(line: str) -> bool:
    # 사람 이름처럼 보이는 짧은 줄 감지 (2~4개 단어, 특수문자 없음)
    words = line.strip().split()
    if 1 <= len(words) <= 3 and all(w[0].isupper() for w in words if w):
        if not any(kw in line.lower() for kw in JOB_KEYWORDS):
            return True
    return False


async def crawl_group(page, target: dict) -> list[dict]:
    url = target["url"]
    location = target["location"]
    print(f"\n  📄 그룹: {url}")

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
    except Exception as e:
        print(f"  ⛔ 로딩 실패: {e}")
        return []

    title = await page.title()
    if "log in" in title.lower():
        print(f"  ⛔ 쿠키 인증 실패 — 쿠키를 확인해주세요")
        return []

    print(f"  ✅ 로그인 확인: {title[:50]}")

    posts = []
    seen = set()

    for scroll in range(10):
        # "더 보기" 버튼 모두 클릭해서 전체 본문 펼치기
        see_more_btns = await page.query_selector_all('div[role="button"]:has-text("더 보기"), div[role="button"]:has-text("See more"), div[role="button"]:has-text("Xem thêm")')
        for btn in see_more_btns[:10]:
            try:
                await btn.click()
                await page.wait_for_timeout(300)
            except Exception:
                pass

        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(2500)

        raw = await page.evaluate("""() => {
            const results = []
            const articles = document.querySelectorAll('[role="article"]')
            articles.forEach(el => {
                const textEl = el.querySelector('[data-ad-comet-preview="message"], [data-ad-preview="message"]')
                const text = textEl ? textEl.innerText : ''
                if (!text || text.length < 30) return

                const imgs = []
                el.querySelectorAll('img[src]').forEach(img => {
                    const src = img.src || ''
                    if ((src.includes('scontent') || src.includes('fbcdn')) &&
                        !src.includes('emoji') && img.naturalWidth > 100) {
                        imgs.push(src)
                    }
                })

                const linkEl = el.querySelector('a[href*="story_fbid"], a[href*="/posts/"]')
                const postUrl = linkEl ? linkEl.href : ''

                results.push({ text: text.trim(), images: imgs, postUrl })
            })
            return results
        }""")

        new = 0
        for r in raw:
            raw_text = r.get("text", "").strip()
            text = clean_text(raw_text)
            key = text[:80]
            if not text or key in seen:
                continue
            if not is_job_post(text):
                continue
            seen.add(key)
            posts.append({**r, "text": text, "location": location})
            new += 1

        print(f"    스크롤 {scroll+1}: +{new}개 (총 {len(posts)}개)")
        if len(posts) >= TARGET_PER_GROUP:
            break

    return posts


def parse_post(post: dict) -> dict:
    text = post["text"]
    images = post.get("images", [])
    location = post["location"]

    return {
        "title": extract_title(text),
        "company": extract_company(text),
        "location": location,
        "salary": extract_salary(text),
        "employer_phone": extract_phone(text),
        "description": f"[source:facebook] {text}",
        "category": guess_category(text),
        "posted_at": TODAY,
        "urgent": False,
        "application_deadline": extract_deadline(text),
        "active": True,
        "image_url": images[0] if images else None,
        "images": images if images else None,
    }


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 없음")
        return
    supabase.table("local_jobs").delete().like("description", "%[source:facebook]%").execute()
    print(f"  🗑️  기존 facebook 공고 교체")
    for i in range(0, len(jobs), 50):
        batch = jobs[i:i+50]
        supabase.table("local_jobs").insert(batch).execute()
        print(f"  ✅ 저장: {i+len(batch)}/{len(jobs)}개")


async def main():
    print("🚀 Facebook 그룹 크롤링 시작 (쿠키 세션)")
    print("─" * 50)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="vi-VN",
        )
        await context.add_cookies(build_cookies())
        page = await context.new_page()
        await stealth_async(page)

        all_jobs = []
        seen_titles = set()

        for target in TARGETS:
            posts = await crawl_group(page, target)
            for post in posts:
                job = parse_post(post)
                key = job["title"].lower()[:50]
                if key not in seen_titles:
                    seen_titles.add(key)
                    all_jobs.append(job)

        await browser.close()

    print(f"\n📊 수집 완료: {len(all_jobs)}개")
    with open("facebook_jobs.json", "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, ensure_ascii=False, indent=2)
    print("  💾 facebook_jobs.json 저장")
    save_to_supabase(all_jobs)
    print("\n✨ 완료!")


if __name__ == "__main__":
    asyncio.run(main())
