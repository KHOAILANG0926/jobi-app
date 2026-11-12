"""다시 처리 전후 지도 핀 비교 (2026-11-12 Lee "이런 거는 어떻게 고치냐").

2026-11-11~12 KRIK 5992·MediaMart 5994 다시 처리에서 같은 매장 핀 2개, 다시 처리 뒤 핀 빠짐이 운영에서야 보였다.
다시 처리 전에 핀을 적어 두고(snapshot), 끝난 뒤 다시 읽어 비교한다(problems):
 - 있던 핀이 사라짐(핀 수 감소) — 위치 줄을 다시 보낼 때 찾은 핀이 지워진 경우
 - 한 공고 안에 같은 좌표 핀 2개 — 같은 매장이 두 줄로 들어간 경우
문제가 있으면 대기열 결과에 location_regression으로 남겨 바로 보이게 한다(공고 공개 상태는 바꾸지 않음).
"""
import re
import unicodedata


def snapshot(supabase, job_id):
    rows = (supabase.table("job_work_locations").select("raw_address,lat,lng")
            .eq("job_id", job_id).execute().data or [])
    return [{"address": r.get("raw_address"), "lat": r.get("lat"), "lng": r.get("lng")} for r in rows]


def _pinned(rows):
    return [(round(float(r["lat"]), 6), round(float(r["lng"]), 6)) for r in rows
            if r.get("lat") is not None and r.get("lng") is not None]


def problems(before, after):
    out = []
    b, a = _pinned(before or []), _pinned(after or [])
    if len(a) < len(b):
        out.append(f"pin_lost:{len(b)}->{len(a)}")
    dup = sorted({p for p in a if a.count(p) > 1})
    if dup:
        out.append("duplicate_pin:" + ",".join(f"{x},{y}" for x, y in dup))
    return out


def merge_store_rows(existing, found):
    """기존 근무지 줄 + 위치 확인이 찾은 매장 → DB로 보낼 근무지 줄(바꿀 게 없으면 []).
    실제 공고(KRIK 5992·MediaMart 5994)로 test_refresh_store_rows.py에서 먼저 돌려 본다(2026-11-12)."""
    # DB의 admin_location_key와 같은 방식(악센트·đ 제거, 구두점·공백을 한 칸으로, 소문자)으로 같은 주소를 가린다.
    def key(a):
        s = unicodedata.normalize("NFD", str(a or "")).replace("đ", "d").replace("Đ", "D")
        s = "".join(c for c in s if not unicodedata.combining(c))
        return re.sub(r"[\W_]+", " ", s.lower()).strip()
    # 같은 매장 = 한 주소가 다른 주소를 낱말 단위로 통째로 포함(addressReader.sameStore와 같은 규칙).
    # 기존 줄은 지역을 덧붙여 저장돼("…, TP. Bắc Ninh, Bắc Ninh") 글자가 완전히 같지 않다(2026-11-11 5992·5994 같은 매장 핀 2개).
    def same(a, b):
        return f" {a} " in f" {b} " or f" {b} " in f" {a} "
    # 기존 줄은 주소만 보낸다 — 확정(admin)·검증(exact) 핀은 DB 쓰기 함수가 그대로 지키고, 대략 핀은 위치 찾기가 저장된 결과로 다시 붙인다.
    # 기존 줄끼리 같은 매장이 두 번 있으면(예전 다시 처리 결과) 앞의 것만 남긴다 — DB 입구가 빠진 줄을 지운다.
    # 같은 매장이 겹치면 관리자 확정 → 검증된 줄(location_verified) → 좌표 있는 줄 → 앞 줄 순으로 남긴다(Codex #718: 검증 핀 삭제 방지).
    # 관리자 확정(admin_confirmed)·확정 재사용(auto_reuse)은 DB 쓰기 함수가 지키는 근거라 가장 먼저 남긴다.
    def rank(r):
        return ((2 if r.get("point_authority") in ("admin_confirmed", "auto_reuse") else 0)
                + (1 if r.get("location_verified") else 0)
                + (0.5 if r.get("lat") is not None and r.get("lng") is not None else 0))
    keep, have = [], []
    for r in existing:
        k = key(r.get("raw_address"))
        if not k:
            continue
        i = next((n for n, h in enumerate(have) if same(k, h)), None)
        if i is None:
            have.append(k)
            keep.append(r)
        elif rank(r) > rank(keep[i]):
            have[i] = k
            keep[i] = r
    keep = [{"raw_address": r["raw_address"]} for r in keep]
    added = []
    for a in found:
        if not any(same(key(a), h) for h in have):
            have.append(key(a))
            added.append({"raw_address": a})
    if added or len(keep) < sum(1 for r in existing if r.get("raw_address")):
        return keep + added
    return []
