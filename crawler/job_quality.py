"""Pure helpers for crawler job payload quality checks."""

from __future__ import annotations

import re
import unicodedata
from datetime import date


# Pure mirror of crawl_category()'s in-browser line-parsing JS in
# crawl_topcv.py — kept here ONLY so that logic can be unit tested without a
# real browser (the actual crawl always runs the JS version in-page, this
# never executes during a real crawl). If either side changes, update both —
# they must stay behaviorally identical.
TITLE_BADGE_LINES = {'Không cần CV', 'HOT', 'Tin ưu tiên'}
# 전체 지역 목록 — src/data/jobRegions.ts의 REGION_MACRO_TABS province label과
# 동기화. 예전엔 8개 대도시만 있어서 그 외 지역(예: Hưng Yên)은 매칭에 실패해
# normalize_location()의 fallback("Hồ Chí Minh")으로 잘못 대체되는 버그가 있었음
# (sb-4312에서 실제 발생 확인). 이 리스트가 바뀌면 jobRegions.ts와 crawl_topcv.py의
# JS 버전(crawl_category() 내부)도 함께 갱신할 것.
LISTING_CITY_KEYWORDS = [
    'Hồ Chí Minh', 'Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Bắc Ninh', 'Bắc Giang',
    'Hưng Yên', 'Thái Nguyên', 'Phú Thọ', 'Ninh Bình', 'Thanh Hóa', 'Nghệ An',
    'Hà Tĩnh', 'Quảng Trị', 'Huế', 'Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Đắk Lắk',
    'Khánh Hòa', 'Lâm Đồng', 'Đồng Nai', 'Tây Ninh', 'Long An', 'Đồng Tháp',
    'An Giang', 'Vĩnh Long', 'Cần Thơ', 'Cà Mau',
]


def parse_listing_card_lines(lines: list[str]) -> dict[str, str | None]:
    """title/company/location extraction from one job card's text lines —
    see crawl_category() in crawl_topcv.py for the real (JS) version this
    mirrors."""
    if not lines:
        return {"title": None, "company": None, "location": None}
    title = next((l for l in lines if l not in TITLE_BADGE_LINES), lines[0])
    # Length sanity check runs on the resolved title, not lines[0] — a short
    # badge as lines[0] (e.g. "HOT", 3 chars) must not disqualify an
    # otherwise-valid card whose real title is further down.
    if len(title) < 5:
        return {"title": None, "company": None, "location": None}
    company = next(
        (l for l in lines if len(l) > 2 and l != title and l not in TITLE_BADGE_LINES),
        "",
    )
    location = next(
        (l for l in lines if l != title and any(c in l for c in LISTING_CITY_KEYWORDS)),
        "",
    )
    return {"title": title, "company": company, "location": location}


def pick_detail_company_name(candidates: list[str]) -> str:
    """Pure mirror of fetch_job_detail()'s in-page company-name selection in
    crawl_topcv.py — kept here ONLY so that logic can be unit tested without a
    real browser (the actual crawl always runs the JS version in-page, this
    never executes during a real crawl). If either side changes, update both.

    candidates: text of every "-ntd..." anchor on the detail page, in DOM
    order. The first such anchor (near the job title) is server-truncated by
    the source site itself (confirmed live on a real posting: "Công Ty Cổ
    Phần Dịch ..."), while a later one in the company-info block near the
    bottom of the page carries the full name — picking the first candidate
    blindly (the original bug) truncates the company name on almost every
    real listing. Prefers the first candidate that isn't ellipsis-truncated;
    falls back to the first candidate if every one is."""
    cleaned = [c for c in candidates if c and c != "Xem trang công ty"]
    for c in cleaned:
        if not c.endswith("..."):
            return c
    return cleaned[0] if cleaned else ""


def strip_salary_badge_label(raw: object) -> str:
    """Pure mirror of fetch_job_detail()'s salary-badge extraction — the
    badge row's first child concatenates the "Mức lương" label directly onto
    the value with no separator (e.g. "Mức lương7.5 - 9 triệu", confirmed
    live) — strips the label. See pick_detail_company_name()'s docstring for
    why this Python copy exists."""
    text = normalize_whitespace(raw)
    return re.sub(r"^Mức lương", "", text).strip()


def find_education_badge(badge_texts: list[str]) -> str:
    """Pure mirror of fetch_job_detail()'s "Trình độ" (education) badge
    extraction — that badge lives ONLY in the title-badge row, never in the
    'Thông tin chung' table (confirmed live), and not every posting has one
    at all (no education requirement stated -> genuinely absent from the
    source, not a parser miss). See pick_detail_company_name()'s docstring
    for why this Python copy exists."""
    badge = next((t for t in badge_texts if t.startswith("Trình độ")), None)
    if badge is None:
        return ""
    return re.sub(r"^Trình độ", "", badge).strip()


_WORK_HOURS_RANGE_RE = re.compile(
    r"(?:sáng|chiều|tối)?\s*[:：]?\s*\d{1,2}h\d{0,2}\s*[-–]\s*\d{1,2}h\d{0,2}", re.IGNORECASE
)
_WORK_HOURS_LABEL_RE = re.compile(r"(?:giờ làm việc)\s*[:：]?\s*([^\n]{3,80})", re.IGNORECASE)


def extract_work_hours_free_text(desc_text: object) -> str:
    """Pure mirror of fetch_job_detail()'s in-page "근무시간"(work hours)
    free-text extraction — see pick_detail_company_name()'s docstring for why
    this Python copy exists.

    Real postings often split morning/afternoon shifts into 2+ time ranges
    in one sentence (e.g. "Sáng: 7h - 11h, Chiều: 12h - 16h", confirmed live
    — sb batch C job "Kỹ Sư Kỹ Thuật Điện (M&E)"). A single-match regex only
    returns the first range and silently drops the rest — this finds every
    range (each with its "Sáng/Chiều/Tối" label when present) and joins them,
    so a split-shift posting keeps both halves instead of only the first."""
    text = str(desc_text or "")
    matches = [m.group(0).strip() for m in _WORK_HOURS_RANGE_RE.finditer(text)]
    if matches:
        return ", ".join(matches)
    label_match = _WORK_HOURS_LABEL_RE.search(text)
    if label_match:
        return (label_match.group(1) or label_match.group(0)).strip()
    return ""


VALID_CATEGORIES = {
    "factory",
    "cafe",
    "restaurant",
    "delivery",
    "cleaning",
    "retail",
    "office",
    "other",
}

EXCLUDED_MONEY_JOB_RE = re.compile(
    r"thu hoi cong no|cong no|thu hoi no|doi no|thu no\b|xu ly no|no xau|nhac no"
    r"|vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung"
    r"|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit"
    r"|mirae asset|shinhan finance|vpbank finance|collection|collector|debt|loan",
    re.IGNORECASE,
)


def normalize_whitespace(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def ascii_key(value: object) -> str:
    text = normalize_whitespace(value).lower().replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text)
    return normalize_whitespace(text)


def canonical_job_key(title: object, company: object) -> tuple[str, str]:
    """Stable dedupe key shared by crawl and save paths."""
    return (ascii_key(title)[:80], ascii_key(company)[:60])


def normalize_salary(value: object) -> str:
    salary = normalize_whitespace(value)
    if not salary:
        return "Thỏa thuận"

    lowered = salary.lower()
    if "thỏa thuận" in lowered or "thoả thuận" in lowered or "cạnh tranh" in lowered:
        return "Thỏa thuận"

    # Filter obvious scraping artifacts such as "300 triệu" on hourly/local jobs.
    million = re.search(r"(\d+[\.,]?\d*)\s*(?:triệu|tr)\b", lowered)
    if million:
        amount = float(million.group(1).replace(",", "."))
        if amount > 200:
            return "Thỏa thuận"

    return salary[:80]


def extract_salary_from_text(*parts: object) -> str:
    text = normalize_whitespace(" ".join(str(p or "") for p in parts))
    if not text:
        return "Thỏa thuận"

    patterns = [
        r"(?:thu nhập|lương|luong)\s*(?:hấp dẫn|cứng|từ|upto|up to|:)?\s*[\w\s]{0,20}?\d+[\.,]?\d*\s*[-–~đến]+\s*\d+[\.,]?\d*\s*(?:triệu|tr|000\.000đ|000,000đ|đ)(?:/\s*\w+|\s*tháng|\s*month)?",
        r"\d+[\.,]?\d*\s*[-–~]\s*\d+[\.,]?\d*\s*(?:triệu|tr)(?:/\s*\w+|\s*tháng|\s*month)?",
        r"(?:thu nhập|lương|luong)\s*(?:hấp dẫn|cứng|từ|upto|up to|:)?\s*[\w\s]{0,20}?\d+[\.,]?\d*\s*(?:triệu|tr)(?:/|\s*tháng|\s*month)?",
        r"\d{1,3}(?:[\\.,]\d{3}){1,3}\s*đ(?:/|\s*tháng)?",
        r"(?:thỏa thuận|thoả thuận|cạnh tranh)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return normalize_salary(match.group(0))
    return "Thỏa thuận"


# Province-center coordinates for LISTING_CITY_KEYWORDS — used only as an
# approximate fallback marker when a job mentions multiple provinces in free
# text (title/description) but has no structured per-address "Địa điểm làm
# việc" section to geocode exactly (see guess_all_provinces_from_text() and
# its use in crawl_topcv.py). Never presented as an exact work address.
PROVINCE_COORDS: dict[str, tuple[float, float]] = {
    'Hà Nội': (21.0285, 105.8542), 'Hải Phòng': (20.8449, 106.6881),
    'Quảng Ninh': (20.9515, 107.0797), 'Bắc Ninh': (21.1861, 106.0763),
    'Bắc Giang': (21.2731, 106.1946), 'Hưng Yên': (20.6567, 106.0511),
    'Thái Nguyên': (21.5928, 105.8442), 'Phú Thọ': (21.4208, 105.2306),
    'Ninh Bình': (20.2506, 105.9744), 'Thanh Hóa': (19.8067, 105.7852),
    'Nghệ An': (18.6796, 105.6813), 'Hà Tĩnh': (18.3428, 105.9057),
    'Quảng Trị': (16.7404, 107.1854), 'Huế': (16.4637, 107.5909),
    'Đà Nẵng': (16.0471, 108.2068), 'Quảng Ngãi': (15.1214, 108.8044),
    'Gia Lai': (13.9833, 108.0000), 'Đắk Lắk': (12.6667, 108.0500),
    'Khánh Hòa': (12.2388, 109.1967), 'Lâm Đồng': (11.9404, 108.4583),
    'Hồ Chí Minh': (10.7769, 106.7009), 'Đồng Nai': (10.9453, 106.8243),
    'Tây Ninh': (11.3100, 106.0989), 'Long An': (10.5333, 106.4167),
    'Đồng Tháp': (10.4938, 105.6881), 'An Giang': (10.3833, 105.4333),
    'Vĩnh Long': (10.2537, 105.9722), 'Cần Thơ': (10.0452, 105.7469),
    'Cà Mau': (9.1769, 105.1500),
}

# Common abbreviations that guess_all_provinces_from_text() should still
# recognize even though they don't contain the full province name as a
# substring (e.g. "TPHCM" doesn't contain "Hồ Chí Minh").
_PROVINCE_ALIASES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\btp\.?\s*hcm\b", re.IGNORECASE), 'Hồ Chí Minh'),
    (re.compile(r"\bhcm\b", re.IGNORECASE), 'Hồ Chí Minh'),
]


def guess_province_from_text(text: object) -> str | None:
    """Find the first known province/city name mentioned in free text (job title,
    the detail page's 'Địa điểm làm việc' section, etc.) — used as a fallback in
    normalize_location() when the listing card's own location line couldn't be
    matched, instead of silently defaulting to a specific big city."""
    found = guess_all_provinces_from_text(text)
    return found[0] if found else None


def guess_all_provinces_from_text(text: object) -> list[str]:
    """Like guess_province_from_text() but returns every distinct known province
    mentioned, in order of first appearance in the text (not keyword-list order)
    — used when a job covers multiple work regions (e.g. title/description
    listing several provinces) so that information isn't lost by only keeping
    the first match."""
    s = normalize_whitespace(text)
    if not s:
        return []
    positions: dict[str, int] = {}
    for province in LISTING_CITY_KEYWORDS:
        idx = s.find(province)
        if idx != -1:
            positions[province] = idx
    for pattern, province in _PROVINCE_ALIASES:
        if province not in positions:
            m = pattern.search(s)
            if m:
                positions[province] = m.start()
    return [p for p, _ in sorted(positions.items(), key=lambda item: item[1])]


# Lines/sentences are only trusted as describing the job's own WORK location if
# they contain one of these phrases. Without this, scanning the whole
# description picks up unrelated places — company benefits ("du lịch hàng năm
# tại Đà Lạt"), training venues, business-trip destinations, or the recruiter's
# HQ address in a signature block — none of which is where the hired person
# actually works.
_WORK_LOCATION_CONTEXT_RE = re.compile(
    r"làm việc tại|khu vực làm việc|địa điểm làm việc|nơi làm việc|làm tại|"
    r"tuyển tại|chi nhánh tại|văn phòng tại|công trình.{0,25}tại|dự án.{0,25}tại",
    re.IGNORECASE,
)
# Phrases that mean the sentence is about something other than the job's actual
# workplace, even if a place name appears right next to them — checked first,
# so these always lose to _WORK_LOCATION_CONTEXT_RE on the same line.
_NON_WORK_LOCATION_CONTEXT_RE = re.compile(
    r"du lịch|đào tạo|tham quan|nghỉ mát|team building|công tác phí|"
    r"chuyến công tác|khóa học|hội thảo|nghỉ dưỡng",
    re.IGNORECASE,
)


def guess_work_location_provinces(title: object, description: object) -> list[str]:
    """Multi-province extraction restricted to text that clearly describes the
    job's own WORK location — the title (trusted directly: a crawled title that
    enumerates provinces, e.g. "... Bắc Ninh / Long An / Đà Nẵng", is describing
    where THIS job is based) plus only those description lines that contain an
    explicit work-location phrase and no travel/training/benefit-trip phrase.
    Deliberately more conservative than guess_all_provinces_from_text() — used
    where a false positive would fabricate a work-location marker (see
    crawl_topcv.py)."""
    found: list[str] = []
    for p in guess_all_provinces_from_text(title):
        if p not in found:
            found.append(p)
    for line in re.split(r"[\n•]+", str(description or "")):
        line = line.strip()
        if not line or _NON_WORK_LOCATION_CONTEXT_RE.search(line) or not _WORK_LOCATION_CONTEXT_RE.search(line):
            continue
        for p in guess_all_provinces_from_text(line):
            if p not in found:
                found.append(p)
    return found


# A candidate location string that's actually the job title, salary, or company
# name (crawler bug seen on sb-4313: the whole title got stored as `location`)
# must never be trusted as-is — real place names are short and don't repeat
# other fields verbatim.
_MAX_PLAUSIBLE_LOCATION_LEN = 60


def looks_like_location(candidate: str, *, title: str = "", company: str = "", salary: str = "") -> bool:
    """Reject listing-scraped `location` values that are implausible — either
    another field's text (title/company/salary) leaking into location verbatim,
    or a string too long to plausibly be a place name. A short real place name
    that happens to also appear inside the title (e.g. "Bắc Ninh" when the title
    mentions Bắc Ninh) is fine and expected — only an exact-field match or an
    implausibly long value is rejected."""
    c = normalize_whitespace(candidate)
    if not c:
        return False
    if len(c) > _MAX_PLAUSIBLE_LOCATION_LEN:
        return False
    for other in (title, company, salary):
        other_norm = normalize_whitespace(other)
        if other_norm and c == other_norm:
            return False
    return True


def normalize_location(
    value: object,
    fallback: str = "",
    detail_text: object = "",
    *,
    title: str = "",
    company: str = "",
    salary: str = "",
) -> str:
    """Returns "" (not a guessed big-city default) when no real location can be
    determined — a job with unknown location must never be silently stored as
    if it were in Hồ Chí Minh (sb-4312/sb-4313 both broke this way). Callers
    (crawl_topcv.py, the frontend) must treat an empty location as "unknown",
    not as a place name."""
    location = normalize_whitespace(value)
    if location and looks_like_location(location, title=title, company=company, salary=salary):
        location = re.sub(r"^(địa điểm|khu vực)\s*[:\-]\s*", "", location, flags=re.IGNORECASE)
        return location[:120] or fallback
    # 리스트 카드에서 지역을 못 찾았을 때(예: LISTING_CITY_KEYWORDS에 없는 지역이라
    # 빈 값으로 넘어온 경우) 상세페이지 텍스트(제목 + 실제 근무지 주소 섹션)에서
    # 다시 지역명을 찾는다. 그래도 못 찾으면 fallback(기본값 "" = 알 수 없음)을
    # 그대로 반환한다 — 예전처럼 대도시로 대체하지 않는다.
    guessed = guess_province_from_text(detail_text)
    return guessed or fallback


# Vieclam24h detail pages occasionally repeat generic labels/CTAs inside the
# "Địa điểm làm việc" block (map links, "xem thêm" etc.) that are not addresses —
# drop these rather than saving them as a fake work location.
_WORK_LOCATION_NOISE_RE = re.compile(
    r"^(xem (bản đồ|thêm)|chi tiết|địa điểm làm việc|bản đồ)\s*:?\s*$",
    re.IGNORECASE,
)

# Some factory/plant jobs (confirmed live on job id 4311, Unilever Củ Chi) list
# "Địa điểm làm việc" as company shuttle-bus PICKUP points, not distinct work
# sites — e.g. "TP.HCM:xe đưa đón, Củ Chi" / "...Thủ Đức" / "...Quận 1" all for
# one single physical plant. Saving each pickup district as its own raw_address
# would fabricate several fake workplaces on the map. There is no reliable way
# to tell which (if any) of the listed districts is the real site without
# guessing, and the company's registered address is explicitly off-limits as a
# substitute (may be a HQ unrelated to the actual work site) — so these rows
# are dropped entirely and the job falls back to province-level location with
# an explicit "no detailed address" state, rather than a fabricated one.
_WORK_LOCATION_SHUTTLE_RE = re.compile(r"^xe\s+đưa\s+đón\b", re.IGNORECASE)

# Each address row on vieclam24h's "Địa điểm làm việc" section is rendered as
# "<province/city>:<address>" with no separating space (observed directly on
# job id 3981: "TP.HCM:OfficeHaus, 32 Tân Thắng, ..."). The prefix is a bare
# place name, never containing a digit — a real street address always starts
# with a house/street number within the first ~25 characters — so requiring
# "no digit before the colon" keeps this from ever eating part of a real
# address that happens to contain an early colon.
_WORK_LOCATION_REGION_PREFIX_RE = re.compile(r"^[^\d:]{2,25}:\s*")


def split_work_locations(
    raw_section_text: object, max_locations: int = 10, *, with_region: bool = False
) -> list[str] | list[dict]:
    """Split the raw 'Địa điểm làm việc' section text into individual addresses.

    The section text comes from fetch_job_detail(), which already renders each
    `<li>` as its own `• ` prefixed line (same convention as Mô tả/Yêu cầu/Quyền
    lợi). This only splits/cleans that text — it never reaches into unrelated
    sections (e.g. company headquarters address, which lives under a different
    heading and is never passed in here).

    with_region=False (default, unchanged from before): returns list[str].
    with_region=True: returns list[{"text": str, "region_prefix": str | None}]
    — the "<province/city>:" label each line carries (e.g. "Bình Dương"),
    needed by the geocoding step to validate the returned coordinate is
    actually in the province the source text claims, not just "confidence
    was high" (see geocode.py's expected_region_text).
    """
    text = str(raw_section_text or "")
    if not text.strip():
        return []

    # Bulleted list (the common case: one <li> per work location).
    if "•" in text:
        candidates = text.split("•")
    else:
        candidates = re.split(r"\n+", text)

    seen: set[str] = set()
    result: list = []
    for raw in candidates:
        addr = normalize_whitespace(raw)
        # Strip leading numbering like "1.", "1)", "-" left over from non-<li> lists.
        addr = re.sub(r"^(\d+[\.\)]|[-*])\s*", "", addr).strip()
        # Capture, then strip, a leading "<province/city>:" label baked into the same string.
        prefix_match = _WORK_LOCATION_REGION_PREFIX_RE.match(addr)
        region_prefix = prefix_match.group(0).rstrip(":").strip() if prefix_match else None
        addr = _WORK_LOCATION_REGION_PREFIX_RE.sub("", addr).strip()
        if not addr or len(addr) < 5:
            continue
        if _WORK_LOCATION_NOISE_RE.match(addr):
            continue
        if _WORK_LOCATION_SHUTTLE_RE.match(addr):
            continue
        addr = addr[:300]
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append({"text": addr, "region_prefix": region_prefix} if with_region else addr)
        if len(result) >= max_locations:
            break
    return result


# Bumped whenever the address/publish-gate pipeline's *behavior* changes (not
# on every unrelated commit) — logged alongside crawl output so a run can be
# tied back to the exact classification/gating rules that produced it. Not
# persisted to the DB (no schema for it yet — see CHATGPT_HANDOFF.md).
CRAWLER_VERSION = "2026-09-03.address-pipeline-v1"

# A work-location candidate counts as a real, geocodable *place* — not just an
# administrative-unit name — when it carries one of these signals: a house/lot/
# block number, a named industrial park ("KCN ..."), a street/alley marker, or a
# named building/complex. Anything without one of these is, at best, a bare
# province/district/ward chain (e.g. "Dĩ An, Bình Dương (cũ)., Thủ Đức" — real
# administrative names, but no specific site within them) and must never be
# geocoded as if it were a precise workplace.
_SPECIFIC_PLACE_SIGNAL_RE = re.compile(
    r"\d"
    r"|\bkcn\b|\bkhu công nghiệp\b|\bcụm công nghiệp\b"
    r"|\bđường\b|\bphố\b|\bngõ\b|\bhẻm\b|\bngách\b"
    r"|\btòa nhà\b|\bplaza\b|\btower\b|\bbuilding\b|\bcao ốc\b"
    r"|\blô\b|\bkhu đô thị\b|\bkđt\b|\btrung tâm\b|\bcenter\b",
    re.IGNORECASE,
)

# Numbered urban districts/wards ("Quận 1", "Phường 12", "Q.1", "P12") carry a
# digit but name no specific site — stripped out before the signal check above
# runs, so a bare "Quận 1, TP.HCM" isn't mistaken for a real street address
# just because Vietnamese district numbers happen to be numeric.
_NUMBERED_ADMIN_UNIT_RE = re.compile(r"\b(quận|phường|q\.?|p\.?)\s*\d+\b", re.IGNORECASE)

def classify_work_location_candidate(candidate: object) -> str:
    """Classify one split_work_locations() candidate as:
    - 'exact': carries a specific-place signal — precise enough to geocode as
      a real workplace marker (a street number, named industrial park/
      building, etc).
    - 'region_only': everything else that's still a plausible place mention
      (passed split_work_locations()'s own noise/length/shuttle filtering
      already) but names no specific site — e.g. "Dĩ An, Bình Dương (cũ).,
      Thủ Đức" (real district/ward names, chained, but no building/park/
      street to anchor a marker to). Deliberately NOT gated on a hand-
      maintained district/ward name list (Vietnam has thousands and it would
      go stale) — only 'exact' vs "not exact" actually matters downstream
      (resolve_work_locations() only geocodes 'exact'), so a district-name
      allowlist here would add maintenance cost without changing behavior.
    - 'undetermined': too short/empty to be any kind of place mention at all
      (a defensive floor — split_work_locations() already filters most of
      this out before a candidate ever reaches here).

    Shuttle-pickup text ("xe đưa đón, ...") and company-HQ addresses never
    reach this function — the former is filtered out by split_work_locations()
    itself, the latter is never extracted in the first place (only the
    'Địa điểm làm việc' section is read). This function only has to tell a
    real site apart from a bare region mention.
    """
    text = str(candidate or "").strip()
    if len(text) < 5:
        return "undetermined"
    signal_text = _NUMBERED_ADMIN_UNIT_RE.sub("", text)
    if _SPECIFIC_PLACE_SIGNAL_RE.search(signal_text):
        return "exact"
    return "region_only"


def has_application_path(
    employer_phone: object = "",
    zalo: object = "",
    source_url: object = "",
    *,
    source_page_valid: bool = True,
    has_apply_affordance: bool = True,
) -> bool:
    """True if a job seeker has at least one real way to act on this listing.

    A phone number or Zalo contact is always sufficient on its own — those
    are direct, not affected by whether the original page still exists.

    A bare source_url is NOT automatically sufficient — confirmed the naive
    version of this check would count it even for a since-expired/removed/
    under-review posting, which would then show an "apply" button pointing at
    a dead page. When source_url is the only path, the caller must also pass
    what it found when it actually fetched that page:
    - source_page_valid: the request succeeded and no "hết hạn/đã bị gỡ/đang
      xét duyệt/..." banner was shown (see crawl_topcv.py's
      _EXPIRED_PAGE_PATTERNS + httpStatus check).
    - has_apply_affordance: an actual "Ứng tuyển ..." control was found on
      that page.
    Both default to True so existing callers that don't have this info yet
    (unit tests, callers that only know phone/zalo/url) keep their old
    behavior — only crawl_topcv.py's real crawl passes the checked values.
    """
    if normalize_whitespace(employer_phone) or normalize_whitespace(zalo):
        return True
    if not normalize_whitespace(source_url):
        return False
    return bool(source_page_valid and has_apply_affordance)


def compute_all_locations_verified_exact(resolved_locations: list[dict]) -> bool:
    """True only when resolved_locations is non-empty AND every row's
    coordinate_accuracy=='exact' — i.e. C1, never C1_partial/C2/C3/etc.
    Pulled out of crawl_topcv.py's build_job_record() as its own pure
    function (named differently from gate_auto_publish()'s
    all_locations_verified_exact PARAMETER below, to avoid a function/
    parameter name collision in this module) so this exact computation is
    directly unit-testable without running the full fetch/geocode pipeline
    — see test_gate_rejects_c1_partial_mixed_tiers() for the C1_partial
    regression this exists to guard against."""
    return len(resolved_locations) > 0 and all(
        loc.get("coordinate_accuracy") == "exact" for loc in resolved_locations
    )


def gate_auto_publish(
    has_address_text: bool,
    has_application_path_: bool,
    all_locations_verified_exact: bool = False,
) -> tuple[bool, str]:
    """Decide whether a freshly-scraped job may be auto-published (active=true)
    or must be held for manual review (active=false, never silently dropped).

    2026-09-04 사용자 지시로 정책 변경: "모든 근무지가 C1(coordinate_accuracy
    =='exact')이고 유효한 지원 경로가 있을 때만 통과" — C1_partial(일부만
    exact)/A/B/C2/C3/D/E는 전부 보류. 이전 설계(주소 텍스트만 있으면 좌표
    무관하게 발행 — "10건 중 2건만 발행되는 문제로 기각")를 이번 지시가
    명시적으로 뒤집었다. all_locations_verified_exact는 이 공고의
    _resolved_locations가 1개 이상이고 전부 coordinate_accuracy=='exact'일
    때만 True — 기본값은 안전 실패(fail-closed) 원칙에 따라 False다: 이
    인자를 계산해 넘기지 않는 호출부는 무조건 "검증 안 됨"으로 간주돼
    발행되지 않는다(옛 정책으로 조용히 되돌아가는 것을 방지). 실제 크롤
    경로(crawl_topcv.py)는 항상 계산된 값을 명시적으로 넘긴다.

    Returns (should_publish, reason) — reason은 'ok' / 'no_address_text' /
    'no_verified_coordinate' / 'no_application_path' 중 하나(이 순서로 검사)."""
    if not has_address_text:
        return False, "no_address_text"
    if not all_locations_verified_exact:
        return False, "no_verified_coordinate"
    if not has_application_path_:
        return False, "no_application_path"
    return True, "ok"


# Re-crawling an already-known job (same canonical_job_key) used to be a pure
# skip — even if the original posting's salary/deadline/description/location
# had genuinely changed on the source site, our copy never caught up. Only
# these fields are tracked for update; title/company/category are part of
# the matching key (title+company never change under the same key), and other
# fields (image_url etc.) are intentionally left alone for now.
# 'source_url' was added after discovering re-crawls of already-known jobs
# (e.g. id 4366/4367/4368) never backfilled it even when freshly found —
# confirmed live: extraction succeeded but the field wasn't in this tuple, so
# compute_job_updates() never even looked at it.
UPDATE_TRACKED_FIELDS = (
    "salary", "application_deadline", "description", "location", "source_url",
    "preference", "education", "work_period", "num_hires", "hours", "work_days",
)


def compute_job_updates(existing_row: dict, new_job: dict) -> dict:
    """Pure diff: given an existing local_jobs row and a freshly-scraped job
    payload matched to it by canonical_job_key, return only the tracked
    fields whose value actually changed. Empty dict means "skip, no update".

    Never touches the DB — callers decide whether/how to apply the result.
    """
    updates: dict = {}
    for field in UPDATE_TRACKED_FIELDS:
        new_val = new_job.get(field)
        if new_val is None:
            continue
        old_val = existing_row.get(field)
        if new_val != old_val:
            updates[field] = new_val
    return updates


def has_source_tag(description: object, source: str) -> bool:
    return f"[source:{source}]" in str(description or "")


def has_excluded_money_terms(*parts: object) -> bool:
    """True for loan/debt-collection jobs that do not match the site motto."""
    return bool(EXCLUDED_MONEY_JOB_RE.search(ascii_key(" ".join(str(p or "") for p in parts))))


def is_expired(deadline: object, today: str | None = None) -> bool:
    deadline_text = normalize_whitespace(deadline)
    if not deadline_text:
        return False
    today_text = today or date.today().isoformat()
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", deadline_text)) and deadline_text <= today_text


def validate_job_payload(job: dict, source: str = "vieclam24h", today: str | None = None) -> list[str]:
    errors: list[str] = []
    title = normalize_whitespace(job.get("title"))
    company = normalize_whitespace(job.get("company"))
    description = normalize_whitespace(job.get("description"))
    category = normalize_whitespace(job.get("category"))

    if len(title) < 5:
        errors.append("title is too short")
    if len(company) < 2:
        errors.append("company is missing")
    # location이 빈 문자열인 것은 이제 "위치 확인 불가"를 뜻하는 정상 상태다
    # (normalize_location() 참고) — 더 이상 저장을 막는 사유가 아니다. 빈
    # location인 공고는 프론트에서 지도 대신 안내 문구를 보여준다.
    if category not in VALID_CATEGORIES:
        errors.append(f"invalid category: {category}")
    if not has_source_tag(description, source):
        errors.append(f"missing source tag: {source}")
    if has_excluded_money_terms(title, company, description):
        errors.append("excluded money/debt collection job")
    if job.get("origin") != "crawler":
        errors.append("origin must be crawler")
    # active/admin_hidden은 여기서 검사하지 않는다 — active는 공개 게이트
    # (gate_auto_publish)의 판정 결과일 뿐이고, False도 유효하고 의도된 상태다
    # (상세주소·지원경로가 없어 보류된 공고도 그 사실 그대로 저장/재판정돼야
    # 한다 — "저장할 가치가 없는 불량 데이터"가 아니다). 이 검사가 있으면
    # 신규 발견 공고와 기존 공고 재판정이 다르게 동작한다: 신규는 게이트
    # 실패 시 통째로 버려지고(active=false로도 저장 안 됨), 기존 공고
    # 재판정은 반대로 active=false로 정상 강등돼야 하는데 이 검사 때문에
    # build_job_record()가 그 결과를 "quality_invalid"로 스킵해버려 강등
    # 자체가 조용히 실패하는 버그가 됐었다(단일 파이프라인 통합 중 발견).
    if is_expired(job.get("application_deadline"), today=today):
        errors.append("deadline is expired")

    return errors


def is_quality_job(job: dict, source: str = "vieclam24h", today: str | None = None) -> bool:
    return not validate_job_payload(job, source=source, today=today)
