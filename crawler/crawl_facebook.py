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
LAST_RUN_PATH = STATE_DIR / "facebook_last_run.json"  # 마지막 실행 요약(운영 점검·알림용)
# 계정 이상(checkpoint/session_expired) 감지 시 자동 생성되는 잠금. 있으면 크롤러가 아예
# 시작하지 않는다(dry-run 포함) — 사람이 일반 브라우저로 계정을 확인하고 쿠키를 갱신한 뒤
# 직접 지워야 풀린다. (2026-09-28 17:15 VPS에서 세션 만료 — 반복 접속으로 계정 위험을
# 키우지 않도록 정기 실행이든 수동 실행이든 여기서 막는다.)
ACCOUNT_LOCK_PATH = STATE_DIR / "FACEBOOK_ACCOUNT_LOCK"


def write_account_lock(state: str, group_url: str, path: Path = ACCOUNT_LOCK_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"state={state}\ngroup={group_url}\nat={datetime.now().isoformat(timespec='seconds')}\n"
        "해제: 일반 브라우저로 계정 상태 확인 → 필요 시 쿠키 갱신 → 이 파일 삭제\n",
        encoding="utf-8")


def account_lock_reason(path: Path = ACCOUNT_LOCK_PATH) -> str | None:
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None

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
        r"\d+[\.,]?\d*\s*(?:triệu|tr)(?:\s*/\s*\w+|/|\s*tháng|\s*month)?",
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
        # "TRUNG TÂM TIẾNG ANH X TUYỂN DỤNG TRỢ GIẢNG…" → "TIẾNG ANH X"
        candidate = re.sub(r"\s*[-–]?\s*(?:cần tuyển|tuyển dụng|tuyển)\b.*$", "", candidate, flags=re.IGNORECASE).strip()
        if candidate and not re.match(r"^(?:có|ho tro|hỗ trợ|can|cần|tuyen|tuyển)\b", candidate, re.IGNORECASE):
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

# 펼친 뒤 본문 끝에 붙는 '접기' 버튼 문구(2026-09-28 VPS: "...Tăng Quang)] 적게 보기")
TRAILING_TOGGLE_RE = re.compile(r"\s*(?:적게 보기|Ẩn bớt|See less)\s*$", re.IGNORECASE)


def clean_text(text: str) -> str:
    text = NOISE_PATTERNS.sub("", text)
    text = TRAILING_TOGGLE_RE.sub("", text)
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
    """상태 파일 → 없거나 깨졌으면 .bak → 그것도 없으면 빈 상태. 빈 상태여도 DB 중복
    방지(본문 지문·제목+회사)가 재저장을 막는다(처리 시간만 늘어남)."""
    for candidate in (path, path.with_suffix(path.suffix + ".bak")):
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
            if candidate != path:
                print(f"  ⚠️ 상태 파일 대신 백업 사용: {candidate.name}")
            return data
        except FileNotFoundError:
            continue
        except Exception as e:
            print(f"  ⚠️ 상태 파일 읽기 실패({candidate.name}): {e}")
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
            # 최종 판정된 글만 '본 글'로 기록(잘림·시각 미확인은 다음 실행에서 재시도)
            "keys": merge_seen_keys(entry.get("keys", []), stats["final_keys"]),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
    write_json_atomic(path, state, keep_backup=True)
    print(f"  💾 수집 상태 저장: {path.name}")


def write_json_atomic(path: Path, data, keep_backup: bool = False) -> None:
    """임시 파일에 쓴 뒤 교체 — 쓰는 도중 중단돼도 기존 파일이 깨지지 않는다.
    keep_backup이면 직전 파일을 .bak으로 한 부 보존(상태 파일 소실·손상 대비)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    if keep_backup and path.exists():
        os.replace(path, path.with_suffix(path.suffix + ".bak"))
    os.replace(tmp, path)


async def expand_visible_posts(page) -> None:
    """최상위 게시물 본문의 '더 보기' 버튼만 누른다(2026-09-28: 예전엔 페이지 전체의
    링크까지 '더 보기'를 포함하면 눌러 엉뚱한 곳을 누를 수 있었다)."""
    await page.evaluate("() => {" + TOP_LEVEL_POSTS_JS + """
        for (const el of tops) {
            const btn = seeMoreBtn(el)
            if (btn) { try { btn.click() } catch {} }
        }
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
    const SEE_MORE_RE = /^(더 보기|Xem thêm|See more)(\\.\\.\\.|…)?$/
    // 이 게시물 본문 소속(댓글 등 중첩 후보·링크 아님)의 '더 보기' — 글자가 정확히 일치하는
    // 가장 안쪽 요소를 찾고, 클릭은 가장 가까운 role=button(없으면 그 요소)에 한다.
    // (2026-09-28 VPS: role=button만 찾던 방식은 실제 페이스북에서 펼치기 실패)
    const seeMoreBtn = el => {
        const hits = [...el.querySelectorAll('div, span, [role="button"]')]
            .filter(n => SEE_MORE_RE.test((n.innerText || '').trim()))
        const deepest = hits.filter(n => !hits.some(m => m !== n && n.contains(m)))
        for (const n of deepest) {
            if (n.closest('a[href]')) continue
            if (n.closest(CAND) !== el) continue
            return n.closest('[role="button"]') || n
        }
        return null
    }
    // 펼치기 실패 진단용: 후보 요소 구조만(본문 값 없음)
    const seeMoreDebug = el => [...el.querySelectorAll('div, span, [role="button"], a')]
        .filter(n => /더 보기|Xem thêm|See more/.test((n.innerText || '').trim()) && (n.innerText || '').trim().length < 20)
        .slice(0, 8)
        .map(n => ({ tag: n.tagName, role: n.getAttribute('role'), text: (n.innerText || '').trim(),
                     inLink: !!n.closest('a[href]'), ownPost: n.closest(CAND) === el,
                     children: n.children.length }))
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
        const emptyIdx = []
        let lastFilled = -1

        for (const [idx, el] of tops.entries()) {
            el.setAttribute('data-jobi-idx', String(idx))
            const text = textOf(el)
            const linkEl = el.querySelector(LINK)
            const postUrl = linkEl ? linkEl.href : ''
            if (!text && !postUrl) { placeholders++; emptyIdx.push(idx); continue }
            lastFilled = idx
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
            posts.push({ text, images: imgs, postUrl, timeLabel, idx,
                         posinset: el.getAttribute('aria-posinset'),
                         hasSeeMore: !!seeMoreBtn(el) })
        }
        // 마지막으로 채워진 글보다 위의 빈 칸 = 화면 밖으로 밀려 비워진(이미 읽은) 글,
        // 아래의 빈 칸 = 아직 채워지는 중인 글
        const above = emptyIdx.filter(i => i < lastFilled).length
        return { posts, placeholders, above, pending: placeholders - above, total: tops.length }
    }""")


SEE_MORE_LABELS = ("더 보기", "Xem thêm", "See more")


def is_truncated_post(raw_text: str, has_see_more: bool = False) -> bool:
    """'더 보기'를 못 펼친 미리보기 본문인지. 버튼이 남아 있거나, 본문이 말줄임표/
    '더 보기' 문구로 끝나면 잘린 것으로 본다(2026-09-28 보조강사 공고: 제목 + '…'만 수집)."""
    if has_see_more:
        return True
    t = (raw_text or "").rstrip()
    return t.endswith(("…", "...")) or t.endswith(SEE_MORE_LABELS)


async def expand_and_reread(page, idx: int) -> dict:
    """잘린 게시물 하나만 실제 마우스 클릭으로 펼친 뒤 다시 읽는다.
    실패 시 {"text": None, "debug": {...}} — 후보 요소 구조를 남겨 원인 판단에 쓴다."""
    READ = "(idx) => {" + TOP_LEVEL_POSTS_JS + """
        const el = document.querySelector(`[data-jobi-idx="${idx}"]`)
        if (!el) return null
        const btn = seeMoreBtn(el)
        if (btn) btn.setAttribute('data-jobi-more', String(idx))
        return { text: textOf(el), hasSeeMore: !!btn, candidates: seeMoreDebug(el),
                 tail: textOf(el).slice(-12) }
    }"""
    before = await page.evaluate(READ, idx)
    if not before:
        return {"text": None, "debug": {"reason": "element_gone"}}
    if not before["hasSeeMore"]:
        return {"text": None, "debug": {"reason": "no_button", "candidates": before["candidates"],
                                        "tail": before["tail"]}}
    try:
        btn = page.locator(f'[data-jobi-more="{idx}"]').first
        await btn.scroll_into_view_if_needed(timeout=3000)
        await btn.click(timeout=3000)
    except Exception as e:
        return {"text": None, "debug": {"reason": f"click_failed: {type(e).__name__}",
                                        "candidates": before["candidates"]}}
    after = None
    for _ in range(6):  # 최대 3초 동안 펼쳐지기를 기다림
        await page.wait_for_timeout(500)
        after = await page.evaluate(READ, idx)
        if after and not is_truncated_post(after["text"], after["hasSeeMore"]):
            return {"text": after["text"], "hasSeeMore": False}
    return {"text": None, "debug": {"reason": "still_truncated_after_click",
                                    "candidates": (after or before)["candidates"],
                                    "tail": (after or before)["tail"]}}


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


# ── 저장 전 검사 흐름 (2026-09-28) ─────────────────────────────────────
# 순서: 구인 여부 → 본문 전문 여부 → 게시 시각 신뢰도·최신성 → 필수 정보 → (중복은
# 같은 실행 안 본문 중복 + 저장 직전 DB 중복). 모든 판정은 코드+사유로 결과에 남긴다.
#
# 최신성 기준 FB_MAX_POST_AGE_DAYS(기본 3일)의 근거:
#  - local_jobs.posted_at에는 수집일이 들어가므로, 오래된 글을 저장하면 사이트에 "오늘
#    올라온 공고"처럼 보인다(2026-09-28 HCM DRY-RUN에서 2019~2021년 글 2건이 구인 후보로
#    통과 — 이 기준이 없으면 그대로 저장될 뻔함).
#  - 그룹 구인글은 급구·단기가 많아 며칠 지나면 마감된 경우가 많다.
#  - 하루 1회 실행이면 1일치로 충분하지만, 실행 실패·지연을 2일 여유로 흡수한다.
#  근거가 바뀌면 환경변수/--max-age-days로 조정한다.
MAX_POST_AGE_DAYS = float(os.getenv("FB_MAX_POST_AGE_DAYS", "3"))
FEED_STALL_STEPS = 3  # 새 ID·새 요소·문서 높이 증가가 모두 없는 스텝이 이만큼 연속이면 종료

# 다음 실행에서 다시 볼 필요가 없는 판정(= 수집 상태에 '본 글'로 기록)
FINAL_DECISIONS = {"accepted", "not_job", "self_promo", "money", "office", "too_old",
                   "ambiguous", "missing_required", "dup_in_run"}
# 다음 실행에서 다시 시도할 판정(기록하지 않음)
RETRY_DECISIONS = {"truncated", "time_unknown"}


def post_age_hours(time_info: dict | None, now: datetime) -> float | None:
    if not time_info or not time_info.get("estimate"):
        return None
    try:
        est = datetime.fromisoformat(time_info["estimate"])
    except ValueError:
        return None
    return max(0.0, (now - est).total_seconds() / 3600)


def evaluate_post(text: str, time_info: dict | None, full_text_ok: bool, location: str,
                  images: list | None = None, now: datetime | None = None,
                  max_age_days: float | None = None) -> tuple[str, list[str], dict | None]:
    """(판정 코드, 사유, 저장 후보 job 또는 None)."""
    now = now or datetime.now()
    max_age = MAX_POST_AGE_DAYS if max_age_days is None else max_age_days
    if not text or not is_job_post(text):
        return "not_job", ["구인 키워드 없음"], None
    if is_self_promotion(text):
        return "self_promo", ["구직자 자기홍보"], None
    if has_excluded_money_terms(text):
        return "money", ["대출/채권추심"], None
    if is_office_job(text):
        return "office", ["사무/전문직(수집 범위 밖)"], None
    if not full_text_ok:
        return "truncated", ["본문 전문 미확보('더 보기' 펼치기 실패)"], None
    age_h = post_age_hours(time_info, now)
    if age_h is None:
        return "time_unknown", ["게시 시각 해석 불가"], None
    if age_h > max_age * 24:
        return "too_old", [f"게시 {age_h / 24:.1f}일 전 > 기준 {max_age:g}일"], None
    job = parse_post({"text": text, "location": location, "images": images or []})
    job["fb_full_text_confirmed"] = True
    problems = missing_required(job)
    if problems:
        return "missing_required", problems, None
    if is_ambiguous_job(job):
        return "ambiguous", ["직무/연락처가 불분명한 일반 모집글"], None
    return "accepted", [], job


def stall_decision(progress: bool, stall: int, limit: int = FEED_STALL_STEPS) -> tuple[int, bool]:
    """스크롤 뒤 (새 stall 수, 종료 여부). 진전 = 새 게시물 ID·새 요소·문서 높이 증가 중 하나."""
    if progress:
        return 0, False
    stall += 1
    return stall, stall >= limit


def order_consistency(ages_in_reading_order: list[float]) -> float | None:
    """읽은 순서대로 게시 시각이 오래돼 가는 비율(1.0 = 최신순, 낮을수록 활동순/섞임)."""
    pairs = list(zip(ages_in_reading_order, ages_in_reading_order[1:]))
    if not pairs:
        return None
    return round(sum(1 for a, b in pairs if b >= a - 1) / len(pairs), 2)


def miss_risk(prev_seen: bool, overlap: int, oldest_age_h: float | None, interval_h: float = 24) -> str:
    """놓친 글 가능성 추정.
    - 이전 실행 기록이 있으면: 겹친 글이 있으면 그 사이 구간을 끝까지 읽었다는 뜻 → low.
    - 없으면: 읽은 가장 오래된 글이 실행 간격+여유(6h)보다 오래됐는지로 판단."""
    if prev_seen:
        return "low" if overlap > 0 else "high(이전 실행과 겹침 0)"
    if oldest_age_h is None:
        return "unknown(시각 없음)"
    return "low" if oldest_age_h >= interval_h + 6 else f"high(읽은 범위 {oldest_age_h:.0f}h < {interval_h + 6:.0f}h)"


async def feed_metrics(page) -> dict:
    return await page.evaluate("() => {" + TOP_LEVEL_POSTS_JS + """
        return { total: tops.length, scrollY: Math.round(window.scrollY),
                 docHeight: document.documentElement.scrollHeight }
    }""")


async def advance_feed(page) -> None:
    """앞으로만 스크롤: 마우스 휠 몇 번 + 문서 맨 아래로. (2026-09-28 이전 방식 —
    마지막 후보 요소 scrollIntoView + 방향키, 그리고 '첫 빈 칸으로 스크롤' — 은 화면 밖으로
    비워진 위쪽 글로 되돌아가 스크롤이 위아래로 진동했다: HCM 요소 합계 15 고정, 채움 4↔6.)"""
    await page.mouse.move(640, 450)
    for _ in range(3):
        await page.mouse.wheel(0, random.randint(900, 1300))
        await page.wait_for_timeout(random.randint(500, 900))
    await page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
    await page.wait_for_timeout(random.randint(2500, 4000))


async def crawl_group(page, target: dict, prev_seen: set[str], max_age_days: float | None = None) -> tuple[list[dict], dict]:
    url = target["url"]
    location = target["location"]
    now = datetime.now()
    print(f"\n  📄 그룹: {url}")
    stats = {
        "group": url, "state": "ok", "steps": 0, "stop_reason": None, "had_previous_state": bool(prev_seen),
        "overlap": 0, "final_keys": [], "retry_keys": [], "counts": {}, "decisions": [], "trace": [],
        "expanded": 0, "author_ellipsis": 0, "truncated_debug": [], "id_missing": 0, "jobs": 0,
        "max_age_days": MAX_POST_AGE_DAYS if max_age_days is None else max_age_days,
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

    jobs: list[dict] = []
    seen_text: set[str] = set()
    processed: set[str] = set()
    step = 0
    stall = 0
    started = time.monotonic()

    while True:
        if len(jobs) >= TARGET_PER_GROUP:
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
        if data["pending"] > 0:
            # 마지막 글 아래의 빈 칸 = 아직 채워지는 중일 수 있음 → 스크롤 없이 한 번만 더 기다림
            await page.wait_for_timeout(2000)
            await expand_visible_posts(page)
            data = await extract_visible_posts(page)

        new_ids: list[str] = []
        for r in data["posts"]:
            key = post_key(r)
            if key in processed:
                continue
            processed.add(key)
            new_ids.append(key)
            if not r.get("postUrl"):
                stats["id_missing"] += 1
            if key in prev_seen:
                stats["overlap"] += 1
                stats["decisions"].append({"key": key, "step": step, "decision": "seen_before"})
                continue

            full_text_ok = True
            if is_truncated_post(r.get("text", ""), r.get("hasSeeMore", False)):
                again = await expand_and_reread(page, r["idx"])
                dbg = again.get("debug") or {}
                if again.get("text"):
                    r = {**r, "text": again["text"], "hasSeeMore": False}
                    stats["expanded"] += 1
                elif dbg.get("reason") == "no_button" and not dbg.get("candidates"):
                    # '…'로 끝나지만 '더 보기' 요소가 전혀 없음 = 작성자 말줄임표(전문)
                    stats["author_ellipsis"] += 1
                else:
                    full_text_ok = False
                    stats["truncated_debug"].append({"key": key, **dbg})

            text = clean_text(r.get("text", ""))
            label = r.get("timeLabel", "")
            time_info = parse_time_label(label)
            decision, reasons, job = evaluate_post(text, time_info, full_text_ok, location,
                                                   r.get("images"), now, stats["max_age_days"])
            if decision == "accepted":
                if text[:80] in seen_text:
                    decision, reasons, job = "dup_in_run", ["같은 실행 안에서 같은 본문"], None
                else:
                    seen_text.add(text[:80])
            age_h = post_age_hours(time_info, now)
            first_line = next((l.strip() for l in text.split("\n") if l.strip()), "")[:70]
            stats["decisions"].append({
                "key": key, "step": step, "time_label": label,
                "age_h": None if age_h is None else round(age_h, 1),
                "time_precision": (time_info or {}).get("precision"),
                "decision": decision, "reasons": reasons, "first_line": first_line,
                # 놓친 구인글(오판) 측정용 본문 앞부분 — 결과 파일은 서버 state/(gitignore)에만 남는다
                "text_head": text[:300],
            })
            stats["counts"][decision] = stats["counts"].get(decision, 0) + 1
            (stats["final_keys"] if decision in FINAL_DECISIONS else stats["retry_keys"]).append(key)
            if decision in ("self_promo", "truncated", "too_old", "time_unknown", "accepted"):
                print(f"    [{decision}] {key} {label!r} {first_line[:50]!r}")
            if job:
                job.update({"fb_post_key": key, "fb_time": time_info,
                            "fb_age_hours": None if age_h is None else round(age_h, 1)})
                jobs.append(job)
                if len(jobs) >= TARGET_PER_GROUP:
                    break

        before = await feed_metrics(page)
        await advance_feed(page)
        after = await feed_metrics(page)
        # 문서 높이는 새 글 없이도 수십 px씩 늘 수 있어(2026-09-28 Bắc Ninh: 스텝마다 +16px)
        # 200px 이상 늘었을 때만 진전으로 본다.
        progress = (bool(new_ids) or after["total"] > data["total"]
                    or after["docHeight"] - before["docHeight"] >= 200)
        stats["trace"].append({
            "step": step, "total": data["total"], "filled": len(data["posts"]),
            "empty_above": data["above"], "empty_pending": data["pending"],
            "new_ids": new_ids, "total_after_scroll": after["total"],
            "doc_height": [before["docHeight"], after["docHeight"]], "scroll_y": [before["scrollY"], after["scrollY"]],
        })
        print(f"    스텝 {step}: 요소 {data['total']}(채움 {len(data['posts'])}·위 빈칸 {data['above']}·아래 빈칸 {data['pending']}) "
              f"새 ID {len(new_ids)} → 스크롤 후 요소 {after['total']}, 문서 높이 {before['docHeight']}→{after['docHeight']}")
        stall, ended = stall_decision(progress, stall)
        if ended:
            stats["stop_reason"] = "feed_end" if data["pending"] == 0 else "feed_stalled"
            break

    stats["steps"] = step
    stats["jobs"] = len(jobs)
    filled_total = len(processed)
    ages = [d["age_h"] for d in stats["decisions"] if d.get("age_h") is not None]
    stats["posts_seen"] = filled_total
    stats["newest_age_h"] = min(ages) if ages else None
    stats["oldest_age_h"] = max(ages) if ages else None
    stats["order_consistency"] = order_consistency(ages)
    stats["miss_risk"] = miss_risk(bool(prev_seen), stats["overlap"], stats["oldest_age_h"])
    if filled_total == 0:
        # 로그인·피드는 정상인데 게시물을 하나도 못 읽음 = 화면 구조 변경 의심
        stats["state"] = "no_posts"
        await save_evidence(page, url, "no_posts")
    elif stats["id_missing"] * 2 > filled_total:
        stats["structure_warning"] = f"게시물 ID 미확보 {stats['id_missing']}/{filled_total}"
        await save_evidence(page, url, "structure_warning")
    print(f"    종료: {stats['stop_reason']} (스텝 {step}, 읽은 글 {filled_total}, 이전 실행과 겹침 {stats['overlap']}, "
          f"판정 {stats['counts']}, 놓친 글 위험 {stats['miss_risk']})")
    return jobs, stats


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


def body_tail_fingerprint(description: str) -> str | None:
    """첫 줄(제목)을 뺀 본문 지문 — 상태 파일이 없을 때 작성자가 제목만 고친 글이 다시
    저장되는 것을 막는다. 남은 본문이 너무 짧으면(60자 미만) 오탐 방지를 위해 쓰지 않는다."""
    body = (description or "").replace("[source:facebook]", "", 1).strip()
    lines = [l for l in body.split("\n") if l.strip()]
    tail = ascii_key("\n".join(lines[1:]))
    if len(tail) < 60:
        return None
    return hashlib.sha1(tail[:300].encode("utf-8")).hexdigest()


def filter_new_jobs(jobs: list[dict], existing_rows: list[dict]) -> list[dict]:
    """기존 facebook 행(title/company/description)과 겹치지 않는 공고만. 같은 실행 안의
    중복도 걸러낸다. 키: ① 제목+회사 ② 본문 지문 ③ 제목 뺀 본문 지문."""
    seen_tc = {title_company_key(r) for r in existing_rows}
    seen_fp = {text_fingerprint(r.get("description", "")) for r in existing_rows}
    seen_tail = {body_tail_fingerprint(r.get("description", "")) for r in existing_rows} - {None}
    fresh = []
    for job in jobs:
        desc = job.get("description", "")
        tc, fp, tail = title_company_key(job), text_fingerprint(desc), body_tail_fingerprint(desc)
        if tc in seen_tc or fp in seen_fp or (tail and tail in seen_tail):
            continue
        seen_tc.add(tc)
        seen_fp.add(fp)
        if tail:
            seen_tail.add(tail)
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


def missing_required(job: dict) -> list[str]:
    """DB 저장 전 필수 조건. 비어 있지 않으면 저장하지 않는다."""
    body = (job.get("description") or "").replace("[source:facebook]", "", 1)
    problems = []
    tail = body.rstrip()
    if tail.endswith(SEE_MORE_LABELS) or (tail.endswith(("…", "...")) and not job.get("fb_full_text_confirmed")):
        # 말줄임표로 끝나는 글은 크롤링 중 '더 보기' 요소가 없음을 화면에서 확인한 경우만 허용
        problems.append("본문 잘림")
    if not (job.get("title") or "").strip():
        problems.append("제목 없음")
    if not (job.get("employer_phone") or job.get("zalo")):
        problems.append("연락처 없음")
    if not (job.get("location") or "").strip():
        problems.append("지역 없음")
    if is_self_promotion(body):
        problems.append("구직자 홍보글")
    return problems


def save_to_supabase(jobs: list[dict]) -> list[dict]:
    """저장한 행(id,title)을 돌려준다."""
    if not supabase:
        print("  ⚠️  Supabase 없음")
        return []

    # 잘린 본문·필수 정보 누락은 어떤 경로로 들어와도 저장하지 않는다(최종 방어선)
    complete = []
    for job in jobs:
        problems = missing_required(job)
        if problems:
            print(f"  ⛔ 저장 제외({', '.join(problems)}): {job.get('title', '')[:60]}")
        else:
            complete.append(job)
    jobs = complete

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

    saved: list[dict] = []
    for i in range(0, len(new_jobs), 50):
        batch = [to_db_payload(j) for j in new_jobs[i:i+50]]
        res = supabase.table("local_jobs").insert(batch).execute()
        saved.extend({"id": r.get("id"), "title": r.get("title")} for r in (res.data or []))
        print(f"  ✅ 저장: {len(saved)}/{len(new_jobs)}개")

    if not new_jobs:
        print("  ℹ️  새 공고 없음 — 기존 데이터 유지")
    return saved


def save_selected_from_dryrun(path: str, post_keys: list[str], max_save: int) -> int:
    """DRY-RUN 결과 파일에서 지정한 게시물만 저장(페이스북 재접속 없음). 사람이 원문을
    대조한 뒤 소량 저장할 때 쓴다."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    by_key = {j.get("fb_post_key"): j for j in data.get("jobs", [])}
    picked = []
    for key in post_keys:
        old = by_key.get(key)
        if not old:
            print(f"  ⛔ 결과 파일에 없는 게시물: {key}")
            continue
        # 결과 파일의 옛 추출값 대신 원문에서 현재 로직으로 다시 추출
        text = (old.get("description") or "").replace("[source:facebook]", "", 1).strip()
        group_location = (old.get("location") or "").split(", ")[-1]
        job = parse_post({"text": text, "location": group_location, "images": old.get("images") or []})
        job["fb_post_key"] = key
        job["fb_full_text_confirmed"] = bool(old.get("fb_full_text_confirmed"))
        if is_ambiguous_job(job):
            print(f"  ⛔ 애매한 공고로 판정 — 제외: {key}")
            continue
        picked.append(job)
    if len(picked) > max_save:
        print(f"  ⛔ 선택 {len(picked)}건 > 최대 {max_save}건 — 저장 안 함")
        return 1
    existing = fetch_existing_facebook_rows()
    fresh_keys = {j.get("fb_post_key") for j in filter_new_jobs(picked, existing)}
    for job in picked:
        state = "신규" if job.get("fb_post_key") in fresh_keys else "DB 중복"
        print(f"  저장 전 점검: {job.get('fb_post_key')} / {state} / 필수조건 문제: {missing_required(job) or '없음'}")
    saved = save_to_supabase(picked)
    for row in saved:
        print(f"  💾 저장 ID {row['id']}: {row['title']}")
    print(f"  결과: 선택 {len(picked)} / 저장 {len(saved)}")
    return 0


def summarize_group(g: dict) -> dict:
    keep = ("group", "state", "stop_reason", "steps", "posts_seen", "overlap", "counts", "newest_age_h",
            "oldest_age_h", "order_consistency", "miss_risk", "expanded", "author_ellipsis", "jobs",
            "had_previous_state", "max_age_days", "structure_warning", "id_missing")
    out = {k: g.get(k) for k in keep}
    out["group_slug"] = g["group"].rstrip("/").split("/")[-1]
    out["truncated"] = len(g.get("truncated_debug") or [])
    out["posts_seen"] = g.get("posts_seen", 0)
    return out


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Facebook 그룹 채용공고 크롤러")
    parser.add_argument("--dry-run", action="store_true",
                        help="DB 저장·수집 상태 갱신 없이 결과만 state/에 파일로 남김")
    parser.add_argument("--group", default="",
                        help="URL에 이 문자열이 들어간 그룹만 수집(쉼표로 여러 개, 예: timvieclamthembacninh)")
    parser.add_argument("--max-age-days", type=float, default=None,
                        help=f"이보다 오래된 글은 저장 안 함(기본 FB_MAX_POST_AGE_DAYS={MAX_POST_AGE_DAYS:g})")
    parser.add_argument("--save-from", default="",
                        help="DRY-RUN 결과 JSON에서 --post-keys 게시물만 저장(브라우저·페이스북 접속 없음)")
    parser.add_argument("--post-keys", default="", help="쉼표 구분 게시물 키(예: id:123,id:456)")
    parser.add_argument("--max-save", type=int, default=None,
                        help="저장 상한(--save-from 기본 2, 정기 실행 기본 무제한)")
    return parser.parse_args(argv)


async def main(argv=None) -> int:
    args = parse_args(argv)
    if args.save_from:
        keys = [k.strip() for k in args.post_keys.split(",") if k.strip()]
        if not keys:
            print("  ⚠️  --post-keys가 필요합니다.")
            return 1
        return save_selected_from_dryrun(args.save_from, keys, args.max_save or 2)
    print("🚀 Facebook 그룹 크롤링 시작 (생활밀착형 우선)" + (" [DRY-RUN: DB 저장 안 함]" if args.dry_run else ""))
    print("─" * 50)

    if not FB_C_USER or not FB_XS:
        print("  ⚠️  FB_C_USER, FB_XS 쿠키가 .env에 없습니다.")
        return 1

    lock = account_lock_reason()
    if lock:
        print(f"  🛑 계정 잠금 파일이 있어 실행하지 않습니다({ACCOUNT_LOCK_PATH.name}):\n{lock}")
        return 3

    wanted = [g.strip() for g in args.group.split(",") if g.strip()]
    targets = [t for t in TARGETS if not wanted or any(g in t["url"] for g in wanted)]
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
                jobs, stats = await crawl_group(page, target, prev_seen, args.max_age_days)
            except AccountStop as e:
                print(f"\n  🛑 {e.state} — 전체 중단. 사람이 일반 브라우저로 계정 상태를 확인하기 전까지 재실행 금지")
                stop_state = e.state
                write_account_lock(e.state, e.group_url)
                print(f"  🔒 {ACCOUNT_LOCK_PATH.name} 생성 — 삭제 전까지 크롤러가 시작되지 않음")
                break
            group_stats.append(stats)

            if stats["state"] in ("anomaly", "no_posts"):
                consecutive_anomaly += 1
                if consecutive_anomaly >= MAX_CONSECUTIVE_ANOMALY_GROUPS:
                    print(f"\n  🛑 {consecutive_anomaly}개 그룹 연속 페이지 이상 — 전체 중단, 사람 확인 필요(state/evidence 참고)")
                    stop_state = "anomaly_repeated"
                    break
            else:
                consecutive_anomaly = 0

            for job in jobs:
                # 여러 그룹에 같은 글(같은 제목)이 올라온 경우 한 번만
                key = job["title"].lower()[:50]
                if key in seen_titles:
                    stats["counts"]["dup_in_run"] = stats["counts"].get("dup_in_run", 0) + 1
                    continue
                seen_titles.add(key)
                all_jobs.append(job)

            if i < len(targets) - 1:
                pause = random.randint(*GROUP_PAUSE_SEC)
                print(f"    … 다음 그룹까지 {pause}초 대기")
                await page.wait_for_timeout(pause * 1000)

        await browser.close()

    print(f"\n📊 저장 후보: {len(all_jobs)}개")
    summary = [summarize_group(s) for s in group_stats]
    for s in summary:
        print(f"  [{s['group_slug']}] 상태 {s['state']} / 종료 {s['stop_reason']} / 스텝 {s['steps']} / 읽은 글 {s['posts_seen']} "
              f"(이전과 겹침 {s['overlap']}) / 판정 {s['counts']} / 최신·최고령 {s['newest_age_h']}h·{s['oldest_age_h']}h / "
              f"순서 일관성 {s['order_consistency']} / 놓친 글 위험 {s['miss_risk']} / 펼침 {s['expanded']}·잘림 {s['truncated']}")

    saved: list[dict] = []
    db_dup = None
    if args.dry_run:
        # DB와의 중복은 읽기 전용으로만 센다(쓰기 없음)
        if supabase and all_jobs:
            db_dup = len(all_jobs) - len(filter_new_jobs(all_jobs, fetch_existing_facebook_rows()))
            print(f"  📋 DB 기존 facebook 공고와 중복(읽기 전용 확인): {db_dup}개")
        out = STATE_DIR / f"facebook_dryrun_{datetime.now():%Y%m%d_%H%M%S}.json"
        write_json_atomic(out, {"stop_state": stop_state, "db_duplicates": db_dup,
                                "groups": [{**s, **{k: g[k] for k in ("decisions", "trace", "truncated_debug")}}
                                           for s, g in zip(summary, group_stats)],
                                "jobs": all_jobs})
        print(f"  💾 DRY-RUN 결과: {out} (DB·수집 상태 변경 없음)")
    else:
        to_save = all_jobs
        if args.max_save is not None and len(all_jobs) > args.max_save:
            to_save = all_jobs[:args.max_save]
            # 상한 때문에 저장 못 한 글은 '본 글'로 기록하지 않아 다음 실행에서 다시 다룬다
            unsaved = {j["fb_post_key"] for j in all_jobs[args.max_save:]}
            for g in group_stats:
                g["final_keys"] = [k for k in g["final_keys"] if k not in unsaved]
        with open("facebook_jobs.json", "w", encoding="utf-8") as f:
            json.dump(to_save, f, ensure_ascii=False, indent=2)
        saved = save_to_supabase(to_save)
        # DB 저장이 끝난 뒤에만 "처리함"으로 기록 — 저장 실패(예외) 시 다음 실행에서 다시 처리
        save_seen_state(seen_state, group_stats)

    write_json_atomic(LAST_RUN_PATH, {
        "finished_at": datetime.now().isoformat(timespec="seconds"), "dry_run": args.dry_run,
        "stop_state": stop_state, "candidates": len(all_jobs), "db_duplicates": db_dup,
        "saved_ids": [r["id"] for r in saved], "groups": summary,
    })

    print("\n✨ 완료!" if not stop_state else f"\n🛑 중단: {stop_state}")
    return 2 if stop_state else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
