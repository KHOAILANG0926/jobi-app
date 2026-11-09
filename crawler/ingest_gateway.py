"""공고 등록 입구(public.ingest_job) 호출 — 크롤러 전용 얇은 포장.

Lee 2026-10-29: 모든 등록 경로(관리자·고용주·크롤러·SQL)는 DB 입구 하나만 거친다.
local_jobs에 직접 insert하면 DB 트리거(trg_000_ingest_gateway_only)가 거부한다.
처리 순서·기준(원문 보존 → 중복 → 직업분류 → 위치 → 공개)은 DB 입구가 정하며 경로별 분기는 없다.
"""
from __future__ import annotations

import hashlib
import json
import os
import urllib.parse
import urllib.error
import urllib.request
from datetime import date, datetime, timezone

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


class LocationDeferred(LocationNotFound):
    """위치를 '못 찾음'이 아니라 '지금 확인 못 함'(Google 한도 초과·확인 서버 오류). 공고는 버리지 않고 보류해 다음 수집 때 다시 묻는다(Lee 2026-11-09)."""


# 지금 확인 못 함 = 보류 후 자동 재시도. 그 밖의 이유(approximate_only·not_found 등)는 지금처럼 수집하지 않는다.
DEFERRED_REASONS = {"google_quota", "precheck_unavailable", "precheck_not_configured"}
HOLD_KIND = "location-hold"  # 비공개 저장소(research_artifacts, RLS 공개 차단)
HOLD_RETRY_PER_RUN = 5
HOLD_MAX_DAYS = 14


def _work_addresses(job: dict) -> list[str]:
    return [a for a in (str(w.get("raw_address") or "").strip() for w in (job.get("work_locations") or []) if isinstance(w, dict)) if a]


def precheck_input(job: dict) -> dict:
    """지도와 같은 위치 찾기에 보낼 원문: 회사·지역·근무지 주소(사이트 주소 칸)·원문 전체.
    주소 칸이 없으면 서버가 원문(source_text)에서 주소를 읽는다 — 주소 읽기는 src/lib/addressReader.ts 한 곳(Lee 2026-11-07)."""
    company = str(job.get("company") or "")
    if job.get("_company_from_text"):
        company = ""  # 원문에서 읽은 회사 이름은 서버가 다시 읽는다(회사 이름 읽기 한 곳). 사이트 회사 칸만 그대로 보낸다.
    return {"company": company, "location": str(job.get("location") or ""),
            "addresses": _work_addresses(job)[:5], "source_text": str(job.get("source_text") or ""),
            "poster_text": str(job.get("_poster_text") or "")}


def _post_hook(body: dict, failed: dict) -> dict:
    """서버(Vercel) 위치 hook 호출. 키·주소·응답 본문은 출력하지 않는다."""
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        return {**failed, "reason": "precheck_not_configured"}
    req = urllib.request.Request(PRECHECK_URL, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"content-type": "application/json", "authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310 — 고정된 우리 서버 주소
            return json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError):
        return {**failed, "reason": "precheck_unavailable"}


def http_precheck(job: dict) -> dict:
    """서버의 위치 확인(Google·지도 조회 포함)."""
    return _post_hook({"precheck": precheck_input(job)}, {"findable": False})


def http_read_location(source_text: str, region: str = "") -> dict:
    """서버의 원문 주소 읽기만(지도·Google 조회 없음). 이미 올라간 공고 다시 수집용."""
    return _post_hook({"read_address": {"source_text": source_text, "location": region}}, {})


# 테스트는 이 값을 바꿔 네트워크 없이 판정을 넣는다.
PRECHECK = http_precheck
READ_LOCATION = http_read_location


def http_read_poster(url: str) -> str | None:
    """포스터 글자 읽기(등록 뒤 판독과 같은 판독기 scripts/ocr/read-poster.mjs). 실패하면 None."""
    import subprocess
    import tempfile
    got = DOWNLOAD_IMAGE(url)
    if not got:
        return None
    with tempfile.NamedTemporaryFile(suffix="." + _IMAGE_TYPES[got[1]]) as f:
        f.write(got[0])
        f.flush()
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        try:
            res = subprocess.run(["node", "scripts/ocr/read-poster.mjs", f.name], cwd=root, capture_output=True, text=True, timeout=90)
        except (OSError, subprocess.TimeoutExpired):
            return None
    return res.stdout if res.returncode == 0 else None


READ_POSTER = http_read_poster


def require_location(job: dict) -> dict:
    """수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선). 못 찾으면 등록하지 않는다(LocationNotFound).
    찾으면 서버가 확인에 쓴 위치 글자(원문에서 읽은 주소 + 지역)를 공고 위치로 쓴다(주소 칸이 있는 소스는 그대로).
    회사 이름(Lee 2026-11-07): 서버가 원문에서 읽고, 못 찾으면 포스터 글자를 읽어 다시 묻는다. 그래도 없으면 등록하지 않는다.
    포스터 판독 실패는 "회사 이름 없음"과 구분한다(poster_read_failed — 등록하지 않았으니 다음 수집 때 다시 시도된다)."""
    verdict = PRECHECK(job) or {}
    if verdict.get("reason") == "no_company_text":
        posters = [x for x in (job.get("images") or []) if isinstance(x, str) and x.startswith("https://")][:1]
        if posters:
            text = READ_POSTER(posters[0])
            if text is None:
                raise LocationNotFound("location_precheck_failed: poster_read_failed")
            job["_poster_text"] = text
            verdict = PRECHECK(job) or {}
    if verdict.get("findable") is not True:
        reason = str(verdict.get("reason") or "not_found")
        who = str(verdict.get("company") or "").strip()
        if reason in DEFERRED_REASONS:
            raise LocationDeferred(f"location_precheck_held: {reason}" + (f" (회사: {who[:60]})" if who else ""))
        raise LocationNotFound(f"location_precheck_failed: {reason}" + (f" (회사: {who[:60]})" if who else ""))
    checked = str(verdict.get("location") or "").strip()
    if checked and not _work_addresses(job):
        job["location"] = checked
    if str(verdict.get("company") or "").strip():
        job["company"] = str(verdict["company"]).strip()
    if verdict.get("agency") is True:
        job["recruitment_type"] = "agency"  # 공고 '채용 형태' 칸(원래 칸, 화면 "Qua công ty cung ứng") — Lee 2026-11-07 같은 내용은 한 칸에만
        if str(verdict.get("workplace_key") or "").strip():
            job["agency_workplace_key"] = str(verdict["workplace_key"]).strip()[:120]  # 실제 근무 공장·공단(중복 판정에만)
    return verdict


# 페이스북 사진을 우리 저장소로 복사(Lee 2026-11-07 "페북에 올라온 건 그냥 쓴다"). 화면은 우리 저장소 사진만 쓰고(10-06 결정,
# 출처 사이트 노출 금지) 페이스북 사진 주소는 며칠 뒤 만료된다. 페이스북 사진(fbcdn.net)만 복사한다 — 다른 출처 사이트 그림은
# 복사하지 않는다(출처 사이트 기본 로고 노출 방지). 복사 실패는 등록을 막지 않는다(그 공고는 로고 찾기·공용 사진으로).
IMAGE_BUCKET = "job-images"
_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _is_facebook_image(url: str) -> bool:
    try:
        host = (urllib.parse.urlsplit(url).hostname or "").lower()
    except ValueError:
        return False
    return url.startswith("https://") and (host == "fbcdn.net" or host.endswith(".fbcdn.net"))


def http_download_image(url: str) -> tuple[bytes, str] | None:
    req = urllib.request.Request(url, headers={"user-agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:  # noqa: S310 — 페이스북 사진 주소만(_is_facebook_image)
            ctype = (res.headers.get("content-type") or "").split(";")[0].strip().lower()
            data = res.read(_MAX_IMAGE_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    if ctype not in _IMAGE_TYPES or not data or len(data) > _MAX_IMAGE_BYTES:
        return None
    return data, ctype


DOWNLOAD_IMAGE = http_download_image


def store_facebook_images(client, job: dict, limit: int = 5) -> int:
    """job의 페이스북 사진(최대 limit장)을 우리 저장소(job-images/facebook/<내용 지문>.<확장자>)로 복사하고
    images·image_url을 우리 저장소 경로로 바꾼다. 복사한 장수를 돌려준다. 하나라도 실패하면 원래 값 그대로 둔다."""
    images = [x for x in (job.get("images") or []) if isinstance(x, str)]
    if not images or not all(_is_facebook_image(x) for x in images):
        return 0
    stored: list[str] = []
    for url in images[:limit]:
        got = DOWNLOAD_IMAGE(url)
        if not got:
            return 0
        data, ctype = got
        path = f"facebook/{hashlib.sha256(data).hexdigest()[:32]}.{_IMAGE_TYPES[ctype]}"
        try:
            client.storage.from_(IMAGE_BUCKET).upload(path, data, {"content-type": ctype, "upsert": "true"})
        except Exception:  # noqa: BLE001 — 저장 실패는 등록을 막지 않음
            return 0
        stored.append(path)
    base = os.getenv("SUPABASE_URL", "https://edhuesdnuxlbcfephutq.supabase.co").rstrip("/")
    job["images"] = stored
    job["image_url"] = f"{base}/storage/v1/object/public/{IMAGE_BUCKET}/{stored[0]}"
    return len(stored)


def _hold_name(job: dict) -> str:
    key = str(job.get("source_url") or "") or json.dumps([job.get("source"), job.get("source_id"), job.get("title"),
                                                           job.get("company"), job.get("source_text")], ensure_ascii=False, default=str)
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hold_job(client, job: dict, reason: str) -> None:
    """확인 못 한 새 공고를 보류함에 넣는다(지우지 않음, 같은 공고는 한 줄). 저장 실패는 수집을 멈추지 않는다(다음 수집 때 다시 만난다)."""
    if job.get("admin_hidden") is True:
        return  # 검증 저장(verify_write)은 보류하지 않는다 — 재시도가 숨김 처리를 건너뛰게 되므로
    payload = {k: _json_safe(v) for k, v in job.items() if not k.startswith("_")}
    try:
        client.table("research_artifacts").upsert(
            {"kind": HOLD_KIND, "name": _hold_name(job), "payload": payload,
             "meta": {"status": "held", "reason": reason, "held_at": _now(), "attempts": 0}},
            on_conflict="kind,name").execute()
    except Exception:  # noqa: BLE001
        print("    ⚠️  보류함 저장 실패 — 다음 수집 때 다시 확인")


_HOLDS_RETRIED = False


def retry_held(client, limit: int = HOLD_RETRY_PER_RUN) -> dict:
    """보류함의 공고를 다시 확인한다(수집 실행마다 한 번, 최대 limit건). 줄은 지우지 않고 상태만 바꾼다:
    registered(등록됨) / rejected(못 찾음 — 수집 안 함) / expired(14일 넘음) / 그대로 held(아직 한도 초과).
    첫 건이 또 한도 초과면 그 실행에서는 더 묻지 않는다(한도를 헛되이 쓰지 않게)."""
    counts = {"registered": 0, "rejected": 0, "held": 0, "expired": 0}
    try:
        rows = (client.table("research_artifacts").select("name,payload,meta").eq("kind", HOLD_KIND)
                .eq("meta->>status", "held").order("created_at").limit(limit).execute().data) or []
    except Exception:  # noqa: BLE001
        return counts
    for row in rows:
        meta = dict(row.get("meta") or {})
        meta["attempts"] = int(meta.get("attempts") or 0) + 1
        meta["retried_at"] = _now()
        held_at = str(meta.get("held_at") or "")
        try:
            old = (datetime.now(timezone.utc) - datetime.fromisoformat(held_at)).days >= HOLD_MAX_DAYS if held_at else False
        except ValueError:
            old = False
        stop = False
        if old:
            meta["status"] = "expired"
        else:
            try:
                meta["job_id"] = _ingest_new(client, dict(row.get("payload") or {}))
                meta["status"] = "registered"
            except LocationDeferred as exc:
                meta["reason"] = str(exc).split("location_precheck_held:", 1)[-1].strip()[:80]
                stop = True
            except LocationNotFound as exc:
                meta["status"] = "rejected"
                meta["reason"] = str(exc).split("location_precheck_failed:", 1)[-1].strip()[:80]
            except Exception as exc:  # noqa: BLE001 — 입구 규칙 거부는 기록, 그 밖의 오류(네트워크 등)는 보류 유지하고 이번엔 멈춤
                from source_fields import rule_code
                code = rule_code(exc)
                if code:
                    meta["status"] = "rejected"
                    meta["reason"] = code[:80]
                else:
                    meta["reason"] = "retry_error"
                    stop = True
        counts[meta.get("status", "held")] += 1
        try:
            client.table("research_artifacts").update({"meta": meta}).eq("kind", HOLD_KIND).eq("name", row["name"]).execute()
        except Exception:  # noqa: BLE001
            pass
        if stop:
            break
    if any(counts.values()):
        print(f"  ⏸️  보류 공고 다시 확인: 등록 {counts['registered']} · 못 찾음 {counts['rejected']} · 아직 보류 {counts['held']} · 기간 지남 {counts['expired']}")
    return counts


def _ingest_new(client, job: dict) -> int:
    require_location(job)
    store_facebook_images(client, job)
    return _call_gateway(client, job)


def _call_gateway(client, job: dict, *, job_id: int | None = None, update_fields: list[str] | None = None) -> int:
    result = client.rpc("ingest_job", {"p": build_payload(job, job_id=job_id, update_fields=update_fields)}).execute()
    if not isinstance(result.data, int) or result.data <= 0:
        raise RuntimeError(f"ingest_job이 공고 번호를 돌려주지 않음: {result.data!r}")
    return result.data


def ingest_job(client, job: dict, *, job_id: int | None = None, update_fields: list[str] | None = None) -> int:
    """입구를 불러 공고 번호를 돌려받는다(새 공고·같은 공고·다시 수집 모두 같은 함수).
    새 공고는 먼저 위치를 찾을 수 있는지 확인하고, 못 찾으면 등록하지 않는다(이미 있는 공고 다시 수집은 그대로).
    지금 확인 못 하면(Google 한도 초과 등) 버리지 않고 보류함에 넣고, 다음 수집 실행 때 먼저 다시 확인한다."""
    global _HOLDS_RETRIED
    existing = job_id is not None or update_fields is not None or job.get("job_id") is not None or job.get("refresh")
    if existing:
        return _call_gateway(client, job, job_id=job_id, update_fields=update_fields)
    if not _HOLDS_RETRIED:
        _HOLDS_RETRIED = True
        retry_held(client)
    try:
        return _ingest_new(client, job)
    except LocationDeferred as exc:
        hold_job(client, job, str(exc).split("location_precheck_held:", 1)[-1].strip()[:80])
        raise
