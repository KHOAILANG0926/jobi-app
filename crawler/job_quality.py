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


_DAY_TERM_RE = r"(?:Thứ\s*(?:Hai|Ba|Tư|Năm|Sáu|Bảy|[2-7])|Chủ\s*[Nn]hật)"

# 2026-09-05 사용자 지시로 확장(vieclam24h-blind-10 독립검증 표본 4/8/9에서
# 실제 hours=null/work_days=null 발견): 시간 표기가 "8h-17h"(문자 h) 형식뿐
# 아니라 "08:00 – 17:00"(콜론) 형식도 흔하고, 범위 구분자가 대시(-/–)뿐
# 아니라 단어 "đến"(...까지)인 경우도 실측 확인됐다(표본 9: "Từ 08:30 đến
# 20:00"). "Thứ Hai – Thứ Sáu:"처럼 요일(범위) 라벨이 시간 앞에 붙는 경우도
# 그 라벨까지 함께 하나의 매치로 보존한다 — 매치된 부분만 반환하는 기존
# 계약(아래 split-shift 회귀 테스트가 그 계약에 의존)은 그대로 유지하되,
# "무엇을 매치로 인정하는지"만 넓힌다.
_WORK_HOURS_RANGE_RE = re.compile(
    rf"(?:{_DAY_TERM_RE}(?:\s*[-–]\s*{_DAY_TERM_RE})?\s*[:：]\s*)?"
    r"(?:(?:sáng|chiều|tối)\s*[:：]\s*)?\d{1,2}[h:]\d{0,2}\s*(?:[-–]|đến)\s*\d{1,2}[h:]\d{0,2}",
    re.IGNORECASE,
)
_WORK_HOURS_LABEL_RE = re.compile(r"(?:giờ làm việc|thời gian làm việc)\s*[:：]?\s*([^\n]{3,80})", re.IGNORECASE)

# 2026-09-05 사용자 지시로 추가(실측 재검증 중 자체 발견 — 표본 4/9 원문에
# "Nghỉ trưa: 12:00 – 13:00" / "nghỉ trưa từ 12:00 đến 14:00"처럼 점심
# 휴게시간도 숫자 범위로 적혀 있어, 위 _WORK_HOURS_RANGE_RE가 이를 실제
# 근무시간과 구분 못 하고 hours에 함께 넣어버리는 결함이 있었다(점심시간을
# 근무시간처럼 표시하는 것은 원문 의미를 왜곡하는 오분류다). 매치 바로
# 앞(최대 40자)에 "nghỉ [trưa/giữa giờ/giải lao] [từ]:" 형태의 휴게 라벨이
# 있으면 그 범위는 근무시간이 아니라 휴게시간이므로 hours에서 제외한다.
_BREAK_TIME_PREFIX_RE = re.compile(
    r"nghỉ\s+(?:trưa|giữa\s*giờ|giải\s*lao)?\s*(?:từ\s*)?[:：]?\s*$", re.IGNORECASE
)


def _is_break_time_prefix(text: str, match_start: int) -> bool:
    window = text[max(0, match_start - 40):match_start]
    return bool(_BREAK_TIME_PREFIX_RE.search(window))

# 근무일(work_days) — 요일(범위) 언급 + "nghỉ ngày/nghỉ chiều/..." 같은 휴무
# 언급을 찾는다. hours와 별개 필드이므로 시간 부분은 여기서 다시 캡처하지
# 않는다(같은 문장에 요일+시간이 같이 있어도 work_days는 요일 부분만).
_WORK_DAYS_RE = re.compile(
    rf"(?:nghỉ\s+(?:ngày|chiều|sáng|trưa)\s*)?{_DAY_TERM_RE}(?:\s*(?:đến|-|–)\s*{_DAY_TERM_RE})?",
    re.IGNORECASE,
)


def _dedupe_join(items: list[str], sep: str = ", ") -> str:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        item = item.strip()
        key = item.lower()
        if not item or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return sep.join(out)


def extract_work_hours_free_text(desc_text: object) -> str:
    """Pure mirror of fetch_job_detail()'s in-page "근무시간"(work hours)
    free-text extraction — see pick_detail_company_name()'s docstring for why
    this Python copy exists.

    Real postings often split morning/afternoon shifts into 2+ time ranges
    in one sentence (e.g. "Sáng: 7h - 11h, Chiều: 12h - 16h", confirmed live
    — sb batch C job "Kỹ Sư Kỹ Thuật Điện (M&E)"). A single-match regex only
    returns the first range and silently drops the rest — this finds every
    range (each with its day-range/"Sáng/Chiều/Tối" label when present) and
    joins them (dedup, original order), so a split-shift posting keeps both
    halves instead of only the first, and a day-range label directly in front
    of a time range (e.g. "Thứ Hai – Thứ Sáu: 08:00 – 17:00") stays attached
    to it as one entry rather than being separated or lost."""
    text = str(desc_text or "")
    matches = [
        m.group(0).strip()
        for m in _WORK_HOURS_RANGE_RE.finditer(text)
        if not _is_break_time_prefix(text, m.start())
    ]
    if matches:
        return _dedupe_join(matches)
    label_match = _WORK_HOURS_LABEL_RE.search(text)
    if label_match:
        return (label_match.group(1) or label_match.group(0)).strip()
    return ""


def extract_work_days_free_text(desc_text: object) -> str:
    """근무일/휴무 정보 자유 텍스트 추출 — extract_work_hours_free_text()와
    같은 이유(pick_detail_company_name() 참고)로 JS 버전의 순수 Python
    거울이다. 2026-09-05 사용자 지시로 신설(vieclam24h-blind-10 독립검증
    표본 4/8/9에서 work_days=null 발견 — 예전 정규식은 숫자 요일("thứ 2")
    과 "ngày làm việc"/"từ thứ N đến..." 형태만 인식해, 실제로 훨씬 흔한
    단어 요일("Thứ Hai/Ba/Tư/Năm/Sáu/Bảy", "Chủ nhật")과 "Nghỉ chiều Thứ 7
    & Chủ nhật" 같은 자유 문장을 전부 놓쳤다). 적혀 있지 않은 정보(휴무일
    개수, 주당 근무일 수, 교대조 의미)는 추측하지 않고, 실제 언급된 요일/
    휴무 문구만 원문 그대로(중복 제거, 원문 등장 순서 유지) 모은다."""
    text = str(desc_text or "")
    matches = [m.group(0).strip() for m in _WORK_DAYS_RE.finditer(text)]
    if matches:
        return _dedupe_join(matches)
    label_match = re.search(r"(?:ngày làm việc)\s*[:：]?\s*([^\n]{3,60})", text, re.IGNORECASE)
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

# 소비자 대출/여신 상품 영업(신용카드/대출 알선 등) 관련 — 이 범주는 이번
# 수정 대상이 아니다(실제 오탐 사례가 보고된 적 없음), title/company/
# description 전체에서 그대로 검사한다(기존 동작 유지).
EXCLUDED_LOAN_FINANCE_RE = re.compile(
    r"vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung"
    r"|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit"
    r"|mirae asset|shinhan finance|vpbank finance|loan",
    re.IGNORECASE,
)

# 2026-09-05 사용자 지시로 정정(실사례 오탐 3건 발견 — 표본 3/4/8, vieclam24h-
# blind-10 독립검증): 예전 EXCLUDED_MONEY_JOB_RE의 "cong no" 단독 매칭이
# "quản lý công nợ"/"theo dõi công nợ"/"đối chiếu công nợ"/(주문·납품·영업·
# 회계 업무 중 일부인) "thu hồi công nợ" 같은 완전히 정상적인 일반 업무
# 문맥까지 전부 추심 전담 공고로 오판정했다. "công nợ" 언급 자체는 더 이상
# 절대 제외 근거가 아니다.
#
# 이제 아래 5개 "어근 조합"이 실제 채용 "제목" 또는 "직종(category)" 필드
# 에서 서로 가까이 나타날 때만("본문에만 있으면 근거로 쓰지 않음") 추심
# 전담 공고로 확정 제외한다 — 완성된 문장 하나를 하드코딩하지 않고, 각
# 항목은 (근처 어근, 목표 어근들, 두 어근 사이 허용 문자 수, 규칙 이름)
# 이다. "đòi"(독촉/요구)는 ascii_key() 정규화(tone mark 제거) 후 "đối"
# (대조/비교 — "đối chiếu công nợ"는 명시적으로 허용된 일반 회계 문맥)와
# 똑같이 "doi"가 되어 구분이 안 된다 — 그래서 이 쌍만 훨씬 좁은 인접
# 거리(2자, 사실상 공백 하나)를 써서 "đòi nợ"(인접)는 잡고 "đối chiếu ...
# công nợ"(사이에 다른 단어가 있음)는 걸러낸다.
_DEBT_COLLECTION_TITLE_STEM_PAIRS: tuple[tuple[str, tuple[str, ...], int, str], ...] = (
    ("thu hoi", ("no", "cong no", "khoan vay"), 15, "thu_hoi+no/cong_no/khoan_vay"),
    ("xu ly", ("no xau", "no"), 15, "xu_ly+no/no_xau"),
    ("nhac", ("no", "thanh toan"), 15, "nhac+no/thanh_toan"),
    ("doi", ("no",), 2, "doi+no"),
    ("field", ("collection",), 15, "field+collection"),
)


def _find_debt_collection_stem_match(ascii_normalized_text: str) -> tuple[str, str] | None:
    """ascii_normalized_text는 ascii_key()로 이미 정규화된 상태여야 한다
    (소문자, 탈문자, 문장부호 제거). 매칭되면 (rule_name, matched_substring)
    을 반환하고, 없으면 None. LLM 판정/단어 비율/임의 점수는 쓰지 않는다 —
    순수 정규식 근접 매칭뿐이다."""
    for root, targets, window, rule_name in _DEBT_COLLECTION_TITLE_STEM_PAIRS:
        root_re = re.escape(root)
        for target in targets:
            target_re = re.escape(target)
            pattern = rf"(?:{root_re}.{{0,{window}}}{target_re}|{target_re}.{{0,{window}}}{root_re})"
            m = re.search(pattern, ascii_normalized_text)
            if m:
                return rule_name, m.group(0)
    return None


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
# block number, a named industrial park/cluster (spelled out or abbreviated —
# "KCN"/"CCN"/"Cụm CN ..." all found in real postings; id 4379's "Cụm CN Tập
# Đoàn Anova, Xã Long Cang, Cần Đước" was missed because only the concatenated
# "kcn" and the fully spelled-out "cụm công nghiệp" were recognized, not the
# space-separated abbreviation "cụm cn" — regression fixture added to
# test_job_quality.py's exact_cases), a street/alley marker, a named building/
# complex, or a named facility type (nhà máy/xưởng/bệnh viện/cửa hàng/siêu thị
# — the same category of signal as "tòa nhà", just for other common workplace
# kinds). Anything without one of these is, at best, a bare province/district/
# ward chain (e.g. "Dĩ An, Bình Dương (cũ)., Thủ Đức" — real administrative
# names, but no specific site within them) and must never be geocoded as if it
# were a precise workplace.
_SPECIFIC_PLACE_SIGNAL_RE = re.compile(
    r"\d"
    r"|\bkcn\b|\bccn\b|\bkhu công nghiệp\b|\bcụm công nghiệp\b|\bcụm\s+cn\b"
    r"|\bđường\b|\bphố\b|\bngõ\b|\bhẻm\b|\bngách\b"
    r"|\btòa nhà\b|\bplaza\b|\btower\b|\bbuilding\b|\bcao ốc\b"
    r"|\blô\b|\bkhu đô thị\b|\bkđt\b|\btrung tâm\b|\bcenter\b",
    re.IGNORECASE,
)

# 2026-09-05 사용자 지시로 정정: 일반 시설 단어(nhà máy/xưởng/bệnh viện/cửa hàng/
# siêu thị)는 그 뒤에 실제 고유명사가 붙어야만("Nhà máy Vĩnh Phúc") 특정 장소
# 신호로 인정한다 — 시설 단어와 행정구역명만 있는 "Cửa hàng, Hà Nội"/"Nhà máy,
# Bình Dương"/"Xưởng, Long An"는 그 자체로는 province/district 이름 하나 이상의
# 구체성이 없으므로 고유 상세주소로 과대 분류하면 안 된다(예: "Nhà máy, Bình
# Dương"만 보고 특정 공장을 가리킨다고 지오코딩하면 안 됨). 시설 단어 바로
# 뒤에 공백 + 쉼표가 아닌 문자(실제 이름의 시작)가 있는지만 확인 — 콤마가 시설
# 단어에 바로 붙어 있으면(중간에 공백 없이) 이름이 없다는 뜻이라 매치되지 않는다.
# 특정 회사명/공고 ID를 나열하는 방식이 아니라 이 일반 규칙 하나로 양쪽 사례를
# 전부 구분한다.
_GENERIC_FACILITY_WORD_WITH_NAME_RE = re.compile(
    r"\b(nhà máy|xưởng|bệnh viện|cửa hàng|siêu thị)\s+\S",
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
    if _SPECIFIC_PLACE_SIGNAL_RE.search(signal_text) or _GENERIC_FACILITY_WORD_WITH_NAME_RE.search(signal_text):
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


def compute_all_locations_c1_verified(resolved_locations: list[dict]) -> bool:
    """True only when resolved_locations is non-empty AND every row's
    source_verified is True — i.e. genuinely confirmed C1, never merely
    'exact_candidate' (Geoapify self-convergence alone).

    2026-09-04 사용자 지시로 정책이 다시 강화됨: 100건 조사 + 신규 20건/10건
    블라인드 시험을 반복해도 geocode.py의 'exact_candidate' 등급이 독립
    Google 지도 대조에서 약 30~36% 실패율(405m~2.6km 오차)을 반복 재현 —
    Geoapify 단일 공급자의 쿼리 자기수렴만으로는 실제 사업장 정확도를
    보장할 수 없음이 확인됐다. 이제 'exact_candidate' 자체는 신뢰된 C1이
    아니다 — resolve_work_locations()가 vieclam24h 원문이 제공하는 고용주
    연락처 좌표(있으면)와 이 근무지 주소가 실제로 같은 곳을 가리키는지
    확인했을 때만(geocode.source_coordinate_matches_location() 참고)
    source_verified=True가 되고, 그때만 C1 후보로 인정한다. 2차 독립
    지오코딩 공급자 교차검증은 아직 도입되지 않았다(설계만 완료, 별도
    승인 필요) — 이번 라운드의 유일한 승격 경로는 원문 좌표 검증뿐이다.

    2026-09-05 사용자 지시로 정책 전환: 이 값은 더 이상 gate_auto_publish()의
    입력이 아니다(공개 여부는 이제 좌표 검증과 무관 — job_quality.
    gate_auto_publish() 참고). 이 함수 자체는 지도 표시 등급(정확한 마커 vs
    근사 위치)이나 거리검색 자격 판단에 여전히 쓸 수 있는 순수 계산이라
    남겨두었다 — 실제 소비처는 job_work_locations.location_verified
    컬럼(위치별 source_verified 그대로 저장, crawl_topcv.py의
    _work_location_rpc_rows() 참고)이며 프론트엔드가 이 값으로 거리검색
    자격을 가른다(src/lib/jobCoords.ts 참고)."""
    return len(resolved_locations) > 0 and all(
        loc.get("source_verified") is True for loc in resolved_locations
    )


def gate_auto_publish(
    has_location_or_region: bool,
    has_application_path_: bool,
) -> tuple[bool, str]:
    """Decide whether a freshly-scraped job may be auto-published (active=true)
    or must be held for manual review (active=false, never silently dropped).

    2026-09-05 사용자 지시로 정책 전환(최종 제품 정책, 이전의 "모든 근무지가
    C1 검증돼야 공개" 정책을 대체): 공개 가능 = 유효한 원문 공고 AND 유효한
    지원 경로 AND 근무지 또는 모집지역 정보가 하나 이상 존재. 좌표
    검증(source_verified)/좌표 정확도(coordinate_accuracy)는 더 이상 공개
    여부를 막지 않는다 — 지도에 어떻게 표시할지(정확한 마커 vs 근사 위치)와
    거리검색 자격만 결정한다(geocode.py/resolve_work_locations() 참고,
    job_work_locations.location_verified가 그 신호다). 성·시만 있는 위치,
    구·군·동만 있는 위치, 구체적 주소가 있지만 좌표 미검증인 경우 전부
    'ok'로 공개된다 — 근무지/모집지역 정보가 아예 하나도 없을 때만
    'no_address_text'다.

    has_location_or_region: `len(resolved_locations) > 0 or len(job_
    recruitment_regions) > 0` — resolved_locations는 이제 'exact'
    (address_accuracy='exact_text')뿐 아니라 'region_only'로 분류된
    후보(구체적 장소 신호는 없지만 실제 지역명은 있는 텍스트)도 포함한다
    (resolve_work_locations() 참고 — 예전에는 'exact'가 아니면 행 자체를
    버렸다). job_recruitment_regions는 근무지 후보가 0건이어도 원문 어딘가
    언급된 지역명만으로 채워질 수 있다(_compute_job_recruitment_regions()
    참고) — 그래서 이 둘을 OR로 합쳐야 "근무지 텍스트도 없고 모집지역도
    전혀 언급 안 된" 진짜 위치 정보 0건 케이스만 no_address_text가 된다.

    'no_verified_coordinate'는 이 함수가 더 이상 반환하지 않는다 — DB
    CHECK 제약(local_jobs_publish_gate_reason_check)에는 과거 데이터와의
    호환을 위해 값 자체는 남아있지만, 신규 판정에서는 절대 쓰이지 않는다.

    Returns (should_publish, reason) — reason은 'ok' / 'no_address_text' /
    'no_application_path' 중 하나."""
    if not has_location_or_region:
        return False, "no_address_text"
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
    # migration 0018(local_jobs.recruitment_regions text[])이 2026-09-04
    # 운영 DB에 실행된 뒤 추가 — 재처리 시 이 값도 재검증해 갱신되도록.
    "recruitment_regions",
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


def classify_money_job_exclusion(
    title: object = "",
    company: object = "",
    description: object = "",
    category: object = "",
) -> tuple[bool, str]:
    """(excluded, log_line) — 대출/여신 상품 영업은 title+company+description
    전체에서 그대로 검사한다(기존 동작, 오탐 보고 없음). 추심 전담 판정만
    2026-09-05로 정정된 규칙을 쓴다: title 또는 category(실제 직종 필드)
    에서만 어근 조합을 검사하고, description(본문)은 절대 근거로 쓰지
    않는다 — "공nợ"가 본문에 있다는 사실만으로는 제외하지 않는다.

    log_line에는 검사 대상(title/company+description/category), 매칭된
    규칙 이름, 매칭된 원문 substring, 최종 allow/exclude를 그대로 남긴다."""
    loan_finance_text = ascii_key(" ".join(str(p or "") for p in (title, company, description)))
    loan_match = EXCLUDED_LOAN_FINANCE_RE.search(loan_finance_text)
    if loan_match:
        return True, (
            f"exclude target=title+company+description rule=EXCLUDED_LOAN_FINANCE_RE "
            f"matched={loan_match.group(0)!r}"
        )

    for target_name, target_value in (("title", title), ("category", category)):
        normalized = ascii_key(str(target_value or ""))
        found = _find_debt_collection_stem_match(normalized)
        if found:
            rule_name, matched_text = found
            return True, f"exclude target={target_name} rule={rule_name} matched={matched_text!r}"

    return False, "allow checked_targets=title,category,company+description(loan/finance only) no rule matched"


def has_excluded_money_terms(
    title: object = "",
    company: object = "",
    description: object = "",
    category: object = "",
) -> bool:
    """True for loan/debt-collection jobs that do not match the site motto.
    Thin boolean wrapper — see classify_money_job_exclusion() for the full
    (excluded, log_line) result with the matched rule/target/text detail."""
    excluded, _log_line = classify_money_job_exclusion(title, company, description, category)
    return excluded


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
    money_excluded, money_log_line = classify_money_job_exclusion(title, company, description, category)
    if money_excluded:
        errors.append(f"excluded money/debt collection job ({money_log_line})")
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
