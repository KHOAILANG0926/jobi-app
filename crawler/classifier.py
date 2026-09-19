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
    r"|hai san\b|buffet\b|bbq\b|nuong\b|dim sum"
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

# 2026-09-17 실사례 오분류 발견(id=4381 "Nhân Viên Kinh Doanh Tôn Thép" —
# 설명문의 "hợp tác bền vững lâu dài"(장기적/오래도록)가 restaurant로 잘못
# 분류됨): "lẩu"(전골 요리)/"lâu"(오래, "lâu dài" 등)/"lau"(닦다, "lau chùi"
# 등) 세 단어가 diacritics 제거 후 전부 "lau"로 접혀 구분이 안 된다 — phở/phổ
# 문제와 동일한 원인. 그래서 _RESTAURANT 본문에서 단독 "lau\b"를 빼고,
# phở 처리와 같은 방식으로 실제 전골 메뉴 문맥일 때만 인정한다.
_LAU_DISH_RE = re.compile(
    r"\blau\s+(?:bo|ga|thai|hai san|nam|de|ga la|rieu)\b"
    r"|\b(?:quan|an|nau|ban|mon|nha hang)\s+lau\b"
)

# 6. 매장 / 소매 / 마트 (Bán lẻ / Cửa hàng)
# 2026-09-17 실사례 오분류 발견(id=4430 "Nhân Viên R&D" — 설명문의 "phối hợp
# cùng BP sale"(영업부서와 협업, R&D 업무 설명 중 부서명 언급일 뿐)가 단독
# `\bsales?\b`에 걸려 retail로 잘못 분류됨): "sale"은 베트남 비즈니스 텍스트에
# 부서명/도구명 등으로 워낙 흔하게 등장해 단독 매칭이 오탐을 유발한다.
# 아래 "sales executive"/"sales representative"/"nhan vien ban hang"/
# "tu van ban hang"/"dai dien kinh doanh"/"nhan vien kinh doanh" 등 이미
# 있는 더 구체적인 구문만으로도 충분해서, 단독 "sale(s)"는 제거했다.
_RETAIL = re.compile(
    r"ban hang\b|thu ngan|cua hang\b|sieu thi\b"
    r"|winmart|vinmart|circle k|7.eleven|familymart|ministop|gs25\b"
    r"|tap hoa\b|showroom\b|dai ly\b"
    r"|ban le\b|ban si\b|phan phoi\b"
    r"|nhan vien ban hang|nhan vien cua hang|quan ly cua hang"
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

# 2026-09-17 사용자 지시("1번까지 하고 진행해야지") — 새 대분류(cntt_ky_thuat/
# thiet_ke/giao_duc_giang_day) 3개를 실제 DB의 category='other' 공고 66건을
# 직접 눈으로 보고 실제 신호가 있는 것만 추가(truyen_thong/y_te_dieu_duong는
# 이 표본에 실제 신호가 없어서 추가 안 함 — 규칙 없이 라벨만 남겨둠).
# 이 3개는 옛 7분류에 대응하는 게 없는 완전히 새 영역이라, classify()가 아예
# 새 대분류 id를 직접 반환한다(LEGACY_CATEGORY_TO_MAJOR에 자기 자신으로
# 매핑되는 항목을 추가해 map_to_new_taxonomy()가 그대로 통과시킴).

# 8. IT·기술 (CNTT/시스템/정보보안) — _FACTORY의 "bao tri may"(설비 정비)와
# 헷갈리지 않도록 IT/시스템/정보 관련 명시적 단어만 매칭한다.
_CNTT_KY_THUAT = re.compile(
    r"\bcntt\b|it helpdesk|it support|nhan vien it\b|ky thuat it\b"
    r"|quan ly he thong\b|an toan thong tin|bao mat he thong"
    r"|lap trinh vien|phan mem\b|developer\b|network engineer"
    r"|quan tri website|quan tri mang\b"
)

# 9. 디자인(Thiết kế) — 인테리어/그래픽/제품/캐릭터 디자인 역할만 매칭한다.
# "kien truc su"(건축사)는 인테리어/디자인 맥락일 때만 인정 — 순수 건설
# 현장(Kỹ sư xây dựng/Construction Manager 등)과는 겹치지 않게 한다.
_THIET_KE = re.compile(
    r"thiet ke noi that|kien truc su.{0,20}noi that|hoa vien\b"
    r"|thiet ke do hoa|thiet ke san pham|thiet ke thoi trang"
    r"|thiet ke ban ve|thiet ke nhan vat|3d rigger\b|animator\b"
)

# 10. 교육·강사 — "giáo viên"(교사)는 명확한 신호. 대학 강사(giang vien dai
# hoc)는 _SENIOR_PROFESSIONAL_TITLES_RE에서 이미 'other'로 격리되므로
# 여기서는 학교/학원급 교사만 잡힌다.
_GIAO_DUC_GIANG_DAY = re.compile(
    r"giao vien\b|gia su\b|tro giang\b|huan luyen vien the hinh"
    r"|trung tam ngoai ngu|trung tam tin hoc|trung tam luyen thi"
    r"|mam non\b|mau giao\b"
)

# 2026-09-17 사용자 지시 — 아래 2개(truyen_thong/y_te_dieu_duong)는 위 3개와
# 달리 실제 크롤링 DB에 검증할 표본이 하나도 없었다(66건 조사 결과 0건).
# "나중에 또 반복하지 말고 지금 최대한 넣어두라"는 지시로, 베트남어에서
# 실제로 통용되는 확실한 직군 용어를 기반으로 규칙을 만들되 — 이건
# **우리 DB의 진짜 공고로 검증된 게 아니라는 점을 명확히 표시**한다(다른
# 24개 규칙과 신뢰도가 다름). 실제 공고가 들어오면 그때 진짜 검증해야 한다.
# 의사(bac si)/약사(duoc si)는 이미 _SENIOR_PROFESSIONAL_TITLES_RE에서
# 'other'로 격리되므로 여기 포함하지 않는다(전문직 격리 정책 유지).

# 11. Y tế · Điều dưỡng · Nghiên cứu — ⚠️ 미검증(실제 DB 표본 0건)
_Y_TE_DIEU_DUONG = re.compile(
    r"y ta\b|dieu duong\b|ho ly\b|dieu duong vien"
    r"|cham soc benh nhan|ky thuat vien y te|duoc ta\b|nhan vien y te\b"
)

# 12. Truyền thông — ⚠️ 미검증(실제 DB 표본 0건)
_TRUYEN_THONG = re.compile(
    r"quay phim\b|dung phim\b|bien tap video|phong vien\b"
    r"|bien tap vien\b|dao dien\b|nhiep anh\b|quay dung video"
    r"|anh sang am thanh"
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
    if _RESTAURANT.search(combined) or _PHO_DISH_RE.search(combined) or _PHO_TITLE_RE.search(title_co) or _LAU_DISH_RE.search(combined):
        return "restaurant"
    # 제목/회사에 명확한 사무/영업 신호가 있으면 본문 속 업종 단어보다 우선한다.
    if _GIAO_DUC_GIANG_DAY.search(title_co): return "giao_duc_giang_day"
    if _CNTT_KY_THUAT.search(title_co):      return "cntt_ky_thuat"
    if _THIET_KE.search(title_co):           return "thiet_ke"
    if _Y_TE_DIEU_DUONG.search(title_co):    return "y_te_dieu_duong"
    if _TRUYEN_THONG.search(title_co):       return "truyen_thong"
    if _OFFICE.search(title_co):     return "office"
    if _RETAIL.search(title_co):     return "retail"
    if _FACTORY.search(combined):    return "factory"
    if _RETAIL.search(combined):     return "retail"
    if _OFFICE.search(combined):     return "office"
    if _GIAO_DUC_GIANG_DAY.search(combined): return "giao_duc_giang_day"
    if _CNTT_KY_THUAT.search(combined):      return "cntt_ky_thuat"
    if _THIET_KE.search(combined):           return "thiet_ke"
    if _Y_TE_DIEU_DUONG.search(combined):    return "y_te_dieu_duong"
    if _TRUYEN_THONG.search(combined):       return "truyen_thong"

    # fallback: 제목+회사만으로 재시도
    if _FACTORY.search(title_co):    return "factory"
    if _CAFE.search(title_co):       return "cafe"
    if _RESTAURANT.search(title_co) or _PHO_TITLE_RE.search(title_co): return "restaurant"
    if _RETAIL.search(title_co):     return "retail"
    if _OFFICE.search(title_co):     return "office"
    if _DELIVERY.search(title_co):   return "delivery"
    if _CLEANING.search(title_co):   return "cleaning"

    return "other"


# ══════════════════════════════════════════════════════════
#  소분류 규칙 (2026-09-16 사용자 지시로 신설) — 7대 대분류 각각을 더
#  세분화한다. classify()와 완전히 같은 방식(우선순위 순 정규식 매칭)을
#  재사용한다 — 새 기술이 필요한 게 아니라 대분류 규칙에서 이미 검증된
#  구문(예: "phu bep"/"bep truong"는 _RESTAURANT에서 이미 오탐 없이 쓰던
#  패턴)을 재활용해 세분화한 것. 대분류가 'other'거나 목록에 없으면
#  소분류도 없다(None) — 억지로 끼워맞추지 않는다.
# ══════════════════════════════════════════════════════════
SUBCATEGORY_LABELS: dict[str, dict[str, str]] = {
    "cafe": {
        "pha_che": "Pha chế / Barista",
        "phuc_vu_quan": "Phục vụ quán",
        "thu_ngan": "Thu ngân",
    },
    "restaurant": {
        "bep": "Bếp (đầu bếp / phụ bếp)",
        "phuc_vu_ban": "Phục vụ bàn",
        "rua_bat": "Rửa bát / dọn dẹp",
        "thu_ngan": "Thu ngân",
    },
    "retail": {
        "thu_ngan": "Thu ngân",
        "ban_hang": "Bán hàng / Tư vấn bán hàng",
        "quan_ly_cua_hang": "Quản lý cửa hàng",
        "kinh_doanh": "Kinh doanh / Đại diện kinh doanh",
    },
    "delivery": {
        "giao_hang_xe_may": "Giao hàng xe máy / Shipper",
        "lai_xe": "Lái xe / Tài xế",
        "kho_van": "Kho vận / Logistics",
    },
    "cleaning": {
        "ve_sinh_cong_nghiep": "Vệ sinh công nghiệp / văn phòng",
        "giup_viec_nha": "Giúp việc nhà / Tạp vụ",
        "cham_soc": "Chăm sóc trẻ em / người cao tuổi",
    },
    "factory": {
        "san_xuat_dong_goi": "Sản xuất / Đóng gói / Lắp ráp",
        "ky_thuat_bao_tri": "Kỹ thuật / Bảo trì / Vận hành máy",
        "han_co_khi": "Hàn / Cơ khí",
    },
    "office": {
        "cskh": "Chăm sóc khách hàng / Telesale",
        "nhap_lieu": "Nhập liệu",
        "hanh_chinh_nhan_su": "Hành chính / Nhân sự",
        "le_tan": "Lễ tân",
        "ke_toan": "Kế toán",
    },
}

_SUBCATEGORY_RULES: dict[str, list[tuple[str, "re.Pattern[str]"]]] = {
    "cafe": [
        ("pha_che", re.compile(r"pha che\b|barista\b")),
        ("phuc_vu_quan", re.compile(r"phuc vu quan|nhan vien quan ca phe|nhan vien cafe")),
        ("thu_ngan", re.compile(r"thu ngan\b")),
    ],
    "restaurant": [
        ("bep", re.compile(r"phu bep|bep chinh|bep truong|dau bep|nau an\b")),
        ("phuc_vu_ban", re.compile(r"phuc vu ban|phuc vu nha hang|phuc vu khach|nhan vien phuc vu")),
        ("rua_bat", re.compile(r"rua bat|rua chen")),
        ("thu_ngan", re.compile(r"thu ngan\b")),
    ],
    "retail": [
        ("thu_ngan", re.compile(r"thu ngan\b")),
        ("quan_ly_cua_hang", re.compile(r"quan ly cua hang|quan ly sieu thi")),
        ("kinh_doanh", re.compile(r"nhan vien kinh doanh\b|dai dien kinh doanh|sales executive|sales representative")),
        ("ban_hang", re.compile(r"nhan vien ban hang|\bsales?\b|nhan vien cua hang|tu van ban hang")),
    ],
    "delivery": [
        # "giao hang"/"shipper" 같은 배달 전용 표현이 있으면, 같은 제목에
        # "tài xế"(운전기사, 트럭기사에도 쓰이는 범용 단어)가 같이 있어도
        # 배달 기사로 우선 분류한다(예: "Tài Xế Giao Hàng GrabFood").
        ("giao_hang_xe_may", re.compile(r"giao hang\b|shipper\b|xe om\b|nhan vien giao hang|nhan vien phat hang")),
        ("lai_xe", re.compile(r"xe tai\b|xe container|xe dau keo|\btai xe\b|\blai xe\b")),
        ("kho_van", re.compile(r"kho van\b|nhan vien kho\b|thu kho\b|phu kho\b|logistic")),
    ],
    "cleaning": [
        ("cham_soc", re.compile(r"trong tre\b|bao mau\b|cham soc nguoi cao tuoi|cham soc tre")),
        ("ve_sinh_cong_nghiep", re.compile(r"ve sinh cong nghiep|ve sinh van phong|ve sinh toa nha|ve sinh moi truong|nhan vien ve sinh|cong nhan ve sinh")),
        ("giup_viec_nha", re.compile(r"giup viec\b|don dep nha|tap vu\b|lao cong\b")),
    ],
    "factory": [
        ("han_co_khi", re.compile(r"han xi\b|han dien\b|tho han\b|co khi\b")),
        ("ky_thuat_bao_tri", re.compile(r"ky thuat vien\b|nhan vien ky thuat|bao tri co dien|bao tri dien|bao tri may|co dien\b|van hanh may")),
        ("san_xuat_dong_goi", re.compile(r"cong nhan san xuat|nhan vien san xuat|dong goi\b|lap rap\b|cong nhan\b")),
    ],
    "office": [
        ("le_tan", re.compile(r"le tan\b|receptionist")),
        ("nhap_lieu", re.compile(r"nhap lieu\b|data entry")),
        ("ke_toan", re.compile(r"ke toan\b")),
        ("hanh_chinh_nhan_su", re.compile(r"hanh chinh nhan su\b|nhan su\b|nhan vien hanh chinh\b|thu ky\b|tro ly\b")),
        ("cskh", re.compile(r"tong dai\b|cskh\b|cham soc khach hang\b|hotline\b|tu van khach hang\b|inbound\b|telesale\b|telesales\b")),
        # marketing/PR는 _OFFICE 대분류 정규식에 이미 걸리지만(→ van_phong로
        # 정확히 라우팅됨) 소분류가 없어 전부 None으로 빠지던 걸 2026-09-19
        # 발견 — SNS/콘텐츠 계열을 먼저 특정해서 잡고, 나머지 일반
        # marketing/quảng cáo/PR은 marketing_quang_cao로 catch-all.
        ("marketing_sns", re.compile(r"social media\b|content creator\b|kol\b|tiktok\b|marketing sns\b")),
        ("marketing_quang_cao", re.compile(r"marketing\b|quang cao\b|\bpr\b|quan he cong chung")),
    ],
    # 아래 3개는 이미 새 대분류 id를 키로 쓴다(위 map_to_new_taxonomy() 참고) —
    # 소분류 id도 SUBCATEGORY_LABELS의 새 id를 그대로 쓴다.
    "cntt_ky_thuat": [
        ("lap_trinh_vien", re.compile(r"lap trinh vien|developer\b")),
        ("he_thong_mang_bao_mat", re.compile(r"quan ly he thong\b|an toan thong tin|bao mat he thong|network engineer|quan tri mang\b")),
        ("lap_dat_thiet_bi_so", re.compile(r"it helpdesk|it support|nhan vien it\b|ky thuat it\b")),
        ("quan_tri_website", re.compile(r"quan tri website")),
    ],
    "thiet_ke": [
        ("cad_cam_noi_that", re.compile(r"thiet ke noi that|kien truc su.{0,20}noi that|hoa vien\b|thiet ke ban ve")),
        ("thiet_ke_do_hoa_video", re.compile(r"thiet ke do hoa")),
        ("thiet_ke_san_pham", re.compile(r"thiet ke san pham")),
        ("thiet_ke_thoi_trang", re.compile(r"thiet ke thoi trang")),
        ("thiet_ke_nhan_vat", re.compile(r"thiet ke nhan vat|3d rigger\b|animator\b")),
    ],
    "giao_duc_giang_day": [
        ("mam_non_mau_giao", re.compile(r"mam non\b|mau giao\b")),
        ("tin_hoc_cntt", re.compile(r"trung tam tin hoc|giao vien tin hoc")),
        ("trung_tam_ngoai_ngu", re.compile(r"trung tam ngoai ngu")),
        ("trung_tam_luyen_thi", re.compile(r"trung tam luyen thi")),
        ("gia_su_tai_nha", re.compile(r"gia su\b")),
        ("tro_giang", re.compile(r"tro giang\b")),
    ],
    # ⚠️ 아래 2개는 _Y_TE_DIEU_DUONG/_TRUYEN_THONG와 마찬가지로 실제 DB
    # 표본으로 검증되지 않았다.
    "y_te_dieu_duong": [
        ("dieu_duong_y_ta", re.compile(r"y ta\b|dieu duong\b|dieu duong vien")),
        ("cham_soc_benh_nhan", re.compile(r"ho ly\b|cham soc benh nhan")),
        ("ky_thuat_vien_y_te", re.compile(r"ky thuat vien y te")),
    ],
    "truyen_thong": [
        ("quay_dung_video", re.compile(r"quay phim\b|dung phim\b|quay dung video")),
        ("chup_anh_chinh_sua", re.compile(r"nhiep anh\b")),
        ("bao_tap_chi_xuat_ban", re.compile(r"bien tap vien\b|phong vien\b")),
        ("anh_sang_am_thanh", re.compile(r"anh sang am thanh")),
    ],
}


def classify_subcategory(category: str, title: str, company: str = "", description: str = "") -> str | None:
    """
    이미 정해진 대분류(category) 안에서만 소분류를 찾는다 — classify()가 이미
    내린 대분류 판정을 다시 검증하거나 바꾸지 않는다. 대분류에 소분류 규칙이
    없거나(예: 'other') 아무 규칙도 안 걸리면 None(소분류 없음)을 반환한다 —
    억지로 아무 소분류나 끼워맞추지 않는다.
    """
    rules = _SUBCATEGORY_RULES.get(category)
    if not rules:
        return None
    combined = _norm_fields(title, company, description[:300])
    title_co = _norm_fields(title, company)
    for sub_id, pattern in rules:
        if pattern.search(title_co) or pattern.search(combined):
            return sub_id
    return None


# ══════════════════════════════════════════════════════════
#  새 대분류/소분류 체계 (2026-09-17 사용자 지시) — 알바몬 실제 사이트
#  (albamon.com/jobs/urgent 업직종 필터)에서 직접 확인한 12개 대분류 +
#  기타 1개(khac) = 13개. 위의 classify()/classify_subcategory()는 검증된
#  정규식 로직을 그대로 두고("legacy" 7분류 그대로 유지, 테스트도 안 건듦),
#  이 레이어가 그 결과값만 새 체계로 번역한다 — 크롤러가 실제로 DB에 쓸 때는
#  반드시 classify() → classify_subcategory() → map_to_new_taxonomy() 순서로
#  거쳐서 나온 (새 대분류, 새 소분류)를 저장한다.
#
#  소분류 158개 중 여기 매핑에 없는 나머지(137개)는 SUBCATEGORY_LABELS에는
#  라벨이 있지만 아직 분류 규칙이 없다는 뜻 — 실제 크롤링 데이터에 해당
#  업종이 얼마나 있는지 확인 후 규칙을 점진적으로 추가한다(성/시·동/사와
#  같은 원칙: 목록 자체는 항상 전체를 보여주고, 실제 매칭은 검증된 만큼만).
# ══════════════════════════════════════════════════════════
MAJOR_LABELS: dict[str, str] = {
    "am_thuc_do_uong":    "Ẩm thực · Đồ uống",
    "quan_ly_ban_hang":   "Quản lý cửa hàng · Bán hàng",
    "dich_vu":            "Dịch vụ",
    "van_phong":          "Văn phòng",
    "cskh_kinh_doanh":    "Chăm sóc khách hàng · Kinh doanh",
    "san_xuat_xay_dung":  "Sản xuất · Xây dựng · Lao động phổ thông",
    "cntt_ky_thuat":      "CNTT · Kỹ thuật",
    "thiet_ke":           "Thiết kế",
    "truyen_thong":       "Truyền thông",
    "lai_xe_giao_hang":   "Lái xe · Giao hàng",
    "y_te_dieu_duong":    "Y tế · Điều dưỡng · Nghiên cứu",
    "giao_duc_giang_day": "Giáo dục · Giảng dạy",
    "khac":               "Khác",
}

LEGACY_CATEGORY_TO_MAJOR: dict[str, str] = {
    "cafe":       "am_thuc_do_uong",
    "restaurant": "am_thuc_do_uong",
    "retail":     "quan_ly_ban_hang",
    "cleaning":   "dich_vu",
    "office":     "van_phong",
    "factory":    "san_xuat_xay_dung",
    "delivery":   "lai_xe_giao_hang",
    "other":      "khac",
    # 옛 7분류에 대응하는 게 없는 새 대분류(_CNTT_KY_THUAT/_THIET_KE/
    # _GIAO_DUC_GIANG_DAY) — classify()가 이미 최종 새 대분류 id를 직접
    # 반환하므로 자기 자신으로 매핑(항등 매핑)만 해주면 된다.
    "cntt_ky_thuat":      "cntt_ky_thuat",
    "thiet_ke":           "thiet_ke",
    "giao_duc_giang_day": "giao_duc_giang_day",
    "y_te_dieu_duong":    "y_te_dieu_duong",
    "truyen_thong":       "truyen_thong",
}

# (legacy_category, legacy_subcategory) -> (new_major, new_subcategory | None).
# None인 경우는 알바몬 소분류 목록에 딱 맞는 항목이 없어(예: "매장 관리" 자체를
# 가리키는 포괄적 소분류 없음) 대분류만 정확히 옮기고 소분류는 비워둔다 —
# 억지로 아무 소분류에나 끼워맞추지 않는다.
LEGACY_SUB_TO_NEW: dict[tuple[str, str], tuple[str, str | None]] = {
    ("cafe", "pha_che"):        ("am_thuc_do_uong", "barista"),
    ("cafe", "phuc_vu_quan"):   ("am_thuc_do_uong", "phuc_vu_ban"),
    ("cafe", "thu_ngan"):       ("quan_ly_ban_hang", "thu_ngan"),
    ("restaurant", "bep"):        ("am_thuc_do_uong", "dau_bep"),
    ("restaurant", "phuc_vu_ban"): ("am_thuc_do_uong", "phuc_vu_ban"),
    ("restaurant", "rua_bat"):    ("am_thuc_do_uong", "phu_bep_rua_bat"),
    ("restaurant", "thu_ngan"):   ("quan_ly_ban_hang", "thu_ngan"),
    ("retail", "thu_ngan"):          ("quan_ly_ban_hang", "thu_ngan"),
    ("retail", "quan_ly_cua_hang"):  ("quan_ly_ban_hang", None),
    ("retail", "ban_hang"):          ("cskh_kinh_doanh", "ban_hang_truc_tiep"),
    ("retail", "kinh_doanh"):        ("cskh_kinh_doanh", "ho_tro_kinh_doanh"),
    ("delivery", "giao_hang_xe_may"): ("lai_xe_giao_hang", "giao_do_an_shipper"),
    ("delivery", "lai_xe"):           ("lai_xe_giao_hang", "taxi_lai_xe_ho"),
    ("delivery", "kho_van"):          ("san_xuat_xay_dung", "xuat_nhap_kho"),
    ("cleaning", "ve_sinh_cong_nghiep"): ("dich_vu", "ve_sinh_don_dep"),
    ("cleaning", "giup_viec_nha"):       ("dich_vu", "trong_tre_giup_viec"),
    ("cleaning", "cham_soc"):            ("dich_vu", "trong_tre_giup_viec"),
    ("factory", "san_xuat_dong_goi"):  ("san_xuat_xay_dung", "san_xuat_gia_cong"),
    ("factory", "ky_thuat_bao_tri"):   ("san_xuat_xay_dung", "bao_tri_sua_chua"),
    ("factory", "han_co_khi"):         ("san_xuat_xay_dung", "khuon_mau_ep_nhua"),
    ("office", "cskh"):               ("cskh_kinh_doanh", "cskh_inbound"),
    ("office", "nhap_lieu"):          ("van_phong", "thu_thap_du_lieu"),
    ("office", "hanh_chinh_nhan_su"): ("van_phong", "nhan_su_hanh_chinh"),
    ("office", "le_tan"):             ("dich_vu", "le_tan"),
    ("office", "ke_toan"):            ("van_phong", "tro_ly_ke_toan"),
    ("office", "marketing_sns"):      ("van_phong", "marketing_sns"),
    ("office", "marketing_quang_cao"): ("van_phong", "marketing_quang_cao"),
}


def map_to_new_taxonomy(legacy_category: str, legacy_subcategory: str | None) -> tuple[str, str | None]:
    """classify()/classify_subcategory()가 반환한 legacy (대분류, 소분류)를
    새 13개 대분류 체계로 번역한다. 크롤러가 DB에 쓰기 직전 마지막 단계에서
    반드시 호출한다."""
    new_major = LEGACY_CATEGORY_TO_MAJOR[legacy_category]
    # cntt_ky_thuat/thiet_ke/giao_duc_giang_day처럼 옛 7분류가 아니라 이미 새
    # 대분류 id를 직접 반환하는 카테고리는 _SUBCATEGORY_RULES도 새 소분류
    # id를 그대로 쓰므로, 추가 변환 없이 그대로 통과시킨다.
    if legacy_category == new_major:
        return new_major, legacy_subcategory
    if legacy_subcategory is None:
        return new_major, None
    mapped = LEGACY_SUB_TO_NEW.get((legacy_category, legacy_subcategory))
    if mapped is None:
        return new_major, None
    return mapped


# 대분류 12개(+기타) 밑 소분류 158개 전체 라벨 — 알바몬 실제 사이트에서 확인한
# 목록을 베트남어로 번역(2026-09-17). 규칙(_SUBCATEGORY_RULES/
# LEGACY_SUB_TO_NEW)이 있는 항목만 실제로 자동 분류되고, 나머지는 라벨만
# 존재한다(프론트에서 항상 전체를 보여주되, 매칭 공고가 없으면 0건).
SUBCATEGORY_LABELS: dict[str, dict[str, str]] = {
    "am_thuc_do_uong": {
        "phuc_vu_ban": "Phục vụ bàn",
        "dau_bep": "Đầu bếp · Phụ bếp chính",
        "phu_bep_rua_bat": "Phụ bếp · Rửa bát",
        "barista": "Pha chế · Barista",
        "tho_lam_banh": "Thợ làm bánh",
        "quan_an_binh_dan": "Quán ăn bình dân",
        "nha_hang": "Nhà hàng",
        "nha_hang_gia_dinh": "Nhà hàng gia đình",
        "thuc_an_nhanh": "Cửa hàng thức ăn nhanh",
        "ga_ran_pizza": "Cửa hàng gà rán · Pizza",
        "quan_ca_phe": "Quán cà phê",
        "kem_trang_mieng": "Kem · Tráng miệng",
        "tiem_banh": "Tiệm bánh · Donut · Bánh truyền thống",
        "quan_bia": "Quán bia · Quán nhậu",
        "bar": "Bar · Quầy rượu",
        "suat_an_cong_nghiep": "Suất ăn công nghiệp · Bếp ăn tập thể",
        "com_hop": "Cơm hộp · Đồ ăn kèm",
    },
    "quan_ly_ban_hang": {
        "thu_ngan": "Thu ngân · Quầy tính tiền",
        "pg_pb": "Nhân viên PG/PB quảng bá sản phẩm",
        "md_tmdt": "MD · Vận hành sàn TMĐT",
        "ttm_tm": "Trung tâm thương mại",
        "sieu_thi": "Siêu thị · Cửa hàng phân phối",
        "cho_truyen_thong": "Bán buôn - bán lẻ · Chợ truyền thống",
        "cua_hang_tien_loi": "Cửa hàng tiện lợi",
        "quan_ao_trang_suc": "Cửa hàng quần áo · Phụ kiện · Trang sức",
        "my_pham_suc_khoe": "Cửa hàng mỹ phẩm · Sức khỏe",
        "dien_thoai_thiet_bi": "Cửa hàng điện thoại · Thiết bị điện tử",
        "noi_that": "Nội thất · Chăn ga gối · Trang trí nhà",
        "do_gia_dung": "Cửa hàng đồ gia dụng",
        "nha_sach_van_phong_pham": "Nhà sách · Văn phòng phẩm · Đồ lưu niệm",
        "nong_san_thuy_san": "Nông sản · Thủy hải sản · Thịt tươi sống",
        "cua_hang_hoa": "Cửa hàng hoa",
        "phong_hoc_nhom": "Phòng học nhóm · Phòng tự học · KTX ôn thi",
        "quan_net": "Quán net · Phòng máy chơi game",
        "karaoke": "Karaoke",
        "bowling_billiard": "Bowling · Billiard",
        "golf_man_hinh": "Golf màn hình · Mô phỏng bóng chày",
        "phong_chieu_phim_da_nang": "Phòng chiếu phim · Multi-room · Cà phê truyện tranh",
        "khu_vui_choi_dien_tu": "Khu vui chơi điện tử · Game center",
        "ca_phe_chu_de": "Cà phê chủ đề độc đáo",
        "ca_phe_tre_em": "Cà phê trẻ em · Khu vui chơi trẻ em",
        "sauna_spa": "Nhà tắm hơi · Sauna · Spa",
        "gym_the_thao": "Phòng gym · Thể thao",
        "tram_dung_nghi": "Trạm dừng nghỉ cao tốc",
    },
    "dich_vu": {
        "cong_vien_giai_tri": "Công viên giải trí",
        "khach_san_resort": "Khách sạn · Resort · Lưu trú",
        "du_lich_cam_trai": "Du lịch · Cắm trại · Thể thao giải trí",
        "rap_chieu_phim": "Rạp chiếu phim · Nhà hát",
        "trien_lam_hoi_nghi": "Triển lãm · Hội nghị · Hội thảo",
        "le_tan": "Lễ tân · Quầy hướng dẫn",
        "huong_dan_do_xe": "Hướng dẫn đỗ xe",
        "bao_ve": "Bảo vệ · An ninh",
        "cay_xang_rua_xe": "Cây xăng · Rửa xe",
        "cho_thue_xe": "Cho thuê xe · Quản lý xe",
        "phat_to_roi": "Phát tờ rơi",
        "ve_sinh_don_dep": "Vệ sinh · Dọn dẹp",
        "quan_ly_cho_thue_as": "Quản lý cho thuê · Bảo hành sửa chữa",
        "caddy_golf": "Caddy sân golf",
        "toc_lam_dep_nail": "Tiệm tóc · Làm đẹp · Nail",
        "cham_soc_da_massage": "Chăm sóc da · Massage",
        "cham_soc_thu_cung": "Chăm sóc thú cưng",
        "trong_tre_giup_viec": "Trông trẻ · Giúp việc nhà",
        "tiec_cuoi_tang_le": "Hỗ trợ tiệc cưới · Tiệc · Tang lễ",
        "nhan_vien_su_kien": "Nhân viên sự kiện",
        "thuyet_minh_quang_cao": "Người thuyết minh quảng cáo",
        "nguoi_mau_thu_do": "Người mẫu thử đồ",
        "moi_gioi_bds": "Môi giới bất động sản",
    },
    "van_phong": {
        "tro_ly_van_phong": "Trợ lý văn phòng",
        "soan_thao_van_ban": "Soạn thảo văn bản · Tìm tài liệu",
        "thu_thap_du_lieu": "Thu thập · Xử lý dữ liệu",
        "tro_ly_ke_toan": "Trợ lý kế toán",
        "nhan_su_hanh_chinh": "Nhân sự · Hành chính",
        "marketing_quang_cao": "Marketing · Quảng cáo · PR",
        "marketing_sns": "Marketing viral · Mạng xã hội",
        "bien_dich_phien_dich": "Biên dịch · Phiên dịch",
        "photocopy_in_an": "Photocopy · In ấn · Đóng sách",
        "bien_tap_hieu_dinh": "Biên tập · Hiệu đính",
        "co_quan_nha_nuoc": "Cơ quan nhà nước · Doanh nghiệp công · Hiệp hội",
        "truong_hoc_thu_vien": "Trường học · Thư viện · Cơ sở giáo dục",
    },
    "cskh_kinh_doanh": {
        "cskh_inbound": "Chăm sóc khách hàng (inbound)",
        "telesale_outbound": "Telesale (outbound)",
        "cskh_tmdt": "CSKH sàn thương mại điện tử",
        "kinh_doanh_tai_chinh": "Kinh doanh tài chính · Bảo hiểm",
        "ban_hang_truc_tiep": "Kinh doanh · Bán hàng trực tiếp",
        "khao_sat_nghien_cuu": "Khảo sát · Nghiên cứu thị trường",
        "quan_ly_tong_dai": "Quản lý · Giám sát tổng đài",
        "ho_tro_kinh_doanh": "Quản lý · Hỗ trợ kinh doanh",
    },
    "san_xuat_xay_dung": {
        "san_xuat_gia_cong": "Sản xuất · Gia công · Lắp ráp",
        "dong_goi_kiem_tra": "Đóng gói · Kiểm tra chất lượng",
        "xuat_nhap_kho": "Xuất nhập kho · Quản lý kho",
        "boc_xep_hang": "Bốc xếp hàng · Phân loại bưu kiện",
        "nhat_hang_logistics": "Nhặt hàng logistics · Đóng gói · Nhập liệu",
        "lai_xe_nang": "Lái xe nâng",
        "khuon_mau_ep_nhua": "Khuôn mẫu · Ép nhựa · Dập · Gia công cơ khí",
        "san_xuat_ban_dan": "Sản xuất bán dẫn · Linh kiện điện tử",
        "van_hanh_may_moc": "Vận hành máy móc",
        "bao_tri_sua_chua": "Bảo trì · Sửa chữa · Lắp đặt",
        "dien_co_so_vat_chat": "Điện · Quản lý cơ sở vật chất",
        "van_chuyen_lap_dat": "Vận chuyển · Lắp đặt · Tháo dỡ",
        "cong_truong_xay_dung": "Công trường xây dựng",
        "thi_cong_dien_ong_nuoc": "Thi công điện · Vách ngăn · Ống nước",
        "noi_that_sua_chua_nha": "Nội thất · Sửa chữa nhà",
        "nha_may_dong_tau": "Nhà máy đóng tàu",
        "cat_may": "Cắt may",
    },
    "cntt_ky_thuat": {
        "len_ke_hoach_web": "Lập kế hoạch web · Nội dung",
        "quan_tri_website": "Quản trị website · Hỗ trợ kỹ thuật",
        "lap_trinh_vien": "Lập trình viên",
        "lap_trinh_html": "Lập trình HTML",
        "kiem_thu_phan_mem": "Kiểm thử phần mềm",
        "he_thong_mang_bao_mat": "Hệ thống · Mạng · Bảo mật",
        "lap_dat_thiet_bi_so": "Lắp đặt · Quản lý máy tính, thiết bị số",
    },
    "thiet_ke": {
        "thiet_ke_web_mobile": "Thiết kế web · Mobile",
        "thiet_ke_do_hoa_video": "Thiết kế đồ họa · Video · Dựng phim",
        "thiet_ke_san_pham": "Thiết kế sản phẩm · Công nghiệp",
        "cad_cam_noi_that": "CAD/CAM · Thiết kế nội thất",
        "thiet_ke_nhan_vat": "Thiết kế nhân vật · Hoạt hình",
        "thiet_ke_thoi_trang": "Thiết kế thời trang · Phụ kiện",
    },
    "truyen_thong": {
        "dien_vien_quan_chung": "Diễn viên quần chúng · Khán giả trường quay",
        "nhan_vien_hau_truong": "Nhân viên hậu trường · Trợ lý quay phim",
        "quay_dung_video": "Quay · Dựng video",
        "chup_anh_chinh_sua": "Chụp ảnh · Chỉnh sửa ảnh",
        "anh_sang_am_thanh": "Ánh sáng · Âm thanh",
        "dai_truyen_hinh": "Đài truyền hình · Công ty sản xuất",
        "bao_tap_chi_xuat_ban": "Báo · Tạp chí · Xuất bản",
    },
    "lai_xe_giao_hang": {
        "van_chuyen_chuyen_nha": "Vận chuyển hàng hóa · Chuyển nhà",
        "tai_xe_giao_hang": "Tài xế giao hàng · Bưu kiện",
        "tai_xe_giao_dai_ly": "Tài xế giao hàng cho đại lý",
        "xe_chuyen_dung": "Xe chuyên dụng · Xe hạng nặng",
        "do_xe_ho": "Đỗ xe hộ",
        "taxi_lai_xe_ho": "Taxi · Lái xe hộ · Tài xế riêng",
        "lai_xe_buyt": "Lái xe buýt · Xe đưa đón",
        "giao_hang_nhanh": "Giao hàng nhanh",
        "giao_do_an_shipper": "Giao đồ ăn · Shipper",
        "giao_hang_di_bo": "Giao hàng đi bộ",
    },
    "y_te_dieu_duong": {
        "dieu_duong_y_ta": "Điều dưỡng · Y tá",
        "ky_thuat_vien_y_te": "Kỹ thuật viên y tế",
        "cham_soc_benh_nhan": "Người chăm sóc bệnh nhân · người cao tuổi",
        "hanh_chinh_benh_vien": "Hành chính bệnh viện · Điều phối viên",
        "tro_ly_khoa_kham": "Trợ lý khoa khám · Trợ lý bệnh phòng",
        "ky_thuat_vien_thu_y": "Kỹ thuật viên thú y",
        "tro_ly_thi_nghiem": "Trợ lý thí nghiệm · Nghiên cứu",
        "thu_nghiem_lam_sang": "Thử nghiệm sinh khả dụng · Lâm sàng",
    },
    "giao_duc_giang_day": {
        "trung_tam_luyen_thi": "Trung tâm luyện thi · Học thêm",
        "trung_tam_ngoai_ngu": "Trung tâm ngoại ngữ",
        "trung_tam_doc_sach": "Trung tâm đọc sách · Luyện viết · Nói trước công chúng",
        "tin_hoc_cntt": "Tin học · CNTT",
        "giao_vien_yoga": "Giáo viên Yoga · Pilates",
        "hlv_the_hinh": "Huấn luyện viên thể hình",
        "giao_vien_the_thao": "Giáo viên thể thao giải trí",
        "giao_vien_nang_khieu": "Giáo viên năng khiếu (nghệ thuật/thể thao)",
        "mam_non_mau_giao": "Mầm non · Mẫu giáo",
        "ho_tro_dua_don": "Hỗ trợ đưa đón học sinh",
        "gia_su_tai_nha": "Gia sư tại nhà · Học liệu",
        "tro_giang": "Trợ giảng",
        "trung_tam_chung_chi": "Trung tâm đào tạo chứng chỉ · Kỹ năng nghề",
        "co_so_dao_tao_nghe": "Cơ sở đào tạo nghề do nhà nước tài trợ",
        "ho_tro_van_hanh_trung_tam": "Hỗ trợ vận hành trung tâm",
        "bien_soan_giao_trinh": "Biên soạn giáo trình · Nội dung giáo dục",
    },
}


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

    # 소분류 셀프 테스트 — 위 대분류 테스트와 같은 제목을 재사용해, 각각이
    # 어느 소분류로 떨어지는지 검증한다.
    sub_tests = [
        ("Nhân Viên Pha Chế Highlands Coffee", "Highlands", "cafe", "pha_che"),
        ("Phụ Bếp Nhà Hàng Hải Sản", "Quán Hải Sản 999", "restaurant", "bep"),
        ("Phục Vụ Bàn Jollibee Part-time", "Jollibee", "restaurant", "phuc_vu_ban"),
        ("Thu Ngân Siêu Thị WinMart", "WinCommerce", "retail", "thu_ngan"),
        ("Nhân Viên Bán Hàng Cửa Hàng Tiện Lợi", "Circle K", "retail", "ban_hang"),
        ("Công Nhân Sản Xuất Nhà Máy", "Samsung Bắc Ninh", "factory", "san_xuat_dong_goi"),
        ("Tài Xế Giao Hàng GrabFood", "Grab", "delivery", "giao_hang_xe_may"),
        ("Nhân Viên Kho Part-time", "Lazada", "delivery", "kho_van"),
        ("Nhân Viên Vệ Sinh Văn Phòng", "CleanPro", "cleaning", "ve_sinh_cong_nghiep"),
        ("Giúp Việc Nhà Bán Thời Gian", "", "cleaning", "giup_viec_nha"),
        ("Nhân Viên Nhập Liệu Part-time", "Cty ABC", "office", "nhap_lieu"),
        ("Trực Tổng Đài CSKH Ca Tối", "Call Center 24h", "office", "cskh"),
        ("Telesale Part-time Buổi Tối", "Edu Online", "office", "cskh"),
        ("Lễ Tân Văn Phòng Part-time", "Spa ABC", "office", "le_tan"),
        ("Tổ Trưởng Kỹ Thuật Bảo Trì Cơ Điện", "Mebi Farm", "factory", "ky_thuat_bao_tri"),
        ("Nhân Viên Content Creator Social Media", "Agency ABC", "office", "marketing_sns"),
        ("Nhân Viên Marketing Online Part-time", "Cty XYZ", "office", "marketing_quang_cao"),
        ("Chuyên Viên PR Sự Kiện", "Cty Truyền Thông", "office", "marketing_quang_cao"),
        # 소분류 규칙 어디에도 안 걸려서 None이 나와야 정상인 경우
        ("Admin Bán Hàng Trực Page Facebook", "Shop Online", "office", None),
        ("Nhân Viên Tư Vấn Tuyển Sinh", "Cao Đẳng Kỹ Thuật", "office", None),
    ]
    sub_ok = sub_err = 0
    print()
    for title, company, category, expected in sub_tests:
        got = classify_subcategory(category, title, company)
        status = "✅" if got == expected else "❌"
        if got != expected:
            sub_err += 1
        else:
            sub_ok += 1
        print(f"  {status} [{category}/{got}] expected={expected} | {title}")
    print(f"\n소분류 결과: {sub_ok}/{sub_ok+sub_err} 정확")

    # 새 대분류/소분류 체계 매핑 테스트 — legacy 7분류 결과가 새 13개 대분류로
    # 정확히 번역되는지 확인.
    new_tests = [
        ("cafe", "pha_che", ("am_thuc_do_uong", "barista")),
        ("cafe", "thu_ngan", ("quan_ly_ban_hang", "thu_ngan")),
        ("restaurant", "bep", ("am_thuc_do_uong", "dau_bep")),
        ("restaurant", "thu_ngan", ("quan_ly_ban_hang", "thu_ngan")),
        ("retail", "quan_ly_cua_hang", ("quan_ly_ban_hang", None)),
        ("retail", "ban_hang", ("cskh_kinh_doanh", "ban_hang_truc_tiep")),
        ("delivery", "kho_van", ("san_xuat_xay_dung", "xuat_nhap_kho")),
        ("delivery", "giao_hang_xe_may", ("lai_xe_giao_hang", "giao_do_an_shipper")),
        ("cleaning", "ve_sinh_cong_nghiep", ("dich_vu", "ve_sinh_don_dep")),
        ("factory", "han_co_khi", ("san_xuat_xay_dung", "khuon_mau_ep_nhua")),
        ("office", "cskh", ("cskh_kinh_doanh", "cskh_inbound")),
        ("office", "le_tan", ("dich_vu", "le_tan")),
        ("office", "ke_toan", ("van_phong", "tro_ly_ke_toan")),
        ("office", "marketing_sns", ("van_phong", "marketing_sns")),
        ("office", "marketing_quang_cao", ("van_phong", "marketing_quang_cao")),
        ("other", None, ("khac", None)),
    ]
    new_ok = new_err = 0
    print()
    for legacy_cat, legacy_sub, expected in new_tests:
        got = map_to_new_taxonomy(legacy_cat, legacy_sub)
        status = "✅" if got == expected else "❌"
        if got != expected:
            new_err += 1
        else:
            new_ok += 1
        print(f"  {status} [{legacy_cat}/{legacy_sub}] -> {got} expected={expected}")

    # 모든 legacy 대분류(7개)가 새 체계에 매핑돼 있는지, 새 SUBCATEGORY_LABELS의
    # 모든 항목이 유효한 대분류 밑에 있는지도 확인.
    legacy_categories = {"cafe", "restaurant", "retail", "delivery", "cleaning", "factory", "office", "other"}
    missing_legacy = legacy_categories - set(LEGACY_CATEGORY_TO_MAJOR)
    if missing_legacy:
        print(f"  ❌ LEGACY_CATEGORY_TO_MAJOR 누락: {missing_legacy}")
        new_err += 1
    else:
        print(f"  ✅ LEGACY_CATEGORY_TO_MAJOR 7개 legacy 전부 매핑됨")
        new_ok += 1
    total_subs = sum(len(v) for v in SUBCATEGORY_LABELS.values())
    if total_subs == 158 and set(SUBCATEGORY_LABELS) <= set(MAJOR_LABELS):
        print(f"  ✅ SUBCATEGORY_LABELS 총 {total_subs}개, 전부 유효한 대분류 밑")
        new_ok += 1
    else:
        print(f"  ❌ SUBCATEGORY_LABELS 총 {total_subs}개(158 기대) 또는 대분류 키 불일치")
        new_err += 1
    print(f"\n새 체계 매핑 결과: {new_ok}/{new_ok+new_err} 정확")

    # 새 대분류 5개(옛 7분류에 없던 것) 테스트. cntt_ky_thuat/thiet_ke/
    # giao_duc_giang_day 3개는 2026-09-17 실제 DB의 category='other' 66건
    # 표본에서 직접 확인한 진짜 제목이고, y_te_dieu_duong/truyen_thong 2개는
    # ⚠️ 실제 DB 표본이 없어(0건) 베트남어 직군 용어 기반으로 손으로 쓴
    # 예시 제목이다 — 실제 공고로 검증된 게 아니므로, 실제 공고가 들어오면
    # 다시 검증해야 한다.
    major_tests = [
        # cntt_ky_thuat — 실제 DB 표본(id=4400, 4417, 4418)
        ("Nhân Viên IT Helpdesk - Giao Tiếp Tiếng Anh", "Công Ty TNHH Roha Dyechem Việt Nam", "cntt_ky_thuat"),
        ("Chuyên Gia Đánh Giá Hệ Thống Quản Lý An Toàn Thông Tin", "Công Ty TNHH Tuv Nord Việt Nam", "cntt_ky_thuat"),
        # thiet_ke — 실제 DB 표본(id=4548, 4633)
        ("Kiến Trúc Sư Thiết Kế Nội Thất - Hóc Môn - Quận 12", "Công Ty TNHH Wanda", "thiet_ke"),
        ("3D Rigger", "Công Ty TNHH Nexon Creative Studio VINA", "thiet_ke"),
        # giao_duc_giang_day — 실제 DB 표본(id=4403, 4410)
        ("Giáo Viên Tin Học (Có Bằng Tốt Nghiệp Cao Đẳng Ngành CNTT)", "Công Ty TNHH Tư Vấn & Đào Tạo Đại Dương", "giao_duc_giang_day"),
        ("Giáo Viên Tin Học Văn Phòng", "Trung Tâm Tin Học Ms", "giao_duc_giang_day"),
        # y_te_dieu_duong — ⚠️ 미검증(손으로 쓴 예시)
        ("Tuyển Điều Dưỡng Viên Phòng Khám Đa Khoa", "Phòng Khám ABC", "y_te_dieu_duong"),
        ("Nhân Viên Y Tế Học Đường", "Trường Quốc Tế XYZ", "y_te_dieu_duong"),
        # truyen_thong — ⚠️ 미검증(손으로 쓴 예시)
        ("Nhân Viên Quay Phim Dựng Video Part-time", "Media House", "truyen_thong"),
        ("Phóng Viên Ảnh Tự Do", "Báo Điện Tử ABC", "truyen_thong"),
        # 기존 7분류 회귀 확인 — 새 대분류 규칙이 기존 분류를 망가뜨리지 않는지
        ("Trưởng Phòng Kỹ Thuật IT Service", "", "other"),  # 블랙리스트(truong phong) 우선
        ("Kỹ Sư Xây Dựng", "CÔNG TY CỔ PHẦN PC1 THĂNG LONG", "other"),  # 신호 없음, 정직하게 other
    ]
    major_ok = major_err = 0
    print()
    for title, company, expected in major_tests:
        got = classify(title, company)
        status = "✅" if got == expected else "❌"
        if got != expected:
            major_err += 1
        else:
            major_ok += 1
        print(f"  {status} [{got:20}] expected={expected:20} | {title}")
    print(f"\n새 대분류(5개) 결과: {major_ok}/{major_ok+major_err} 정확")

    if err or sub_err or new_err or major_err:
        sys.exit(1)
