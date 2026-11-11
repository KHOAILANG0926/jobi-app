"""수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선) — 크롤러 등록 입구 시험. 네트워크 없이 판정을 넣는다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ingest_gateway as g  # noqa: E402
from source_fields import rule_code  # noqa: E402


class Client:
    def __init__(self):
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return type("Q", (), {"execute": lambda _s: type("R", (), {"data": 77})()})()

    def table(self, name):  # 보류함(가짜, 매번 빈 저장소) — 이 시험들은 입구 판정만 본다
        return HoldClient().table(name)


def run():
    job = {"title": "Công nhân", "company": "NEW TEAM ROBOTICS VIETNAM", "location": "Bắc Ninh",
           "work_locations": [{"raw_address": "NX 2-2, KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh"}, {"x": 1}, "bad"]}
    seen = []
    g.PRECHECK = lambda j: (seen.append(g.precheck_input(j)), {"findable": True, "reason": "google_company_place"})[1]
    c = Client()
    assert g.ingest_job(c, job) == 77 and len(c.calls) == 1, "찾을 수 있으면 등록"
    assert seen[0]["addresses"] == ["NX 2-2, KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh"] and seen[0]["company"] == "NEW TEAM ROBOTICS VIETNAM", seen

    assert c.calls[0][1]["p"]["location"] == "Bắc Ninh", "주소 칸이 있는 소스는 위치 글자를 바꾸지 않는다"

    # 2026-11-07 주소 읽기 한 곳: 주소 칸이 없는 소스(페이스북)는 원문을 보내고, 서버가 읽은 "주소, 지역"을 위치로 저장
    fb = {"title": "Tài xế", "company": "NETCO POST", "location": "Bắc Ninh", "source_text": "📍 Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh"}
    seen.clear()
    g.PRECHECK = lambda j: (seen.append(g.precheck_input(j)), {"findable": True, "location": "Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh, Bắc Ninh"})[1]
    c = Client()
    assert g.ingest_job(c, fb) == 77 and seen[0]["source_text"] == fb["source_text"] and seen[0]["addresses"] == [], seen
    assert c.calls[0][1]["p"]["location"] == "Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh, Bắc Ninh", c.calls
    assert "work_locations" not in c.calls[0][1]["p"], "매장 한 곳이면 근무지 줄을 따로 넣지 않는다"

    # 2026-11-11 Lee 매장 여러 곳(KRIK): 서버가 읽은 매장마다 근무지 줄로 등록(새 공고만)
    krik_src = {"title": "Bán hàng", "company": "KRIK", "location": "Bắc Ninh", "source_text": "Địa chỉ: 152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh\n148 Trần Phú - Từ Sơn - Bắc Ninh"}
    krik = dict(krik_src)
    first, second = "152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh, Bắc Ninh", "148 Trần Phú, Từ Sơn, Bắc Ninh, Bắc Ninh"
    g.PRECHECK = lambda j: {"findable": True, "location": first, "stores": [first, second]}
    c = Client()
    assert g.ingest_job(c, krik) == 77
    assert c.calls[0][1]["p"]["work_locations"] == [{"raw_address": first}, {"raw_address": second}], c.calls
    assert c.calls[0][1]["p"]["location"] == first
    # 첫 매장이 위치 글자와 다르면(서버 응답 이상) 근무지 줄을 만들지 않는다
    g.PRECHECK = lambda j: {"findable": True, "location": first, "stores": [second, first]}
    c = Client()
    assert g.ingest_job(c, dict(krik_src)) == 77 and "work_locations" not in c.calls[0][1]["p"]

    g.PRECHECK = lambda j: {"findable": False, "reason": "approximate_only"}
    c = Client()
    try:
        g.ingest_job(c, {"title": "Tuyển gấp", "company": "Cty ABC", "location": "Bắc Ninh"})
        raise AssertionError("못 찾으면 등록하면 안 됨")
    except g.LocationNotFound as exc:
        assert rule_code(exc) == "location_precheck_failed" and "approximate_only" in str(exc), exc
    assert c.calls == [], "못 찾으면 입구를 부르지 않는다(수집 안 함)"

    g.PRECHECK = lambda j: {"findable": False, "reason": "precheck_unavailable"}
    c = Client()
    try:
        g.ingest_job(c, job)
        raise AssertionError("확인 못 하면 등록 안 함")
    except g.LocationNotFound:
        pass
    assert c.calls == [], "확인 서버가 안 되면 등록하지 않는다"

    # 이미 있는 공고 다시 수집·칸 고침은 이 확인을 거치지 않는다(기존 공고는 자동으로 숨기지 않음)
    called = []
    g.PRECHECK = lambda j: called.append(1) or {"findable": False}
    c = Client()
    assert g.ingest_job(c, job, job_id=5438) == 77 and g.ingest_job(c, job, update_fields=["title"]) == 77 \
        and g.ingest_job(c, {**job, "job_id": 5438, "refresh": True}) == 77 and called == [], "기존 공고 다시 수집은 확인 안 함"

    g.PRECHECK = g.http_precheck
    import os
    saved = os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
    try:
        assert g.http_precheck(job)["reason"] == "precheck_not_configured"
        assert g.http_read_location("x").get("location") is None, "키 없으면 읽은 위치 없음"
    finally:
        if saved is not None:
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = saved

    # 2026-11-07 페이스북 사진을 우리 저장소로 복사(위치 확인 통과 뒤, 새 공고만)
    class Storage:
        def __init__(self):
            self.saved = []
        def from_(self, bucket):
            outer = self
            class B:
                def upload(self, path, data, opts):
                    outer.saved.append((bucket, path, opts["content-type"]))
            return B()
    class SClient(Client):
        def __init__(self):
            super().__init__()
            self.storage = Storage()
    g.PRECHECK = lambda j: {"findable": True, "location": "Bắc Ninh"}
    g.DOWNLOAD_IMAGE = lambda url: (b"img-" + url.encode(), "image/jpeg")
    c = SClient()
    fb_images = ["https://scontent.fhan2-1.fna.fbcdn.net/v/a.jpg?x=1", "https://scontent.fhan2-1.fna.fbcdn.net/v/b.jpg"]
    fbjob = {"title": "x", "company": "A", "location": "Bắc Ninh", "source_text": "t",
             "images": ["https://scontent.fhan2-1.fna.fbcdn.net/v/a.jpg?x=1", "https://scontent.fhan2-1.fna.fbcdn.net/v/b.jpg"]}
    assert g.ingest_job(c, fbjob) == 77
    sent = c.calls[0][1]["p"]
    assert all(p.startswith("facebook/") and p.endswith(".jpg") for p in sent["images"]) and len(c.storage.saved) == 2, sent
    assert sent["image_url"].endswith("/storage/v1/object/public/job-images/" + sent["images"][0]), sent["image_url"]
    # 다른 출처 사이트 그림은 복사하지 않는다(10-06 출처 노출 금지)
    c = SClient()
    other = {**fbjob, "images": ["https://cdn.vieclam24h.vn/logo.png"]}
    g.ingest_job(c, other)
    assert c.storage.saved == [] and c.calls[0][1]["p"]["images"] == ["https://cdn.vieclam24h.vn/logo.png"]
    # 내려받기 실패 → 원래 값 그대로, 등록은 계속
    g.DOWNLOAD_IMAGE = lambda url: None
    c = SClient()
    g.ingest_job(c, {**fbjob, "images": list(fb_images), "image_url": None})
    assert c.storage.saved == [] and c.calls[0][1]["p"]["images"][0].startswith("https://scontent")

    # 2026-11-07 회사 이름: 원문에 없으면 포스터 글자를 읽어 다시 묻고, 서버가 읽은 이름·소개소 표시를 저장
    calls = []
    def pre(j):
        calls.append(g.precheck_input(j))
        if not j.get("_poster_text"):
            return {"findable": False, "reason": "no_company_text"}
        return {"findable": True, "location": "KCN Quế Võ, Bắc Ninh", "company": "Công ty Nhân lực Minh Anh", "agency": True, "workplace_key": "kcn que vo"}
    g.PRECHECK = pre
    g.READ_POSTER = lambda url: "Công ty Nhân lực Minh Anh tuyển LĐPT KCN Quế Võ"
    c = SClient()
    job = {"title": "x", "company": "Nhà tuyển dụng Facebook", "_company_from_text": True, "location": "", "source_text": "Tuyển gấp",
           "images": ["https://scontent.fhan2-1.fna.fbcdn.net/v/p.jpg"]}
    assert g.ingest_job(c, job) == 77
    assert calls[0]["company"] == "" and calls[1]["poster_text"].startswith("Công ty"), calls
    sent = c.calls[0][1]["p"]
    assert sent["company"] == "Công ty Nhân lực Minh Anh" and sent["recruitment_type"] == "agency" and sent["agency_workplace_key"] == "kcn que vo" and "recruiter_agency" not in sent and "_poster_text" not in sent, sent
    # 포스터 판독 실패는 "회사 이름 없음"과 구분
    g.PRECHECK = lambda j: {"findable": False, "reason": "no_company_text"}
    g.READ_POSTER = lambda url: None
    try:
        g.ingest_job(SClient(), {**job, "images": ["https://scontent.fhan2-1.fna.fbcdn.net/v/p.jpg"]})
        raise AssertionError("must reject")
    except g.LocationNotFound as e:
        assert "poster_read_failed" in str(e), e
    print("test_ingest_gateway: location-first gate passed")


class HoldClient:
    """보류함(research_artifacts)을 흉내 내는 가짜 저장소 — 지우기 기능이 없다(지우면 시험이 실패하도록)."""

    def __init__(self):
        self.rows = {}
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return type("Q", (), {"execute": lambda _s: type("R", (), {"data": 90 + len(self.calls)})()})()

    def table(self, name):
        assert name == "research_artifacts", name
        outer = self

        class T:
            def __init__(self):
                self.op, self.filters, self.data = None, {}, None

            def upsert(self, row, on_conflict=None, ignore_duplicates=False):
                assert on_conflict == "kind,name" and ignore_duplicates is True, "이미 있는 보류 줄은 덮어쓰지 않는다"
                self.op, self.data = "upsert", row
                return self

            def in_(self, k, v):
                self.filters[k] = list(v)
                return self

            def lt(self, k, v):
                self.filters[k + "<"] = v
                return self

            def update(self, data):
                self.op, self.data = "update", data
                return self

            def select(self, _cols):
                self.op = "select"
                return self

            def eq(self, k, v):
                self.filters[k] = v
                return self

            def order(self, c):
                self.filters["order"] = c
                return self

            def limit(self, _n):
                return self

            def execute(self):
                if self.op == "upsert":
                    outer.rows.setdefault(self.data["name"], dict(self.data))
                    return type("R", (), {"data": [self.data]})()
                if self.op == "update":
                    outer.rows[self.filters["name"]]["meta"] = self.data["meta"]
                    return type("R", (), {"data": []})()
                held = [r for r in outer.rows.values() if r["meta"].get("status") in self.filters["meta->>status"]
                        and r["meta"].get("next_at", "") < self.filters["meta->>next_at<"]]
                if self.filters.get("order") == "meta->>next_at":
                    held.sort(key=lambda r: r["meta"].get("next_at", ""))
                return type("R", (), {"data": held})()

        return T()


def run_hold():
    """Lee 2026-11-09: Google 한도 초과는 '위치 없음'과 다르다 — 공고를 버리지 않고 보류, 다음 수집 때 자동으로 다시 확인."""
    g._HOLDS_RETRIED = False
    c = HoldClient()
    g.PRECHECK = lambda j: {"findable": False, "reason": "google_quota"}
    jobs = [{"title": f"Công nhân {i}", "company": f"Cty {i}", "location": "Bắc Ninh", "source": "facebook",
             "source_url": f"https://example.invalid/p/{i}", "source_text": "Tuyển", "_poster_text": "x"} for i in range(3)]
    for job in jobs:
        try:
            g.ingest_job(c, dict(job))
            raise AssertionError("한도 초과면 지금 등록하지 않는다")
        except g.LocationDeferred as exc:
            assert rule_code(exc) == "location_precheck_held" and "google_quota" in str(exc), exc
    assert c.calls == [] and len(c.rows) == 3, "한도 초과 공고 3건은 보류함에, 입구는 부르지 않음"
    assert all(r["meta"]["status"] == "held" and r["meta"]["reason"] == "google_quota" and "_poster_text" not in r["payload"] for r in c.rows.values())
    # 같은 공고가 다시 와도 한 줄(중복 보류 없음)
    try:
        g.ingest_job(c, dict(jobs[0]))
    except g.LocationDeferred:
        pass
    assert len(c.rows) == 3

    # '못 찾음'(Lee 2026-11-09): 공고 목록(입구)에는 넣지 않고 보류함에 비공개 보관(unfound), 7일 뒤 다시 확인
    g.PRECHECK = lambda j: {"findable": False, "reason": "approximate_only"}
    try:
        g.ingest_job(c, {"title": "y", "company": "Cty Y", "location": "Bắc Ninh", "source_url": "https://example.invalid/y"})
        raise AssertionError
    except g.LocationDeferred:
        raise AssertionError("못 찾음은 한도 초과와 구분")
    except g.LocationNotFound as exc:
        assert rule_code(exc) == "location_precheck_failed"
    assert c.calls == [] and len(c.rows) == 4
    y = c.rows[g._hold_name({"source_url": "https://example.invalid/y"})]["meta"]
    assert y["status"] == "unfound" and y["next_at"] > g._now(), y
    # 수집 금지 사유(수수료 소개소·회사 이름 없음)는 보관하지 않는다
    for reason in ("agency_fee", "no_company"):
        g.PRECHECK = lambda j, r=reason: {"findable": False, "reason": r}
        try:
            g.ingest_job(c, {"title": reason, "company": "Z", "location": "Bắc Ninh", "source_url": f"https://example.invalid/{reason}"})
        except g.LocationNotFound:
            pass
    assert len(c.rows) == 4
    # 이미 보류 중인 공고가 다시 수집돼도 재확인 일정을 되돌리지 않는다
    g.PRECHECK = lambda j: {"findable": False, "reason": "google_quota"}
    try:
        g.ingest_job(c, {"title": "y", "company": "Cty Y", "location": "Bắc Ninh", "source_url": "https://example.invalid/y"})
    except g.LocationNotFound:
        pass
    assert c.rows[g._hold_name({"source_url": "https://example.invalid/y"})]["meta"]["status"] == "unfound"

    # 다음 수집 실행: 아직 한도 초과면 첫 건만 묻고 멈춘다(한도 낭비 없음), 줄은 그대로
    g._HOLDS_RETRIED = False
    asked = []
    g.PRECHECK = lambda j: (asked.append(j["title"]), {"findable": False, "reason": "google_quota"})[1]
    out = g.retry_held(c)
    assert len(asked) == 1 and out["held"] == 1 and out["registered"] == 0 and len(c.rows) == 4, (asked, out)

    # 한도가 풀린 실행: 첫 새 공고 전에 보류 공고부터 등록. 하나는 이제 '못 찾음' → rejected 기록(지우지 않음)
    g._HOLDS_RETRIED = False
    def pre(j):
        if j["company"] == "Cty 1":
            return {"findable": False, "reason": "not_found"}
        return {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
    g.PRECHECK = pre
    new_id = g.ingest_job(c, {"title": "Mới", "company": "Cty Mới", "location": "Bắc Ninh", "source_url": "https://example.invalid/new"})
    status = sorted(r["meta"]["status"] for r in c.rows.values())
    assert status == ["registered", "registered", "unfound", "unfound"], status  # Cty 1: 한도 풀린 뒤 못 찾음 → 7일 뒤 다시(비공개)
    assert len(c.calls) == 3 and c.calls[-1][1]["p"]["title"] == "Mới" and new_id > 0, c.calls
    assert all(r["meta"].get("job_id") for r in c.rows.values() if r["meta"]["status"] == "registered")
    assert len(c.rows) == 4, "보류함 줄은 지우지 않는다"

    # 7일 뒤: 다시 확인 — y는 이번엔 찾음 → 같은 입구로 등록, Cty 1은 두 번째도 못 찾음 → rejected(줄은 남음)
    for r in c.rows.values():
        if r["meta"]["status"] == "unfound":
            r["meta"]["next_at"] = "2000-01-01T00:00:00+00:00"
    g.PRECHECK = lambda j: {"findable": False, "reason": "not_found"} if j["company"] == "Cty 1" else {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
    out = g.retry_held(c)
    assert out["registered"] == 1 and out["rejected"] == 1, out
    assert c.calls[-1][1]["p"]["company"] == "Cty Y" and len(c.rows) == 4
    # 끝난 줄(registered·rejected)은 다시 보지 않는다
    before = len(c.calls)
    g.retry_held(c)
    assert len(c.calls) == before
    # 보류 공고도 같은 입구·같은 위치 확인으로만 등록된다(별도 경로 없음)
    assert {p["p"]["company"] for _n, p in c.calls[:2]} == {"Cty 0", "Cty 2"}

    # 검증 저장(숨김) 공고는 보류하지 않는다
    g.PRECHECK = lambda j: {"findable": False, "reason": "precheck_unavailable"}
    c2 = HoldClient()
    try:
        g.ingest_job(c2, {"title": "v", "company": "V", "location": "Hà Nội", "admin_hidden": True, "active": False})
    except g.LocationDeferred:
        pass
    assert c2.rows == {}
    # 검증 저장은 보류 대기열을 처리하지 않는다(다른 공고를 건드리지 않음)
    g._HOLDS_RETRIED = False
    c3 = HoldClient()
    g.PRECHECK = lambda j: {"findable": False, "reason": "not_found"}
    try:
        g.ingest_job(c3, {"title": "w", "company": "W", "location": "Hà Nội", "admin_hidden": True, "active": False})
    except g.LocationNotFound:
        pass
    assert g._HOLDS_RETRIED is False and c3.calls == []
    g._HOLDS_RETRIED = True
    print("test_ingest_gateway: quota hold/retry passed")


def run_poster_hold():
    """Codex #619: 포스터 판독 실패는 그 공고만의 문제 — 보류 대기열의 다른 공고 재확인을 막지 않는다.
    한도 초과(모든 공고에 같음)는 그대로 첫 건에서 멈춘다."""
    c = HoldClient()
    old = "2000-01-01T00:00:00+00:00"
    for i, name in enumerate(["poster", "ok", "ok2"]):
        payload = {"title": name, "company": "" if name == "poster" else f"Cty {name}", "location": "Bắc Ninh",
                   "source_url": f"https://example.invalid/{name}", "images": ["https://example.invalid/p.jpg"] if name == "poster" else []}
        c.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                          "meta": {"status": "held", "reason": "google_quota", "held_at": g._now(), "attempts": 0,
                                                   "next_at": f"2000-01-0{i + 1}T00:00:00+00:00"}}
    saved_read = g.READ_POSTER
    g.READ_POSTER = lambda _url: None  # 포스터 그림을 못 읽음
    g.PRECHECK = lambda j: {"findable": False, "reason": "no_company_text"} if not j.get("company") else {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
    try:
        out = g.retry_held(c)
    finally:
        g.READ_POSTER = saved_read
    st = {r["payload"]["title"]: r["meta"] for r in c.rows.values()}
    assert out["registered"] == 2 and out["held"] == 1, out
    assert st["poster"]["status"] == "held" and st["poster"]["reason"] == "poster_read_failed", st["poster"]
    assert st["ok"]["status"] == "registered" and st["ok2"]["status"] == "registered", st
    assert st["poster"]["next_at"] > old, "미룬 공고는 다음 실행에서 뒤로(다시 볼 때 순서)"
    # 한도 초과는 여전히 첫 건에서 멈춘다
    c2 = HoldClient()
    for i in range(3):
        payload = {"title": f"q{i}", "company": f"Cty q{i}", "location": "Bắc Ninh", "source_url": f"https://example.invalid/q{i}"}
        c2.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                           "meta": {"status": "held", "reason": "google_quota", "held_at": g._now(), "attempts": 0, "next_at": old}}
    asked = []
    g.PRECHECK = lambda j: (asked.append(j["title"]), {"findable": False, "reason": "google_quota"})[1]
    out = g.retry_held(c2)
    assert len(asked) == 1 and out["held"] == 1, (asked, out)
    print("test_ingest_gateway: poster failure does not block other held jobs passed")


def run_hold_without_new_jobs():
    """Codex #619: 새 공고가 없는 수집 실행에서도 보류 공고를 다시 확인한다(수집 입구가 retry_held_once를 부름) — 실행마다 한 번만."""
    c = HoldClient()
    payload = {"title": "h", "company": "Cty H", "location": "Bắc Ninh", "source_url": "https://example.invalid/h"}
    c.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                      "meta": {"status": "held", "reason": "google_quota", "held_at": g._now(), "attempts": 0,
                                               "next_at": "2000-01-01T00:00:00+00:00"}}
    g.PRECHECK = lambda j: {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
    g._HOLDS_RETRIED = False
    out = g.retry_held_once(c)
    assert out and out["registered"] == 1 and len(c.calls) == 1, out
    assert g.retry_held_once(c) is None and len(c.calls) == 1, "같은 실행에서 두 번 돌지 않음"
    # 선택 저장(미리 막음)은 다른 보류 공고를 건드리지 않는다
    c2 = HoldClient()
    c2.rows.update({k: {**v, "meta": {**v["meta"], "status": "held"}} for k, v in c.rows.items()})
    g._HOLDS_RETRIED = True
    assert g.retry_held_once(c2) is None and c2.calls == []
    print("test_ingest_gateway: holds retried even without new jobs passed")


def run_unfound_recheck_fresh():
    """Codex #619: '못 찾음' 7일 뒤 다시 확인은 서버에 recheck 표시를 보내 저장된 Google '없음'을 다시 쓰지 않게 한다.
    한도 초과(held) 다시 확인은 저장 결과를 그대로 써도 된다(recheck 없음)."""
    c = HoldClient()
    for name, status in (("u", "unfound"), ("q", "held")):
        payload = {"title": name, "company": f"Cty {name}", "location": "Bắc Ninh", "source_url": f"https://example.invalid/{name}"}
        c.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                          "meta": {"status": status, "reason": "not_found", "held_at": g._now(), "attempts": 0,
                                                   "next_at": "2000-01-01T00:00:00+00:00"}}
    sent = {}
    g.PRECHECK = lambda j: (sent.__setitem__(j["title"], g.precheck_input(j)["recheck"]), {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"})[1]
    g.retry_held(c)
    assert sent == {"u": True, "q": False}, sent
    assert all("_recheck" not in r["payload"] for r in c.rows.values()), "보류함 원본은 그대로"
    # Codex #619 P2: '못 찾음' 다시 확인이 한도에 막혀 held가 돼도, 한도가 풀린 다음 확인은 여전히 새로 묻는다
    c2 = HoldClient()
    payload = {"title": "r", "company": "Cty r", "location": "Bắc Ninh", "source_url": "https://example.invalid/r"}
    c2.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                      "meta": {"status": "unfound", "reason": "not_found", "held_at": g._now(), "attempts": 0,
                                               "next_at": "2000-01-01T00:00:00+00:00"}}
    flags = []
    g.PRECHECK = lambda j: (flags.append(g.precheck_input(j)["recheck"]), {"findable": False, "reason": "google_quota"})[1]
    g.retry_held(c2)
    g.PRECHECK = lambda j: (flags.append(g.precheck_input(j)["recheck"]), {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"})[1]
    g.retry_held(c2)
    meta = c2.rows[g._hold_name(payload)]["meta"]
    assert flags == [True, True] and meta["status"] == "registered" and "refresh" not in meta, (flags, meta)
    # Codex #619 P1: 보류함 저장이 실패하면 거부(건너뛰기)가 아니라 실패 — 수집기가 본 글로 표시하지 않음
    class BrokenHold(HoldClient):
        def table(self, name):
            t = super().table(name)
            def boom(*_a, **_k):
                raise RuntimeError("storage down")
            t.upsert = boom
            return t
    g._HOLDS_RETRIED = True
    g.PRECHECK = lambda j: {"findable": False, "reason": "google_quota"}
    try:
        g.ingest_job(BrokenHold(), {"title": "b", "company": "Cty b", "location": "Bắc Ninh", "source_url": "https://example.invalid/b"})
        raise AssertionError("must fail")
    except g.LocationNotFound:
        raise AssertionError("저장 실패를 거부로 넘기면 공고를 잃는다")
    except g.HoldStoreError as exc:
        assert rule_code(exc) is None, exc
    # Codex #619: hold=False(TopCV 계열, 등록 뒤 근무지 따로 씀)는 보류함에 넣지 않고 예전처럼 거부만
    hc = HoldClient()
    for reason, err in (("google_quota", g.LocationDeferred), ("not_found", g.LocationNotFound)):
        g.PRECHECK = lambda j, r=reason: {"findable": False, "reason": r}
        try:
            g.ingest_job(hc, {"title": reason, "company": "Cty t", "location": "Bắc Ninh", "source_url": f"https://example.invalid/t/{reason}"}, hold=False)
            raise AssertionError
        except err:
            pass
    assert hc.rows == {} and hc.calls == [], "hold=False → 보류 없음"
    print("test_ingest_gateway: unfound recheck asks Google again passed")


if __name__ == "__main__":
    run()
    run_hold()
    run_poster_hold()
    run_hold_without_new_jobs()
    run_unfound_recheck_fresh()
