"""공고 등록 입구(public.ingest_job) 호출 — 크롤러 전용 얇은 포장.

Lee 2026-10-29: 모든 등록 경로(관리자·고용주·크롤러·SQL)는 DB 입구 하나만 거친다.
local_jobs에 직접 insert하면 DB 트리거(trg_000_ingest_gateway_only)가 거부한다.
처리 순서·기준(원문 보존 → 중복 → 직업분류 → 위치 → 공개)은 DB 입구가 정하며 경로별 분기는 없다.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import date, datetime

_CHANNELS = (("topcv", "crawler_topcv"), ("facebook", "crawler_facebook"), ("muaban", "crawler_muaban"), ("chotot", "crawler_chotot"),
             ("chợ tốt", "crawler_chotot"))


def channel_for(source: object) -> str:
    """기록용 경로 이름. 처리 순서는 경로와 무관하다."""
    text = str(source or "").lower()
    for key, channel in _CHANNELS:
        if key in text:
            return channel
    return "crawler_other"


def _json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def build_payload(job: dict, *, job_id: int | None = None, update_fields: list[str] | None = None) -> dict:
    """입구에 보낼 원문 묶음. 밑줄(_)로 시작하는 내부 칸은 보내지 않는다.
    job_id를 주면 '다시 수집'(그 공고의 바뀐 칸만 고침), update_fields를 주면 그 칸만 고친다."""
    payload = {k: _json_safe(v) for k, v in job.items() if not k.startswith("_")}
    payload["channel"] = channel_for(payload.get("source"))
    if job_id is not None:
        payload["job_id"] = int(job_id)
        payload["refresh"] = True
    if update_fields is not None:
        payload["update_fields"] = list(update_fields)
    return payload


PRECHECK_URL = os.getenv("LOCATION_PRECHECK_URL", "https://www.viecganban.vn/api/location-hook")


class LocationNotFound(RuntimeError):
    """수집 첫 단계 위치 확인 실패. 메시지에 규칙 코드(location_precheck_*)가 들어가 rule_code()로 잡힌다."""


def precheck_input(job: dict) -> dict:
    """지도와 같은 위치 찾기에 보낼 원문: 회사·지역·근무지 주소."""
    addresses = [str(w.get("raw_address") or "").strip() for w in (job.get("work_locations") or []) if isinstance(w, dict)]
    return {"company": str(job.get("company") or ""), "location": str(job.get("location") or ""),
            "addresses": [a for a in addresses if a][:5]}


def http_precheck(job: dict) -> dict:
    """서버(Vercel)의 위치 확인을 부른다. 키·주소·응답 본문은 출력하지 않는다."""
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        return {"findable": False, "reason": "precheck_not_configured"}
    req = urllib.request.Request(PRECHECK_URL, data=json.dumps({"precheck": precheck_input(job)}).encode("utf-8"), method="POST",
                                 headers={"content-type": "application/json", "authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310 — 고정된 우리 서버 주소
            return json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError):
        return {"findable": False, "reason": "precheck_unavailable"}


# 테스트는 이 값을 바꿔 네트워크 없이 판정을 넣는다.
PRECHECK = http_precheck


def require_location(job: dict) -> dict:
    """수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선). 못 찾으면 등록하지 않는다(LocationNotFound)."""
    verdict = PRECHECK(job) or {}
    if verdict.get("findable") is not True:
        reason = str(verdict.get("reason") or "not_found")
        raise LocationNotFound(f"location_precheck_failed: {reason}")
    return verdict


def ingest_job(client, job: dict, *, job_id: int | None = None, update_fields: list[str] | None = None) -> int:
    """입구를 불러 공고 번호를 돌려받는다(새 공고·같은 공고·다시 수집 모두 같은 함수).
    새 공고는 먼저 위치를 찾을 수 있는지 확인하고, 못 찾으면 등록하지 않는다(이미 있는 공고 다시 수집은 그대로)."""
    existing = job_id is not None or update_fields is not None or job.get("job_id") is not None or job.get("refresh")
    if not existing:
        require_location(job)
    result = client.rpc("ingest_job", {"p": build_payload(job, job_id=job_id, update_fields=update_fields)}).execute()
    if not isinstance(result.data, int) or result.data <= 0:
        raise RuntimeError(f"ingest_job이 공고 번호를 돌려주지 않음: {result.data!r}")
    return result.data
