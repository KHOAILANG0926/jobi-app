"""
Facebook 그룹 채용공고 크롤러 (쿠키 세션 방식)
- 생활밀착형 일자리(Việc làm gần bạn) 우선 수집
- 구/군/동 상세 위치 + Zalo/전화번호 필수 추출
"""

import asyncio
import json
import os
import random
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

from job_quality import has_excluded_money_terms
from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
print(f"  Supabase: {'연결됨' if supabase else '없음'}")

FB_C_USER = os.getenv("FB_C_USER", "")
FB_XS     = os.getenv("FB_XS", "")
FB_DATR   = os.getenv("FB_DATR", "")
FB_FR     = os.getenv("FB_FR", "")

if not FB_C_USER or not FB_XS:
    print("  ⚠️  FB_C_USER, FB_XS 쿠키가 .env에 없습니다.")
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

# ── 기본 채용공고 감지 키워드 ────────────────────────────────────────
JOB_KEYWORDS = [
    "tuyển", "cần tuyển", "tuyển dụng", "đang tuyển",
    "cần người", "tìm người", "nhân viên", "lương",
    "triệu", "full time", "part time", "ca làm", "tuyển gấp",
]

# ── 생활밀착형 우선 직종 (Priority 1) ───────────────────────────────
LOCAL_JOB_TYPES = [
    # 카페/식음료
    "pha chế", "barista", "bartender", "cà phê", "cafe", "coffee", "trà sữa",
    # 홀서빙/주방
    "phục vụ", "phục vụ bàn", "phụ bếp", "bếp", "đầu bếp", "nhà hàng", "quán ăn",
    # 매장/캐셔
    "bán hàng", "thu ngân", "cửa hàng", "siêu thị", "tạp hóa", "shop",
    # 물류/창고/포장
    "shipper", "giao hàng", "đóng gói", "phụ kho", "kho", "phân loại hàng",
    # 보안/주차
    "bảo vệ", "giữ xe", "trông xe",
    # 생산직/현장
    "công nhân", "sản xuất", "theo ca", "ca làm", "làm ca", "nhà máy",
    # 근무 형태
    "part-time", "part time", "bán thời gian", "thời vụ", "làm thêm",
    "theo giờ", "nhận ca", "ca sáng", "ca chiều", "ca tối", "ca đêm",
]

# ── 사무/전문직 (우선순위 하향) ──────────────────────────────────────
OFFICE_JOB_PATTERNS = re.compile(
    r"kế toán|lập trình|developer|software|kỹ sư|engineer|marketing\s+chuyên|"
    r"hr manager|trưởng phòng|giám đốc|director|luật sư|bác sĩ|dược sĩ|"
    r"kiểm toán|tài chính cao cấp",
    re.IGNORECASE
)

# ── 구/군/동 패턴 ────────────────────────────────────────────────────
DISTRICT_PATTERN = re.compile(
    r"(?:quận|q\.?|huyện|thành phố|tp\.?)\s*[\d\w\s]{1,20}|"
    r"(?:phường|p\.?|xã|thị trấn)\s*[\w\s]{1,20}|"
    r"(?:đường|ngõ|ngách|khu|kp)\s+[\w\s\d]{2,30}",
    re.IGNORECASE
)


def is_job_post(text: str) -> bool:
    return any(kw in text.lower() for kw in JOB_KEYWORDS)


def is_local_priority(text: str) -> bool:
    """생활밀착형 직종이면 True"""
    t = text.lower()
    return any(kw in t for kw in LOCAL_JOB_TYPES)


def is_office_job(text: str) -> bool:
    """사무/전문직이면 True (우선순위 하향)"""
    return bool(OFFICE_JOB_PATTERNS.search(text))


def extract_phone(text: str) -> str:
    cleaned = re.sub(r"[\s\.\-]", "", text)
    phones = re.findall(r"(?<!\d)(0[0-9]{9})(?!\d)", cleaned)
    return phones[0] if phones else ""


def extract_zalo(text: str) -> str:
    """Zalo 번호 추출 — 'zalo: 09xx' 또는 'zalo 09xx' 형태"""
    m = re.search(
        r"zalo[:\s]*([0-9][\s\.\-]?[0-9]{3}[\s\.\-]?[0-9]{3}[\s\.\-]?[0-9]{3,4})",
        text, re.IGNORECASE
    )
    if m:
        return re.sub(r"[\s\.\-]", "", m.group(1))
    # Zalo 언급 없지만 전화번호 첫 번째를 Zalo 로도 쓸 수 있음 — phone과 공유
    return ""


def extract_district(text: str) -> str:
    """구/군/동/도로명 등 상세 위치 추출"""
    matches = DISTRICT_PATTERN.findall(text)
    if matches:
        # 가장 짧고 구체적인 매치 우선
        parts = [m.strip() for m in matches if len(m.strip()) > 2]
        return ", ".join(dict.fromkeys(parts[:3]))  # 최대 3개, 중복 제거
    return ""


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
            salary = m.group(0).strip()
            num = re.search(r"(\d+[\.,]?\d*)\s*(?:triệu|tr)", salary, re.IGNORECASE)
            if num:
                val = float(num.group(1).replace(",", "."))
                if val > 200:
                    return "Thỏa thuận"
            return salary
    return "Thỏa thuận"


def extract_title(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for line in lines[:8]:
        if any(kw in line.lower() for kw in ["tuyển", "cần tuyển", "nhân viên", "tìm người", "tuyển dụng"]):
            if 5 < len(line) < 150:
                return line
    for line in lines[:5]:
        if not is_person_name(line) and len(line) > 5:
            return line[:120]
    return lines[0][:120] if lines else "Tuyển dụng"


def extract_company(text: str) -> str:
    m = re.search(
        r"(?:công ty|cty|shop|cửa hàng|nhà hàng|quán|trung tâm|siêu thị)[:\s]+([^\n,\.]{3,60})",
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
    if re.search(r"nhà máy|sản xuất|công nhân|kho|lắp ráp|kỹ thuật|điện tử|cơ khí|đóng gói|phân loại", t):
        return "factory"
    if re.search(r"nhà hàng|quán ăn|quán nhậu|beer|bia|hải sản|lẩu|buffet|jollibee|haidilao|phục vụ bàn|bếp|đầu bếp|phụ bếp|nấu ăn", t):
        return "restaurant"
    if re.search(r"cà phê|cafe|coffee|trà sữa|pha chế|bartender|barista", t):
        return "cafe"
    if re.search(r"giao hàng|shipper|tài xế|xe máy|vận chuyển", t):
        return "delivery"
    if re.search(r"vệ sinh|giúp việc|dọn dẹp|tạp vụ", t):
        return "cleaning"
    if re.search(r"bán hàng|thu ngân|cửa hàng|siêu thị|sales|kinh doanh|thời trang|bán lẻ|tạp hóa", t):
        return "retail"
    if re.search(r"bảo vệ|giữ xe|trông xe|an ninh", t):
        return "security"
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
    text = NOISE_PATTERNS.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def is_person_name(line: str) -> bool:
    words = line.strip().split()
    if 1 <= len(words) <= 3 and all(w[0].isupper() for w in words if w):
        if not any(kw in line.lower() for kw in JOB_KEYWORDS):
            return True
    return False


async def is_login_wall(page) -> bool:
    title = (await page.title()).lower()
    try:
        body = (await page.locator("body").inner_text(timeout=5000)).lower()
    except Exception:
        body = ""

    login_markers = [
        "đăng nhập",
        "log in",
        "login",
        "mở ứng dụng",
        "open app",
        "forgot password",
    ]
    has_login_marker = any(marker in title or marker in body[:1000] for marker in login_markers)
    has_group_public_shell = "nhóm công khai" in body[:1000] or "public group" in body[:1000]
    has_feed_marker = "bình luận" in body or "comment" in body or "like" in body

    return has_login_marker and (has_group_public_shell or not has_feed_marker)


def mobile_group_url(url: str) -> str:
    return url.replace("https://www.facebook.com/", "https://m.facebook.com/")


async def expand_visible_posts(page) -> None:
    await page.evaluate("""() => {
        document.querySelectorAll('[role="button"], a').forEach(el => {
            const t = (el.innerText || el.textContent || '').trim()
            if (t.includes('더 보기') || t.includes('See more') || t.includes('Xem thêm')) {
                try { el.click() } catch {}
            }
        })
    }""")


async def article_count(page) -> int:
    return await page.evaluate("""() => {
        const selectors = [
            '[role="article"]',
            'div[data-ad-preview="message"]',
            'div[aria-posinset]',
            'div[data-ft]'
        ]
        return Math.max(...selectors.map(sel => document.querySelectorAll(sel).length), 0)
    }""")


async def extract_visible_posts(page) -> list[dict]:
    return await page.evaluate("""() => {
        const candidates = [
            ...document.querySelectorAll('[role="article"]'),
            ...document.querySelectorAll('div[aria-posinset]'),
            ...document.querySelectorAll('div[data-ft]')
        ]
        const seen = new Set()
        const posts = []

        for (const el of candidates) {
            const preview = el.querySelector('[data-ad-preview="message"]')
            const textNodes = preview
                ? [preview]
                : [...el.querySelectorAll('[dir="auto"], [data-ad-preview="message"]')]
            const lines = []
            for (const node of textNodes) {
                const t = (node.innerText || node.textContent || '').trim()
                if (t && t.length > 2) lines.push(t)
            }
            const text = [...new Set(lines)].join('\\n').trim()
            if (!text || text.length < 30) continue

            const key = text.slice(0, 120)
            if (seen.has(key)) continue
            seen.add(key)

            const imgs = []
            el.querySelectorAll('img[src]').forEach(img => {
                const src = img.src || ''
                const width = img.naturalWidth || img.width || 0
                if ((src.includes('scontent') || src.includes('fbcdn')) &&
                    !src.includes('emoji') && width > 80) {
                    imgs.push(src)
                }
            })

            const linkEl = el.querySelector('a[href*="story_fbid"], a[href*="/posts/"], a[href*="/groups/"][href*="multi_permalinks"]')
            const postUrl = linkEl ? linkEl.href : ''
            posts.push({ text, images: imgs, postUrl })
        }

        return posts
    }""")


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
    if await is_login_wall(page):
        print(f"  ⛔ Facebook 쿠키 인증 실패 — .env의 FB_C_USER/FB_XS를 새 값으로 갱신해주세요")
        return []

    print(f"  ✅ 로그인 확인: {title[:50]}")

    posts = []
    seen = set()
    step = 0
    used_mobile_fallback = False

    while len(posts) < TARGET_PER_GROUP:
        step += 1
        current_article_count = await article_count(page)
        if current_article_count == 0 and not used_mobile_fallback:
            fallback_url = mobile_group_url(url)
            print(f"    ↪ article 0개 — mobile fallback 재시도: {fallback_url}")
            try:
                await page.goto(fallback_url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3000)
                used_mobile_fallback = True
                if await is_login_wall(page):
                    print(f"    ⛔ mobile fallback도 로그인 벽 표시 — Facebook cookie 갱신 필요")
                    return posts
                current_article_count = await article_count(page)
            except Exception as e:
                print(f"    ⚠️ mobile fallback 실패: {e}")

        await expand_visible_posts(page)
        await page.wait_for_timeout(random.randint(800, 1500))

        for r in await extract_visible_posts(page):
            text = clean_text(r.get("text", ""))
            key = text[:80]
            if not text or key in seen or not is_job_post(text):
                continue

            if has_excluded_money_terms(text):
                print(f"    ⏩ 대출/채권회수 공고 스킵")
                continue

            # 사무/전문직은 건너뜀 (생활밀착형 집중)
            if is_office_job(text):
                print(f"    ⏩ 사무/전문직 스킵")
                continue

            seen.add(key)
            posts.append({**r, "text": text, "location": location})
            if len(posts) >= TARGET_PER_GROUP:
                break

        print(f"    스텝 {step}: article 후보 {current_article_count}개 처리, 공고 {len(posts)}개 수집")

        prev_count = current_article_count
        await page.evaluate(f"""() => {{
            const candidates = document.querySelectorAll('[role="article"], div[aria-posinset], div[data-ft]')
            const last = candidates[candidates.length - 1]
            if (last) last.scrollIntoView({{behavior: 'smooth', block: 'end'}})
        }}""")

        for _ in range(random.randint(5, 10)):
            await page.keyboard.press("ArrowDown")
            await page.wait_for_timeout(random.randint(100, 300))

        await page.wait_for_timeout(random.randint(2000, 4000))

        new_count = await article_count(page)
        if new_count == prev_count:
            print(f"    더 이상 게시물 없음 (총 {len(posts)}개)")
            break

    return posts


def parse_post(post: dict) -> dict:
    text = post["text"]
    images = post.get("images", [])
    location = post["location"]

    phone = extract_phone(text)
    zalo = extract_zalo(text) or phone  # Zalo 미표기 시 전화번호 공유
    district = extract_district(text)
    # 구/군/동 있으면 위치 정보를 더 구체적으로
    full_location = f"{district}, {location}" if district else location

    return {
        "title": extract_title(text),
        "company": extract_company(text),
        "location": full_location,
        "salary": extract_salary(text),
        "employer_phone": phone,
        "zalo": zalo,
        "description": f"[source:facebook] {text}",
        "category": guess_category(text),
        "posted_at": TODAY,
        "urgent": "tuyển gấp" in text.lower() or "gấp" in text.lower(),
        "application_deadline": extract_deadline(text),
        "active": True,
        "origin": "crawler",
        "admin_hidden": False,
        "image_url": images[0] if images else None,
        "images": images if images else None,
        "is_local_priority": is_local_priority(text),
    }


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 없음")
        return

    # 기존 facebook 공고 title 세트 조회 (중복 방지용)
    existing_raw = supabase.table("local_jobs") \
        .select("title,company") \
        .like("description", "%[source:facebook]%") \
        .execute()
    existing_keys = {
        (r["title"].strip().lower()[:60], r["company"].strip().lower()[:40])
        for r in (existing_raw.data or [])
    }
    print(f"  📋 기존 facebook 공고: {len(existing_keys)}개")

    # 생활밀착형 우선 정렬
    priority = [j for j in jobs if j.get("is_local_priority")]
    others   = [j for j in jobs if not j.get("is_local_priority")]
    ordered  = priority + others

    # 신규 공고만 필터링 (누적 추가)
    new_jobs = [
        j for j in ordered
        if (j["title"].strip().lower()[:60], j["company"].strip().lower()[:40]) not in existing_keys
    ]
    print(f"  📊 생활밀착형: {len(priority)}개 / 기타: {len(others)}개")
    print(f"  ➕ 신규 공고: {len(new_jobs)}개 / 중복 스킵: {len(ordered) - len(new_jobs)}개")

    def to_db_payload(job: dict) -> dict:
        transient_keys = {"is_local_priority", "zalo"}
        return {k: v for k, v in job.items() if k not in transient_keys}

    inserted = 0
    for i in range(0, len(new_jobs), 50):
        batch = [to_db_payload(j) for j in new_jobs[i:i+50]]
        supabase.table("local_jobs").insert(batch).execute()
        inserted += len(batch)
        print(f"  ✅ 저장: {inserted}/{len(new_jobs)}개")

    if not new_jobs:
        print("  ℹ️  새 공고 없음 — 기존 데이터 유지")


async def main():
    print("🚀 Facebook 그룹 크롤링 시작 (생활밀착형 우선)")
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
