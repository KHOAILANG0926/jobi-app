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
LISTING_CITY_KEYWORDS = [
    'Hồ Chí Minh', 'Hà Nội', 'Bình Dương', 'Đồng Nai',
    'Cần Thơ', 'Đà Nẵng', 'Bắc Ninh', 'Hải Phòng',
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


def normalize_location(value: object, fallback: str = "Hồ Chí Minh") -> str:
    location = normalize_whitespace(value)
    if not location:
        return fallback
    location = re.sub(r"^(địa điểm|khu vực)\s*[:\-]\s*", "", location, flags=re.IGNORECASE)
    return location[:120] or fallback


# Vieclam24h detail pages occasionally repeat generic labels/CTAs inside the
# "Địa điểm làm việc" block (map links, "xem thêm" etc.) that are not addresses —
# drop these rather than saving them as a fake work location.
_WORK_LOCATION_NOISE_RE = re.compile(
    r"^(xem (bản đồ|thêm)|chi tiết|địa điểm làm việc|bản đồ)\s*:?\s*$",
    re.IGNORECASE,
)

# Each address row on vieclam24h's "Địa điểm làm việc" section is rendered as
# "<province/city>:<address>" with no separating space (observed directly on
# job id 3981: "TP.HCM:OfficeHaus, 32 Tân Thắng, ..."). The prefix is a bare
# place name, never containing a digit — a real street address always starts
# with a house/street number within the first ~25 characters — so requiring
# "no digit before the colon" keeps this from ever eating part of a real
# address that happens to contain an early colon.
_WORK_LOCATION_REGION_PREFIX_RE = re.compile(r"^[^\d:]{2,25}:\s*")


def split_work_locations(raw_section_text: object, max_locations: int = 10) -> list[str]:
    """Split the raw 'Địa điểm làm việc' section text into individual addresses.

    The section text comes from fetch_job_detail(), which already renders each
    `<li>` as its own `• ` prefixed line (same convention as Mô tả/Yêu cầu/Quyền
    lợi). This only splits/cleans that text — it never reaches into unrelated
    sections (e.g. company headquarters address, which lives under a different
    heading and is never passed in here).
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
    result: list[str] = []
    for raw in candidates:
        addr = normalize_whitespace(raw)
        # Strip leading numbering like "1.", "1)", "-" left over from non-<li> lists.
        addr = re.sub(r"^(\d+[\.\)]|[-*])\s*", "", addr).strip()
        # Strip a leading "<province/city>:" label baked into the same string.
        addr = _WORK_LOCATION_REGION_PREFIX_RE.sub("", addr).strip()
        if not addr or len(addr) < 5:
            continue
        if _WORK_LOCATION_NOISE_RE.match(addr):
            continue
        addr = addr[:300]
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(addr)
        if len(result) >= max_locations:
            break
    return result


# Re-crawling an already-known job (same canonical_job_key) used to be a pure
# skip — even if the original posting's salary/deadline/description/location
# had genuinely changed on the source site, our copy never caught up. Only
# these 4 fields are tracked for update; title/company/category are part of
# the matching key (title+company never change under the same key), and other
# fields (image_url etc.) are intentionally left alone for now.
UPDATE_TRACKED_FIELDS = ("salary", "application_deadline", "description", "location")


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
    if not normalize_whitespace(job.get("location")):
        errors.append("location is missing")
    if category not in VALID_CATEGORIES:
        errors.append(f"invalid category: {category}")
    if not has_source_tag(description, source):
        errors.append(f"missing source tag: {source}")
    if has_excluded_money_terms(title, company, description):
        errors.append("excluded money/debt collection job")
    if job.get("origin") != "crawler":
        errors.append("origin must be crawler")
    if job.get("active") is not True:
        errors.append("active must be true")
    if job.get("admin_hidden") is not False:
        errors.append("admin_hidden must be false")
    if is_expired(job.get("application_deadline"), today=today):
        errors.append("deadline is expired")

    return errors


def is_quality_job(job: dict, source: str = "vieclam24h", today: str | None = None) -> bool:
    return not validate_job_payload(job, source=source, today=today)
