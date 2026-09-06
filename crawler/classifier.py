"""
7대 표준 카테고리 분류기 — Rule-based Classifier
제목 + 회사명 + 본문(300자) 분석 → 자동 매핑

카테고리:
  factory    — 공장 / 생산 / 물류창고
  cafe       — 카페 / 음료 / 디저트
  restaurant — 식당 / F&B / 주방
  delivery   — 배달 / 운전 / 배송
  cleaning   — 청소 / 가사 / 돌봄
  retail     — 매장 / 소매 / 마트
  office     — 사무보조 / 알바 / 단기 / 고객센터
  other      — 분류 불가 (고급 전문직 격리 포함)
"""

import re
import sys
import unicodedata


# ── 베트남어 diacritics 제거 후 소문자화 ─────────────────
def _norm(text: str) -> str:
    text = text.lower()
    text = text.replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s&]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# 2026-09-06 사용자 지시로 신설(실사례 오분류 — vieclam24h-blind-final10.zip
# 표본 9 "Thực Tập Sinh Thẩm Định Giá" + 회사 "Công Ty CP TM DV Và Tư Vấn
# Hồng Đức"): title/company를 그냥 f"{title} {company}"로 이어붙인 뒤
# _norm()을 적용하면, title 끝의 "...Định Giá"("...dinh gia")와 company
# 시작의 "Công Ty..."("cong ty...")가 공백 하나로 맞닿아 우연히 "gia cong"
# (제조업 "가공")이 만들어져 factory로 오분류됐다 — 두 필드 사이에 실제로는
# 존재하지 않는 문구가 이어붙기 때문이다. _norm()이 모든 문장부호를 공백
# 하나로 지워버려서, 단순히 필드 사이에 다른 구두점을 넣는 것만으로는
# 소용없다(어차피 공백으로 바뀜) — 그래서 각 필드를 먼저 "따로" _norm()한
# 뒤에, 그 정규화 결과들 사이에만(다시 _norm()을 거치지 않는) 구분자를
# 끼워 넣는다. 이 구분자는 실제 텍스트에 나올 수 없고 어떤 정규식도 그
# 경계를 사이에 두고 매칭할 수 없다 — 필드 안에서는 원래 로직이 그대로
# 동작하되(예: 한 필드 안에 실제 "gia công"이 있으면 여전히 factory로
# 잡힘), 서로 다른 필드가 이어붙어 새로운 단어를 만드는 것만 막는다.
_FIELD_BOUNDARY = "\x00"


def _norm_fields(*parts: object) -> str:
    return f" {_FIELD_BOUNDARY} ".join(_norm(str(p)) for p in parts if p)


# ══════════════════════════════════════════════════════════
#  고급 화이트칼라 전문직 제목 — 카테고리 분류 전용(classify()가 7대
#  카테고리 어디에도 억지로 끼워맞추지 않고 'other'로 분류하기 위한
#  목록일 뿐이다). 2026-09-05 사용자 지시로 명확화: 이 목록은 수집
#  단계에서 공고를 제외하는 데 절대 쓰지 않는다 — 직급(팀장/부장/이사/
#  대표 등)·고연봉·경력 요건·전문성(IT/법률/의료/교육/부동산 등)만으로
#  정상적인 채용공고를 제외하지 않는 것이 비엣간반의 정책이다. 실제
#  제외는 소비자대출 영업/전문 채권추심(job_quality.py의
#  classify_money_job_exclusion)과 그 외 실질적인 불법·위험 공고 필터만
#  담당하며, 이 목록과는 완전히 별개다.
# ══════════════════════════════════════════════════════════
_SENIOR_PROFESSIONAL_TITLES = [
    # IT 전문직 (시니어/엔지니어급)
    r"senior developer", r"lead developer", r"software engineer",
    r"devops", r"data scientist", r"machine learning", r"ai engineer",
    r"full.?stack", r"backend developer", r"frontend developer",
    r"mobile developer", r"android developer", r"ios developer",
    r"system architect", r"cloud architect",
    # 경영/임원
    r"giam doc", r"director", r"ceo", r"cfo", r"cto", r"coo",
    r"truong phong", r"pho giam doc",
    # 수석 회계/재무
    r"ke toan truong", r"giam doc tai chinh", r"cfo", r"chief financial",
    r"kiem toan vien", r"auditor",
    # 법률/의료 전문직
    r"luat su", r"bac si", r"duoc si", r"bac si chuyen khoa",
    # 부동산 분양영업
    r"moi gioi bat dong san", r"kinh doanh bat dong san",
    r"bat dong san cao cap", r"phan phoi du an",
    # 교육 전문직
    r"giang vien dai hoc", r"tien si", r"thac si giao duc",
]
_SENIOR_PROFESSIONAL_TITLES_RE = re.compile(r"|".join(_SENIOR_PROFESSIONAL_TITLES))


# ══════════════════════════════════════════════════════════
#  7대 카테고리 규칙 (우선순위 순)
# ══════════════════════════════════════════════════════════

# 1. 배달 / 운전 (Giao hàng / Tài xế)
_DELIVERY = re.compile(
    r"giao hang|shipper|tai xe|lai xe|xe om|grab\b"
    r"|be xe|xe tai|xe container|xe dau keo|van chuyen"
    r"|nhan vien giao hang|nhan vien phat hang|nhan vien van chuyen"
    r"|giao nhan|boc xep|phu kho\b|thu kho\b|nhan vien kho\b"
    r"|logistic|kho van\b|last.?mile|delivery driver"
)

# 2. 청소 / 가사 / 돌봄 (Vệ sinh / Giúp việc)
# 주의: 've sinh'(위생) 단독 키워드는 F&B/유통 공고 설명문에도 상용구로
# 매우 흔하게 등장(예: "đảm bảo tiêu chuẩn vệ sinh của cửa hàng")하므로
# 과매칭을 유발함. 실제 청소 "직무"를 가리키는 복합구문만 매칭한다.
_CLEANING = re.compile(
    r"nhan vien ve sinh|cong nhan ve sinh|to ve sinh\b|doi ve sinh\b"
    r"|ve sinh cong nghiep|ve sinh van phong|ve sinh toa nha|ve sinh moi truong"
    r"|giup viec|lao cong\b|don dep nha|tạp vu\b|tap vu\b"
    r"|trong tre|bao mau|cham soc nguoi cao tuoi|cham soc tre"
    r"|dich vu don dep|dich vu nha|housekeeper|janitor|cleaner\b"
)

# 3. 공장 / 생산 (Nhà máy / Sản xuất)
_FACTORY = re.compile(
    r"nha may\b|kcn\b|khu cong nghiep"
    r"|cong nhan san xuat|cong nhan nha may|cong nhan\b"
    r"|nhan vien san xuat|nhan vien dong goi|cong nhan lap rap"
    r"|dong goi\b|lap rap\b|cat may\b|may mac\b|det\b|gia cong\b"
    r"|han xi\b|han dien\b|tho han\b"
    r"|thiet bi san xuat|co khi chinh xac|co khi\b"
    r"|ky thuat bao tri|bao tri co dien|bao tri dien|bao tri may|co dien\b"
    r"|ky thuat vien\b|nhan vien ky thuat|to truong ky thuat|van hanh may"
    r"|lao dong pho thong\b|cong nhan pho thong\b"
    r"|linh kien dien tu|kiem tra chat luong san pham"
    r"|san xuat linh kien|san xuat hang hoa"
    r"|xuong san xuat|khu san xuat"
)

# 4. 카페 / 음료 / 디저트 (Cafe / Pha chế)
_CAFE = re.compile(
    r"ca phe\b|cafe\b|coffee\b|tra sua\b|milk tea|boba\b|trà sữa"
    r"|pha che\b|barista\b|bartender\b|mixologist"
    r"|highlands\b|starbucks|phuc long|gong cha"
    r"|the coffee house|trung nguyen|passio\b|cong ca phe"
    r"|bingsu|kem tuoi|dessert\b|yogurt|tran chau"
    r"|nhan vien pha che|nhan vien quan ca phe|nhan vien cafe"
)

# 5. 식당 / F&B / 주방 (Nhà hàng / Ẩm thực)
# 주의: 'phục vụ'(서빙/service) 단독 키워드는 "phục vụ công việc/khách hàng"처럼
# 업종 무관 상용구에도 흔하게 등장해 과매칭을 유발함. 실제 서빙 "직무"를
# 가리키는 복합구문만 매칭한다.
#
# 2026-09-06 사용자 지시로 정정(실사례 오분류 — "Nhân Viên Kỹ Thuật Điện Tử"
# 본문의 "...cho các dòng smartphone phổ biến..."가 restaurant로 잘못 분류
# 됨): "phổ"(흔한/보편적, 예: phổ biến/phổ thông/phổ cập)와 "phở"(쌀국수)가
# ascii_key 정규화 후 똑같이 "pho"로 접혀 구분이 안 된다 — 그래서 본문 어디든
# 단독 "pho\b"만 있으면 음식으로 인정하던 것을 제거했다. 아래
# _PHO_DISH_RE로 대체: 실제 쌀국수 메뉴/문맥 결합("phở bò/gà/...", "quán/ăn/
# nấu/bán phở" 등)일 때만 음식 근거로 인정한다.
_RESTAURANT = re.compile(
    r"nha hang\b|quan an\b|quan nhau|beer club|bia hoi"
    r"|hai san\b|lau\b|buffet\b|bbq\b|nuong\b|dim sum"
    r"|jollibee|kfc\b|lotteria|mcdonald|burger king|pizza\b|subway\b"
    r"|haidilao|bun\b|com rang|an uong|am thuc"
    r"|phuc vu ban|phuc vu nha hang|phuc vu khach|nhan vien phuc vu"
    r"|phu bep|bep chinh|bep truong|dau bep|nau an"
    r"|fb\b|fnb\b|f&b|f and b|food.?beverage"
    r"|rua bat|rua chen|don ban|quan ly nha hang"
    r"|nhan vien bep|nhan vien nha hang"
)
# "phở"(쌀국수)가 실제 음식 문맥에서 쓰인 것으로 인정되는 결합 — 품종
# 단어가 뒤따르거나(phở bò/gà/...), 취급/판매/조리 동사가 앞에 오는 경우만.
_PHO_DISH_RE = re.compile(
    r"\bpho\s+(?:bo|ga|sate|tai|nam|chin|xao|tron|cuon|hue|ha noi)\b"
    r"|\b(?:quan|an|bat|to|nau|ban|mon|hang)\s+pho\b"
)
# title+company(제목/회사명)에서는 "phổ biến" 같은 상용구가 등장할 일이
# 사실상 없으므로, 단독 "pho\b"만으로도 안전하게 음식 근거로 인정한다.
_PHO_TITLE_RE = re.compile(r"\bpho\b")

# 6. 매장 / 소매 / 마트 (Bán lẻ / Cửa hàng)
_RETAIL = re.compile(
    r"ban hang\b|thu ngan|cua hang\b|sieu thi\b"
    r"|winmart|vinmart|circle k|7.eleven|familymart|ministop|gs25\b"
    r"|tap hoa\b|showroom\b|dai ly\b"
    r"|ban le\b|ban si\b|phan phoi\b"
    r"|nhan vien ban hang|\bsales?\b|nhan vien cua hang|quan ly cua hang"
    r"|samsung store|apple store|dien may|dien thoai di dong"
    r"|wincommerce|coopmart|bsmart|co.op"
    r"|nhan vien thi truong|nhan vien kinh doanh ban le"
    r"|nhan vien phat trien thi truong ban le"
    r"|nhan vien kinh doanh\b|kinh doanh thi truong|phat trien thi truong"
    r"|dai dien kinh doanh|tu van ban hang|sales executive|sales representative"
    r"|ton thep|vat lieu xay dung|qua tang|hang nhap khau"
)

# 7. 사무보조 / 알바 / 단기 / 고객센터 (Văn phòng / Part-time)
_OFFICE = re.compile(
    r"nhan vien nhap lieu|nhap lieu\b|data entry"
    r"|tong dai\b|cskh\b|cham soc khach hang\b|hotline\b"
    r"|tu van khach hang\b|tu van san pham\b|inbound\b"
    r"|telesale\b|telesales\b|tele\b"
    r"|ho tro van phong|tro ly van phong|nhan vien van phong"
    r"|admin ban hang|truc page\b|quan ly page\b|cham soc fanpage"
    r"|nhan vien hanh chinh\b|thu ky\b|le tan\b|receptionist"
    r"|nhan vien dat hang|xu ly don hang|order\b"
    r"|part.?time van phong|lam them van phong|lam them buoi"
    r"|nhan vien xuat nhap khau van phong|nhan vien bao cao"
    r"|nhan vien marketing online\b|content\b|social media part"
    r"|nhan vien ke toan thue\b|ke toan thue\b|ke toan\b"
    r"|hanh chinh nhan su\b|nhan su\b"
    r"|tu van tuyen sinh|tuyen sinh\b|giao vu\b|nhan vien tu van"
    r"|tu van vien|dieu phoi\b|van thu\b|tro ly\b|marketing\b"
)


def classify(title: str, company: str = "", description: str = "") -> str:
    """
    공고 텍스트를 분석해 7대 카테고리 중 하나를 반환.
    고급 화이트칼라 전문직 제목(_SENIOR_PROFESSIONAL_TITLES_RE)에 걸리면
    'other'로 분류한다 — 수집 자체를 막는 것이 아니라 7대 카테고리 어디에도
    억지로 끼워맞추지 않기 위한 분류일 뿐이다.
    """
    combined  = _norm_fields(title, company, description[:300])
    title_co  = _norm_fields(title, company)

    # 블랙리스트: 제목+회사 기준 (본문은 false positive 위험)
    if _SENIOR_PROFESSIONAL_TITLES_RE.search(title_co):
        return "other"

    # 순서 = 우선순위 (중복 키워드는 먼저 매칭된 카테고리 승)
    if _DELIVERY.search(combined):   return "delivery"
    if _CLEANING.search(combined):   return "cleaning"
    if _CAFE.search(combined):       return "cafe"
    if _RESTAURANT.search(combined) or _PHO_DISH_RE.search(combined) or _PHO_TITLE_RE.search(title_co):
        return "restaurant"
    # 제목/회사에 명확한 사무/영업 신호가 있으면 본문 속 업종 단어보다 우선한다.
    if _OFFICE.search(title_co):     return "office"
    if _RETAIL.search(title_co):     return "retail"
    if _FACTORY.search(combined):    return "factory"
    if _RETAIL.search(combined):     return "retail"
    if _OFFICE.search(combined):     return "office"

    # fallback: 제목+회사만으로 재시도
    if _FACTORY.search(title_co):    return "factory"
    if _CAFE.search(title_co):       return "cafe"
    if _RESTAURANT.search(title_co) or _PHO_TITLE_RE.search(title_co): return "restaurant"
    if _RETAIL.search(title_co):     return "retail"
    if _OFFICE.search(title_co):     return "office"
    if _DELIVERY.search(title_co):   return "delivery"
    if _CLEANING.search(title_co):   return "cleaning"

    return "other"


# ── 셀프 테스트 ──────────────────────────────────────────
if __name__ == "__main__":
    tests = [
        # F&B
        ("Nhân Viên Pha Chế Highlands Coffee", "Highlands", "cafe"),
        ("Phụ Bếp Nhà Hàng Hải Sản", "Quán Hải Sản 999", "restaurant"),
        ("Phục Vụ Bàn Jollibee Part-time", "Jollibee", "restaurant"),
        # Retail
        ("Thu Ngân Siêu Thị WinMart", "WinCommerce", "retail"),
        ("Nhân Viên Bán Hàng Cửa Hàng Tiện Lợi", "Circle K", "retail"),
        # Factory
        ("Công Nhân Sản Xuất Nhà Máy", "Samsung Bắc Ninh", "factory"),
        ("Nhân Viên Đóng Gói KCN Bình Dương", "ABC Mfg", "factory"),
        # Delivery
        ("Tài Xế Giao Hàng GrabFood", "Grab", "delivery"),
        ("Nhân Viên Kho Part-time", "Lazada", "delivery"),
        # Cleaning
        ("Nhân Viên Vệ Sinh Văn Phòng", "CleanPro", "cleaning"),
        ("Giúp Việc Nhà Bán Thời Gian", "", "cleaning"),
        # Office (알바/단기 사무직)
        ("Nhân Viên Nhập Liệu Part-time", "Cty ABC", "office"),
        ("Trực Tổng Đài CSKH Ca Tối", "Call Center 24h", "office"),
        ("Telesale Part-time Buổi Tối", "Edu Online", "office"),
        ("Admin Bán Hàng Trực Page Facebook", "Shop Online", "office"),
        ("Lễ Tân Văn Phòng Part-time", "Spa ABC", "office"),
        ("NV Kinh Doanh Tôn Thép - Không Yêu Cầu Kinh Nghiệm", "Công Ty Mỹ Việt", "retail"),
        ("Tổ Trưởng Kỹ Thuật Bảo Trì Cơ Điện", "Mebi Farm", "factory"),
        ("Nhân Viên Tư Vấn Tuyển Sinh", "Cao Đẳng Kỹ Thuật", "office"),
        # Blacklisted
        ("Senior Developer Python", "Tech Co", "other"),
        ("Giám Đốc Kinh Doanh", "Corp X", "other"),
        ("Kế Toán Trưởng", "Tập Đoàn Y", "other"),
    ]

    ok = err = 0
    for title, company, expected in tests:
        got = classify(title, company)
        status = "✅" if got == expected else "❌"
        if got != expected:
            err += 1
        else:
            ok += 1
        print(f"  {status} [{got:10}] expected={expected:10} | {title}")

    print(f"\n결과: {ok}/{ok+err} 정확")
    if err:
        sys.exit(1)
