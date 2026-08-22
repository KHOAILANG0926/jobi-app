"""Pure helpers for crawler job payload quality checks."""

from __future__ import annotations

import re
import unicodedata
from datetime import date


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


def normalize_location(value: object, fallback: str = "Hồ Chí Minh") -> str:
    location = normalize_whitespace(value)
    if not location:
        return fallback
    location = re.sub(r"^(địa điểm|khu vực)\s*[:\-]\s*", "", location, flags=re.IGNORECASE)
    return location[:120] or fallback


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
