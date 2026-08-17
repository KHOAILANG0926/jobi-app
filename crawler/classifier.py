"""
표준 카테고리 분류기 — Rule-based Classifier
6대 카테고리로 공고 제목+회사+본문을 분석해 자동 매핑.
"""

import re
import unicodedata

# ── 베트남어 정규화 (diacritics 제거) ─────────────────────
def _norm(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ══════════════════════════════════════════════════════════
#  블랙리스트: 사무직/비타깃 → 즉시 'other' 격리
# ══════════════════════════════════════════════════════════
_BLACKLIST = [
    # IT/개발
    r"lap trinh", r"software", r"developer", r"it ", r"\bit\b",
    r"cong nghe thong tin", r"devops", r"data analyst", r"ai ",
    # 마케팅/영업관리
    r"marketing", r"seo ", r"social media", r"content creator",
    r"brand manager", r"pr ",
    # 재무/회계
    r"ke toan", r"kiem toan", r"tai chinh", r"accountant", r"finance",
    # 인사/행정
    r"nhan su", r"hanh chinh", r"hr ", r"\bhr\b", r"tuyen dung",
    r"hành chính", r"administrative",
    # 부동산/보험
    r"bat dong san", r"moi gioi", r"bao hiem", r"insurance",
    r"real estate",
    # 의료전문직 (간호사 제외, 청소/가사 포함)
    r"bac si", r"duoc si", r"y ta chuyen gia",
    # 교육/강사
    r"giao vien", r"giang vien", r"gia su",
    # 법률
    r"luat su", r"phap ly",
]
_BLACKLIST_RE = re.compile(r"|".join(_BLACKLIST))


# ══════════════════════════════════════════════════════════
#  카테고리별 키워드 규칙 (우선순위 순)
# ══════════════════════════════════════════════════════════

# 1. 한국 취업 (최우선)
_KOREA = re.compile(
    r"han quoc|korea|e-8|e-7|e-9|e8|e9|e7"
    r"|xuat khau lao dong|visa lao dong|epf|eps"
    r"|ngu nghiep han|mau don xuat khau"
)

# 2. 배달/물류 (Giao hàng / Kho vận)
_DELIVERY = re.compile(
    r"giao hang|shipper|tai xe|lai xe|xe om|grab"
    r"|be xe|xe tai|xe dau keo|van chuyen|kho van"
    r"|boc xep|phu kho|thu kho|nhan vien kho"
    r"|logistic|last.?mile|phat hang"
)

# 3. 청소/가사 (Vệ sinh / Giúp việc)
_CLEANING = re.compile(
    r"ve sinh|giup viec|lao cong|don dep|tro giup viec"
    r"|cham soc nguoi cao tuoi|trong tre|bao mau"
    r"|dich vu nha|housekeeper|janitor|cleaner"
)

# 4. 공장/생산 (Nhà máy / Sản xuất)
_FACTORY = re.compile(
    r"nha may|san xuat|cong nhan|kcn|khu cong nghiep"
    r"|dong goi|lap rap|han|cat may|may mac|det|gia cong"
    r"|thao may|kiem tra chat luong|qc |qc$|ql chat luong"
    r"|van hanh|lo nung|may moc|thiet bi|co khi"
    r"|lao dong pho thong|lao dong tu do|pho thong"
    r"|dien tu|linh kien|xuat nhap khau"
)

# 5. F&B — 카페 (Quán cà phê / Pha chế)
_CAFE = re.compile(
    r"ca phe|cafe|coffee|tra sua|milk tea|boba"
    r"|pha che|barista|bartender|mixologist"
    r"|highlands|starbucks|phuc long|gong cha"
    r"|the coffee house|trung nguyen|passio"
    r"|bingsu|kem|dessert|banh|tinh bot loc"
)

# 6. F&B — 식당/레스토랑 (Nhà hàng / Ẩm thực)
_RESTAURANT = re.compile(
    r"nha hang|quan an|quan nhau|beer|bia hoi"
    r"|hai san|lau|buffet|bbq|nuong"
    r"|jollibee|kfc|lotteria|mcdonald|burger king|pizza|subway"
    r"|haidilao|chay|pho|bun|com|an uong|am thuc"
    r"|phuc vu ban|phuc vu nha hang|phuc vu nha an"
    r"|phu bep|bep chinh|bep truong|dau bep|nau an"
    r"|thu quy nha hang|quan ly nha hang|fb |fnb|f&b|f and b"
    r"|tạp vụ bep|rua bat|tạp vu"
)

# 7. 매장/소매 (Bán lẻ / Cửa hàng)
_RETAIL = re.compile(
    r"ban hang|thu ngan|cua hang|sieu thi|winmart|vinmart"
    r"|circle k|7-eleven|familymart|ministop|gs25"
    r"|tap hoa|shop|showroom|dai ly|bai xe"
    r"|ban le|ban si|phan phoi|kho hang ban le"
    r"|nhan vien ban hang|sale|ban thoi trang"
    r"|nhan vien cua hang|quan ly cua hang"
    r"|samsung|apple store|dien may|dien thoai"
    r"|wincommerce|coopmart|bsmart"
)


def classify(title: str, company: str = "", description: str = "") -> str:
    """
    공고 텍스트를 분석해 6대 카테고리 중 하나를 반환.
    블랙리스트(사무직)에 걸리면 'other' 반환.
    """
    combined = _norm(f"{title} {company} {description[:300]}")
    title_co = _norm(f"{title} {company}")

    # 블랙리스트 우선 체크 (제목+회사만 — 본문에 키워드가 포함될 수 있음)
    if _BLACKLIST_RE.search(title_co):
        return "other"

    # 규칙 체크 (순서 = 우선순위)
    if _KOREA.search(combined):     return "other"      # KoreaJobs 별도 페이지 처리
    if _DELIVERY.search(combined):  return "delivery"
    if _CLEANING.search(combined):  return "cleaning"
    if _FACTORY.search(combined):   return "factory"
    if _CAFE.search(combined):      return "cafe"
    if _RESTAURANT.search(combined): return "restaurant"
    if _RETAIL.search(combined):    return "retail"

    # fallback: 제목만으로 재시도 (본문 노이즈 제거)
    if _FACTORY.search(title_co):   return "factory"
    if _CAFE.search(title_co):      return "cafe"
    if _RESTAURANT.search(title_co): return "restaurant"
    if _RETAIL.search(title_co):    return "retail"
    if _DELIVERY.search(title_co):  return "delivery"
    if _CLEANING.search(title_co):  return "cleaning"

    return "other"


def is_blacklisted(title: str, company: str = "") -> bool:
    """True면 수집 단계에서 제외 권장."""
    return _BLACKLIST_RE.search(_norm(f"{title} {company}")) is not None


# ── 간단 테스트 ─────────────────────────────────────────
if __name__ == "__main__":
    tests = [
        ("Nhân Viên Pha Chế Highlands Coffee", "Highlands"),
        ("Phụ Bếp Nhà Hàng Hải Sản", "Quán Hải Sản 999"),
        ("Tài Xế Giao Hàng GrabFood", "Grab"),
        ("Công Nhân Sản Xuất Nhà Máy", "Samsung Bắc Ninh"),
        ("Nhân Viên Vệ Sinh Văn Phòng", "CleanPro"),
        ("Thu Ngân Siêu Thị WinMart", "WinCommerce"),
        ("Kế Toán Tổng Hợp", "ABC Corp"),
        ("Lập Trình Viên Python", "Tech Co"),
        ("Phục Vụ Bàn Nhà Hàng Buffet", "Happy Buffet"),
        ("Nhân Viên Bán Hàng Cửa Hàng Tiện Lợi", "Circle K"),
    ]
    for title, company in tests:
        cat = classify(title, company)
        bl = is_blacklisted(title, company)
        print(f"{'[BL]' if bl else '    '} {cat:12} | {title}")
