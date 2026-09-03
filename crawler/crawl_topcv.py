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
from geocode import resolve_coordinate_accuracy
from job_quality import (
    CRAWLER_VERSION,
    canonical_job_key,
    classify_work_location_candidate,
    compute_job_updates,
    extract_salary_from_text,
    gate_auto_publish,
    guess_work_location_provinces,
    has_application_path,
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


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import atan2, cos, radians, sin, sqrt
    r = 6371.0
    d_lat, d_lng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))


def _address_core(normalized_address: str) -> str:
    """The address text minus its trailing comma-segment (typically a
    district/ward label) — used ONLY to decide "is this the same place as
    that other candidate", never for what gets geocoded or stored."""
    parts = normalized_address.rsplit(",", 1)
    return parts[0].strip() if len(parts) > 1 else normalized_address.strip()


def _is_duplicate_location(a: dict, b: dict) -> bool:
    """Two resolved rows count as the same real place only when BOTH signals
    agree: their coordinates are within ~100m AND their address text shares
    the same core (identical, or identical once the trailing district label
    is dropped). Coordinate-only matching was tried first and rejected — two
    genuinely different, imprecisely-specified addresses can independently
    geocode to the same district/ward centroid (Geoapify's fallback behavior
    for low-detail queries), and merging those would silently drop a real,
    distinct workplace instead of just de-duplicating a repeated one."""
    if _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"]) > 0.1:
        return False
    if a["normalized_address"] == b["normalized_address"]:
        return True
    core_a, core_b = _address_core(a["normalized_address"]), _address_core(b["normalized_address"])
    return bool(core_a) and core_a == core_b


def resolve_work_locations(candidates_with_region: list[dict]) -> tuple[list[dict], bool]:
    """Standard address pipeline, stage 4-7 (classify -> multi-candidate
    geocode cascade -> coordinate-accuracy scoring), applied identically for
    every job — never branched on job id or company.

    candidates_with_region: split_work_locations(..., with_region=True) output
    — each candidate carries the province/city label vieclam24h prefixed it
    with (e.g. "Bình Dương"), used by geocode.resolve_coordinate_accuracy()
    to validate the geocoder didn't quietly resolve it to a different
    province, and to bias the query toward the right area.

    address_accuracy (is the raw TEXT a genuine, specific address) and
    coordinate_accuracy (can a map pin be trusted for it) are deliberately
    independent — see geocode.py's module docstring for why a single-query
    confidence gate was tried first and rejected (it published only 2/10 on
    real addresses that all had genuine, displayable text). Only candidates
    classified 'exact' by classify_work_location_candidate() (i.e.
    address_accuracy == 'exact_text') get a row at all — 'region_only'/
    'undetermined' text is dropped here exactly as before. EVERY such
    candidate keeps its row regardless of what coordinate_accuracy comes
    back as ('exact'/'ward' carry a real lat/lng for the map; 'region'/
    'unresolved' carry none — the raw address TEXT is still shown, just
    without a fabricated-looking marker).

    Returns (resolved_rows, had_transient_failure). had_transient_failure is
    True when ANY candidate's cascade hit a transient geocode API failure —
    the caller MUST treat that as "this run's result is incomplete" and must
    not use it to replace/wipe previously-stored, known-good rows.
    """
    resolved: list[dict] = []
    had_transient_failure = False
    seen_texts: set[str] = set()
    for cand in candidates_with_region:
        text, region_prefix = cand["text"], cand.get("region_prefix")
        if classify_work_location_candidate(text) != "exact":
            continue
        text_key = text.strip().lower()
        if text_key in seen_texts:
            continue
        seen_texts.add(text_key)

        coord = resolve_coordinate_accuracy(text, region_prefix)
        if coord.get("had_transient_failure"):
            had_transient_failure = True
        tier = coord["coordinate_accuracy"]
        print(f"    📍 {tier:11} {text!r} — {coord['evidence']}")

        row = {
            "raw_address": text,
            "normalized_address": text_key,
            "lat": coord["lat"],
            "lng": coord["lng"],
            "geocode_status": "success" if tier in ("exact", "ward") else "failed",
            "geocode_source": coord.get("geocode_source"),
            "address_accuracy": "exact_text",
            "coordinate_accuracy": tier,
        }
        # 좌표가 있는 행(exact/ward)만 좌표 기준 중복 제거 대상 — region/
        # unresolved는 좌표가 없으므로 텍스트 중복(seen_texts)만으로 충분하다.
        if row["lat"] is not None and any(
            e.get("lat") is not None and _is_duplicate_location(row, e) for e in resolved
        ):
            continue
        resolved.append(row)
    return resolved, had_transient_failure

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


# Phrases vieclam24h (or a since-removed/expired posting) uses to say "this
# listing isn't actually open right now" — checked against the page's own
# body text so a stale source_url doesn't get trusted as a real application
# path just because the URL still 200s.
_EXPIRED_PAGE_PATTERNS = [
    "đã hết hạn", "đã bị gỡ", "tin không tồn tại", "đang được xét duyệt",
    "đang chờ duyệt", "tin đã đóng", "ngừng tuyển", "đã dừng tuyển",
    "tin tuyển dụng đã kết thúc",
]


async def fetch_job_detail(page, url: str) -> dict:
    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        http_status = response.status if response else None
        await page.wait_for_timeout(2000)
        result = await page.evaluate("""(expiredPatterns) => {
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

            // 실제 지원 버튼("Ứng tuyển ...") 존재 여부 + 만료/검수중/삭제 배너 여부.
            // source_url을 지원 경로로 신뢰해도 되는지 판단하는 근거.
            const bodyText = (document.body.innerText || '').toLowerCase()
            const hasApplyButton = Array.from(document.querySelectorAll('button, a'))
                .some(el => (el.innerText || '').includes('Ứng tuyển'))
            const expiredBanner = expiredPatterns.some(p => bodyText.includes(p))

            return { deadline, sections, hasApplyButton, expiredBanner }
        }""", _EXPIRED_PAGE_PATTERNS)
        result = result or {"deadline": None, "sections": {}, "hasApplyButton": False, "expiredBanner": False}
        if not result.get("sections"):
            # DOM heading selectors occasionally miss SPA detail layouts; keep a
            # bounded body fallback so crawler jobs are not saved as URL-only.
            body_text = await page.locator("body").inner_text(timeout=5000)
            fallback = normalize_whitespace(body_text)[:1800]
            if fallback:
                result["sections"] = {"Mô tả công việc": fallback}
        result["httpStatus"] = http_status
        return result
    except Exception as exc:
        print(f"    ⚠️  상세 수집 실패: {url} ({exc})")
        # 페이지를 아예 확인 못했으므로 지원 가능하다고 낙관할 근거가 없다 —
        # hasApplyButton=False가 has_application_path()에서 안전한 기본값.
        return {"deadline": None, "sections": {}, "hasApplyButton": False, "expiredBanner": False, "httpStatus": None}


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
            work_locations = split_work_locations(work_location_section, with_region=True)
            salary = normalize_salary(j.get("salary")) if normalize_whitespace(j.get("salary")) else extract_salary_from_text(desc_text)

            # 분류: 제목 + 회사 + 본문 첫 300자 활용
            category = classify(title, company, desc_text)

            # 리스트 카드 키워드 매칭이 실패했거나(빈 값) 값이 있어도 실제로는
            # location처럼 보이지 않으면(예: 제목/급여/회사명 전체가 그대로 들어온
            # sb-4313류 버그) 신뢰하지 않고 제목 + 실제 근무지 주소 섹션에서 다시
            # 찾는다 — sb-4312(지역 매칭 실패 → 잘못된 fallback 대도시)와
            # sb-4313(제목 전체가 location으로 저장됨) 재발 방지.
            location = normalize_location(
                j.get("location"), detail_text=f"{title} {work_location_section}",
                title=title, company=company, salary=salary,
            )
            # 'Địa điểm làm việc' 섹션에 구조화된 주소가 없어도, 제목/본문에 여러
            # 지역명이 함께 언급되는 공고(예: "Bắc Ninh / Bình Dương / Long An /
            # Đà Nẵng")가 있다 — 이 경우 첫 지역 하나만 쓰면 나머지 근무지 정보가
            # 사라지므로, 발견된 지역 전부를 work_locations 후보로 남겨서 나중에
            # geocode.py가 각각의 근사 위치를 붙일 수 있게 한다(정확한 주소가
            # 아니므로 회사 본사 주소로 대체하지 않고, 지역명 자체를 그대로 저장).
            # guess_work_location_provinces()는 제목 + "근무지 문맥" 문장만 보므로
            # (전체 본문을 훑는 guess_all_provinces_from_text()와 달리) 복지 여행/
            # 교육 장소/출장지처럼 근무지가 아닌 지역이 섞여 들어오는 오탐을 줄인다.
            if not work_locations:
                mentioned_provinces = guess_work_location_provinces(title, desc_text)
                if len(mentioned_provinces) > 1:
                    # 이 경로는 원문 지역명 그 자체가 후보이자 그 후보의 "예상 지역"이므로
                    # region_prefix로도 같은 값을 준다(geocode 결과가 실제로 그 지역인지
                    # 검증할 근거로 쓰인다).
                    work_locations = [{"text": p, "region_prefix": p} for p in mentioned_provinces]

            # 표준 파이프라인 4-7단계: 후보 분류 -> geocode/좌표 검증 -> 지원 경로
            # 확인 -> 공개 게이트. 신규/기존 공고, 특정 id/회사명과 무관하게 항상
            # 동일하게 적용한다(예외 코드 없음).
            resolved_locations, had_transient_geocode_failure = resolve_work_locations(work_locations)
            source_url_value = j.get("href") or None
            employer_phone_value = ""
            should_publish, gate_reason = gate_auto_publish(
                # 상세주소 "텍스트"가 있는지만 본다 — geocode(좌표) 성공 여부와
                # 무관하다. resolve_work_locations()는 exact_text로 분류된
                # 후보라면 좌표를 못 찾아도(coordinate_accuracy='unresolved')
                # 행을 만들어 반환하므로, 이 길이만으로 "상세주소 있음"을 뜻한다.
                has_address_text=len(resolved_locations) > 0,
                has_application_path_=has_application_path(
                    employer_phone_value, "", source_url_value,
                    source_page_valid=(detail.get("httpStatus") in (200, None) and not detail.get("expiredBanner")),
                    has_apply_affordance=bool(detail.get("hasApplyButton")),
                ),
            )

            job = {
                "title": title,
                "company": company,
                "location": location,
                "salary": salary,
                "description": description,
                "category": category,
                "posted_at": TODAY,
                "urgent": False,
                "employer_phone": employer_phone_value,
                "application_deadline": deadline,
                "active": should_publish,
                "origin": "crawler",
                "admin_hidden": False,
                "image_url": logo if logo and logo.startswith("http") else None,
                "source_url": source_url_value,
            }
            quality_errors = validate_job_payload(job, source="vieclam24h", today=TODAY)
            if quality_errors:
                skipped += 1
                print(f"    ⏩ 품질 스킵: {title[:70]} ({', '.join(quality_errors)})")
                continue
            if not should_publish:
                print(f"    🔒 공개 보류({gate_reason}): {title[:70]}")
            # local_jobs 컬럼이 아닌 임시 필드 — save_to_supabase에서 job_work_locations
            # insert에만 쓰고 local_jobs insert 페이로드에서는 제거한다.
            job["_work_locations"] = work_locations
            job["_resolved_locations"] = resolved_locations
            job["_gate_reason"] = gate_reason
            job["_had_transient_geocode_failure"] = had_transient_geocode_failure
            # local_jobs.crawler_version/last_verified_at don't exist yet (see
            # the reviewed-but-not-yet-applied migration) — kept as internal
            # fields only until that migration is approved and run; not sent
            # to local_jobs by save_to_supabase() (it strips every "_"-prefixed
            # key). Renaming these (drop the "_") is the only change needed
            # once the columns exist.
            job["_crawler_version"] = CRAWLER_VERSION
            jobs.append(job)
            if (idx + 1) % 20 == 0:
                print(f"    {idx + 1}/{len(unique_raw)}개 완료 (제외: {skipped}개)")

        await browser.close()
        return jobs


def save_to_json(jobs: list[dict], filename: str = "jobs_output.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON 저장: {filename} ({len(jobs)}개)")


def _work_location_rpc_rows(resolved_locations: list[dict]) -> list[dict]:
    return [
        {
            "raw_address": loc["raw_address"],
            "normalized_address": loc["normalized_address"],
            "lat": loc["lat"],
            "lng": loc["lng"],
            "geocode_status": loc["geocode_status"],
            "geocode_source": loc["geocode_source"],
            "address_accuracy": loc.get("address_accuracy", "exact_text"),
            "coordinate_accuracy": loc.get("coordinate_accuracy"),
            "sort_order": idx,
        }
        for idx, loc in enumerate(resolved_locations)
    ]


def _replace_job_work_locations(job_id: int, resolved_locations: list[dict]) -> None:
    """Atomic replace via the replace_job_work_locations(p_job_id, p_rows)
    Postgres function (see supabase/migrations/ — NOT yet applied to the
    live DB, see the migration review in the handoff doc) — a plpgsql
    function body runs in a single transaction, so a failure partway through
    (e.g. a constraint violation) rolls back the delete too, instead of the
    two separate .delete()/.insert() calls this replaced, where a failure
    after the delete but before the insert could leave a job with zero
    known work locations even though good data existed a moment earlier.

    Callers must NOT call this when address resolution had a transient
    failure (geocode API error) for this job this run — see
    resolve_work_locations()'s had_transient_failure — an incomplete result
    must never replace previously-known-good rows.
    """
    supabase.rpc(
        "replace_job_work_locations",
        {"p_job_id": job_id, "p_rows": _work_location_rpc_rows(resolved_locations)},
    ).execute()


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    # 기존 vieclam24h 공고(핵심 필드 포함) 조회 — 매칭은 여전히 canonical_job_key
    # (title+company)로 하되, 이미 있는 공고라도 salary/deadline/description/
    # location/source_url 중 실제로 바뀐 값이 있으면 update한다(예전엔 무조건 skip).
    # origin도 함께 가져온다 — 공개 게이트를 크롤러 출처 공고에만 적용하기 위함
    # (기업이 직접 등록한 공고는 이 게이트로 절대 자동 강등하지 않는다).
    existing_raw = supabase.table("local_jobs") \
        .select("id,title,company,salary,application_deadline,description,location,source_url,active,origin") \
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
    demoted = 0
    work_location_rows_total = 0
    skipped_wl_sync_on_transient_failure = 0
    for j in jobs:
        key = canonical_job_key(j["title"], j["company"])
        existing_row = existing_by_key.get(key)
        if existing_row is None:
            new_jobs.append(j)
            continue

        field_updates = compute_job_updates(existing_row, j)
        # 공개 게이트 재평가는 이 공고가 실제로 크롤러가 만든 것일 때만 active를
        # 건드린다 — 기업이 직접 등록한 공고(origin != 'crawler')는 재크롤
        # 매칭 대상이 될 일이 거의 없지만, 있더라도 이 표준으로 자동 강등하지
        # 않는다(사용자 지시). 크롤러 출처는 양방향(승격/강등) 모두 적용하고,
        # 강등 시 사유를 publish_gate_reason에 남긴다.
        if existing_row.get("origin") == "crawler":
            if existing_row.get("active") != j.get("active"):
                field_updates["active"] = j["active"]
                if existing_row.get("active") and not j.get("active"):
                    demoted += 1
            field_updates["publish_gate_reason"] = j.get("_gate_reason")

        if field_updates:
            supabase.table("local_jobs").update(field_updates).eq("id", existing_row["id"]).execute()
            updated += 1
        else:
            unchanged += 1

        # job_work_locations는 INSERT/UPDATE 양쪽 경로에서 완전히 동일하게,
        # 원자적으로(RPC) 동기화한다 — 이전엔 UPDATE 경로에서 이 테이블이 아예
        # 갱신되지 않는 버그가 있었음(id 4366/4367/4368으로 재현 확인됨). 단,
        # 이번 판정이 geocode API 오류로 불완전하면 기존 데이터를 그대로 둔다
        # (불완전한 결과로 알고 있던 좋은 데이터를 지우지 않는다).
        job_id = existing_row["id"]
        if j.get("_had_transient_geocode_failure"):
            skipped_wl_sync_on_transient_failure += 1
        else:
            _replace_job_work_locations(job_id, j.get("_resolved_locations") or [])
            work_location_rows_total += len(j.get("_resolved_locations") or [])

    print(
        f"  ➕ 신규 공고: {len(new_jobs)}개 / 🔄 업데이트: {updated}개 / ⏭️ 변경 없음: {unchanged}개"
        f" / 🔻 재크롤 후 보류 전환: {demoted}개"
    )
    if skipped_wl_sync_on_transient_failure:
        print(f"  ⚠️  geocode 일시 오류로 근무지 동기화 보류(기존 데이터 유지): {skipped_wl_sync_on_transient_failure}개")

    inserted = 0
    for i in range(0, len(new_jobs), 50):
        batch = new_jobs[i:i+50]
        # local_jobs에는 실제 컬럼만 보낸다 — _work_locations/_resolved_locations/
        # _gate_reason/_had_transient_geocode_failure는 별도 테이블용 임시 필드.
        local_jobs_batch = [
            {k: v for k, v in job.items() if not k.startswith("_")}
            for job in batch
        ]
        result = supabase.table("local_jobs").insert(local_jobs_batch).execute()
        inserted += len(batch)
        print(f"  ✅ Supabase 저장: {inserted}/{len(new_jobs)}개")

        inserted_rows = result.data or []
        for job, row in zip(batch, inserted_rows):
            job_id = row.get("id")
            resolved = job.get("_resolved_locations") or []
            # 신규 삽입은 기존 데이터가 없으므로 transient failure라도 빈 결과로
            # 두는 것 자체는 안전하다(지울 기존 데이터가 없음) — 다만 완전한
            # 판정이 아니었다는 사실은 로그로 남긴다.
            if job.get("_had_transient_geocode_failure"):
                print(f"    ⚠️  job_id={job_id}: geocode 일시 오류 있었음(일부 후보 미판정)")
            if not job_id or not resolved:
                continue
            _replace_job_work_locations(job_id, resolved)
            work_location_rows_total += len(resolved)

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
