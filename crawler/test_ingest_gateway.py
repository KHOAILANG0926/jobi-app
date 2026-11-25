"""수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선) — 크롤러 등록 입구 시험. 네트워크 없이 판정을 넣는다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ingest_gateway as g  # noqa: E402
from source_fields import rule_code  # noqa: E402

# 회사 이름 AI 확인(#872 R)은 아래 run_company_agreement에서 따로 본다. 다른 시험은 '규칙 이름 그대로 동의'로 둔다(네트워크·열쇠 없음).
AGREE_AS_IS = lambda rule, text: {"name": rule, "agreed": True, "reason": "exact"}  # noqa: E731
g.CONFIRM_COMPANY = AGREE_AS_IS


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
    # 2026-11-23 Lee 「지점별 독립 공고」: 지점마다 공고 하나(입구 호출 지점 수만큼), 각 공고의 근무지 줄은 그 지점 하나뿐
    assert len(c.calls) == 2, c.calls
    assert [x[1]["p"]["location"] for x in c.calls] == [first, second], c.calls
    assert [x[1]["p"]["work_locations"] for x in c.calls] == [[{"raw_address": first}], [{"raw_address": second}]], c.calls
    assert [x[1]["p"]["branch_location"] for x in c.calls] == [first, second], "입구가 (원문, 지점 위치) 쌍으로 같은 공고를 판정하도록 지점 위치 식별자를 보낸다"
    assert all(x[1]["p"]["source_text"] == krik_src["source_text"] for x in c.calls), "원문 글자는 지점마다 그대로"
    # 같은 지점 여러 직무는 공고 1개: 직무 칸을 지점 수만큼 나누지 않는다(원문 한 번 → 지점별 공고, 각 공고가 직무 전체를 가짐)
    assert all(x[1]["p"]["title"] == krik_src["title"] for x in c.calls)
    # 첫 매장이 위치 글자와 다르면(서버 응답 이상) 근무지 줄을 만들지 않는다
    g.PRECHECK = lambda j: {"findable": True, "location": first, "stores": [second, first]}
    c = Client()
    assert g.ingest_job(c, dict(krik_src)) == 77 and "work_locations" not in c.calls[0][1]["p"]

    # 2026-11-18 #916(#6255 El Gaucho): 수집기가 따로 쓰던 근무지 줄은 입구와 같은 트랜잭션으로 — 위치 확인 입력(주소)은 그대로, 위치 글자는 서버가 읽은 것
    v24 = {"title": "Phục vụ", "company": "[Nhà Hàng El Gaucho] - Công Ty TNHH Cao Bồi Nam Mỹ", "location": "TP.HCM"}
    rows = [{"raw_address": "Hikari Bình Dương, Phường Bình Dương (Thành phố Thủ Dầu Một | Thị xã Tân Uyên, Bình Dương cũ)", "lat": None, "lng": None}]
    seen.clear()
    g.PRECHECK = lambda j: (seen.append(g.precheck_input(j)), {"findable": True, "location": "Hikari Bình Dương, TP.HCM"})[1]
    c = Client()
    assert g.ingest_job(c, dict(v24), hold=False, work_location_rows=rows) == 77
    assert seen[0]["addresses"] == [], "위치 확인 입력은 예전과 같음(근무지 줄은 확인 뒤에 붙임)"
    assert c.calls[0][1]["p"]["work_locations"] == rows and c.calls[0][1]["p"]["location"] == "Hikari Bình Dương, TP.HCM", c.calls
    # 위치 확인이 매장 여러 곳을 정했으면 그쪽이 먼저
    g.PRECHECK = lambda j: {"findable": True, "location": first, "stores": [first, second]}
    c = Client()
    assert g.ingest_job(c, dict(krik_src), work_location_rows=rows) == 77
    assert [x[1]["p"]["work_locations"] for x in c.calls] == [[{"raw_address": first}], [{"raw_address": second}]], c.calls

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
                    if "payload" in self.data:
                        outer.rows[self.filters["name"]]["payload"] = self.data["payload"]
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
    # 지도 정상화 C: API 장애·한도(provider_failed·provider_quota)도 '못 찾음'이 아니라 보류 사유
    for reason in ("provider_quota", "provider_failed"):
        g.PRECHECK = lambda j, r=reason: {"findable": False, "reason": r}
        try:
            g.ingest_job(hc, {"title": reason, "company": "Cty t", "location": "Bắc Ninh", "source_url": f"https://example.invalid/t2/{reason}"}, hold=False)
            raise AssertionError
        except g.LocationDeferred:
            pass
    assert hc.rows == {} and hc.calls == [], "hold=False → 보류 없음"
    print("test_ingest_gateway: unfound recheck asks Google again passed")


def run_company_agreement():
    """Lee 2026-11-17 #872 R: 원문에서 읽은 회사 이름은 규칙 + AI 3회 동의가 있어야 등록. 못 하면 기존 보류함 경로."""
    g._HOLDS_RETRIED = True  # 이 시험은 새 공고만 본다
    g.PRECHECK = lambda j: {"findable": True, "location": "Kinh Bắc, Bắc Ninh", "company": "JOY THÁI BẮC NINH"}
    fb = {"title": "Phục vụ", "company": "Nhà tuyển dụng Facebook", "_company_from_text": True, "location": "",
          "source_url": "https://example.invalid/joy", "description": "[source:facebook] JOY THÁI",
          "source_text": "JOY THÁI BẮC NINH TUYỂN DỤNG\nJOY THÁI – THAI CUISINE", "_poster_text": "POSTER"}
    asked = []
    # ① 동의(포함 관계) → 짧은 이름으로 등록. AI에는 원문+포스터 글자를 넘긴다.
    #    짧은 이름이면 위치도 그 이름(회사 칸)으로 다시 확인한다 — Google 검색어 = 상세 Google 버튼과 같은 이름(#892 대조)
    sent_company = []
    g.PRECHECK = lambda j: (sent_company.append(g.precheck_input(j)["company"]),
                            {"findable": True, "location": "Kinh Bắc, Bắc Ninh", "company": j["company"] if not j.get("_company_from_text") else "JOY THÁI BẮC NINH"})[1]
    g.CONFIRM_COMPANY = lambda rule, text: (asked.append((rule, text)), {"name": "JOY THÁI", "agreed": True, "reason": "contained"})[1]
    c = HoldClient()
    assert g.ingest_job(c, dict(fb)) > 0
    assert c.calls[0][1]["p"]["company"] == "JOY THÁI" and "_company_from_text" not in c.calls[0][1]["p"], c.calls
    assert asked == [("JOY THÁI BẮC NINH", "JOY THÁI BẮC NINH TUYỂN DỤNG\nJOY THÁI – THAI CUISINE\nPOSTER")], asked
    assert sent_company == ["", "JOY THÁI"], sent_company
    # 짧은 이름으로 다시 찾았는데 못 찾으면 등록하지 않는다(위치 못 찾음과 같은 경로)
    g.PRECHECK = lambda j: {"findable": True, "location": "Bắc Ninh", "company": "JOY THÁI BẮC NINH"} if j.get("_company_from_text") else {"findable": False, "reason": "not_found"}
    c = HoldClient()
    try:
        g.ingest_job(c, dict(fb))
        raise AssertionError("짧은 이름 위치를 못 찾으면 등록하지 않는다")
    except g.LocationNotFound as exc:
        assert "not_found" in str(exc), exc
    assert c.calls == [] and next(iter(c.rows.values()))["meta"]["reason"] == "not_found"
    g.PRECHECK = lambda j: {"findable": True, "location": "Kinh Bắc, Bắc Ninh", "company": "JOY THÁI BẮC NINH"}
    # ② 확정 못 함 → 등록 안 함, 보류함(unfound, 7일 뒤 다시) — 위치 못 찾음과 같은 경로
    g.CONFIRM_COMPANY = lambda rule, text: {"name": "", "agreed": False, "reason": "disagree"}
    c = HoldClient()
    try:
        g.ingest_job(c, dict(fb))
        raise AssertionError("동의 없으면 등록하지 않는다")
    except g.LocationNotFound as exc:
        assert rule_code(exc) == "location_precheck_failed" and "company_unconfirmed" in str(exc) and "disagree" in str(exc), exc
    row = next(iter(c.rows.values()))
    assert c.calls == [] and row["meta"]["status"] == "unfound" and row["meta"]["reason"] == "company_unconfirmed", row
    # ③ AI를 못 부름(열쇠 없음·오류) → 지금 확인 못 함(held, 다음 수집 때 바로)
    g.CONFIRM_COMPANY = lambda rule, text: None
    c = HoldClient()
    try:
        g.ingest_job(c, dict(fb))
        raise AssertionError("AI 확인 못 하면 등록하지 않는다")
    except g.LocationDeferred as exc:
        assert "company_ai_unavailable" in str(exc), exc
    row = next(iter(c.rows.values()))
    assert c.calls == [] and row["meta"]["status"] == "held" and row["meta"]["reason"] == "company_ai_unavailable", row
    # 보류함은 원문 회사 표시를 남긴다 → 다시 확인 때도 서버가 원문에서 회사 이름을 다시 읽는다(회사 칸으로 보내지 않음)
    assert row["payload"]["_company_from_text"] is True and g.precheck_input(row["payload"])["company"] == "", row["payload"]
    assert "_poster_text" not in row["payload"]
    # ④ 보류함 다시 확인: '_' 칸이 빠진 Facebook 공고도 다시 AI 확인을 거친다. AI 확인 실패는 그 공고만 보류(다음 공고 계속)
    seen = []
    g.CONFIRM_COMPANY = lambda rule, text: (seen.append(rule), None if rule == "JOY THÁI BẮC NINH" else {"name": rule, "agreed": True, "reason": "exact"})[1]
    g.PRECHECK = lambda j: {"findable": True, "location": "Bắc Ninh", "company": j["company"] if j["company"] != "Nhà tuyển dụng Facebook" else "JOY THÁI BẮC NINH"}
    c = HoldClient()
    for i, comp in enumerate(["Nhà tuyển dụng Facebook", "CTY ABC"]):
        payload = {**{k: v for k, v in fb.items() if not k.startswith("_")}, "company": comp, "source_url": f"https://example.invalid/r{i}"}
        c.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                          "meta": {"status": "held", "reason": "company_ai_unavailable", "held_at": g._now(), "attempts": 0,
                                                   "next_at": f"2000-01-0{i + 1}T00:00:00+00:00"}}
    out = g.retry_held(c)
    assert seen == ["JOY THÁI BẮC NINH", "CTY ABC"] and out["held"] == 1 and out["registered"] == 1, (seen, out)
    # ⑤ 사이트 회사 칸 공고(TopCV 등)·규칙이 이름을 못 읽은 공고는 AI를 부르지 않는다(기존 규칙 그대로)
    called = []
    g.CONFIRM_COMPANY = lambda rule, text: called.append(rule)
    g.PRECHECK = lambda j: {"findable": True, "location": "Bắc Ninh", "company": "CTY TOPCV"}
    assert g.ingest_job(HoldClient(), {"title": "x", "company": "CTY TOPCV", "location": "Bắc Ninh", "source_url": "https://example.invalid/t"}) > 0
    g.PRECHECK = lambda j: {"findable": True, "location": "Bắc Ninh"}
    assert g.ingest_job(HoldClient(), {**fb, "source_url": "https://example.invalid/n"}) > 0
    assert called == [], called
    # ⑥ 실제 실행기(scripts/ocr/read-company-ai.mjs): 열쇠가 없으면 None(→ 보류)
    import os
    key = os.environ.pop("ANTHROPIC_API_KEY", None)
    try:
        assert g.http_confirm_company("JOY THÁI", "JOY THÁI tuyển") is None
    finally:
        if key is not None:
            os.environ["ANTHROPIC_API_KEY"] = key
    g.CONFIRM_COMPANY = AGREE_AS_IS
    print("test_ingest_gateway: company name agreement (rule + AI x3) passed")


def run_review_hold():
    """판단 보류(Lee 2026-11-22 크롤링 정상화): 부적합이라는 근거가 없고 지금 근거로 판정 못 한 공고는 보류함(review)에 보관하고,
    다시 볼 때마다 지금의 판정 코드로 다시 판정한다 — 허용이면 기존 보류 경로(위치 확인 → 같은 입구)로, 명백한 부적합이면 종결(줄은 남김)."""
    saved_checkers = dict(g.REVIEW_RECHECK)
    g.REVIEW_RECHECK.clear()
    old = "2000-01-01T00:00:00+00:00"
    try:
        def tagged(name, **extra):
            return {"title": name, "company": f"Cty {name}", "location": "Bắc Ninh", "description": "[source:facebook] Tuyển " + name,
                    "source_url": f"https://example.invalid/{name}", **extra}

        # ① 보관: 비공개 보류함에 status review, 첫 재판정은 하루 뒤(같은 줄은 덮어쓰지 않음)
        c = HoldClient()
        g.hold_job(c, tagged("a"), "incomplete_role_evidence", g.REVIEW_STATUS)
        row = c.rows[g._hold_name(tagged("a"))]
        assert row["meta"]["status"] == "review" and row["meta"]["reason"] == "incomplete_role_evidence" and row["meta"]["next_at"] > g._now(), row["meta"]
        assert c.calls == [], "보관만 한다 — 입구(공고 목록)를 부르지 않는다"

        # ② 아직 못 정함: 보류 유지, 하루 뒤로 미룸, 입구 안 부름, 위치 확인(Google)도 안 씀
        row["meta"]["next_at"] = old
        asked = []
        g.PRECHECK = lambda j: asked.append(j) or {"findable": True, "location": "KCN"}
        g.REVIEW_RECHECK["facebook"] = lambda payload: (payload, "still_vague", False)
        out = g.retry_held(c)
        assert out["review"] == 1 and out["registered"] == 0 and c.calls == [] and asked == [], (out, c.calls, asked)
        assert row["meta"]["status"] == "review" and row["meta"]["reason"] == "still_vague" and row["meta"]["next_at"] > g._now(), row["meta"]

        # ③ 명백한 부적합으로 판정이 바뀜: 종결(rejected), 줄은 남음, 입구 안 부름
        row["meta"]["next_at"] = old
        g.REVIEW_RECHECK["facebook"] = lambda payload: (payload, "dedicated_debt_collection", True)
        out = g.retry_held(c)
        assert out["rejected"] == 1 and row["meta"]["status"] == "rejected" and row["meta"]["reason"] == "dedicated_debt_collection" and c.calls == [], (out, row["meta"])
        assert len(c.rows) == 1, "보류함 줄은 지우지 않는다"
        before = len(c.calls)
        g.retry_held(c)
        assert len(c.calls) == before, "끝난 줄은 다시 보지 않는다"

        # ④ 고친 판정 코드가 허용으로 풀고 칸을 다시 읽어 옴: 위치 확인을 거쳐 같은 입구로 등록, 다시 읽은 칸이 입구로 간다
        c = HoldClient()
        g.hold_job(c, tagged("b"), "professional_incentive_sales", g.REVIEW_STATUS)
        (rowb,) = c.rows.values()
        rowb["meta"]["next_at"] = old
        g.REVIEW_RECHECK["facebook"] = lambda payload: ({**payload, "title": "Tuyển b (다시 읽음)"}, None, False)
        g.PRECHECK = lambda j: {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
        out = g.retry_held(c)
        assert out["registered"] == 1 and rowb["meta"]["status"] == "registered" and rowb["meta"].get("job_id"), (out, rowb["meta"])
        assert len(c.calls) == 1 and c.calls[0][0] == "ingest_job" and c.calls[0][1]["p"]["title"] == "Tuyển b (다시 읽음)", c.calls

        # ⑤ 허용으로 풀렸지만 위치 확인이 한도 초과: 기존 위치 보류(held)로 이어지고, 다시 읽은 칸은 보류함 원본에 반영된다
        c = HoldClient()
        g.hold_job(c, tagged("c"), "incomplete_role_evidence", g.REVIEW_STATUS)
        (rowc,) = c.rows.values()
        rowc["meta"]["next_at"] = old
        calls = []
        g.REVIEW_RECHECK["facebook"] = lambda payload: (calls.append(1), {**payload, "title": "Tuyển c (다시 읽음)"})[1], None, False
        g.REVIEW_RECHECK["facebook"] = lambda payload: (calls.append(1) or {**payload, "title": "Tuyển c (다시 읽음)"}, None, False)
        g.PRECHECK = lambda j: {"findable": False, "reason": "google_quota"}
        out = g.retry_held(c)
        assert out["held"] == 1 and c.calls == [] and rowc["meta"]["status"] == "held" and rowc["meta"]["reason"] == "google_quota", (out, rowc["meta"])
        assert rowc["payload"]["title"] == "Tuyển c (다시 읽음)", "다시 읽은 칸이 보류함 원본에 남는다"
        rowc["meta"]["next_at"] = old
        g.PRECHECK = lambda j: {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
        out = g.retry_held(c)
        assert out["registered"] == 1 and len(calls) == 1, "위치 보류로 넘어간 뒤에는 판정을 다시 돌리지 않는다(기존 위치 재시도 그대로)"
        assert c.calls[-1][1]["p"]["title"] == "Tuyển c (다시 읽음)"

        # ⑥ 판정은 보류를 만든 소스의 함수만 한다 — 이 실행에 그 함수가 없으면(예: vieclam24h 수집 실행) review 줄은 아예 건드리지 않는다
        #    (다른 기준으로 대신 풀어 주면 Facebook 직무 불분명·제목 읽기 실패 보류가 기준 없이 등록된다)
        g.REVIEW_RECHECK.clear()
        c = HoldClient()
        g.PRECHECK = lambda j: {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
        g.hold_job(c, tagged("e"), "직무/연락처가 불분명한 일반 모집글", g.REVIEW_STATUS)
        g.hold_job(c, {**tagged("f"), "description": "Tuyển f"}, "x", "held")
        for r in c.rows.values():
            r["meta"]["next_at"] = old
        out = g.retry_held(c, limit=10)
        got = {r["payload"]["title"]: r["meta"]["status"] for r in c.rows.values()}
        assert got == {"e": "review", "f": "registered"}, got
        assert out["review"] == 0 and len(c.calls) == 1, "함수가 없으면 review 줄은 대상에서 빠진다(위치 보류 줄만 처리)"
        assert next(r for r in c.rows.values() if r["payload"]["title"] == "e")["meta"]["attempts"] == 0, "건드리지 않음"
        # 다른 소스 함수만 등록된 실행에서도 그 소스가 아닌 review 줄은 풀리지 않는다
        g.REVIEW_RECHECK["other"] = lambda payload: (payload, None, False)
        g.retry_held(c, limit=10)
        e = next(r for r in c.rows.values() if r["payload"]["title"] == "e")["meta"]
        assert e["status"] == "review" and e["reason"] == "checker_unavailable" and len(c.calls) == 1, e

        # ⑦ 기간이 지난 보류(14일)는 종결(expired), 줄은 남음
        c = HoldClient()
        g.hold_job(c, tagged("d"), "incomplete_role_evidence", g.REVIEW_STATUS)
        (rowd,) = c.rows.values()
        rowd["meta"].update({"next_at": old, "held_at": "2000-01-01T00:00:00+00:00"})
        out = g.retry_held(c)
        assert out["expired"] == 1 and rowd["meta"]["status"] == "expired" and c.calls == [], (out, rowd["meta"])
    finally:
        g.REVIEW_RECHECK.clear()
        g.REVIEW_RECHECK.update(saved_checkers)
    print("test_ingest_gateway: review hold/recheck passed")


class _PoisonClient(HoldClient):
    """제목이 poison인 공고만 입구(rpc)가 계속 DB 오류를 내는 가짜 — 규칙 거부가 아닌 오류(네트워크·DB)."""

    def rpc(self, name, params):
        if params["p"].get("title") == "poison":
            self.calls.append((name, params))
            raise RuntimeError("503 upstream connect error")
        return super().rpc(name, params)


def run_retry_error_does_not_block_queue():
    """보류 공고를 다시 넣다가 규칙 거부가 아닌 오류가 난 줄이 대기열 맨 앞에 그대로 남아 매번 같은 곳에서 멈추면(예전 동작)
    뒤의 정상 공고가 영영 확인되지 않는다 — 오류 줄은 하루 뒤로 미루고, 같은 줄이 RETRY_ERROR_LIMIT번 오류면 종결한다(줄은 남김)."""
    old = "2000-01-01T00:00:00+00:00"
    c = _PoisonClient()
    for i, name in enumerate(["poison", "healthy"]):
        payload = {"title": name, "company": f"Cty {name}", "location": "Bắc Ninh", "source_url": f"https://example.invalid/{name}"}
        c.rows[g._hold_name(payload)] = {"name": g._hold_name(payload), "payload": payload,
                                          "meta": {"status": "held", "reason": "google_quota", "held_at": g._now(), "attempts": 0,
                                                   "next_at": f"2000-01-0{i + 1}T00:00:00+00:00"}}
    g.PRECHECK = lambda j: {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
    by = lambda: {r["payload"]["title"]: r["meta"] for r in c.rows.values()}
    out = g.retry_held(c)
    assert out["registered"] == 0, "첫 실행: 오류 줄에서 멈춘다(DB 문제일 수 있어 헛호출 방지)"
    st = by()
    assert st["poison"]["errors"] == 1 and st["poison"]["reason"] == "retry_error" and st["poison"]["next_at"] > g._now(), st["poison"]
    assert st["poison"]["status"] == "held", "아직 종결 아님 — 보관 내용은 그대로"
    out = g.retry_held(c)
    assert out["registered"] == 1 and by()["healthy"]["status"] == "registered", ("다음 실행에서는 오류 줄이 뒤로 가서 정상 공고가 확인된다", out, by())
    # 같은 줄이 계속 오류: 한도에서 종결(rejected/retry_error_limit), 줄은 남음
    for _ in range(g.RETRY_ERROR_LIMIT):
        for r in c.rows.values():
            if r["payload"]["title"] == "poison" and r["meta"]["status"] == "held":
                r["meta"]["next_at"] = old
        g.retry_held(c)
    st = by()["poison"]
    assert st["status"] == "rejected" and st["reason"] == "retry_error_limit" and st["errors"] == g.RETRY_ERROR_LIMIT, st
    assert len(c.rows) == 2, "보류함 줄은 지우지 않는다"
    print("test_ingest_gateway: retry error does not block the queue passed")


def run_review_status_stored():
    """인식 실패(review, Lee 2026-11-22): 원문·출처·사유가 그대로 같은 보류함에 비공개로 보존된다. 이 상태를 다시 판정·해소하는 로직은 없다(후속 그룹) —
    다시 확인하는 재시도(retry_held)는 review 줄을 건드리지 않고, 입구(공고 목록)도 부르지 않는다."""
    g._HOLDS_RETRIED = False
    c = HoldClient()
    job = {"title": "Tuyển gấp", "company": "Cty A", "location": "Bắc Ninh", "source_url": "https://example.invalid/r",
           "source_text": "Tuyển gấp 5 bạn. Không có số", "description": "[source:facebook] Tuyển gấp 5 bạn"}
    g.hold_job(c, job, "연락처 없음", g.REVIEW_STATUS)
    (row,) = c.rows.values()
    assert row["meta"]["status"] == g.REVIEW_STATUS == "review" and row["meta"]["reason"] == "연락처 없음", row["meta"]
    assert row["payload"]["source_text"] == job["source_text"] and row["payload"]["source_url"] == job["source_url"], "원문·출처 보존"
    assert c.calls == [], "보존만 한다 — 입구(공고 목록)를 부르지 않는다"
    # 같은 글을 다시 보존해도 한 줄(덮어쓰지 않음)
    g.hold_job(c, job, "다른 사유", g.REVIEW_STATUS)
    assert len(c.rows) == 1 and next(iter(c.rows.values()))["meta"]["reason"] == "연락처 없음"
    # 다시 확인(retry_held)은 이 줄을 건드리지 않는다
    row["meta"]["next_at"] = "2000-01-01T00:00:00+00:00"
    g.PRECHECK = lambda j: {"findable": True, "location": "KCN Quế Võ, Bắc Ninh"}
    out = g.retry_held(c)
    assert c.calls == [] and row["meta"]["status"] == "review" and out["registered"] == 0, (out, row["meta"])
    g._HOLDS_RETRIED = True
    print("test_ingest_gateway: review status stored passed")


def run_db_rule_rejection_kept():
    """1-C(Lee 2026-11-22): Facebook 등 hold=True 수집기가 DB 규칙(job_rule_R*·정책 제외)으로 거부당하면 원문·출처·규칙 코드·사유를 보류함에
    rejected(종결, 자동 재시도 없음)로 남긴다. hold=False(TopCV 계열)·이미 있는 공고 다시 수집·규칙 코드 없는 오류는 그대로다."""
    from source_fields import rule_code

    class RejectClient(HoldClient):
        def __init__(self, message):
            super().__init__()
            self.message = message

        def rpc(self, name, params):
            self.calls.append((name, params))
            raise RuntimeError(self.message)

    g._HOLDS_RETRIED = True
    g.PRECHECK = lambda j: {"findable": True, "reason": "google_company_place", "location": "KCN Quế Võ, Bắc Ninh"}
    job = {"title": "Công nhân may", "company": "CTY A", "location": "Bắc Ninh", "source": "facebook",
           "source_url": "https://example.invalid/p/9", "source_text": "ORIGINAL TEXT 9", "description": "[source:facebook] ORIGINAL TEXT 9"}
    # 1) 근거 규칙 거부(R5): 예외는 그대로 올라가고(수집기가 거부로 센다), 보류함에 rejected로 남는다
    c = RejectClient("job_rule_R5: company \"CTY A\" 가 source_text에 같은 글자로 없음")
    try:
        g.ingest_job(c, dict(job))
        raise AssertionError("거부는 예외로 올라가야 한다")
    except RuntimeError as exc:
        assert rule_code(exc) == "job_rule_R5", exc
    (row,) = c.rows.values()
    assert row["kind"] == g.HOLD_KIND and row["meta"]["status"] == "rejected", row["meta"]
    assert row["meta"]["reason"].startswith("job_rule_R5") and "CTY A" in row["meta"]["reason"], row["meta"]
    assert row["payload"]["source_text"] == "ORIGINAL TEXT 9" and row["payload"]["source"] == "facebook" and row["payload"]["source_url"] == job["source_url"], row["payload"]
    # 2) 자동 재시도 없음: 다시 확인(retry_held)은 rejected 줄을 고르지 않는다
    row["meta"]["next_at"] = "2000-01-01T00:00:00+00:00"
    calls_before = len(c.calls)
    out = g.retry_held(c)
    assert len(c.calls) == calls_before and row["meta"]["status"] == "rejected" and sum(out.values()) == 0, (out, row["meta"])
    # 3) 정책 제외도 같은 방식
    c = RejectClient("job_posting_policy_excluded: exclude:dedicated_debt_collection@2026-10-12-v3")
    try:
        g.ingest_job(c, dict(job))
        raise AssertionError
    except RuntimeError as exc:
        assert rule_code(exc) == "job_posting_policy_excluded"
    (row,) = c.rows.values()
    assert row["meta"]["status"] == "rejected" and "dedicated_debt_collection" in row["meta"]["reason"], row["meta"]
    # 4) 보류함 저장 실패 → 거부로 넘기지 않고 HoldStoreError(규칙 코드 없음) — 수집기가 그 글을 '처리 완료'로 표시하지 않는다
    class BrokenRejectClient(RejectClient):
        def table(self, name):
            t = super().table(name)
            def boom(*_a, **_k):
                raise RuntimeError("storage down")
            t.upsert = boom
            return t
    try:
        g.ingest_job(BrokenRejectClient("job_rule_R3: source_text(원문)가 비어 있음"), dict(job))
        raise AssertionError("보관 실패는 예외여야 한다")
    except g.HoldStoreError as exc:
        assert rule_code(exc) is None, exc
    # 5) hold=False(TopCV 계열)·이미 있는 공고 다시 수집·규칙 코드 없는 오류는 보류함에 넣지 않는다(예전 그대로)
    c = RejectClient("job_rule_R5: x")
    try:
        g.ingest_job(c, dict(job), hold=False)
    except RuntimeError:
        pass
    assert c.rows == {}, "hold=False는 보관하지 않는다"
    c = RejectClient("job_rule_R5: x")
    try:
        g.ingest_job(c, dict(job), job_id=5)
    except RuntimeError:
        pass
    assert c.rows == {}, "이미 있는 공고 다시 수집은 보관하지 않는다"
    c = RejectClient("503 upstream connect error")
    try:
        g.ingest_job(c, dict(job))
    except RuntimeError:
        pass
    assert c.rows == {}, "규칙 코드가 없는 오류(DB·네트워크)는 보관하지 않는다 — 수집기가 오류로 세고 다음 실행에서 다시 한다"
    # 6) 위치 거부는 예전 그대로(unfound 보관) — 이번 변경이 건드리지 않는다
    g.PRECHECK = lambda j: {"findable": False, "reason": "not_found"}
    c = RejectClient("never called")
    try:
        g.ingest_job(c, dict(job))
    except g.LocationNotFound:
        pass
    (row,) = c.rows.values()
    assert row["meta"]["status"] == "unfound" and c.calls == [], row["meta"]
    print("test_ingest_gateway: DB rule rejection kept as rejected passed")


def run_site_rows_kept_in_hold():
    """vieclam24h(Lee 2026-11-25): 위치를 못 찾은 새 공고는 수집기가 정한 근무지 줄과 함께 보류함에 보관되고(원문 유실 없음),
    같은 원문의 지점별 공고는 지점마다 다른 보류 줄이다. 다시 확인 때 보관된 근무지 줄로 입구에 간다."""
    g._HOLDS_RETRIED = True
    g.PRECHECK = lambda j: {"findable": False, "reason": "not_found"}
    row_a = {"raw_address": "35/5 Nguyễn Trung Trực, Phường Bến Thành", "normalized_address": "a"}
    job = {"title": "Kỹ thuật viên spa", "company": "Sol Group", "source": "vieclam24h",
           "source_url": "https://example.invalid/x.html", "source_text": "원문 그대로", "description": "[source:vieclam24h] x"}
    c = HoldClient()
    try:
        g.ingest_job(c, dict(job), work_location_rows=[row_a])
    except g.LocationNotFound:
        pass
    (held,) = c.rows.values()
    assert held["meta"]["status"] == "unfound" and c.calls == [], held["meta"]
    assert held["payload"]["work_locations"] == [row_a] and held["payload"]["source_text"] == "원문 그대로", held["payload"]
    c = HoldClient()
    for address in ("A street", "B street"):
        try:
            g.ingest_job(c, {**job, "location": address, "branch_location": address, "work_locations": [{"raw_address": address}]})
        except g.LocationNotFound:
            pass
    assert len(c.rows) == 2, "같은 원문의 지점별 공고는 지점마다 보류 줄"
    assert g._hold_name({"source_url": "u"}) == g._hold_name({"source_url": "u", "branch_location": ""}), "지점 없는 보류 줄 이름은 예전 그대로"
    print("test_ingest_gateway: site rows kept in hold passed")


def run_past_deadline_kept_not_registered():
    """#973(Lee 2026-11-25): 마감일이 분명히 지난 새 공고는 수집원 공통으로 등록하지 않고(위치 확인 전 — Google 한도를 쓰지 않음)
    원문을 보류함에 rejected(deadline_expired, 자동 재시도 없음)로 남긴다. 마감 당일·마감 없음·날짜 아닌 값은 그대로 진행, 기존 공고 다시 수집은 건드리지 않는다."""
    from source_fields import rule_code
    g._HOLDS_RETRIED = True
    asked = []
    g.PRECHECK = lambda j: asked.append(j) or {"findable": False, "reason": "not_found"}
    job = {"title": "Công nhân", "company": "CTY B", "location": "Bắc Ninh", "source": "vieclam24h",
           "source_url": "https://example.invalid/d/1", "source_text": "ORIGINAL 1", "description": "[source:vieclam24h] ORIGINAL 1"}
    from job_criteria import today_vn
    today = today_vn()
    from datetime import date as _d, timedelta as _t
    past = (_d.fromisoformat(today) - _t(days=1)).isoformat()
    c = HoldClient()
    try:
        g.ingest_job(c, {**job, "application_deadline": past}, work_location_rows=[{"raw_address": "A"}])
        raise AssertionError("마감 지난 새 공고는 등록되지 않아야 한다")
    except g.DeadlinePassed as exc:
        assert rule_code(exc) == "deadline_expired", exc
    (row,) = c.rows.values()
    assert row["meta"]["status"] == "rejected" and row["meta"]["reason"] == f"deadline_expired: {past}", row["meta"]
    assert row["payload"]["source_text"] == "ORIGINAL 1" and row["payload"]["work_locations"] == [{"raw_address": "A"}], row["payload"]
    assert asked == [] and c.calls == [], "위치 확인·입구를 부르지 않는다"
    row["meta"]["next_at"] = "2000-01-01T00:00:00+00:00"
    assert sum(g.retry_held(c).values()) == 0 and row["meta"]["status"] == "rejected", "자동 재시도 없음"
    # 마감 당일·마감 없음·날짜 모양이 아닌 값은 거르지 않는다(위치 확인까지 감 — 여기서는 못 찾음으로 끝남)
    for value in (today, None, "", "Thỏa thuận"):
        c = HoldClient()
        try:
            g.ingest_job(c, {**job, "application_deadline": value})
        except g.DeadlinePassed:
            raise AssertionError(f"{value!r}는 마감 지남이 아니다")
        except g.LocationNotFound:
            pass
    assert len(asked) == 4, asked
    # 기존 공고 다시 수집(job_id)은 이 판정을 거치지 않는다(갱신 여부는 수집기 쪽 판단)
    c = HoldClient()
    g.ingest_job(c, {**job, "application_deadline": past}, job_id=7)
    assert c.rows == {} and c.calls and c.calls[0][0] == "ingest_job", c.calls
    print("test_ingest_gateway: past deadline kept, not registered passed")


if __name__ == "__main__":
    run()
    run_hold()
    run_poster_hold()
    run_hold_without_new_jobs()
    run_unfound_recheck_fresh()
    run_company_agreement()
    run_review_hold()
    run_retry_error_does_not_block_queue()
    run_review_status_stored()
    run_db_rule_rejection_kept()
    run_site_rows_kept_in_hold()
    run_past_deadline_kept_not_registered()
