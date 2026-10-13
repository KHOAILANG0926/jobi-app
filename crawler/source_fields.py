"""원문 근거 칸(source_text / contact_name / age_min·age_max) 채우기 + 규칙 거부(job_rule_Rx) 집계.

DB 규칙 장치(job_posting_rules, PR #60·#62)가 요구하는 값을 수집 쪽에서 맞춘다. 규칙을 우회·완화하지 않는다:
- source_text: 원문 글자 그대로(제목+본문). 요약·번역·성조 추가 금지. 공백 줄이기 같은 가공도 하지 않는다(앞뒤 공백만 제거).
- contact_name: 원문에 있으면 원문 글자 그대로의 부분 문자열, 없으면 None.
- age_min/age_max: 원문에 연령 범위("14-50t", "18-35 tuổi", "tuổi: 18-35")가 있을 때 그 숫자. 없으면 None.
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


def source_fields(title: str | None, body: str | None, extras: tuple | list = ()) -> dict:
    """저장 payload에 합칠 원문 근거 칸 4개(+contact_name).

    extras: 원문 페이지의 구조화된 칸(회사명·연락처·급여·주소 등)에서 읽은 값. 가공 없이 제목과 본문 사이에 줄 단위로 넣는다.
    페이지에 없던 값(우리가 추정·보정한 값)은 넣지 않는다 — 넣으면 R5(원문 그대로) 대조가 무의미해진다."""
    text = build_source_text(title, *[str(x) for x in extras if x is not None], body)
    age_min, age_max = extract_age_range(text)
    return {
        "source_text": text or None,
        "contact_name": extract_contact_name(text),
        "age_min": age_min,
        "age_max": age_max,
    }


_RULE_RX = re.compile(r"(job_rule_R\d+|job_posting_policy_excluded)")


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
            self.samples.append((code, label[:60]))

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
