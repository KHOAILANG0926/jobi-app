"""
vieclam24h.vn 채용공고 크롤러
- 카테고리 페이지에서 실제 공고 수집
- 실행: python3 crawl_topcv.py
"""

import argparse
import asyncio
import json
import os
import re
import urllib.parse
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
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
    ascii_key,
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
    """Single detail-page fetch, used for every URL this crawler ever visits
    (fresh discovery, re-visit of a known job, or a manually triggered
    --process-url/--reprocess-ids run) — one page load, one shared extraction.
    fetchOk=False + fetchError set means the page itself could not be read at
    all; callers must treat that as a genuine failure (record the stage/
    reason) rather than silently falling back to empty-but-successful data."""
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

            // 상세페이지 자체에서 title/company/근무지역 라벨을 독립적으로 추출한다 —
            // 리스팅 카드 파싱(crawl_category)과 완전히 분리된 경로라 배지 오추출/
            // title=location 오추출 버그의 영향을 받지 않는다. source_url이 없어
            // 재검색으로 URL을 다시 찾아야 하는 기존 공고 재처리 시, 리스팅 카드
            // 없이도 이 값들만으로 필수정보를 온전히 재추출할 수 있다.
            const h1 = document.querySelector('h1')
            const detailTitle = h1 ? h1.innerText.trim() : ''
            const companyLink = Array.from(document.querySelectorAll('a'))
              .find(a => (a.getAttribute('href') || '').includes('/nha-tuyen-dung/')
                || (a.getAttribute('href') || '').match(/-ntd\\d+/))
            const detailCompany = companyLink ? companyLink.textContent.trim() : ''
            let detailLocationLabel = ''
            for (const el of document.querySelectorAll('*')) {
              if (el.children.length === 0 && (el.textContent || '').trim() === 'Khu vực tuyển') {
                detailLocationLabel = el.nextElementSibling ? el.nextElementSibling.textContent.trim() : ''
                break
              }
            }

            return {
                deadline, sections, hasApplyButton, expiredBanner,
                detailTitle, detailCompany, detailLocationLabel,
            }
        }""", _EXPIRED_PAGE_PATTERNS)
        result = result or {
            "deadline": None, "sections": {}, "hasApplyButton": False, "expiredBanner": False,
            "detailTitle": "", "detailCompany": "", "detailLocationLabel": "",
        }
        if not result.get("sections"):
            # DOM heading selectors occasionally miss SPA detail layouts; keep a
            # bounded body fallback so crawler jobs are not saved as URL-only.
            body_text = await page.locator("body").inner_text(timeout=5000)
            fallback = normalize_whitespace(body_text)[:1800]
            if fallback:
                result["sections"] = {"Mô tả công việc": fallback}
        result["httpStatus"] = http_status
        result["fetchOk"] = True
        result["fetchError"] = None
        return result
    except Exception as exc:
        print(f"    ⚠️  상세 수집 실패: {url} ({exc})")
        return {
            "deadline": None, "sections": {}, "hasApplyButton": False, "expiredBanner": False,
            "httpStatus": None, "detailTitle": "", "detailCompany": "", "detailLocationLabel": "",
            "fetchOk": False, "fetchError": str(exc),
        }


def format_description(sections: dict) -> str:
    order = ["Mô tả công việc", "Yêu cầu công việc", "Quyền lợi"]
    parts = []
    for key in order:
        if key in sections and sections[key]:
            content = str(sections[key]).strip()[:2000]
            parts.append(f"## {key}\n{content}")
    return "\n\n".join(parts)[:5000]


@asynccontextmanager
async def browser_page():
    """One shared browser/page setup — used by the category crawl, a single
    --process-url run, and --reprocess-ids alike, so none of them can drift
    from another in headers/viewport/stealth behavior."""
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
        try:
            yield page
        finally:
            await browser.close()


def build_job_record(url: str, detail: dict, listing_hint: dict | None = None) -> dict:
    """표준 파이프라인의 단일 처리 함수: 상세페이지 수집 결과(detail) ->
    필수정보·상세주소 추출 -> 주소/좌표 정확도 판정 -> 지원 가능 여부 판정 ->
    공개 게이트까지 한 번에 결정한다. 신규 발견(카테고리 크롤), 이미 아는
    공고의 재방문, --process-url/--reprocess-ids로 수동 지정된 단건 처리
    모두 이 함수 하나만 거친다 — 특정 job id/회사명으로 분기하는 코드는
    어디에도 없다.

    listing_hint: 카테고리 목록 카드에서 얻은 title/company/salary/logoUrl
    (있을 때만) — 상세페이지 자체 추출(detail.detailTitle 등)이 항상 우선이고,
    listing_hint는 그게 비어 있을 때의 보조 값일 뿐이다.

    실패/스킵은 절대 도시 중심 좌표나 데모 데이터로 메우지 않고 명시적으로
    구분해 반환한다:
    - `_pipeline_failed=True`: 상세페이지 자체를 못 읽음(_failure_stage=
      'detail_fetch', _failure_reason=예외 메시지) — 저장 단계에서 기존 데이터를
      덮어쓰지 않기 위한 신호.
    - `_skip=True`: 페이지는 읽었지만 정책상 저장하지 않는 정상적인 필터링
      (마감/블랙리스트/품질검증 실패) — `_skip_reason`/`_skip_detail`.
    - 둘 다 없으면 정상 레코드 — `_work_locations`/`_resolved_locations`/
      `_had_transient_geocode_failure`가 추가로 포함된다.
    """
    listing_hint = listing_hint or {}
    title = normalize_whitespace(detail.get("detailTitle") or listing_hint.get("title") or "")
    company = normalize_whitespace(detail.get("detailCompany") or listing_hint.get("company") or "")

    if not detail.get("fetchOk", True):
        return {
            "source_url": url, "title": title, "company": company,
            "_pipeline_failed": True, "_failure_stage": "detail_fetch",
            "_failure_reason": detail.get("fetchError"),
        }

    deadline = detail.get("deadline")
    if deadline and deadline <= TODAY:
        return {
            "source_url": url, "title": title, "company": company,
            "_skip": True, "_skip_reason": "deadline_expired", "_skip_detail": deadline,
        }
    if is_blacklisted(title, company):
        return {
            "source_url": url, "title": title, "company": company,
            "_skip": True, "_skip_reason": "blacklisted",
        }

    logo = listing_hint.get("logoUrl", "")
    desc_text = format_description(detail.get("sections", {}))
    description = f"[source:vieclam24h] {desc_text}" if desc_text else f"[source:vieclam24h] {url}"
    # 'Địa điểm làm việc' 섹션(있을 때만)에서 실제 근무지 주소를 추출한다.
    # 회사 개요/연락처 섹션(예: QTSC 본사 주소)은 이 heading 밑에 오지 않으므로
    # fetch_job_detail의 heading 경계 추출 자체가 혼입을 막는다.
    work_location_section = detail.get("sections", {}).get("Địa điểm làm việc", "")
    work_locations = split_work_locations(work_location_section, with_region=True)
    listing_salary = listing_hint.get("salary")
    salary = normalize_salary(listing_salary) if normalize_whitespace(listing_salary) else extract_salary_from_text(desc_text)

    # 분류: 제목 + 회사 + 본문 첫 300자 활용
    category = classify(title, company, desc_text)

    # 목록 카드 키워드 매칭이 실패했거나(빈 값) 값이 있어도 실제로는 location처럼
    # 보이지 않으면(예: 제목/급여/회사명 전체가 그대로 들어온 경우) 신뢰하지 않고,
    # 상세페이지 자체의 "Khu vực tuyển" 라벨 -> 제목+근무지 섹션 순으로 다시 찾는다.
    location_label = detail.get("detailLocationLabel") or listing_hint.get("location")
    location = normalize_location(
        location_label, detail_text=f"{title} {work_location_section}",
        title=title, company=company, salary=salary,
    )
    # 'Địa điểm làm việc' 섹션에 구조화된 주소가 없어도, 제목/본문에 여러
    # 지역명이 함께 언급되는 공고(예: "Bắc Ninh / Bình Dương / Long An /
    # Đà Nẵng")가 있다 — 이 경우 첫 지역 하나만 쓰면 나머지 근무지 정보가
    # 사라지므로, 발견된 지역 전부를 work_locations 후보로 남겨서 나중에
    # geocode.py가 각각의 근사 위치를 붙일 수 있게 한다(정확한 주소가
    # 아니므로 회사 본사 주소로 대체하지 않고, 지역명 자체를 그대로 저장).
    if not work_locations:
        mentioned_provinces = guess_work_location_provinces(title, desc_text)
        if len(mentioned_provinces) > 1:
            work_locations = [{"text": p, "region_prefix": p} for p in mentioned_provinces]

    # 표준 파이프라인 4-7단계: 후보 분류 -> geocode/좌표 검증 -> 지원 경로
    # 확인 -> 공개 게이트. 신규/기존 공고, 특정 id/회사명과 무관하게 항상
    # 동일하게 적용한다(예외 코드 없음).
    resolved_locations, had_transient_geocode_failure = resolve_work_locations(work_locations)
    employer_phone_value = ""
    has_app_path = has_application_path(
        employer_phone_value, "", url,
        source_page_valid=(detail.get("httpStatus") in (200, None) and not detail.get("expiredBanner")),
        has_apply_affordance=bool(detail.get("hasApplyButton")),
    )
    should_publish, gate_reason = gate_auto_publish(
        # 상세주소 "텍스트"가 있는지만 본다 — geocode(좌표) 성공 여부와
        # 무관하다. resolve_work_locations()는 exact_text로 분류된
        # 후보라면 좌표를 못 찾아도(coordinate_accuracy='unresolved')
        # 행을 만들어 반환하므로, 이 길이만으로 "상세주소 있음"을 뜻한다.
        has_address_text=len(resolved_locations) > 0,
        has_application_path_=has_app_path,
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
        "source_url": url,
        # local_jobs 실제 컬럼(migration 0015로 추가됨) — insert/update 양쪽
        # 경로에서 항상 함께 저장된다(과거엔 insert 경로에서 publish_gate_reason이
        # 저장 안 되던 결함이 있었음 — 이 함수로 통합하며 같이 고쳐짐).
        "publish_gate_reason": gate_reason,
        "crawler_version": CRAWLER_VERSION,
    }
    quality_errors = validate_job_payload(job, source="vieclam24h", today=TODAY)
    if quality_errors:
        job["_skip"] = True
        job["_skip_reason"] = "quality_invalid"
        job["_skip_detail"] = ", ".join(quality_errors)
        return job

    # local_jobs 컬럼이 아닌 임시 필드 — upsert_job_record()가 job_work_locations
    # 동기화에만 쓰고 local_jobs 페이로드에서는 제거한다.
    job["_work_locations"] = work_locations
    job["_resolved_locations"] = resolved_locations
    job["_had_transient_geocode_failure"] = had_transient_geocode_failure
    return job


async def process_job_url(page, url: str, listing_hint: dict | None = None) -> dict:
    """디스커버리 방식과 무관한 단일 진입점 — 카테고리 크롤이 새로 찾은 URL,
    재크롤에서 다시 만난 이미 아는 URL, --process-url/--reprocess-ids로 수동
    지정된 URL 모두 이 함수 하나로 상세 수집 + build_job_record를 거친다."""
    detail = await fetch_job_detail(page, url)
    return build_job_record(url, detail, listing_hint)


async def crawl_vieclam24h() -> list[dict]:
    async with browser_page() as page:
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

        # 각 공고: 상세 수집 -> 필수정보/주소 추출 -> 판정까지 build_job_record
        # 하나로 처리(신규 발견 여부와 무관 — 저장 단계에서만 신규/기존을 가른다).
        print(f"\n  📋 상세 페이지 수집 중 ({len(unique_raw)}개)...")
        jobs = []
        skipped = 0
        for idx, j in enumerate(unique_raw):
            job = await process_job_url(page, j["href"], listing_hint=j)

            if job.get("_skip"):
                skipped += 1
                if job["_skip_reason"] == "quality_invalid":
                    print(f"    ⏩ 품질 스킵: {job.get('title', '')[:70]} ({job.get('_skip_detail')})")
                continue
            if job.get("_pipeline_failed"):
                skipped += 1
                continue
            if not job.get("active"):
                print(f"    🔒 공개 보류({job.get('publish_gate_reason')}): {job.get('title', '')[:70]}")

            jobs.append(job)
            if (idx + 1) % 20 == 0:
                print(f"    {idx + 1}/{len(unique_raw)}개 완료 (제외: {skipped}개)")

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


def load_existing_lookup_maps() -> tuple[dict, dict]:
    """이 크롤러가 쓰는 기존 공고 조회는 이 함수 하나뿐이다 — 카테고리 전체
    크롤(수백 건)과 --process-url/--reprocess-ids(1~수건) 모두 동일하게
    이 함수로 미리 로드한 맵을 매칭에 쓴다(건별 개별 쿼리 없음).
    Returns (by_source_url, by_key) — source_url이 있는 행은 by_source_url에도
    같이 들어간다."""
    existing_raw = supabase.table("local_jobs") \
        .select("id,title,company,salary,application_deadline,description,location,source_url,active,origin") \
        .like("description", "%[source:vieclam24h]%") \
        .execute()
    rows = existing_raw.data or []
    by_source_url = {r["source_url"]: r for r in rows if r.get("source_url")}
    by_key = {canonical_job_key(r.get("title", ""), r.get("company", "")): r for r in rows}
    return by_source_url, by_key


def match_existing_row(job: dict, by_source_url: dict, by_key: dict) -> dict | None:
    """이 공고가 이미 local_jobs에 있는지 판단하는 단 하나의 규칙 — source_url이
    있으면 정확히 그 값으로(제목이 원문 사이트에서 수정돼도 안전), 없으면
    canonical_job_key(title, company)로 대조한다(source_url이 아직 없던
    구버전 행 대비 하위호환)."""
    src = job.get("source_url")
    if src and src in by_source_url:
        return by_source_url[src]
    return by_key.get(canonical_job_key(job.get("title", ""), job.get("company", "")))


def upsert_job_record(job: dict, by_source_url: dict, by_key: dict) -> dict:
    """이 크롤러가 local_jobs/job_work_locations에 쓰는 단 하나의 저장 경로.
    카테고리 전체 크롤이 새로 발견한 공고, 재크롤에서 다시 만난 이미 아는
    공고, --process-url/--reprocess-ids로 수동 지정된 단건 재처리 —
    셋 다 신규든 기존이든 이 함수 하나만 거친다. 특정 job id/회사명으로
    분기하는 코드는 없다.

    실패(_pipeline_failed)는 절대 도시 중심 좌표나 데모 데이터로 메우지 않고,
    기존 행이 있으면 그 데이터를 그대로 둔 채 실패를 반환하며, 신규면 아무것도
    쓰지 않는다."""
    existing = match_existing_row(job, by_source_url, by_key)

    if job.get("_pipeline_failed"):
        print(f"    ❌ 파이프라인 실패[{job.get('_failure_stage')}]: {job.get('title', '')[:60]!r} — {job.get('_failure_reason')}")
        if existing:
            print(f"       기존 id={existing['id']} 데이터는 그대로 둠(실패한 결과로 덮어쓰지 않음)")
            return {"action": "failed_existing_untouched", "id": existing["id"]}
        return {"action": "failed_new_skipped", "id": None}

    resolved = job.get("_resolved_locations") or []
    had_transient = job.get("_had_transient_geocode_failure", False)

    if existing is None:
        insert_payload = {k: v for k, v in job.items() if not k.startswith("_")}
        insert_payload["last_verified_at"] = datetime.now(timezone.utc).isoformat()
        result = supabase.table("local_jobs").insert(insert_payload).execute()
        row = (result.data or [{}])[0]
        job_id = row.get("id")
        action = "inserted"
    else:
        field_updates = compute_job_updates(existing, job)
        # 공개 게이트/버전 필드는 이 공고가 실제로 크롤러가 만든 것일 때만
        # 건드린다 — 기업이 직접 등록한 공고(origin != 'crawler')는 이 매칭에
        # 걸릴 일이 거의 없지만, 있더라도 이 표준으로 절대 승격/강등하지 않는다.
        if existing.get("origin") == "crawler":
            field_updates["active"] = job["active"]
            field_updates["publish_gate_reason"] = job["publish_gate_reason"]
            field_updates["crawler_version"] = job["crawler_version"]
            field_updates["last_verified_at"] = datetime.now(timezone.utc).isoformat()
        if field_updates:
            supabase.table("local_jobs").update(field_updates).eq("id", existing["id"]).execute()
            action = "updated"
        else:
            action = "unchanged"
        job_id = existing["id"]

    # job_work_locations는 INSERT/UPDATE 양쪽 경로에서 완전히 동일하게, 원자적으로
    # (RPC) 동기화한다. 이번 판정이 geocode API 오류로 불완전하면 기존 데이터를
    # 그대로 둔다(불완전한 결과로 알고 있던 좋은 데이터를 지우지 않는다).
    if job_id and not had_transient:
        _replace_job_work_locations(job_id, resolved)
    elif had_transient:
        print(f"    ⚠️  job_id={job_id}: geocode 일시 오류 — 근무지 동기화 보류(기존 데이터 유지)")

    return {"action": action, "id": job_id}


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 설정 없음 → JSON만 저장")
        return

    by_source_url, by_key = load_existing_lookup_maps()
    print(f"  📋 기존 vieclam24h 공고: {len(by_key)}개")

    counts = {
        "inserted": 0, "updated": 0, "unchanged": 0,
        "failed_existing_untouched": 0, "failed_new_skipped": 0,
    }
    demoted = 0
    work_location_rows_total = 0
    for job in jobs:
        existing = match_existing_row(job, by_source_url, by_key)
        was_active_crawler = bool(
            existing and existing.get("origin") == "crawler" and existing.get("active")
        )
        result = upsert_job_record(job, by_source_url, by_key)
        counts[result["action"]] = counts.get(result["action"], 0) + 1
        if was_active_crawler and job.get("active") is False:
            demoted += 1
        work_location_rows_total += len(job.get("_resolved_locations") or [])

    print(
        f"  ➕ 신규: {counts['inserted']}개 / 🔄 업데이트: {counts['updated']}개 / ⏭️ 변경 없음: {counts['unchanged']}개"
        f" / 🔻 재크롤 후 보류 전환: {demoted}개"
        f" / ❌ 실패: {counts['failed_existing_untouched'] + counts['failed_new_skipped']}개"
    )
    if work_location_rows_total:
        print(f"  📍 근무지 주소 저장: {work_location_rows_total}건 (job_work_locations)")
    if not jobs:
        print("  ℹ️  처리할 공고 없음")


_SEARCH_LIST_JS = """() => {
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
        const deadlineLine = lines.find(l => /^Còn\\s+\\d+\\s+ngày$/.test(l)) || ''
        const daysMatch = deadlineLine.match(/\\d+/)
        const fullHref = href.startsWith('http') ? href : 'https://vieclam24h.vn' + href
        items.push({ title, company, href: fullHref, daysLeft: daysMatch ? parseInt(daysMatch[0], 10) : null })
    })
    return items
}"""


async def search_source_url_candidates(page, title: str) -> list[dict]:
    """title 재검색으로 후보 URL을 찾는다 — source_url이 없는(레거시) 기존
    공고를 재처리할 때만 쓰는 디스커버리 단계. 이후 처리(process_job_url)는
    카테고리 크롤로 찾은 URL과 완전히 동일하다."""
    query = urllib.parse.quote(title)
    await page.goto(
        f"https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q={query}",
        wait_until="domcontentloaded", timeout=20000,
    )
    await page.wait_for_timeout(1500)
    try:
        return await page.evaluate(_SEARCH_LIST_JS)
    except Exception:
        return []


def match_source_url_candidate(title: str, company: str, deadline: str | None, candidates: list[dict], today: date) -> dict:
    """EXACT(원문 완전 일치, 후보 1개)/HIGH(정규화 일치 + 마감일 ±1일, 후보 1개)만
    채택 — AMBIGUOUS/NOT_FOUND는 호출자가 재처리를 건너뛰는 신호로 쓴다."""
    key = (ascii_key(title)[:80], ascii_key(company)[:60])
    normalized_matches = [c for c in candidates if (ascii_key(c["title"])[:80], ascii_key(c["company"])[:60]) == key]
    if not normalized_matches:
        return {"confidence": "NOT_FOUND", "url": None}

    exact_matches = [c for c in normalized_matches if c["title"] == title and c["company"] == company]
    if len(exact_matches) == 1:
        return {"confidence": "EXACT", "url": exact_matches[0]["href"]}

    if len(normalized_matches) == 1:
        cand = normalized_matches[0]
        if deadline and cand.get("daysLeft") is not None:
            cand_deadline = (today + timedelta(days=cand["daysLeft"])).isoformat()
            if abs((date.fromisoformat(deadline) - date.fromisoformat(cand_deadline)).days) <= 1:
                return {"confidence": "HIGH", "url": cand["href"]}
        return {"confidence": "AMBIGUOUS", "url": cand["href"]}

    return {"confidence": "AMBIGUOUS", "url": None}


async def discover_source_url(page, existing_row: dict) -> tuple[str | None, str]:
    """기존 행에 source_url이 있으면 그대로 쓰고, 없으면 title 재검색으로
    확정(EXACT/HIGH)되는 URL만 채택한다 — AMBIGUOUS/NOT_FOUND는 URL 없이
    confidence만 반환해 호출자가 그 공고를 건너뛰게 한다(잘못된 공고를
    엉뚱한 URL로 재처리하는 사고 방지)."""
    if existing_row.get("source_url"):
        return existing_row["source_url"], "existing"
    candidates = await search_source_url_candidates(page, existing_row.get("title", ""))
    match = match_source_url_candidate(
        existing_row.get("title", ""), existing_row.get("company", ""),
        existing_row.get("application_deadline"), candidates, date.today(),
    )
    if match["confidence"] in ("EXACT", "HIGH"):
        return match["url"], match["confidence"]
    return None, match["confidence"]


async def process_single_url(url: str) -> dict:
    """--process-url: source_url 1건만 표준 파이프라인으로 처리한다. 신규/
    기존 여부는 upsert_job_record()가 자동으로 판별한다 — 목록 페이지는
    전혀 건드리지 않으므로 신규 공고 수집이 아니다."""
    by_source_url, by_key = load_existing_lookup_maps()
    async with browser_page() as page:
        job = await process_job_url(page, url)
    result = upsert_job_record(job, by_source_url, by_key)
    return {**job, **result}


async def reprocess_jobs(job_ids: list[int]) -> list[dict]:
    """--reprocess-ids: 지정된 local_jobs id들만 표준 파이프라인으로 재처리한다.
    job_ids는 호출 시점에 전달되는 값일 뿐 코드에 하드코딩되지 않는다 — 이
    함수 자체는 어떤 특정 id/회사명도 알지 못한다. 카테고리 목록 페이지는
    전혀 방문하지 않으므로 신규 공고 수집이 아니다."""
    if not job_ids:
        return []
    rows = supabase.table("local_jobs") \
        .select("id,title,company,salary,application_deadline,description,location,source_url,active,origin,employer_phone") \
        .in_("id", job_ids).eq("origin", "crawler").execute().data or []
    rows_by_id = {r["id"]: r for r in rows}
    by_source_url, by_key = load_existing_lookup_maps()

    reports = []
    async with browser_page() as page:
        for job_id in job_ids:
            row = rows_by_id.get(job_id)
            if not row:
                reports.append({
                    "id": job_id, "_pipeline_failed": True, "_failure_stage": "lookup",
                    "_failure_reason": "local_jobs에 없거나 origin != crawler",
                })
                continue
            url, confidence = await discover_source_url(page, row)
            if not url:
                reports.append({
                    "id": job_id, "title": row.get("title"), "_pipeline_failed": True,
                    "_failure_stage": "url_discovery",
                    "_failure_reason": f"재검색으로 URL 확정 실패(confidence={confidence})",
                })
                continue
            job = await process_job_url(page, url, listing_hint={"title": row.get("title"), "company": row.get("company")})
            result = upsert_job_record(job, by_source_url, by_key)
            reports.append({"id": job_id, "url_discovery_confidence": confidence, **job, **result})
    return reports


async def main():
    print("🚀 vieclam24h 크롤링 시작")
    print("─" * 50)

    jobs = await crawl_vieclam24h()
    print(f"\n📊 수집 완료: {len(jobs)}개")
    save_to_json(jobs)
    save_to_supabase(jobs)
    print("\n✨ 완료!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--process-url", type=str, default="",
        help="vieclam24h 상세페이지 URL 1건만 표준 파이프라인으로 처리(신규/기존 자동 판별, 목록 수집 없음)",
    )
    parser.add_argument(
        "--reprocess-ids", type=str, default="",
        help="쉼표구분 local_jobs id들만 표준 파이프라인으로 재처리(신규 공고 수집 없음)",
    )
    args = parser.parse_args()

    if args.process_url:
        report = asyncio.run(process_single_url(args.process_url))
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    elif args.reprocess_ids:
        ids = [int(x.strip()) for x in args.reprocess_ids.split(",") if x.strip()]
        reports = asyncio.run(reprocess_jobs(ids))
        print(json.dumps(reports, ensure_ascii=False, indent=2, default=str))
    else:
        asyncio.run(main())
