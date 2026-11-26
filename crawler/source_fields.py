"""원문 근거 칸(source_text / contact_name / age_min·age_max) 채우기 + 규칙 거부(job_rule_Rx) 집계.

DB 규칙 장치(job_posting_rules, PR #60·#62)가 요구하는 값을 수집 쪽에서 맞춘다. 규칙을 우회·완화하지 않는다:
- source_text: 원문 글자 그대로(제목+본문). 요약·번역·성조 추가 금지. 공백 줄이기 같은 가공도 하지 않는다(앞뒤 공백만 제거).
- contact_name: 원문에 있으면 원문 글자 그대로의 부분 문자열, 없으면 None.
- age_min/age_max: 원문에 연령 범위("14-50t", "18-35 tuổi", "tuổi: 18-35")가 있을 때 그 숫자. 없으면 None.
- employment_type: 원문에 고용형태 낱말이 한 종류만 분명히 있을 때(full_time·part_time·seasonal). 없거나 여러 종류면 None(추정 금지).
- employment_type_extra: 인턴(thực tập)·협력자(cộng tác viên/CTV)가 한 종류만 분명할 때. 계약(hợp đồng)은 근거가 약해 읽지 않음.
- 저장이 규칙(job_rule_Rx / job_posting_policy_excluded)에 걸려 거부되면 그 공고만 건너뛰고 사유별 건수를 센다.
"""
from __future__ import annotations

import re
from collections import Counter

# DB 함수 job_source_has_age_range()와 같은 형태(소문자 기준). 두 정규식 모두 앞 두 자리·뒤 두 자리 범위를 요구한다.
_AGE_SUFFIX = re.compile(r"(?<![0-9])([0-9]{2})\s*[-–~]\s*([0-9]{2})\s*(?:t|tuổi|tuoi)(?![^\W\d_])", re.I)
_AGE_LABEL = re.compile(r"(?:tuổi|tuoi)\s*:?\s*(?:từ\s*)?([0-9]{2})\s*[-–~]\s*([0-9]{2})", re.I)

_NAME_WORD = r"[A-ZÀ-ỸĐ][^\s\d,.:;()\[\]/|]*"
_NOT_NAMES = {"zalo", "sđt", "sdt", "hotline", "ngay", "phone", "tel", "đt", "dt", "mr", "ms", "mrs", "anh", "chị", "chi"}
_CONTACT_NAME = re.compile(
    r"(?:liên hệ|lien he|người liên hệ|nguoi lien he|LH|Lh)\s*[:\-]?\s*"
    r"(?:(?:anh|chị|chi|cô|chú|bác|mr|ms|mrs)\.?\s+)?"
    rf"({_NAME_WORD}(?:\s+{_NAME_WORD}){{0,2}})"
    r"(?=\s*[-–:,.()]*\s*(?:\(|\d|sđt|sdt|zalo|$))",
    re.I | re.M,
)


def build_source_text(*parts: str | None) -> str:
    """제목·본문 등 원문 조각을 줄바꿈으로 이어 붙인다. 각 조각은 앞뒤 공백만 제거하고 내용은 그대로 둔다."""
    return "\n".join(p.strip() for p in parts if p and p.strip())


def extract_age_range(text: str | None) -> tuple[int | None, int | None]:
    """원문의 연령 범위 숫자. 범위가 여러 개면 첫 번째. 없으면 (None, None)."""
    t = text or ""
    for rx in (_AGE_SUFFIX, _AGE_LABEL):
        m = rx.search(t)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            if lo <= hi:
                return lo, hi
    return None, None


def extract_contact_name(text: str | None) -> str | None:
    """"Liên hệ: anh Hùng 09xx..." 처럼 라벨 뒤에 이름이 명시된 경우만. 반환값은 항상 text의 부분 문자열(원문 글자 그대로)."""
    t = text or ""
    # 대소문자를 무시하는 라벨 매칭이지만 이름 첫 글자는 대문자여야 하므로 전체 re.I 대신 후보를 걸러낸다.
    for m in _CONTACT_NAME.finditer(t):
        name = m.group(1).strip()
        if name and name[0].isupper() and name in t and name.split()[0].lower() not in _NOT_NAMES:
            return name
    return None


# 고용형태(Lee 2026-11-25): 원문에 적힌 낱말만 — DB 허용 값 full_time·part_time·seasonal(20261007013659 check).
# 화면 직무 줄 판독(src/lib/sourceRecruitmentRoles.ts)과 같은 낱말(full/part time·toàn/bán thời gian)에 thời vụ만 더한다.
_EMPLOYMENT_WORDS = (
    ("full_time", re.compile(r"(?<![^\W_])(?:full\s*[- ]?time|toàn\s+thời\s+gian|toan\s+thoi\s+gian)(?![^\W_])", re.I)),
    ("part_time", re.compile(r"(?<![^\W_])(?:part\s*[- ]?time|partime|bán\s+thời\s+gian|ban\s+thoi\s+gian)(?![^\W_])", re.I)),
    ("seasonal", re.compile(r"(?<![^\W_])(?:thời\s+vụ|thoi\s+vu)(?![^\W_])", re.I)),
)
_EMPLOYMENT_LABEL = re.compile(r"^\s*[-•*]?\s*(?:hình\s+thức(?:\s+làm\s+việc)?|hinh\s+thuc(?:\s+lam\s+viec)?|loại\s+hình|loai\s+hinh)\s*[:：]\s*(.+)$", re.I | re.M)
_PERMANENT = re.compile(r"(?<![^\W_])(?:chính\s+thức|chinh\s+thuc)(?![^\W_])", re.I)
_NEGATED_EMPLOYMENT = re.compile(r"(?:không|khong|ko)\s+(?:phải\s+|phai\s+|nhận\s+|nhan\s+|tuyển\s+|tuyen\s+)?$", re.I)


def _employment_kinds(text: str) -> set[str]:
    kinds = set()
    for kind, rx in _EMPLOYMENT_WORDS:
        for m in rx.finditer(text):
            if not _NEGATED_EMPLOYMENT.search(text[max(0, m.start() - 20):m.start()]):  # "không nhận part time"은 근거가 아니다
                kinds.add(kind)
    if "seasonal" in kinds and _PERMANENT.search(text):  # "Chính thức và Thời vụ"(FUSHAN 원문) = 두 종류 — 고르지 않는다
        kinds.add("permanent")
    return kinds


def extract_employment_type(text: str | None) -> str | None:
    """원문의 고용형태. 사이트 칸·이름표 줄("Hình thức làm việc: Toàn thời gian")이 한 종류면 그 값, 없으면 글 전체에서 한 종류만 나올 때.
    두 종류 이상(예: 직무별 Fulltime/Parttime)이거나 낱말이 없으면 None — 고르거나 추정하지 않는다."""
    t = text or ""
    for m in _EMPLOYMENT_LABEL.finditer(t):
        kinds = _employment_kinds(m.group(1))
        if len(kinds) == 1:
            return next(iter(kinds))
    kinds = _employment_kinds(t)
    return next(iter(kinds)) if len(kinds) == 1 else None


# 추가 고용형태(employment_type_extra, DB 허용 값 contract·internship·collaborator — 20261108130000 check). 원문 낱말만.
# 'hợp đồng'(계약)은 정규직 글의 'hợp đồng lao động'(근로계약)에도 흔히 나와 근거가 되지 못해 읽지 않는다(추정 금지).
_EMPLOYMENT_EXTRA_WORDS = (
    # 인턴: 'thực tập sinh'(인턴 사원)·'sinh viên thực tập'만 — '…thời gian thực tập' 같은 말은 근거로 보지 않는다.
    ("internship", re.compile(r"(?<![^\W_])(?:thực\s+tập\s+sinh|thuc\s+tap\s+sinh|sinh\s+viên\s+thực\s+tập|sinh\s+vien\s+thuc\s+tap|internship)(?![^\W_])", re.I)),
    # 협력자: 모집 낱말(tuyển·cần·làm·vị trí) 바로 뒤(두 낱말 안)일 때만 — 'Chương trình cộng tác viên'(소개 보상, TEFAL 원문)은 고용형태가 아니다.
    ("collaborator", re.compile(r"(?<![^\W_])(?:tuyển|tuyen|cần|can|làm|lam|vị\s+trí|vi\s+tri)(?:\s+\S+){0,2}?\s+(?:cộng\s+tác\s+viên|cong\s+tac\s+vien|ctv)(?![^\W_])", re.I)),
)


def extract_employment_type_extra(text: str | None) -> str | None:
    """원문의 추가 고용형태(인턴·협력자). 한 종류만 분명히 있을 때만, 부정('không nhận thực tập')은 근거가 아니다. 없거나 여러 종류면 None."""
    t = text or ""
    kinds = set()
    for kind, rx in _EMPLOYMENT_EXTRA_WORDS:
        for m in rx.finditer(t):
            if not _NEGATED_EMPLOYMENT.search(t[max(0, m.start() - 20):m.start()]):
                kinds.add(kind)
    return next(iter(kinds)) if len(kinds) == 1 else None


def source_fields(title: str | None, body: str | None, extras: tuple | list = ()) -> dict:
    """저장 payload에 합칠 원문 근거 칸(source_text·contact_name·age_min·age_max·employment_type·employment_type_extra).

    extras: 원문 페이지의 구조화된 칸(회사명·연락처·급여·주소 등)에서 읽은 값. 가공 없이 제목과 본문 사이에 줄 단위로 넣는다.
    페이지에 없던 값(우리가 추정·보정한 값)은 넣지 않는다 — 넣으면 R5(원문 그대로) 대조가 무의미해진다."""
    text = build_source_text(title, *[str(x) for x in extras if x is not None], body)
    age_min, age_max = extract_age_range(text)
    return {
        "source_text": text or None,
        "contact_name": extract_contact_name(text),
        "age_min": age_min,
        "age_max": age_max,
        "employment_type": extract_employment_type(text),
        "employment_type_extra": extract_employment_type_extra(text),
    }


_RULE_RX = re.compile(r"(job_rule_R\d+|job_posting_policy_excluded|location_precheck_failed|location_precheck_held|deadline_expired)")


def rule_code(err: BaseException | str) -> str | None:
    """예외/메시지에서 규칙 거부 코드(job_rule_R3 등)를 뽑는다. 규칙 거부가 아니면 None."""
    m = _RULE_RX.search(str(err))
    return m.group(1) if m else None


class RuleRejections:
    """실행 한 번 동안 규칙에 걸려 건너뛴 공고를 사유별로 센다."""

    def __init__(self) -> None:
        self.by_rule: Counter[str] = Counter()
        self.samples: list[tuple[str, str]] = []

    def add(self, code: str, label: str = "") -> None:
        self.by_rule[code] += 1
        if len(self.samples) < 20:
            self.samples.append((code, label[:140]))

    @property
    def total(self) -> int:
        return sum(self.by_rule.values())

    def summary(self) -> str:
        if not self.total:
            return "규칙 거부 0건"
        return f"규칙 거부 {self.total}건: " + ", ".join(f"{k}={v}" for k, v in sorted(self.by_rule.items()))

    def report(self) -> None:
        print(f"  🚧 {self.summary()}")
        for code, label in self.samples:
            print(f"     - {code}: {label}")


REJECTIONS = RuleRejections()


class JobErrors:
    """공고 하나의 예상 못 한 오류(규칙 거부가 아닌 예외: DB 5xx·연결 끊김 등)는 그 공고만 실패로 남기고
    다음 공고를 계속한다(#872 ② "공고 하나의 오류로 전체 수집이 멈추지 않는다").
    실패한 공고는 저장되지 않았으므로 다음 실행에서 다시 만난다(Facebook은 '본 글'에서 뺌). 실행 결과는 실패로 끝난다.
    연속 LIMIT건이면 한 공고 문제가 아니라 DB·서버 문제로 보고 예전처럼 예외로 멈춘다(헛호출 방지).
    LIMIT 3 = 수집 멈춤 기준(같은 원인 3건 연속, Lee 2026-10-25)과 같은 숫자."""

    LIMIT = 3

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.failed: list[tuple[str | None, str, str]] = []  # (게시물 키, 제목, 오류)
        self._streak = 0

    def ok(self) -> None:
        """DB가 정상으로 답함(저장 또는 규칙 거부) — 연속 오류를 끊는다."""
        self._streak = 0

    def add(self, label: str, exc: BaseException, key: str | None = None) -> None:
        reason = f"{type(exc).__name__}: {str(exc)[:200]}"
        self.failed.append((key, label[:140], reason))
        self._streak += 1
        print(f"    ❌ 오류 — 이 공고만 실패, 다음 실행에서 다시: {label[:60]!r} — {reason}")
        if self._streak >= self.LIMIT:
            raise RuntimeError(f"연속 {self._streak}건 오류 — 공고 문제가 아니라 DB·서버 문제로 보고 멈춤") from exc

    def failed_keys(self) -> set[str]:
        return {k for k, _, _ in self.failed if k}

    def report(self) -> None:
        if self.failed:
            print(f"  ❌ 오류로 저장 못 한 공고 {len(self.failed)}건(다음 실행에서 다시):")
            for _, label, reason in self.failed[:20]:
                print(f"     - {label} — {reason}")


JOB_ERRORS = JobErrors()
