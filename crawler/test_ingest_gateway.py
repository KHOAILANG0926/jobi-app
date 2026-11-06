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
    finally:
        if saved is not None:
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = saved
    print("test_ingest_gateway: location-first gate passed")


if __name__ == "__main__":
    run()
