"""
Facebook 그룹 채용공고 크롤러 (쿠키 세션 방식)
- 생활밀착형 일자리(Việc làm gần bạn) 우선 수집
- 구/군/동 상세 위치 + Zalo/전화번호 필수 추출
"""

import argparse
import asyncio
import hashlib
import json
import os
import random
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright
try:
    from playwright_stealth import stealth_async
except ImportError:
    async def stealth_async(page): pass

load_dotenv(Path(__file__).parent / ".env")

from job_quality import ascii_key, has_excluded_money_terms
from classifier import classify, classify_subcategory, map_to_new_taxonomy
from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
print(f"  Supabase: {'연결됨' if supabase else '없음'}")

FB_C_USER = os.getenv("FB_C_USER", "")
FB_XS     = os.getenv("FB_XS", "")
FB_DATR   = os.getenv("FB_DATR", "")
FB_FR     = os.getenv("FB_FR", "")

TODAY = date.today().isoformat()
TARGET_PER_GROUP = 30

# ── 증분 수집 (2026-09-28) ──────────────────────────────────────────
# 기본 정렬은 "활동순"이라 오래된 글이 댓글로 다시 올라오고 새 글이 그 사이에
# 섞인다 — "이미 본 글 N개 연속이면 중단" 규칙은 새 글을 놓칠 수 있어 쓰지
# 않는다. 대신 고정 상한(스크롤/시간/공고 수)까지 훑고, 이미 본 게시물은
# 처리만 건너뛴다. 이전 실행과 겹친 게시물 수(overlap)를 기록해, 0이면
# "그 사이 새 글이 상한보다 많았을 수 있음(누락 가능)"으로 경고한다.
MAX_SCROLL_STEPS = 15
GROUP_TIME_BUDGET_SEC = 240
SEEN_KEYS_PER_GROUP = 500
GROUP_PAUSE_SEC = (60, 120)
MAX_CONSECUTIVE_ANOMALY_GROUPS = 2

STATE_DIR = Path(__file__).parent / "state"
SEEN_STATE_PATH = STATE_DIR / "facebook_seen.json"
EVIDENCE_DIR = STATE_DIR / "evidence"

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
    "cần người", "tìm người", "nhân viên", "full time",
    "part time", "ca làm", "tuyển gấp",
]
COMPENSATION_KEYWORDS = ["lương", "thu nhập", "triệu", "tr/tháng", "đ/tháng"]

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
    r"(?:quận|q\.|huyện|thành phố|tp\.)\s*[\d\w\s]{1,20}|"
    r"(?:phường|p\.|xã|thị trấn)\s*[\w\s]{1,20}|"
    r"(?:đường|ngõ|ngách|khu|kp)\s+[\w\s\d]{2,30}",
    re.IGNORECASE
)


NON_JOB_PATTERNS = re.compile(
    r"rửa tiền|rua tien|công đức|cong duc|tiêu tiền|tieu tien|trả\s+\d+.*triệu",
    re.IGNORECASE,
)


def is_job_post(text: str) -> bool:
    t = text.lower()
    if NON_JOB_PATTERNS.search(t):
        return False
    if any(kw in t for kw in JOB_KEYWORDS):
        return True
    return any(kw in t for kw in LOCAL_JOB_TYPES) and any(kw in t for kw in COMPENSATION_KEYWORDS)


# ── 구직자 자기홍보글 (2026-09-28) ─────────────────────────────────
# "EM NHẬN LAU NHÀ Ạ – AI CẦN THÌ ỦNG HỘ EM!"(청소 일 받습니다) 같은 글이
# "ai đang cần người lau dọn"의 "cần người"로 구인 키워드에 걸려 통과했다.
# 1인칭 + 일을 받는다/일을 찾는다 표현이 있고, 구인 측 신호(tuyển/lương/
# 급여 단위/ứng viên/hồ sơ…)가 전혀 없을 때만 자기홍보로 본다 — "Quán em cần
# người phụ bếp, lương 8tr"처럼 1인칭 구인글을 잘못 거르지 않기 위해.
SELF_PROMO_PATTERNS = [
    re.compile(r"\b(?:em|minh|toi|chau)\s+(?:chuyen\s+)?nhan\s+(?:lam|lau|don|giup viec|trong|cham|nau|sua|ve sinh|day|kem|cho|cat|may|giat|phu)\b"),
    re.compile(r"\bchuyen nhan\s+(?:lau|don|ve sinh|giup viec|trong|cham|nau|sua|day|kem|cho|giat)\b"),
    re.compile(r"\b(?:em|minh|toi|chau)\s+(?:dang\s+|can\s+|muon\s+)*(?:tim|xin)\s+(?:viec|cong viec)\b"),
    re.compile(r"\bung ho em\b|\bgioi thieu giup (?:em|minh)\b"),
]
EMPLOYER_SIGNAL_RE = re.compile(
    r"\btuyen\b|\bluong\b|thu nhap|ung vien|ho so|phong van|dai ngo|trieu|"
    r"\d+\s*k\s*/\s*(?:gio|h|ngay|ca)\b|\d+\s*tr\b|ben (?:minh|em) can|"
    r"\bcan\s+\d+\s+(?:ban|nguoi|nv|nhan vien)\b"
)


def is_self_promotion(text: str) -> bool:
    """구직자가 자기 노동/서비스를 홍보하는 글(구인 공고 아님)."""
    t = ascii_key(text)
    if not any(p.search(t) for p in SELF_PROMO_PATTERNS):
        return False
    return not EMPLOYER_SIGNAL_RE.search(t)


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
        r"\d+[\.,]?\d*\s*[-–~]\s*\d+[\.,]?\d*\s*(?:triệu|tr)(?:/\s*\w+|\s*tháng|\s*month)?",
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
    lines = [l.strip(" -*•\t") for l in text.split("\n") if l.strip()]
    for line in lines[:8]:
        if re.match(r"^(?:công ty|cty)\b", line, re.IGNORECASE) and 6 < len(line) < 100:
            if not re.search(r"\b(?:có|hỗ trợ|ho tro|cần|can|tuyển|tuyen)\b", line, re.IGNORECASE):
                return line
    m = re.search(
        r"(?:công ty|cty|shop|cửa hàng|nhà hàng|quán|trung tâm|siêu thị)[:\s]+([^\n,\.]{3,80})",
        text, re.IGNORECASE
    )
    if m:
        candidate = m.group(1).strip()
        if not re.match(r"^(?:có|ho tro|hỗ trợ|can|cần|tuyen|tuyển)\b", candidate, re.IGNORECASE):
            return candidate
    for line in lines[:4]:
        if "tuyển dụng" in line.lower() and len(line) < 120:
            candidate = re.sub(r"\s*[-–]?\s*tuyển dụng.*$", "", line, flags=re.IGNORECASE).strip()
            candidate = re.sub(r"\s*thông báo\s*$", "", candidate, flags=re.IGNORECASE).strip()
            if candidate:
                return candidate
    return ""


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


GENERIC_TITLE_RE = re.compile(
    r"^(?:tuyen(?:\s+dung)?|can\s+tuyen|thong\s+bao\s+tuyen\s+dung|tuyen\s+nhan\s+su|tuyen\s+nhan\s+vien)\b",
    re.IGNORECASE,
)


ROLE_HINTS = [
    *LOCAL_JOB_TYPES,
    "tạp vụ", "tap vu", "phụ bếp", "phu bep", "phục vụ", "phuc vu",
    "bán hàng", "ban hang", "tư vấn", "tu van", "thu ngân", "thu ngan",
    "công nhân", "cong nhan", "kỹ thuật", "ky thuat", "lái xe", "lai xe",
    "giao hàng", "giao hang", "shipper", "bảo vệ", "bao ve", "lễ tân", "le tan",
]


def is_ambiguous_job(job: dict) -> bool:
    title = job.get("title", "").strip()
    company = job.get("company", "").strip()
    description = job.get("description", "")
    text = ascii_key(f"{title}\n{company}\n{description}")

    if has_excluded_money_terms(title, company, description):
        return True

    def matches_role_hint(hint: str) -> bool:
        normalized = ascii_key(hint)
        if len(normalized) <= 4 and " " not in normalized:
            return bool(re.search(rf"\b{re.escape(normalized)}\b", text))
        return normalized in text

    has_role = any(matches_role_hint(hint) for hint in ROLE_HINTS)
    has_contact = bool(job.get("employer_phone") or re.search(r"zalo|0\d{9}|@[a-z0-9.-]+", text, re.IGNORECASE))
    is_generic_title = bool(GENERIC_TITLE_RE.search(ascii_key(title)))
    fallback_company = company == "Nhà tuyển dụng Facebook"

    if is_generic_title and not has_role:
        return True
    # 2026-09-28: 09-24 이후 category는 새 13분류 id라 "기타"는 "khac" —
    # "other"만 비교하던 이 조건은 그동안 한 번도 성립하지 않았다.
    if fallback_company and job.get("category") in ("other", "khac") and not has_role:
        return True
    if len(description.replace("[source:facebook]", "").strip()) < 80 and not has_role:
        return True
    if not has_contact and fallback_company and not has_role:
        return True

    return False


def guess_category(text: str) -> str:
    return classify("", "", text)


def build_cookies() -> list[dict]:
    if not FB_C_USER or not FB_XS:
        raise RuntimeError("FB_C_USER, FB_XS 쿠키가 .env에 없습니다.")
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


# ── 페이지 상태 판정 (2026-09-28) ───────────────────────────────────
# 옛 is_login_wall()은 "로그인 단어 있음 + 베트남어/영어 피드 단어 없음"으로
# 판정해, 계정 UI가 한국어일 때(댓글 달기/좋아요) 정상 피드도 로그인 벽으로
# 오탐할 수 있었다(2026-09-28 정렬 파라미터 URL에서 실제로 걸림, 원인 미확정).
# 이제는 URL/쿠키/피드 존재 같은 객관 신호를 먼저 보고, 문구 검사는 피드가
# 없을 때만 쓴다.
CHECKPOINT_MARKERS = [
    "xác minh danh tính", "xác nhận danh tính", "tài khoản của bạn đã bị khóa",
    "tạm thời bị khóa", "confirm your identity", "security check",
    "your account has been locked", "account is temporarily locked",
    "본인 확인", "보안 확인", "계정이 일시적으로 잠", "계정이 잠겼",
]


class AccountStop(Exception):
    """계정 위험/세션 만료 — 전체 수집 즉시 중단, 사람 확인 전 재실행 금지."""

    def __init__(self, state: str, group_url: str):
        super().__init__(f"{state} at {group_url}")
        self.state = state
        self.group_url = group_url


def classify_page_signals(url: str, has_c_user: bool, has_feed: bool, body_head: str) -> str:
    """ok / checkpoint / session_expired / anomaly 중 하나."""
    u = (url or "").lower()
    b = (body_head or "").lower()
    if "/checkpoint" in u:
        return "checkpoint"
    if not has_feed and any(m in b for m in CHECKPOINT_MARKERS):
        return "checkpoint"
    if "/login" in u or "login.php" in u or not has_c_user:
        return "session_expired"
    if not has_feed:
        return "anomaly"
    return "ok"


async def inspect_page_state(page) -> str:
    try:
        body = await page.locator("body").inner_text(timeout=5000)
    except Exception:
        body = ""
    cookies = await page.context.cookies("https://www.facebook.com")
    has_c_user = any(c.get("name") == "c_user" and c.get("value") for c in cookies)
    has_feed = (await page.locator('[role="feed"]').count()) > 0 or (await article_count(page)) > 0
    return classify_page_signals(page.url, has_c_user, has_feed, body[:3000])


async def save_evidence(page, group_url: str, state: str) -> None:
    """정상이 아닌 페이지는 스크린샷+본문 앞부분을 남겨 사람이 원인을 판단하게 한다
    (state/ 는 gitignore — 그룹 게시자 이름 등이 포함될 수 있어 커밋 금지)."""
    try:
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        slug = re.sub(r"[^\w]+", "_", group_url.rstrip("/").split("/")[-1])[:40]
        stem = EVIDENCE_DIR / f"{datetime.now():%Y%m%d_%H%M%S}_{slug}_{state}"
        await page.screenshot(path=f"{stem}.png")
        try:
            body = await page.locator("body").inner_text(timeout=5000)
        except Exception:
            body = ""
        stem.with_suffix(".txt").write_text(f"url: {page.url}\n\n{body[:2000]}", encoding="utf-8")
        print(f"    🧾 증거 저장: {stem.name}.png/.txt")
    except Exception as e:
        print(f"    ⚠️ 증거 저장 실패: {e}")


def mobile_group_url(url: str) -> str:
    return url.replace("https://www.facebook.com/", "https://m.facebook.com/")


# ── 게시물 식별 / 작성 시각 ───────────────────────────────────────────
POST_ID_PATTERNS = [
    re.compile(r"/posts/([A-Za-z0-9]+)"),
    re.compile(r"/permalink/(\d+)"),
    re.compile(r"[?&]story_fbid=([A-Za-z0-9]+)"),
    re.compile(r"[?&]multi_permalinks=(\d+)"),
]


def extract_post_id(url: str) -> str:
    for pattern in POST_ID_PATTERNS:
        m = pattern.search(url or "")
        if m:
            return m.group(1)
    return ""


def post_key(post: dict) -> str:
    """퍼머링크 ID가 있으면 그것, 없으면 정규화한 본문 앞부분의 해시."""
    post_id = extract_post_id(post.get("postUrl", ""))
    if post_id:
        return f"id:{post_id}"
    normalized = re.sub(r"\s+", " ", (post.get("text") or "").lower()).strip()[:200]
    return "h:" + hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]


EN_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}


def _date_or_none(year: int, month: int, day: int, now: datetime, year_given: bool):
    try:
        dt = datetime(year, month, day)
    except ValueError:
        return None
    if not year_given and dt.date() > now.date():
        try:
            dt = datetime(year - 1, month, day)
        except ValueError:
            return None
    return dt


def parse_time_label(label: str, now: datetime | None = None) -> dict | None:
    """게시물 시간 링크 문구("방금", "3시간", "hôm qua", "20 tháng 9"...)를 추정 시각으로.

    결과는 {"estimate": ISO, "precision": minute|hour|day|week} — 상대시간은
    본질적으로 근사값이라 DB의 posted_at(수집일, 사이트 정렬 기준)에는 쓰지
    않고 로그/결과 파일에만 남긴다. 해석 못 하면 None(추측하지 않음).
    """
    if not label:
        return None
    now = now or datetime.now()
    s = label.strip().lower()

    def out(dt: datetime, precision: str) -> dict:
        return {"estimate": dt.isoformat(timespec="minutes"), "precision": precision}

    # 절대 날짜 먼저("9월 20일"의 "20일"이 상대 N일로 잡히지 않도록)
    m = re.search(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", s)
    if m:
        dt = _date_or_none(int(m.group(1)), int(m.group(2)), int(m.group(3)), now, True)
        return out(dt, "day") if dt else None
    m = re.search(r"(\d{1,2})월\s*(\d{1,2})일", s)
    if m:
        dt = _date_or_none(now.year, int(m.group(1)), int(m.group(2)), now, False)
        return out(dt, "day") if dt else None
    m = re.search(r"(\d{1,2})\s*tháng\s*(\d{1,2})(?:,?\s*(\d{4}))?", s)
    if m:
        year = int(m.group(3)) if m.group(3) else now.year
        dt = _date_or_none(year, int(m.group(2)), int(m.group(1)), now, bool(m.group(3)))
        return out(dt, "day") if dt else None
    m = re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,\s*(\d{4}))?", s)
    if m:
        year = int(m.group(3)) if m.group(3) else now.year
        dt = _date_or_none(year, EN_MONTHS[m.group(1)], int(m.group(2)), now, bool(m.group(3)))
        return out(dt, "day") if dt else None

    if s.startswith(("방금", "vừa xong", "just now")):
        return out(now, "minute")
    if re.search(r"어제|hôm qua|yesterday", s):
        return out(now - timedelta(days=1), "day")
    m = re.search(r"(\d+)\s*(분|phút|mins?\b|minutes?\b|m\b)", s)
    if m:
        return out(now - timedelta(minutes=int(m.group(1))), "minute")
    m = re.search(r"(\d+)\s*(시간|giờ|hrs?\b|hours?\b|h\b)", s)
    if m:
        return out(now - timedelta(hours=int(m.group(1))), "hour")
    m = re.search(r"(\d+)\s*(일|ngày|days?\b|d\b)", s)
    if m:
        return out(now - timedelta(days=int(m.group(1))), "day")
    m = re.search(r"(\d+)\s*(주|tuần|weeks?\b|w\b)", s)
    if m:
        return out(now - timedelta(weeks=int(m.group(1))), "week")
    return None


# ── 이전 실행 상태 (그룹별 이미 처리한 게시물 키) ──────────────────────
def load_seen_state(path: Path = SEEN_STATE_PATH) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as e:
        # 깨진 상태 파일은 "처음 실행"과 같게 취급(상한 + DB 제목 중복 방지가 막아줌)
        print(f"  ⚠️ 상태 파일 읽기 실패 — 빈 상태로 진행: {e}")
        return {}


def merge_seen_keys(old_keys: list[str], new_keys: list[str], limit: int = SEEN_KEYS_PER_GROUP) -> list[str]:
    merged: list[str] = []
    for key in [*new_keys, *old_keys]:
        if key not in merged:
            merged.append(key)
    return merged[:limit]


def save_seen_state(state: dict, group_stats: list[dict], path: Path = SEEN_STATE_PATH) -> None:
    for stats in group_stats:
        if stats.get("state") != "ok":
            continue
        entry = state.get(stats["group"], {})
        state[stats["group"]] = {
            "keys": merge_seen_keys(entry.get("keys", []), stats["new_keys"]),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  💾 수집 상태 저장: {path.name}")


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


# 최상위 게시물 요소만(댓글은 게시물 안에 중첩된 role=article이라 제외).
TOP_LEVEL_POSTS_JS = """
    const CAND = '[role="article"], div[aria-posinset], div[data-ft]'
    const tops = [...document.querySelectorAll(CAND)]
        .filter(el => !(el.parentElement && el.parentElement.closest(CAND)))
    const LINK = 'a[href*="/posts/"], a[href*="story_fbid"], a[href*="/permalink/"], a[href*="multi_permalinks"]'
    const textOf = el => {
        const preview = el.querySelector('[data-ad-preview="message"]')
        const nodes = preview ? [preview] : [...el.querySelectorAll('[dir="auto"]')]
        const lines = []
        for (const n of nodes) {
            const t = (n.innerText || n.textContent || '').trim()
            if (t && t.length > 2) lines.push(t)
        }
        return [...new Set(lines)].join('\\n').trim()
    }
"""


async def extract_visible_posts(page) -> dict:
    """{posts, placeholders, total} — 텍스트도 퍼머링크도 없는 요소는 아직 안 채워진
    자리 표시자로 따로 센다(이미 본 글/끝으로 판단하지 않음)."""
    return await page.evaluate("() => {" + TOP_LEVEL_POSTS_JS + """
        const seen = new Set()
        const posts = []
        let placeholders = 0

        for (const el of tops) {
            const text = textOf(el)
            const linkEl = el.querySelector(LINK)
            const postUrl = linkEl ? linkEl.href : ''
            if (!text && !postUrl) { placeholders++; continue }
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

            const timeLabel = linkEl
                ? ((linkEl.innerText || '').trim() || linkEl.getAttribute('aria-label') || '')
                : ''
            posts.push({ text, images: imgs, postUrl, timeLabel,
                         posinset: el.getAttribute('aria-posinset') })
        }
        return { posts, placeholders, total: tops.length }
    }""")


async def placeholder_count(page) -> int:
    return await page.evaluate("() => {" + TOP_LEVEL_POSTS_JS + """
        return tops.filter(el => !textOf(el) && !el.querySelector(LINK)).length
    }""")


def feed_end_decision(grew: bool, placeholders_left: int, streak: int, max_streak: int) -> tuple[int, bool]:
    """스크롤 뒤 (새 streak, 종료 여부). 빈 칸이 남아 있으면 로딩 지연인지 목록 끝인지
    구분할 수 없으므로 '증가 없음'으로 세지 않는다 — 그 경우는 스크롤/시간 상한이 끝낸다."""
    if grew or placeholders_left > 0:
        return 0, False
    streak += 1
    return streak, streak >= max_streak


async def scroll_to_first_placeholder(page) -> None:
    await page.evaluate("() => {" + TOP_LEVEL_POSTS_JS + """
        const ph = tops.find(el => !textOf(el) && !el.querySelector(LINK))
        if (ph) ph.scrollIntoView({behavior: 'smooth', block: 'center'})
    }""")


async def goto_with_retry(page, url: str) -> bool:
    """네트워크성 로딩 실패만 60초 뒤 1회 재시도."""
    for attempt in (1, 2):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            return True
        except Exception as e:
            print(f"  ⛔ 로딩 실패({attempt}/2): {e}")
            if attempt == 1:
                await page.wait_for_timeout(60000)
    return False


async def crawl_group(page, target: dict, prev_seen: set[str]) -> tuple[list[dict], dict]:
    url = target["url"]
    location = target["location"]
    print(f"\n  📄 그룹: {url}")
    stats = {
        "group": url, "state": "ok", "steps": 0, "stop_reason": None,
        "overlap": 0, "new_keys": [], "jobs": 0, "max_placeholders": 0,
        "placeholder_waits": 0, "loading_delay_steps": 0, "had_previous_state": bool(prev_seen), "time_labels": [],
    }

    if not await goto_with_retry(page, url):
        stats["state"] = "load_failed"
        return [], stats

    state = await inspect_page_state(page)
    if state == "ok" and await article_count(page) == 0:
        # 피드는 있는데 게시물이 0개인 경우만 기존 mobile fallback 유지
        fallback_url = mobile_group_url(url)
        print(f"    ↪ article 0개 — mobile fallback 재시도: {fallback_url}")
        if await goto_with_retry(page, fallback_url):
            state = await inspect_page_state(page)
    if state != "ok":
        stats["state"] = state
        print(f"  ⛔ 페이지 상태: {state}")
        await save_evidence(page, url, state)
        if state in ("checkpoint", "session_expired"):
            raise AccountStop(state, url)
        return [], stats

    print(f"  ✅ 로그인 확인: {(await page.title())[:50]}")

    posts = []
    seen_text = set()
    processed = set()
    step = 0
    no_growth_streak = 0
    started = time.monotonic()
    # 2026-09-28 실측: article 수가 2→4로 한 번 늘었다가 바로 다음 스크롤에서
    # 안 늘어난 경우가 있었음 — Facebook의 다음 배치 로딩이 스크롤 1회보다
    # 느릴 수 있어, 안 늘어난 게 1번뿐이면 계속 시도하고 2번 연속일 때만
    # 실제로 "더 이상 없음"으로 판단한다(무한루프 방지를 위해 여전히 상한은 둠).
    MAX_NO_GROWTH_STREAK = 2

    while True:
        if len(posts) >= TARGET_PER_GROUP:
            stats["stop_reason"] = "target_jobs"
            break
        if step >= MAX_SCROLL_STEPS:
            stats["stop_reason"] = "max_steps"
            break
        if time.monotonic() - started > GROUP_TIME_BUDGET_SEC:
            stats["stop_reason"] = "time_budget"
            break
        step += 1

        await expand_visible_posts(page)
        await page.wait_for_timeout(random.randint(800, 1500))
        data = await extract_visible_posts(page)
        if data["total"] and data["placeholders"] * 2 > data["total"]:
            # 절반 넘게 빈 칸 — 해당 위치로 천천히 가서 채워질 시간을 한 번 준다
            stats["placeholder_waits"] += 1
            await scroll_to_first_placeholder(page)
            await page.wait_for_timeout(2000)
            await expand_visible_posts(page)
            data = await extract_visible_posts(page)
        stats["max_placeholders"] = max(stats["max_placeholders"], data["placeholders"])

        for r in data["posts"]:
            key = post_key(r)
            if key in processed:
                continue
            processed.add(key)
            if key in prev_seen:
                stats["overlap"] += 1
                continue
            stats["new_keys"].append(key)
            time_info = parse_time_label(r.get("timeLabel", ""))
            if len(stats["time_labels"]) < 40:
                stats["time_labels"].append({"key": key, "label": r.get("timeLabel", ""), "parsed": time_info})

            text = clean_text(r.get("text", ""))
            text_key = text[:80]
            if not text or text_key in seen_text or not is_job_post(text):
                continue

            if is_self_promotion(text):
                print(f"    ⏩ 구직자 홍보글 스킵: {text[:50]!r}")
                continue

            if has_excluded_money_terms(text):
                print(f"    ⏩ 대출/채권회수 공고 스킵")
                continue

            # 사무/전문직은 건너뜀 (생활밀착형 집중)
            if is_office_job(text):
                print(f"    ⏩ 사무/전문직 스킵")
                continue

            seen_text.add(text_key)
            posts.append({**r, "text": text, "location": location,
                          "post_key": key, "time_info": time_info})
            if len(posts) >= TARGET_PER_GROUP:
                break

        print(f"    스텝 {step}: 게시물 {len(data['posts'])}개(빈 칸 {data['placeholders']}), "
              f"신규 {len(stats['new_keys'])} / 이전과 겹침 {stats['overlap']}, 공고 {len(posts)}개")

        prev_count = await article_count(page)
        await page.evaluate(f"""() => {{
            const candidates = document.querySelectorAll('[role="article"], div[aria-posinset], div[data-ft]')
            const last = candidates[candidates.length - 1]
            if (last) last.scrollIntoView({{behavior: 'smooth', block: 'end'}})
        }}""")

        for _ in range(random.randint(5, 10)):
            await page.keyboard.press("ArrowDown")
            await page.wait_for_timeout(random.randint(100, 300))

        await page.wait_for_timeout(random.randint(3000, 5000))

        # 2026-09-28 DRY-RUN: 빈 칸 3~4개가 남은 채 "2회 연속 미증가"로 끝나 5개만
        # 읽었다 — 빈 칸이 남아 있으면 끝으로 보지 않는다(feed_end_decision).
        new_count = await article_count(page)
        placeholders_left = await placeholder_count(page)
        grew = new_count > prev_count
        if not grew and placeholders_left > 0:
            stats["loading_delay_steps"] += 1
            print(f"    (article 수 그대로, 빈 칸 {placeholders_left}개 남음 — 로딩 지연으로 보고 계속)")
        no_growth_streak, ended = feed_end_decision(grew, placeholders_left, no_growth_streak, MAX_NO_GROWTH_STREAK)
        if ended:
            print(f"    더 이상 게시물 없음 (총 {len(posts)}개, 빈 칸 없이 {no_growth_streak}회 연속 미증가)")
            stats["stop_reason"] = "no_growth"
            break
        if not grew and placeholders_left == 0:
            print(f"    (article 수 안 늘어남 {no_growth_streak}/{MAX_NO_GROWTH_STREAK} — 한 번 더 시도)")

    stats["steps"] = step
    stats["jobs"] = len(posts)
    print(f"    종료: {stats['stop_reason']} (스텝 {step}, 신규 게시물 {len(stats['new_keys'])}, "
          f"이전 실행과 겹침 {stats['overlap']})")
    if prev_seen and stats["overlap"] == 0:
        print("    ⚠️ 이전 실행과 겹친 게시물 0개 — 그 사이 새 글이 상한보다 많았을 수 있음(누락 가능)")
    return posts, stats


def parse_post(post: dict) -> dict:
    text = post["text"]
    images = post.get("images", [])
    location = post["location"]

    phone = extract_phone(text)
    zalo = extract_zalo(text) or phone  # Zalo 미표기 시 전화번호 공유
    district = extract_district(text)
    # 구/군/동 있으면 위치 정보를 더 구체적으로
    full_location = f"{district}, {location}" if district else location

    title = extract_title(text)
    company = extract_company(text)
    category = classify(title, company, text)
    subcategory = classify_subcategory(category, title, company, text)
    category, subcategory = map_to_new_taxonomy(category, subcategory)

    return {
        "title": title,
        "company": company or "Nhà tuyển dụng Facebook",
        "location": full_location,
        "salary": extract_salary(text),
        "employer_phone": phone,
        "zalo": zalo,
        "description": f"[source:facebook] {text}",
        "category": category,
        "subcategory": subcategory,
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


# ── DB 재저장 방지 (2026-09-28) ─────────────────────────────────────
# 게시물 ID 중복 판별(state/facebook_seen.json)과 원문 링크의 사용자 노출
# (source_url — 지원 버튼 이동처)은 분리한다. source_url을 비워둔 채로 DB
# 재저장을 막는 건 아래 두 키: ① 기존 title+company, ② 본문 지문(저장된
# description 본문을 정규화한 해시). ②는 추출 로직(제목/회사)이 바뀌어도
# 같은 글이면 같은 값이라, 상태 파일이 없어져도 같은 글이 다시 들어가지 않는다.
FACEBOOK_DESCRIPTION_PREFIX = "[source:facebook] "


def title_company_key(job: dict) -> tuple[str, str]:
    return ((job.get("title") or "").strip().lower()[:60], (job.get("company") or "").strip().lower()[:40])


def text_fingerprint(description: str) -> str:
    body = (description or "").replace("[source:facebook]", "", 1)
    normalized = ascii_key(body)[:300]
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def filter_new_jobs(jobs: list[dict], existing_rows: list[dict]) -> list[dict]:
    """기존 facebook 행(title/company/description)과 겹치지 않는 공고만. 같은 실행 안의
    중복도 걸러낸다."""
    seen_tc = {title_company_key(r) for r in existing_rows}
    seen_fp = {text_fingerprint(r.get("description", "")) for r in existing_rows}
    fresh = []
    for job in jobs:
        tc, fp = title_company_key(job), text_fingerprint(job.get("description", ""))
        if tc in seen_tc or fp in seen_fp:
            continue
        seen_tc.add(tc)
        seen_fp.add(fp)
        fresh.append(job)
    return fresh


def fetch_existing_facebook_rows(page_size: int = 1000) -> list[dict]:
    """PostgREST 기본 행 제한(1000)에 잘리지 않도록 페이지 단위로 전부 읽는다."""
    rows: list[dict] = []
    start = 0
    while True:
        res = supabase.table("local_jobs") \
            .select("id,title,company,description") \
            .like("description", "%[source:facebook]%") \
            .order("id") \
            .range(start, start + page_size - 1) \
            .execute()
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            return rows
        start += page_size


def save_to_supabase(jobs: list[dict]):
    if not supabase:
        print("  ⚠️  Supabase 없음")
        return

    existing_rows = fetch_existing_facebook_rows()
    print(f"  📋 기존 facebook 공고: {len(existing_rows)}개")

    # 생활밀착형 우선 정렬
    priority = [j for j in jobs if j.get("is_local_priority")]
    others   = [j for j in jobs if not j.get("is_local_priority")]
    ordered  = priority + others

    # 신규 공고만 필터링 (누적 추가)
    new_jobs = filter_new_jobs(ordered, existing_rows)
    print(f"  📊 생활밀착형: {len(priority)}개 / 기타: {len(others)}개")
    print(f"  ➕ 신규 공고: {len(new_jobs)}개 / 중복 스킵: {len(ordered) - len(new_jobs)}개")

    db_columns = {
        "active",
        "admin_hidden",
        "application_deadline",
        "category",
        "company",
        "company_founded_year",
        "company_verified",
        "description",
        "education",
        "employer_id",
        "employer_phone",
        "hire_count",
        "hours",
        "image_url",
        "images",
        "lat",
        "lng",
        "location",
        "num_hires",
        "origin",
        "posted_at",
        "preference",
        "salary",
        "source",
        "title",
        "urgent",
        "work_days",
        "work_period",
    }

    def to_db_payload(job: dict) -> dict:
        return {k: v for k, v in job.items() if k in db_columns}

    inserted = 0
    for i in range(0, len(new_jobs), 50):
        batch = [to_db_payload(j) for j in new_jobs[i:i+50]]
        supabase.table("local_jobs").insert(batch).execute()
        inserted += len(batch)
        print(f"  ✅ 저장: {inserted}/{len(new_jobs)}개")

    if not new_jobs:
        print("  ℹ️  새 공고 없음 — 기존 데이터 유지")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Facebook 그룹 채용공고 크롤러")
    parser.add_argument("--dry-run", action="store_true",
                        help="DB 저장·수집 상태 갱신 없이 결과만 state/에 파일로 남김")
    parser.add_argument("--group", default="",
                        help="URL에 이 문자열이 들어간 그룹만 수집(예: timvieclamthembacninh)")
    return parser.parse_args(argv)


async def main(argv=None) -> int:
    args = parse_args(argv)
    print("🚀 Facebook 그룹 크롤링 시작 (생활밀착형 우선)" + (" [DRY-RUN: DB 저장 안 함]" if args.dry_run else ""))
    print("─" * 50)

    if not FB_C_USER or not FB_XS:
        print("  ⚠️  FB_C_USER, FB_XS 쿠키가 .env에 없습니다.")
        return 1

    targets = [t for t in TARGETS if args.group in t["url"]]
    if not targets:
        print(f"  ⚠️  '{args.group}'에 해당하는 그룹 없음")
        return 1

    seen_state = load_seen_state()
    group_stats: list[dict] = []
    stop_state = None  # 사람 확인이 필요한 중단 사유

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
        consecutive_anomaly = 0

        for i, target in enumerate(targets):
            prev_seen = set(seen_state.get(target["url"], {}).get("keys", []))
            try:
                posts, stats = await crawl_group(page, target, prev_seen)
            except AccountStop as e:
                print(f"\n  🛑 {e.state} — 전체 중단. 사람이 일반 브라우저로 계정 상태를 확인하기 전까지 재실행 금지")
                stop_state = e.state
                break
            group_stats.append(stats)

            if stats["state"] == "anomaly":
                consecutive_anomaly += 1
                if consecutive_anomaly >= MAX_CONSECUTIVE_ANOMALY_GROUPS:
                    print(f"\n  🛑 {consecutive_anomaly}개 그룹 연속 페이지 이상 — 전체 중단, 사람 확인 필요(state/evidence 참고)")
                    stop_state = "anomaly_repeated"
                    break
            else:
                consecutive_anomaly = 0

            for post in posts:
                job = parse_post(post)
                if is_ambiguous_job(job):
                    print(f"    ⏩ 애매한 공고 스킵: {job['title'][:70]}")
                    continue
                key = job["title"].lower()[:50]
                if key not in seen_titles:
                    seen_titles.add(key)
                    # DB 컬럼이 아니라 to_db_payload()에서 걸러짐 — 결과 파일 확인용
                    job["fb_post_key"] = post.get("post_key")
                    job["fb_time"] = post.get("time_info")
                    all_jobs.append(job)

            if i < len(targets) - 1:
                pause = random.randint(*GROUP_PAUSE_SEC)
                print(f"    … 다음 그룹까지 {pause}초 대기")
                await page.wait_for_timeout(pause * 1000)

        await browser.close()

    print(f"\n📊 수집 완료: {len(all_jobs)}개")
    summary = [{k: v for k, v in s.items() if k != "new_keys"} | {"new_posts": len(s["new_keys"])}
               for s in group_stats]

    if args.dry_run:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        out = STATE_DIR / f"facebook_dryrun_{datetime.now():%Y%m%d_%H%M%S}.json"
        out.write_text(json.dumps({"stop_state": stop_state, "groups": summary, "jobs": all_jobs},
                                  ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  💾 DRY-RUN 결과: {out} (DB·수집 상태 변경 없음)")
    else:
        with open("facebook_jobs.json", "w", encoding="utf-8") as f:
            json.dump(all_jobs, f, ensure_ascii=False, indent=2)
        print("  💾 facebook_jobs.json 저장")
        save_to_supabase(all_jobs)
        # DB 저장이 끝난 뒤에만 "처리함"으로 기록 — 저장 실패 시 다음 실행에서 다시 처리
        save_seen_state(seen_state, group_stats)

    print("\n✨ 완료!" if not stop_state else f"\n🛑 중단: {stop_state}")
    return 2 if stop_state else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
