"""공고 등록 입구(public.ingest_job) 호출 — 크롤러 전용 얇은 포장.

Lee 2026-10-29: 모든 등록 경로(관리자·고용주·크롤러·SQL)는 DB 입구 하나만 거친다.
local_jobs에 직접 insert하면 DB 트리거(trg_000_ingest_gateway_only)가 거부한다.
처리 순서·기준(원문 보존 → 중복 → 직업분류 → 위치 → 공개)은 DB 입구가 정하며 경로별 분기는 없다.
"""
from __future__ import annotations

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


def ingest_job(client, job: dict, *, job_id: int | None = None, update_fields: list[str] | None = None) -> int:
    """입구를 불러 공고 번호를 돌려받는다(새 공고·같은 공고·다시 수집 모두 같은 함수)."""
    result = client.rpc("ingest_job", {"p": build_payload(job, job_id=job_id, update_fields=update_fields)}).execute()
    if not isinstance(result.data, int) or result.data <= 0:
        raise RuntimeError(f"ingest_job이 공고 번호를 돌려주지 않음: {result.data!r}")
    return result.data
