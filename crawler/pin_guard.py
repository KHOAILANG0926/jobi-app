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
    # 손실은 중복을 뺀 좌표 집합으로 비교한다 — 같은 매장 중복 줄을 합친 것은 손실이 아니다(Codex #724). 중복 남음은 아래 duplicate_pin이 따로 잡는다.
    # 개수만 보지 않고 전에 있던 핀마다 뒤에도 가까운(약 50m 안) 핀이 있는지 본다 — 새 매장 핀이 사라진 핀을 가리지 않게(Codex #724).
    gone = sorted({p for p in b if not any(abs(p[0] - q[0]) < 0.0005 and abs(p[1] - q[1]) < 0.0005 for q in a)})
    if gone:
        out.append("pin_lost:" + ",".join(f"{x},{y}" for x, y in gone))
    dup = sorted({p for p in a if a.count(p) > 1})
    if dup:
        out.append("duplicate_pin:" + ",".join(f"{x},{y}" for x, y in dup))
    return out


# DB의 admin_location_key와 같은 방식(악센트·đ 제거, 구두점·공백을 한 칸으로, 소문자)으로 같은 주소를 가린다.
def _key(a):
    s = unicodedata.normalize("NFD", str(a or "")).replace("đ", "d").replace("Đ", "D")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[\W_]+", " ", s.lower()).strip()


# 같은 매장 = 한 주소가 다른 주소를 낱말 단위로 통째로 포함(addressReader.sameStore와 같은 규칙).
# 기존 줄은 지역을 덧붙여 저장돼("…, TP. Bắc Ninh, Bắc Ninh") 글자가 완전히 같지 않다(2026-11-11 5992·5994 같은 매장 핀 2개).
def _same(a, b):
    return f" {a} " in f" {b} " or f" {b} " in f" {a} "


def keeps_confirmed_location(old_location, new_location, rows):
    """다시 수집에서 공고 위치 글자를 그대로 둘지(지도 정상화 W4b, Lee 2026-11-24).
    공고 위치 글자가 바뀌면 DB가 그 글자의 근무지 줄 좌표를 지우고 다시 찾는다(location_private.job_identity_changed → invalidate).
    같은 지점인데 표기(뒤에 지역을 덧붙임)만 다른 글자로 바꾸면 확정 좌표가 사라지므로, 그 경우에만 기존 글자를 둔다:
     - 한쪽이 다른 쪽의 낱말 단위 앞부분이고 짧은 쪽에 번지 숫자가 있을 때(DB 쓰기 함수의 같은 지점 조건과 같음 — 거리 이름만·다른 번지·앞에 글자가 붙은 주소는 다른 지점),
     - 그리고 기존 글자의 근무지 줄이 확정 좌표(관리자 확정·재사용·검증)일 때만.
    그 밖(다른 지점·이전·확정 아님)은 예전처럼 새 글자로 바꾸고 기존 위치 확인 정책을 탄다."""
    old, new = _key(old_location), _key(new_location)
    if not old or not new or old == new:
        return False
    short, long_ = (old, new) if len(old) <= len(new) else (new, old)
    if not (long_ + " ").startswith(short + " ") or not re.search(r"\d", short):
        return False
    return any(_key(r.get("raw_address")) == old and r.get("lat") is not None and r.get("lng") is not None
               and (r.get("location_verified") is True or r.get("point_authority") in ("admin_confirmed", "auto_reuse"))
               for r in (rows or []))


def other_stores(existing, found):
    """기존 근무지 줄과 같은 매장이 아닌 지점(found)만 — 지점별 독립 공고(Lee 2026-11-23)에서 따로 등록할 지점.
    기존 줄이 비어 있으면 found 전부."""
    have = [k for k in (_key(r.get("raw_address")) for r in (existing or [])) if k]
    return [a for a in found if _key(a) and not any(_same(_key(a), h) for h in have)]


def keeps_branch_location(existing, found, new_location):
    """다시 처리에서 위치 글자를 원문의 다른 지점 주소로 바꾸지 않을지(지점별 독립 공고, Lee 2026-11-23 — 같은 글의 다른 지점을 서로의 갱신 대상으로 보지 않는다).
    원문 위치 글자(new_location)는 글의 첫 매장이다. 이 공고가 지점 하나(existing 1줄)만 가지고 그 줄이 이번 글의 한 매장(found)과 같은데
    new_location이 그 줄과 다른 매장이면 이 공고는 다른 지점이다 — 위치 글자를 바꾸면 DB가 이 지점의 확정 좌표를 지운다(2026-11-24 운영 #5992:
    148 Trần Phú 지점 공고가 첫 매장 152 Trần Hưng Đạo로 바뀌어 pin_lost). 같은 매장 판정은 other_stores와 같은 규칙(_same)."""
    rows = existing or []
    if len(rows) != 1 or not new_location or not found:
        return False
    if len(other_stores(rows, found)) == len(found):
        return False  # 이 공고 줄이 이번 글의 어느 매장과도 안 맞음 — 어느 지점인지 모름(기존 동작)
    return bool(other_stores(rows, [new_location]))


def merge_store_rows(existing, found):
    """기존 근무지 줄 + 위치 확인이 찾은 매장 → DB로 보낼 근무지 줄(바꿀 게 없으면 []).
    실제 공고(KRIK 5992·MediaMart 5994)로 test_refresh_store_rows.py에서 먼저 돌려 본다(2026-11-12).
    기존 공고가 여러 지점 줄을 이미 가진 경우(전환 전 legacy)에만 쓴다 — 지점별 독립 공고는 지점 하나만 가진다."""
    key, same = _key, _same
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
