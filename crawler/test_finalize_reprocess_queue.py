"""Facebook 재처리 마무리 판정 회귀 시험(2026-11-13). 네트워크·DB 없이 판정 함수와 run()을 가짜 DB로 돌린다.
과거 실패 8건의 공고 상태(실행 로그 기록)를 그대로 넣어 '기대 결과'를 고정한다 — 실제 재현은 이 시험이 돌려 본 결과다."""
from __future__ import annotations

import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import finalize_reprocess_queue as f  # noqa: E402

# PostgreSQL 16에서 md5(jsonb::text)로 직접 구한 값(images_hash가 DB 게이트와 같은 글자를 만드는지 고정).
assert f.images_hash(["a.jpg"]) == "26ba61092e06539e95c2f3ab7f1869c6"
assert f.images_hash([{"url": "https://x/y.png", "path": "p/q.png", "w": 3}]) == "37d81f7e2f0d0243a9a9cb9890ee9b3a"
assert f.images_hash([{"b": 1, "aa": [{"z": None, "y": True}], "a": "é\n"}]) == "735a1884b357cb5b36216d2273b93649"
assert f.images_hash([]) == "d751713988987e9331980363e24189ce"

IMGS = ["1731-0.png"]
def job(**kw):
    base = {"title": "KRIK TUYỂN DỤNG", "active": True, "admin_hidden": False, "publish_gate_reason": "ok", "ocr_check": {},
            "occupation_code": "5", "images": None, "application_deadline": None}
    base.update(kw)
    return base
PUBLIC_BEFORE = {"before": {"active": True, "admin_hidden": False, "images": 0}}
PRIVATE_BEFORE = {"before": {"active": False, "admin_hidden": False, "images": 0}}
TODAY = "2026-11-13"
def v(current, item=None, pins=None):
    return f.verdict(current, item, pins or [], TODAY)

# 1) 정상 공개(이미지 있음, OCR ok + 해시 일치)
assert v(job(images=IMGS, ocr_check={"status": "ok", "images_hash": f.images_hash(IMGS)})) == ("success", None)
# 2) 이미지 없는 공개 — OCR 결과를 요구하지 않는다(과거 5247·5633·5942·5992·5993·5994·6043)
assert v(job()) == ("success", None)
assert v(job(images=[])) == ("success", None)
# 3) 이미지가 있으면 기존 게이트와 같은 검증을 유지: OCR 없음·불일치·읽기불가·해시 다름은 실패
assert v(job(images=IMGS)) == ("failure", "r7_not_ok:None")
assert v(job(images=IMGS, ocr_check={"status": "mismatch"})) == ("failure", "r7_not_ok:mismatch")
assert v(job(images=IMGS, ocr_check={"status": "unreadable"})) == ("failure", "r7_not_ok:unreadable")
assert v(job(images=IMGS, ocr_check={"status": "ok", "images_hash": f.images_hash(["other.png"])})) == ("failure", "ocr_images_hash_mismatch")
# 4) 정당한 비공개 — 기존 게이트·검사 기록의 실제 사유가 있을 때만 보류(과거 5595·5873·5938)
insp = {"inspect": {"publishable": False, "items": [{"key": "pin", "ok": False}, {"key": "occupation", "ok": False}, {"key": "public", "ok": False}]}}
r = v(job(active=False, ocr_check=insp), PRIVATE_BEFORE)
assert r == ("held", "inspect_failed:pin,occupation"), r
assert v(job(active=False, occupation_code=None), PRIVATE_BEFORE) == ("held", "no_occupation_code")          # 5873: R8
assert v(job(active=False, admin_hidden=True), PRIVATE_BEFORE) == ("held", "admin_hidden")
assert v(job(active=False, publish_gate_reason="no_verified_coordinate"), PRIVATE_BEFORE) == ("held", "publish_gate:no_verified_coordinate")
assert v(job(active=False, application_deadline="2026-11-01"), PRIVATE_BEFORE) == ("held", "deadline_passed")
assert v(job(active=False, images=IMGS, ocr_check={"status": "mismatch"}), PRIVATE_BEFORE) == ("held", "r7_mismatch")
# 5) 사유 불명 비공개 — 재처리 전부터 비공개였다는 사실이나 검사 통과 기록만으로는 보류가 아니다
assert v(job(active=False), PRIVATE_BEFORE) == ("failure", "unexplained_unpublished")
assert v(job(active=False, ocr_check={"inspect": {"publishable": True, "items": []}}), PRIVATE_BEFORE) == ("failure", "unexplained_unpublished")
assert v(job(active=False), None) == ("failure", "unexplained_unpublished")                                    # 전 상태 기록이 없어도 사유 없으면 실패
# 5-1) 과거 실행 43070244676(5994): active는 참인데 admin_hidden이 거짓이 아님 + 전 상태 기록 없음 → 사유를 모르니 실패로 남긴다(보수적)
assert v(job(active=True, admin_hidden=None), None) == ("failure", "unexplained_unpublished")
# 5-2) 검사표 대기(#728 R4, Codex P1): OCR은 다시 공개하지 않고 검사표만 공개한다. 재처리 workflow는 OCR 뒤 검사표를 돌리지 않으므로(검사표는 job-ocr-check가 30분마다),
#      OCR이 정상으로 끝났어도 검사표 표지(inspect_hold·ocr_hold)가 남은 비공개 공고는 '검사표 대기'로 보류한다 — 정상 공고를 실패로 세지 않는다.
ok_ocr = {"status": "ok", "images_hash": f.images_hash(IMGS)}
stale_pass = {"publishable": True, "items": [{"key": "public", "ok": True}]}   # 옛 검사 기록(통과) — 검사표가 다시 돌기 전
assert v(job(active=False, images=IMGS, ocr_check={**ok_ocr, "inspect_hold": True, "inspect": stale_pass}), PRIVATE_BEFORE) == ("held", "awaiting_inspect")
assert v(job(active=False, images=IMGS, ocr_check={**ok_ocr, "ocr_hold": True, "inspect": stale_pass}), PRIVATE_BEFORE) == ("held", "awaiting_inspect")
assert v(job(active=False, images=IMGS, ocr_check={**ok_ocr, "inspect": stale_pass}), PRIVATE_BEFORE) == ("failure", "unexplained_unpublished")   # 표지가 없으면 여전히 사유 불명(실패)
assert v(job(active=False, images=IMGS, ocr_check={"status": "mismatch", "ocr_hold": True}), PRIVATE_BEFORE) == ("held", "r7_mismatch")          # OCR 불일치는 그대로 구체적 사유
assert v(job(active=False, images=IMGS, ocr_check={**ok_ocr, "ocr_hold": True}), PUBLIC_BEFORE) == ("failure", "unpublished_by_reprocess")      # 재처리가 공개를 내린 것은 그대로 실패
assert v(job(active=False, images=IMGS, admin_hidden=True, ocr_check={**ok_ocr, "ocr_hold": True}), PRIVATE_BEFORE) == ("held", "admin_hidden")
assert v(job(active=False, images=IMGS, ocr_check={**ok_ocr, "ocr_hold": True, "inspect": {"publishable": False, "items": [{"key": "pin", "ok": False}]}}), PRIVATE_BEFORE) == ("held", "inspect_failed:pin")
# 6) 공개에서 비공개로 바뀜 — 사유가 있어도 재처리가 내린 것이면 실패
assert v(job(active=False, occupation_code=None), PUBLIC_BEFORE) == ("failure", "unpublished_by_reprocess")
assert v(job(active=False), PUBLIC_BEFORE) == ("failure", "unpublished_by_reprocess")
# 7) 핀 보호(#707·#712)는 그대로: 핀 손실·중복은 공개·보류 어느 쪽이든 실패
assert v(job(), pins=["pin_lost:21.1,105.9"]) == ("failure", "location_regression:pin_lost:21.1,105.9")
assert v(job(active=False, occupation_code=None), PRIVATE_BEFORE, ["duplicate_pin:1,2"])[0] == "failure"
# 8) 제목 이상
assert v(job(title="Vị trí tuyển dụng:")) == ("failure", "title_unverified")
assert v(job(title="")) == ("failure", "title_unverified")

# 9) 실제 실행 경로: 가짜 DB로 f.run()을 돌려 종료 동작과 대기열 기록을 본다(과거 실패 실행의 공고 상태).
class SQ:   # 상태·필터를 지키는 가짜 DB — 여러 번 실행하는 대기열 상태 전이 시험(아래 11)도 같은 것을 쓴다
    def __init__(self, db, name): self.db, self.name, self.filters, self.op, self.payload, self.lo, self.hi = db, name, {}, "select", None, 0, None
    def select(self, *_a): return self
    def eq(self, k, val): self.filters[k] = val; return self
    def order(self, *_a): return self
    def limit(self, n): self.lo, self.hi = 0, n - 1; return self      # 서버처럼 limit·range가 실제로 결과를 자른다(50건 제한 시험, Codex P1)
    def range(self, lo, hi): self.lo, self.hi = lo, hi; return self
    def single(self): self.op = "single"; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def _rows(self): return [r for r in self.db.queue if all(r.get(k) == val for k, val in self.filters.items())]
    def execute(self):
        if self.name == "job_reprocess_queue" and self.op == "select":
            rows = self._rows()
            return types.SimpleNamespace(data=[dict(r) for r in (rows[self.lo:] if self.hi is None else rows[self.lo:self.hi + 1])])
        if self.name == "job_reprocess_queue" and self.op == "update":
            hit = self._rows()
            for r in hit: r.update(self.payload)
            if hit: self.db.updates.append((self.filters.get("id"), self.payload))
            return types.SimpleNamespace(data=[dict(r) for r in hit])
        if self.name == "local_jobs": return types.SimpleNamespace(data=self.db.jobs[self.filters["id"]])
        return types.SimpleNamespace(data=[])   # job_work_locations: 핀 스냅샷은 비어 있음
class DB:
    def __init__(self, queue, jobs): self.queue, self.jobs, self.updates = [{"status": "running", "error": None, **r} for r in queue], jobs, []
    def table(self, name): return SQ(self, name)
def run_with(queue, jobs):
    return run_db(DB(queue, jobs))
def run_db(db):
    sys.modules["crawl_facebook"] = types.SimpleNamespace(supabase=db)
    try:
        f.run()
        return db, None
    except RuntimeError as e:
        return db, str(e)
    finally:
        del sys.modules["crawl_facebook"]

# 과거 실행 43401276858(10개) 상태: 공개 7건(이미지 없음) + 비공개 3건(사유 있음) → 이제 초록
pub = [5247, 5633, 5942, 5992, 5993, 5994, 6043]
jobs = {n: job(title=f"공고 {n}", ocr_check={}) for n in pub}
jobs[5595] = job(title="EAGLEON", active=False, occupation_code=None, ocr_check=insp)
jobs[5873] = job(title="Gia Bình", active=False, occupation_code=None, images=IMGS, ocr_check={"status": "ok", "images_hash": f.images_hash(IMGS), **insp})
jobs[5938] = job(title="THUỐC THÚ Y", active=False, ocr_check=insp)
queue = [{"id": n, "job_id": n, "result": {"pins_before": [], **(PUBLIC_BEFORE if n in pub else PRIVATE_BEFORE)}} for n in jobs]
db, err = run_with(queue, jobs)
assert err is None, err
got = {i: (p["status"], p["error"], p["result"]["verdict"]) for i, p in db.updates}
assert all(got[n] == ("success", None, "success") for n in pub), got
assert got[5595][:2] == ("blocked", "held:no_occupation_code") and got[5873][1] == "held:no_occupation_code" and got[5938][2] == "held", got
assert all(p["result"]["published"] == (n in pub) for n, p in db.updates)

# 실패가 하나라도 섞이면 실행은 빨간불(대기열에는 모두 기록됨)
jobs2 = {1: job(title="OK job"), 2: job(title="Gone", active=False), 3: job(title="Held", active=False, occupation_code=None)}
q2 = [{"id": n, "job_id": n, "result": {"pins_before": [], **(PUBLIC_BEFORE if n == 2 else PRIVATE_BEFORE)}} for n in jobs2]
db2, err2 = run_with(q2, jobs2)
assert err2 == "1 jobs failed title/R7/publication verification", err2
got2 = {i: p["error"] for i, p in db2.updates}
assert got2 == {1: None, 2: "unpublished_by_reprocess", 3: "held:no_occupation_code"}, got2

# 검사표 대기 공고는 대기열에 blocked + held:awaiting_inspect로 남고 실행은 빨간불이 되지 않는다(실제 verdict()·대기열 상태 변경까지)
await_job = job(active=False, images=IMGS, ocr_check={"status": "ok", "images_hash": f.images_hash(IMGS), "inspect_hold": True, "inspect": {"publishable": True, "items": []}})
db4, err4 = run_with([{"id": 11, "job_id": 11, "result": {"pins_before": [], **PRIVATE_BEFORE}}], {11: await_job})
assert err4 is None, err4
assert db4.updates[0][1]["status"] == "blocked" and db4.updates[0][1]["error"] == "held:awaiting_inspect" and db4.updates[0][1]["result"]["verdict"] == "held", db4.updates

# 이미지 있는 공개 공고의 OCR 불일치는 실행 전체를 실패시킨다
db3, err3 = run_with([{"id": 9, "job_id": 9, "result": {"pins_before": []}}], {9: job(images=IMGS, ocr_check={"status": "mismatch"})})
assert err3 and db3.updates[0][1]["error"] == "r7_not_ok:mismatch", (err3, db3.updates)
print("finalize_reprocess_queue: 판정 시험 통과 (정상 공개·이미지 없는 공개·정당한 보류·사유 불명·공개→비공개·OCR 불일치·핀 손실·실행 경로)")

# 10) 재처리 전 상태 기록: reprocess_queue.run()이 refresh 전에 공개 상태·이미지 개수를 result.before에 적는다(DB 구조 변경 없음).
order, rows_state = [], {"active": True, "admin_hidden": False, "images": ["a.png", "b.png"]}
class RQ:
    def __init__(self, name): self.name, self.f, self.op, self.payload = name, {}, "select", None
    def select(self, *_a): return self
    def eq(self, k, val): self.f[k] = val; return self
    def lt(self, *_a): return self
    def order(self, *_a): return self
    def limit(self, *_a): return self
    def single(self): return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def execute(self):
        if self.name == "job_reprocess_queue" and self.op == "select":
            return types.SimpleNamespace(data=[{"id": 1, "job_id": 7, "attempts": 0}] if self.f.get("status") == "pending" else [])
        if self.name == "job_reprocess_queue" and self.op == "update":
            if "result" in self.payload: order.append(("result", self.payload["result"]))
            return types.SimpleNamespace(data=[{"id": 1}])
        if self.name == "local_jobs":
            order.append("read_local_jobs")
            return types.SimpleNamespace(data={**rows_state, "id": 7, "title": "T", "publish_gate_reason": "ok", "ocr_check": {}})
        return types.SimpleNamespace(data=[])
class RDB:
    def table(self, name): return RQ(name)
sys.modules["crawl_facebook"] = types.SimpleNamespace(is_facebook_row=lambda _j: True, supabase=RDB())
sys.modules["refresh_facebook_existing"] = types.SimpleNamespace(refresh_existing=lambda _id: order.append("refresh"))
sys.modules["auto_cutoff"] = types.SimpleNamespace(AUTO_CUTOFF="2026-01-01")
import reprocess_queue as rq  # noqa: E402
rq.run()
assert order.index("refresh") > order.index("read_local_jobs"), order          # 전 상태를 refresh보다 먼저 읽음
res = [x for x in order if isinstance(x, tuple)][0][1]
assert res["before"] == {"active": True, "admin_hidden": False, "images": 2}, res
assert "pins_before" in res
print("reprocess_queue: 재처리 전 상태 기록 시험 통과")

# 11) 대기열 상태 전이(#728 R4, Codex P1): 검사표 대기(blocked + held:awaiting_inspect)는 끝이 아니라 대기다.
#     OCR 불일치 → 비공개 → OCR 정상 복구 → 검사표 대기 → (다음 실행) 검사표 통과로 공개 → 대기열이 최종 success가 되어야 한다.
#     상태·필터를 지키는 가짜 DB로 f.run()을 여러 번 돌린다(재처리 workflow가 30분마다 하는 일).
ok_img = {"status": "ok", "images_hash": f.images_hash(IMGS)}
sjobs = {21: job(title="OCR 복구 뒤 검사표 대기", active=False, images=IMGS, ocr_check={**ok_img, "ocr_hold": True, "inspect": {"publishable": True, "items": []}})}
sq = [{"id": 21, "job_id": 21, "status": "running", "error": None, "result": {"pins_before": [], **PRIVATE_BEFORE}}]
sdb = DB(sq, sjobs)
assert run_db(sdb)[1] is None
sq = sdb.queue
assert (sq[0]["status"], sq[0]["error"]) == ("blocked", "held:awaiting_inspect"), sq[0]                      # 검사표 대기로 기록
assert run_db(sdb)[1] is None and (sq[0]["status"], sq[0]["error"]) == ("blocked", "held:awaiting_inspect")   # 아직 대기 — 그대로(실패·성공 아님)
sjobs[21] = job(title="OCR 복구 뒤 검사표 대기", active=True, images=IMGS, ocr_check={**ok_img, "inspect": {"publishable": True, "items": []}})   # 검사표가 공개
assert run_db(sdb)[1] is None
assert (sq[0]["status"], sq[0]["error"]) == ("success", None), f"검사표가 공개한 뒤에도 대기열이 blocked로 남음: {sq[0]}"
assert sq[0]["result"]["published"] is True and sq[0]["result"]["verdict"] == "success", sq[0]["result"]
# 다른 이유로 막힌 보류(예: 관리자 숨김)는 끝난 상태 — 다시 판정하지 않는다
sjobs[22] = job(title="관리자 숨김", active=False, admin_hidden=True)
sq2 = [{"id": 22, "job_id": 22, "status": "running", "error": None, "result": {"pins_before": [], **PRIVATE_BEFORE}}]
sdb2 = DB(sq2, sjobs); assert run_db(sdb2)[1] is None and (sq2 := sdb2.queue)[0]["error"] == "held:admin_hidden"
sjobs[22] = job(title="관리자 숨김", active=True)
assert run_db(sdb2)[1] is None and sq2[0]["error"] == "held:admin_hidden", "검사표 대기가 아닌 보류는 다시 건드리지 않는다"
# 대기 중 공고가 검사표에서 진짜 실패하면 구체적 사유로 바뀐다
sjobs[23] = job(title="검사 실패", active=False, images=IMGS, ocr_check={**ok_img, "ocr_hold": True})
sq3 = [{"id": 23, "job_id": 23, "status": "running", "error": None, "result": {"pins_before": [], **PRIVATE_BEFORE}}]
sdb3 = DB(sq3, sjobs); assert run_db(sdb3)[1] is None and (sq3 := sdb3.queue)[0]["error"] == "held:awaiting_inspect"
sjobs[23] = job(title="검사 실패", active=False, images=IMGS, ocr_check={**ok_img, "inspect": {"publishable": False, "items": [{"key": "pin", "ok": False}]}})
assert run_db(sdb3)[1] is None and sq3[0]["error"] == "held:inspect_failed:pin", sq3[0]
print("finalize_reprocess_queue: 대기열 상태 전이(검사표 대기 → 공개 success / 실제 실패 사유 / 다른 보류는 그대로) 시험 통과")

# 12) 검사표 대기가 50건을 넘어도(Codex P1, finalize 98행) 앞 50건이 계속 대기 중이면 뒤쪽 공고가 이미 공개돼도 success로 못 가던 것 — 전체를 페이지 단위로 훑는다.
big_jobs, big_q = {}, []
for n in range(100, 151):   # 51건: 앞 50건은 계속 대기, 51번째(150)만 검사표가 공개
    big_jobs[n] = job(title=f"대기 {n}", active=False, images=IMGS, ocr_check={**ok_img, "inspect_hold": True, "inspect": {"publishable": True, "items": []}})
    big_q.append({"id": n, "job_id": n, "status": "blocked", "error": "held:awaiting_inspect", "result": {"pins_before": [], **PRIVATE_BEFORE}})
big_jobs[150] = job(title="대기 150", active=True, images=IMGS, ocr_check={**ok_img, "inspect": {"publishable": True, "items": []}})
bdb = DB(big_q, big_jobs)
assert run_db(bdb)[1] is None
by_id = {r["id"]: r for r in bdb.queue}
assert (by_id[150]["status"], by_id[150]["error"]) == ("success", None), f"51번째 대기 항목이 success로 전이되지 못함: {by_id[150]}"
assert all((by_id[n]["status"], by_id[n]["error"]) == ("blocked", "held:awaiting_inspect") for n in range(100, 150)), "앞 50건은 아직 대기 — 기록 그대로"
assert [i for i, _ in bdb.updates] == [150], bdb.updates   # 대기 중인 앞 50건은 쓰지 않는다(갱신 없음)
# 앞 50건 중 일부가 공개되거나 실제 실패해도 그 항목만 바뀌고 나머지 대기는 유지된다(기존 처리 로직 유지)
big_jobs[103] = job(title="대기 103", active=True, images=IMGS, ocr_check={**ok_img, "inspect": {"publishable": True, "items": []}})
big_jobs[120] = job(title="대기 120", active=False, images=IMGS, ocr_check={**ok_img, "inspect": {"publishable": False, "items": [{"key": "pin", "ok": False}]}})
assert run_db(bdb)[1] is None
by_id = {r["id"]: r for r in bdb.queue}
assert by_id[103]["status"] == "success" and by_id[120]["error"] == "held:inspect_failed:pin", (by_id[103], by_id[120])
assert sum(1 for r in bdb.queue if r["error"] == "held:awaiting_inspect") == 48
print("finalize_reprocess_queue: 검사표 대기 50건 초과 페이지 순회 시험 통과")
