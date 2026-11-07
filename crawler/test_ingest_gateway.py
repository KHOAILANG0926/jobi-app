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
    print("test_ingest_gateway: location-first gate passed")


if __name__ == "__main__":
    run()
