"""공고 기준(마감·연락처)의 작은 공유 도우미 — 값은 policy/job-criteria.json 한 곳(화면 src/lib/jobCriteria.mjs와 같은 파일).

1-B(2026-11-22, Lee 승인): 수집기마다 따로 정하던 '마감 당일 처리·오늘의 시간대·연락처 있음'을 한 곳으로 모은다.
정책 판정(job_posting_policy.py)과 별개이고, 새 제외 규칙은 아니다 — 같은 기준을 DB·화면이 이미 쓰고 있어 수집기를 맞출 뿐이다.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

CRITERIA = json.loads((Path(__file__).resolve().parents[1] / "policy/job-criteria.json").read_text("utf-8"))
MIN_CONTACT_DIGITS = int(CRITERIA["contact"]["min_digits"])
# 베트남은 일광절약이 없어 고정 오프셋이면 충분하다(tzdata 의존 없음).
_VN = timezone(timedelta(hours=int(CRITERIA["deadline"]["utc_offset_hours"])))
_ISO_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")


def today_vn(now: datetime | None = None) -> str:
    """오늘 날짜(YYYY-MM-DD) — 서버 시간대와 상관없이 베트남 날짜."""
    return (now or datetime.now(timezone.utc)).astimezone(_VN).date().isoformat()


def deadline_passed(deadline: object, today: str | None = None) -> bool:
    """마감일이 오늘보다 앞이면 True. 마감 당일은 열림(False). 날짜 모양이 아니거나 없으면 False."""
    text = str(deadline or "").strip()[:10]
    return bool(_ISO_DAY.fullmatch(text)) and text < (today or today_vn())


def contact_digits(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))


def has_enough_contact(*values: object) -> bool:
    """전화·Zalo 중 하나라도 숫자가 MIN_CONTACT_DIGITS(8)자리 이상이면 True — DB 공개 게이트와 같은 기준."""
    return any(len(contact_digits(v)) >= MIN_CONTACT_DIGITS for v in values)
