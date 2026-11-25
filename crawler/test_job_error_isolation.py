"""공고 하나의 오류가 전체 수집을 멈추지 않는지(#872 ②) — 외부 접속 없는 단위 시험.

규칙 거부가 아닌 예상 못 한 오류(DB 5xx·연결 끊김 등)가 공고 1건에서 나도
- 같은 실행의 다른 정상 공고는 계속 저장되고
- 실패한 공고는 '본 글'로 기록되지 않아 다음 실행에서 다시 처리되며(Facebook)
- 실행 결과는 실패(0이 아닌 종료)로 남고
- 연속 3건이면 DB·서버 문제로 보고 그 자리에서 멈춘다(예전처럼 예외).

playwright·supabase·dotenv·httpx·vietnam_provinces는 가짜 모듈로 바꿔 넣어 실제 브라우저·DB·네트워크를 쓰지 않는다.
실행: python -I crawler/test_job_error_isolation.py
"""
from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _stub(name: str, **attrs) -> None:
    mod = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    sys.modules.setdefault(name, mod)


_stub("dotenv", load_dotenv=lambda *a, **k: None)
_stub("playwright")
_stub("playwright.async_api", async_playwright=None)
_stub("playwright_stealth", stealth_async=None)
_stub("supabase", create_client=lambda *a, **k: None)
_stub("httpx", Client=object, HTTPError=Exception, TimeoutException=Exception, get=None, post=None)


class _Prov:
    def __getattr__(self, _):
        return lambda *a, **k: []


_stub("vietnam_provinces", Province=_Prov(), Ward=_Prov(), ProvinceCode=_Prov(), WardCode=_Prov())

import crawl_facebook as fb  # noqa: E402
import crawl_topcv as topcv  # noqa: E402
import source_fields  # noqa: E402


def _job(key: str) -> dict:
    return {"title": f"Tuyển {key}", "fb_post_key": key, "company": "CTY A", "description": "x"}


class FacebookSaveIsolation(unittest.TestCase):
    def setUp(self):
        source_fields.JOB_ERRORS.reset()
        self.patches = [
            mock.patch.object(fb, "supabase", object()),
            mock.patch.object(fb, "missing_required", lambda job: []),
            mock.patch.object(fb, "fetch_existing_facebook_rows", lambda: []),
            mock.patch.object(fb, "filter_new_jobs", lambda jobs, rows: list(jobs)),
            mock.patch.object(fb, "facebook_source_url", lambda key: None),
            mock.patch.object(fb.ingest_gateway, "retry_held_once", lambda sb: None),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        source_fields.JOB_ERRORS.reset()

    def _ingest(self, fail_titles: set[str]):
        calls = []

        def fake(sb, payload):
            calls.append(payload["title"])
            if payload["title"] in fail_titles:
                raise RuntimeError("503 upstream connect error")
            return len(calls)
        return calls, fake

    def test_one_error_does_not_stop_other_jobs(self):
        calls, fake = self._ingest({"Tuyển id:2"})
        with mock.patch.object(fb, "ingest_job", fake):
            saved = fb.save_to_supabase([_job("id:1"), _job("id:2"), _job("id:3")])
        self.assertEqual(calls, ["Tuyển id:1", "Tuyển id:2", "Tuyển id:3"])
        self.assertEqual([r["title"] for r in saved], ["Tuyển id:1", "Tuyển id:3"])
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {"id:2"})

    def test_rule_rejection_still_skipped_not_error(self):
        def fake(sb, payload):
            if payload["title"] == "Tuyển id:1":
                raise RuntimeError("job_rule_R3: no source")
            return 7
        with mock.patch.object(fb, "ingest_job", fake):
            saved = fb.save_to_supabase([_job("id:1"), _job("id:2")])
        self.assertEqual([r["id"] for r in saved], [7])
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), set())

    def test_three_consecutive_errors_stop_run(self):
        calls, fake = self._ingest({"Tuyển id:1", "Tuyển id:2", "Tuyển id:3"})
        with mock.patch.object(fb, "ingest_job", fake):
            with self.assertRaises(RuntimeError):
                fb.save_to_supabase([_job(f"id:{i}") for i in range(1, 6)])
        self.assertEqual(len(calls), 3)  # 4·5번째는 묻지 않는다(DB가 죽었으면 헛호출 안 함)

    def test_success_between_errors_resets_streak(self):
        calls, fake = self._ingest({"Tuyển id:1", "Tuyển id:2", "Tuyển id:4", "Tuyển id:5"})
        with mock.patch.object(fb, "ingest_job", fake):
            saved = fb.save_to_supabase([_job(f"id:{i}") for i in range(1, 6)])
        self.assertEqual([r["title"] for r in saved], ["Tuyển id:3"])
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {"id:1", "id:2", "id:4", "id:5"})

    def test_failed_post_not_recorded_as_seen(self):
        source_fields.JOB_ERRORS.add("t", RuntimeError("x"), key="id:2")
        stats = [{"group": "g", "state": "ok", "final_keys": ["id:1", "id:2", "id:3"]}]
        fb.drop_failed_from_seen(stats)
        self.assertEqual(stats[0]["final_keys"], ["id:1", "id:3"])


class _FakeLedgerClient:
    """보류함(research_artifacts)과 등록 입구(rpc ingest_job)를 흉내 내는 가짜 DB — 게시물 제목에 든 낱말로 입구 거부를 고른다."""

    def __init__(self, reject=None, ledger_fail=False):
        self.reject = reject or {}  # 제목에 든 낱말 → 입구가 내는 오류 메시지
        self.ledger_fail = ledger_fail
        self.ledger = []
        self.registered = []

    def table(self, name):
        outer = self

        class T:
            def upsert(self, row, **_k):
                self.row = row
                return self

            def execute(self):
                if outer.ledger_fail:
                    raise RuntimeError("storage down")
                outer.ledger.append(self.row)
                return types.SimpleNamespace(data=[self.row])
        return T()

    def rpc(self, name, params):
        title = str(params["p"].get("title") or "")
        for word, message in self.reject.items():
            if word in title:
                raise RuntimeError(message)
        self.registered.append(title)
        return types.SimpleNamespace(execute=lambda: types.SimpleNamespace(data=800 + len(self.registered)))


def _fb_post(key):
    return {"title": f"Tuyển công nhân {key}", "fb_post_key": key, "company": "CTY A", "employer_phone": "0912345678",
            "description": f"[source:facebook] Tuyển công nhân. LH 0912345678 ({key})", "source_text": f"ORIGINAL TEXT {key}",
            "location": "Bắc Ninh", "source": "facebook", "is_local_priority": True}


class FacebookDbRuleRejectionKept(unittest.TestCase):
    """1-C(Lee 2026-11-22): 위치는 찾았는데 DB 규칙이 거부한 Facebook 글은 원문·출처·규칙 코드·사유를 보류함에 rejected로 남기고(자동 재시도 없음),
    보관에 실패하면 '본 글'로 기록하지 않아 다음 수집에서 다시 처리한다. 일반 수집·선택 저장 두 길 모두."""

    def setUp(self):
        source_fields.JOB_ERRORS.reset()
        self.seen = {}
        patches = [
            mock.patch.object(fb, "missing_required", lambda job: []),
            mock.patch.object(fb, "fetch_existing_facebook_rows", lambda *a, **k: []),
            mock.patch.object(fb, "filter_new_jobs", lambda jobs, rows: list(jobs)),
            mock.patch.object(fb, "facebook_source_url", lambda key: f"https://example.invalid/{key}"),
            mock.patch.object(fb.ingest_gateway, "retry_held_once", lambda sb: None),
            mock.patch.object(fb.ingest_gateway, "PRECHECK", lambda j: {"findable": True, "reason": "google_company_place", "location": "KCN Quế Võ, Bắc Ninh"}),
            mock.patch.object(fb, "save_seen_state", lambda state, gs: self.seen.setdefault("keys", list(gs[0]["final_keys"]))),
            mock.patch.object(fb, "hold_review_posts", lambda gs: 0),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(source_fields.JOB_ERRORS.reset)

    def _collect(self, client, posts):
        stats = [{"group": "g", "state": "ok", "final_keys": [p["fb_post_key"] for p in posts], "held_jobs": []}]
        with mock.patch.object(fb, "supabase", client):
            saved = fb.save_and_mark_seen(posts, {}, stats)
        return saved

    def test_collection_keeps_a_rule_rejected_post_and_finishes_it(self):
        client = _FakeLedgerClient(reject={"id:1": 'job_rule_R5: company "CTY A" 가 source_text에 같은 글자로 없음'})
        saved = self._collect(client, [_fb_post("id:1"), _fb_post("id:2")])
        self.assertEqual([r["title"] for r in saved], ["Tuyển công nhân id:2"], "거부된 글만 빠지고 다른 글은 등록")
        (row,) = client.ledger
        self.assertEqual(row["kind"], "location-hold")
        self.assertEqual(row["meta"]["status"], "rejected", "종결 상태 — 자동 재시도 없음")
        self.assertTrue(row["meta"]["reason"].startswith("job_rule_R5"), row["meta"]["reason"])
        self.assertEqual(row["payload"]["source_text"], "ORIGINAL TEXT id:1", "원문 보존")
        self.assertEqual(row["payload"]["source"], "facebook")
        self.assertTrue(row["payload"]["source_url"].endswith("id:1"), "출처 보존")
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), set())
        self.assertEqual(self.seen["keys"], ["id:1", "id:2"], "보관에 성공했으니 처리 완료로 기록")

    def test_policy_exclusion_is_kept_as_rejected_too(self):
        client = _FakeLedgerClient(reject={"id:1": "job_posting_policy_excluded: exclude:dedicated_debt_collection@2026-10-12-v3"})
        self._collect(client, [_fb_post("id:1")])
        (row,) = client.ledger
        self.assertEqual(row["meta"]["status"], "rejected")
        self.assertIn("dedicated_debt_collection", row["meta"]["reason"])

    def test_failed_keeping_does_not_mark_the_post_finished(self):
        client = _FakeLedgerClient(reject={"id:1": "job_rule_R3: source_text(원문)가 비어 있음"}, ledger_fail=True)
        saved = self._collect(client, [_fb_post("id:1"), _fb_post("id:2")])
        self.assertEqual([r["title"] for r in saved], ["Tuyển công nhân id:2"])
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {"id:1"}, "보관 실패는 규칙 거부가 아니라 오류로 센다")
        self.assertEqual(self.seen["keys"], ["id:2"], "보관 못 한 글은 '본 글'에서 빠져 다음 수집에서 다시 처리된다")

    def test_selected_save_keeps_the_rejected_post_and_reports_unfinished_when_keeping_fails(self):
        for ledger_fail, want_code in ((False, 0), (True, 1)):
            source_fields.JOB_ERRORS.reset()
            client = _FakeLedgerClient(reject={"": 'job_rule_R5: company "CTY ABC" 가 source_text에 같은 글자로 없음'}, ledger_fail=ledger_fail)
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "facebook_dryrun.json"
                _artifact([_read(NORMAL_POST, "id:1")], [], path)
                out = io.StringIO()
                with mock.patch.object(fb, "supabase", client), contextlib.redirect_stdout(out), \
                        mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": "CTY ABC"}), \
                        mock.patch.object(fb.ingest_gateway, "CONFIRM_COMPANY", lambda r, t: {"name": r, "agreed": True}):
                    code = fb.save_selected_from_dryrun(str(path), ["id:1"], 2)
            self.assertEqual(code, want_code, out.getvalue())
            self.assertEqual(len(client.ledger), 0 if ledger_fail else 1)
            if not ledger_fail:
                self.assertEqual(client.ledger[0]["meta"]["status"], "rejected")
                self.assertTrue(client.ledger[0]["payload"]["source_text"], "원문 보존")
            self.assertEqual(self.seen, {}, "수동 선택 저장은 '본 글' 기록을 만들지 않는다")


class FacebookRetryNextRun(unittest.TestCase):
    """실패 공고가 다음 실행에서 누락되지 않는지 — '본 글' 상태 파일을 실제로 쓰고 읽어 두 번 실행한다."""

    def setUp(self):
        import tempfile
        source_fields.JOB_ERRORS.reset()
        self.tmp = Path(tempfile.mkdtemp())
        self.state_path = self.tmp / "seen.json"
        self.db: dict[str, int] = {}  # 저장된 게시물 키 → id (가짜 DB)
        self.fail: set[str] = set()
        self.calls: list[str] = []

        def ingest(sb, payload):
            key = payload["title"]
            self.calls.append(key)
            if key in self.fail:
                raise RuntimeError("503 upstream connect error")
            self.db[key] = len(self.db) + 1
            return self.db[key]
        self.patches = [
            mock.patch.object(fb, "supabase", object()),
            mock.patch.object(fb, "missing_required", lambda job: []),
            mock.patch.object(fb, "fetch_existing_facebook_rows", lambda: list(self.db)),
            mock.patch.object(fb, "filter_new_jobs", lambda jobs, rows: [j for j in jobs if j["fb_post_key"] not in rows]),
            mock.patch.object(fb, "facebook_source_url", lambda key: None),
            mock.patch.object(fb.ingest_gateway, "retry_held_once", lambda sb: None),
            mock.patch.object(fb, "ingest_job", ingest),
        ]
        orig = fb.save_seen_state  # 실제 상태 파일 쓰기 함수를 임시 경로로
        self.patches.append(mock.patch.object(fb, "save_seen_state", lambda st, gs, path=None: orig(st, gs, self.state_path)))
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        source_fields.JOB_ERRORS.reset()

    def _run(self, keys: list[str]):
        """수집기 한 번 = 이미 본 글은 건너뛰고(상태 파일), 나머지를 저장 → 본 글 기록."""
        source_fields.JOB_ERRORS.reset()
        seen = fb.load_seen_state(self.state_path) if self.state_path.exists() else {}
        old = set(seen.get("g", {}).get("keys", []))
        fresh = [k for k in keys if k not in old]
        jobs = [{"title": k, "fb_post_key": k} for k in fresh]
        stats = [{"group": "g", "state": "ok", "final_keys": list(fresh)}]
        return fb.save_and_mark_seen(jobs, seen, stats), fresh

    def test_one_error_retried_next_run(self):
        self.fail = {"b"}
        self._run(["a", "b", "c"])
        self.assertEqual(sorted(self.db), ["a", "c"])
        self.fail = set()
        self.calls.clear()
        _, fresh = self._run(["a", "b", "c"])
        self.assertEqual(fresh, ["b"])          # 실패 글만 다시 본다
        self.assertEqual(self.calls, ["b"])
        self.assertEqual(sorted(self.db), ["a", "b", "c"])

    def test_three_consecutive_errors_nothing_marked_seen(self):
        self.fail = {"b", "c", "d"}
        with self.assertRaises(RuntimeError):
            self._run(["a", "b", "c", "d", "e"])
        self.assertFalse(self.state_path.exists())  # 본 글 기록 없음
        self.fail = set()
        self.calls.clear()
        self._run(["a", "b", "c", "d", "e"])
        self.assertEqual(self.calls, ["b", "c", "d", "e"])  # a는 DB 중복으로 걸러지고 나머지 전부 처리
        self.assertEqual(sorted(self.db), ["a", "b", "c", "d", "e"])

    def test_interrupted_midway_nothing_lost(self):
        def boom(sb, payload):
            self.calls.append(payload["title"])
            if payload["title"] == "b":
                raise KeyboardInterrupt  # 실행 중단(타임아웃·취소) — 잡지 않고 그대로 끝나야 한다
            self.db[payload["title"]] = 1
            return 1
        with mock.patch.object(fb, "ingest_job", boom):
            with self.assertRaises(KeyboardInterrupt):
                self._run(["a", "b", "c"])
        self.assertFalse(self.state_path.exists())
        self.calls.clear()
        self._run(["a", "b", "c"])
        self.assertEqual(self.calls, ["b", "c"])


class TopcvSaveIsolation(unittest.TestCase):
    def setUp(self):
        source_fields.JOB_ERRORS.reset()
        import contextlib
        self.patches = [
            mock.patch.object(topcv, "supabase", object()),
            mock.patch.object(topcv, "load_existing_lookup_maps", lambda source="vieclam24h": ({}, {})),
            mock.patch.object(topcv, "retry_held_once", lambda sb: None),
            mock.patch.object(topcv, "enable_writes", contextlib.nullcontext),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        source_fields.JOB_ERRORS.reset()

    def _jobs(self, n):
        return [{"title": f"Job {i}", "source_url": f"u{i}"} for i in range(1, n + 1)]

    def test_one_error_does_not_stop_other_jobs(self):
        calls = []

        def fake(job, a, b, **k):
            calls.append(job["title"])
            if job["title"] == "Job 2":
                raise RuntimeError("500 Internal Server Error")
            return {"action": "inserted", "id": len(calls)}
        with mock.patch.object(topcv, "upsert_job_record", fake):
            topcv.save_to_supabase(self._jobs(3))
        self.assertEqual(calls, ["Job 1", "Job 2", "Job 3"])
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {"u2"})

    def test_three_consecutive_errors_stop_run(self):
        calls = []

        def fake(job, a, b, **k):
            calls.append(job["title"])
            raise RuntimeError("connection reset")
        with mock.patch.object(topcv, "upsert_job_record", fake):
            with self.assertRaises(RuntimeError):
                topcv.save_to_supabase(self._jobs(5))
        self.assertEqual(len(calls), 3)

    def test_main_exits_nonzero_when_a_job_failed(self):
        async def fake_crawl(**k):
            return self._jobs(2)

        def fake_save(jobs, source="vieclam24h"):
            source_fields.JOB_ERRORS.add("Job 1", RuntimeError("x"), key="u1")
        import asyncio
        with mock.patch.object(topcv, "crawl_vieclam24h", fake_crawl), \
                mock.patch.object(topcv, "save_to_json", lambda *a, **k: None), \
                mock.patch.object(topcv, "save_to_supabase", fake_save):
            with self.assertRaises(SystemExit) as cm:
                asyncio.run(topcv.main())
        self.assertNotEqual(cm.exception.code, 0)


class TopcvRetryNextRun(unittest.TestCase):
    """TopCV는 '본 글' 상태 없이 DB에 있는 원문 주소(source_url)로 새 공고를 가린다 —
    오류로 저장 못 한 공고는 DB에 없으므로 다음 수집에서 다시 신규로 처리되는지, 실제 upsert_job_record로 두 번 돌린다."""

    def setUp(self):
        source_fields.JOB_ERRORS.reset()
        self.rows: dict[str, dict] = {}   # 가짜 local_jobs (source_url → 행)
        self.fail_insert: set[str] = set()
        self.fail_locations: set[str] = set()
        self.inserts: list[str] = []
        self.location_writes: list[int] = []

        def maps(source="vieclam24h"):
            rows = list(self.rows.values())
            return ({r["source_url"]: r for r in rows},
                    {topcv.canonical_job_key(r["title"], r["company"]): r for r in rows})

        def ingest(sb, payload, hold=True, job_id=None, update_fields=None, work_location_rows=None):
            if job_id is not None and payload.get("work_locations") is not None:
                replace_locations(job_id, payload["work_locations"])  # 다시 수집 근무지 줄은 입구가 같은 트랜잭션에서 쓴다(W4a 2차)
            if job_id is not None:
                return job_id
            url = payload["source_url"]
            self.inserts.append(url)
            if url in self.fail_insert:
                raise RuntimeError("500 Internal Server Error")
            # 새 공고 근무지는 입구가 같은 트랜잭션에서 쓴다(#916) — 근무지 쓰기가 실패하면 공고도 안 들어간다(반쯤 저장 없음)
            if work_location_rows and url in self.fail_locations:
                raise RuntimeError("connection reset")
            row = {k: payload.get(k) for k in ("title", "company", "salary", "application_deadline", "description",
                                                 "location", "source_url", "active", "admin_hidden")}
            row.update(id=len(self.rows) + 1, origin="crawler", _has_locations=bool(work_location_rows))
            self.rows[url] = row
            return row["id"]

        def replace_locations(job_id, resolved):
            url = next(u for u, r in self.rows.items() if r["id"] == job_id)
            if url in self.fail_locations:
                raise RuntimeError("connection reset")
            self.location_writes.append(job_id)
            self.rows[url]["_has_locations"] = True

        def has_locations(job_id):
            return any(r["id"] == job_id and r.get("_has_locations") for r in self.rows.values())

        self.patches = [
            mock.patch.object(topcv, "supabase", object()),
            mock.patch.object(topcv, "load_existing_lookup_maps", maps),
            mock.patch.object(topcv, "retry_held_once", lambda sb: None),
            mock.patch.object(topcv, "crawler_policy_errors", lambda job: []),
            mock.patch.object(topcv, "ingest_job", ingest),
            mock.patch.object(topcv, "_replace_job_work_locations", replace_locations),
            mock.patch.object(topcv, "_has_existing_work_locations", has_locations),
            # W4a 2차: 다시 수집 근무지 줄 판단이 읽는 DB(사람 확인 줄·지금 줄)는 이 가짜 DB에 없다 — 줄이 아직 없을 때만 '달라짐'
            mock.patch.object(topcv, "_fetch_protected_work_locations", lambda job_id: []),
            mock.patch.object(topcv, "_work_locations_changed", lambda job_id, rows: not has_locations(job_id)),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        source_fields.JOB_ERRORS.reset()

    def _jobs(self):
        return [{
            "title": f"Công nhân {i}", "company": f"CTY {i}", "location": "Bắc Ninh", "salary": "8 triệu",
            "description": "[source:vieclam24h] x", "application_deadline": "2026-12-31", "active": True,
            "admin_hidden": False, "origin": "crawler", "source_url": f"https://vieclam24h.vn/job-{i}.html",
            "publish_gate_reason": "ok", "crawler_version": "t", "_resolved_locations": [{"raw_address": "Bắc Ninh", "normalized_address": "bac ninh", "lat": None, "lng": None,
                                     "geocode_status": "failed", "geocode_source": None}],
            "_had_transient_geocode_failure": False,
        } for i in (1, 2, 3)]

    def test_failed_insert_retried_as_new_next_run(self):
        u2 = "https://vieclam24h.vn/job-2.html"
        self.fail_insert = {u2}
        topcv.save_to_supabase(self._jobs())
        self.assertNotIn(u2, self.rows)
        self.assertEqual(len(self.rows), 2)
        source_fields.JOB_ERRORS.reset()
        self.fail_insert = set()
        self.inserts.clear()
        topcv.save_to_supabase(self._jobs())
        self.assertEqual(self.inserts, [u2])  # 2번만 새로 등록, 1·3은 기존 공고로 처리
        self.assertEqual(len(self.rows), 3)
        self.assertEqual(source_fields.JOB_ERRORS.failed, [])

    def test_saved_but_location_write_failed_is_completed_next_run(self):
        # #916: 새 공고 근무지는 입구와 같은 트랜잭션 — 근무지 쓰기가 실패하면 공고도 들어가지 않고(반쯤 저장 없음) 다음 수집에서 근무지와 함께 등록
        u2 = "https://vieclam24h.vn/job-2.html"
        self.fail_locations = {u2}
        topcv.save_to_supabase(self._jobs())
        self.assertNotIn(u2, self.rows)
        self.assertEqual(self.location_writes, [])        # 새 공고는 등록 뒤 근무지를 따로 다시 쓰지 않음
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {u2})
        source_fields.JOB_ERRORS.reset()
        self.fail_locations = set()
        self.inserts.clear()
        topcv.save_to_supabase(self._jobs())
        self.assertEqual(self.inserts, [u2])               # 2번만 새로 등록(1·3은 기존 공고)
        self.assertTrue(self.rows[u2].get("_has_locations"))  # 근무지와 함께


class StateDirOverride(unittest.TestCase):
    """GitHub 실행기에서 계정 잠금·본 글 기록이 실행 사이 유지되도록 상태 폴더를 바꿀 수 있는지(#872)."""

    def test_env_moves_lock_and_seen_files(self):
        import importlib, os, tempfile
        d = tempfile.mkdtemp()
        with mock.patch.dict(os.environ, {"CRAWLER_STATE_DIR": d}):
            m = importlib.reload(fb)
            self.assertEqual(str(m.ACCOUNT_LOCK_PATH.parent), d)
            self.assertEqual(str(m.SEEN_STATE_PATH.parent), d)
            m.write_account_lock("checkpoint", "https://www.facebook.com/groups/x")
            self.assertIsNotNone(m.account_lock_reason())   # 다음 실행(같은 폴더)에서 잠금이 보인다
        importlib.reload(fb)

    def test_legacy_lock_still_locks_after_move(self):
        import importlib, os, tempfile
        d, legacy = tempfile.mkdtemp(), Path(tempfile.mkdtemp())
        with mock.patch.dict(os.environ, {"CRAWLER_STATE_DIR": d}):
            m = importlib.reload(fb)
            with mock.patch.object(m, "LEGACY_STATE_DIR", legacy):
                self.assertIsNone(m.account_lock_reason())
                (legacy / "FACEBOOK_ACCOUNT_LOCK").write_text("checkpoint", encoding="utf-8")
                self.assertEqual(m.account_lock_reason(), "checkpoint")  # 예전 폴더 잠금도 잠금
                (legacy / "facebook_seen.json").write_text('{"g": {"keys": ["id:1"]}}', encoding="utf-8")
                self.assertEqual(m.load_seen_state()["g"]["keys"], ["id:1"])  # 예전 본 글 기록 이어받기
        importlib.reload(fb)

    def test_default_is_shared_home_folder(self):
        import importlib, os
        env = {k: v for k, v in os.environ.items() if k != "CRAWLER_STATE_DIR"}
        with mock.patch.dict(os.environ, env, clear=True):
            m = importlib.reload(fb)
            self.assertEqual(m.STATE_DIR, Path.home() / "jobi-crawler-state" / "facebook")  # 계정 공용 폴더(#881)
            self.assertEqual(m.LEGACY_STATE_DIR, Path(m.__file__).parent / "state")
        importlib.reload(fb)


class DryRunWithoutKey(unittest.TestCase):
    """DB 열쇠 없는 미리 보기에서만 회사 이름 읽기를 건너뛰고, 그 밖에는 예전처럼 서버에 묻는다(#881)."""

    def tearDown(self):
        fb.COMPANY_READ_SKIPPED = False

    def test_skip_only_when_flag(self):
        calls = []
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: calls.append(t) or {"company": "CTY A"}):
            fb.COMPANY_READ_SKIPPED = True
            self.assertEqual(fb.read_company("x"), "")
            self.assertEqual(calls, [])
            fb.COMPANY_READ_SKIPPED = False
            self.assertEqual(fb.read_company("x"), "CTY A")
            self.assertEqual(calls, ["x"])

    def test_unavailable_still_stops_when_not_skipped(self):
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"reason": "precheck_not_configured"}):
            with self.assertRaises(RuntimeError):
                fb.read_company("x")

    def test_main_sets_flag_only_for_keyless_dry_run(self):
        import asyncio
        async def stop(*a, **k):
            raise SystemExit(0)
        for argv, key, want in ((["--dry-run"], "", True), (["--dry-run"], "k", False), ([], "", False)):
            with mock.patch.object(fb, "SUPABASE_KEY", key), mock.patch.object(fb, "account_lock_reason", lambda: "stop-here"):
                fb.COMPANY_READ_SKIPPED = False
                try:
                    asyncio.run(fb.main(argv))
                except SystemExit:
                    pass
                self.assertEqual(fb.COMPANY_READ_SKIPPED, want, argv)


class Vieclam24hListingFailure(unittest.TestCase):
    """#872 실제 시험(run 44026690666): 목록 페이지 24곳이 전부 0건인데 '수집 완료 0개'로 성공 처리됐다."""

    def test_block_titles(self):
        for t in ("Just a moment...", "Attention Required! | Cloudflare", "Verify you are human", "Access denied"):
            self.assertTrue(topcv.is_blocked_title(t), t)
        self.assertFalse(topcv.is_blocked_title("Việc làm Nhà máy - Vieclam24h"))
        self.assertFalse(topcv.is_blocked_title(""))

    def test_all_pages_empty_is_failure(self):
        self.assertIsNotNone(topcv.listing_failure(24, 24))
        self.assertIsNone(topcv.listing_failure(24, 23))   # 하나라도 공고가 있으면 정상
        self.assertIsNone(topcv.listing_failure(0, 0))     # 페이지를 안 열었으면(신규 목표 도달 등) 판단 안 함


class SharedCounter(unittest.TestCase):
    def setUp(self):
        source_fields.JOB_ERRORS.reset()

    def test_limit_matches_crawl_guard_three(self):
        self.assertEqual(source_fields.JobErrors.LIMIT, 3)

    def test_reset_clears(self):
        source_fields.JOB_ERRORS.add("a", RuntimeError("x"), key="k")
        source_fields.JOB_ERRORS.reset()
        self.assertEqual(source_fields.JOB_ERRORS.failed, [])


class _VerifyDb:
    """검증 저장 시험용 가짜 DB: 입구 호출·숨김 UPDATE·다시 읽기 결과를 기록한다."""

    def __init__(self, row=None, hide_fails=False):
        self.row = row if row is not None else {"active": False, "admin_hidden": True, "publish_gate_reason": "no_application_path"}
        self.hide_fails, self.ingested, self.hidden = hide_fails, [], []
        db = self

        class Q:
            def __init__(self):
                self.op = None

            def update(self, payload):
                self.op = ("update", payload)
                return self

            def select(self, *_):
                self.op = ("select", None)
                return self

            def eq(self, *_):
                return self

            def execute(self):
                if self.op[0] == "update":
                    if db.hide_fails:
                        raise RuntimeError("DB 503")
                    db.hidden.append(self.op[1])
                    return types.SimpleNamespace(data=[])
                return types.SimpleNamespace(data=[db.row])

        self.Q = Q

    def table(self, _name):
        return self.Q()


def _v24_job(**kw):
    job = {"title": "Nhân viên phục vụ", "company": "CTY A", "location": "Hà Nội", "source_url": "https://vieclam24h.vn/a.html",
           "employer_phone": "", "contact_zalo": "", "active": True, "publish_gate_reason": "ok", "_resolved_locations": []}
    job.update(kw)
    return job


class VerifyWriteNeverPublic(unittest.TestCase):
    """Lee 2026-11-17 #872·#884: 검증 저장 공고는 숨김이 실패해도 공개되면 안 된다 → DB 공개 차단 규칙에 걸리는(연락처 없는) 공고만 저장."""

    def _save(self, db, job):
        ingest = mock.Mock(return_value=777)
        with mock.patch.object(topcv, "supabase", db), mock.patch.object(topcv, "ingest_job", ingest), \
                mock.patch.object(topcv, "crawler_policy_errors", lambda job: []), \
                mock.patch.object(topcv, "_has_existing_work_locations", lambda job_id: False), \
                mock.patch.object(topcv, "_replace_job_work_locations", lambda *a: None), topcv.enable_writes():
            return topcv.upsert_job_record(job, {}, {}, verify_write=True), ingest

    def test_contact_rule_matches_db_gate(self):
        self.assertTrue(topcv.db_gate_has_contact({"employer_phone": "0912 345 678"}))
        self.assertTrue(topcv.db_gate_has_contact({"contact_zalo": "84-912-345"}))
        self.assertFalse(topcv.db_gate_has_contact({"employer_phone": "0912", "contact_zalo": ""}))
        self.assertFalse(topcv.db_gate_has_contact({}))

    def test_contact_rule_follows_the_shared_criteria(self):
        # 1-B 공통 기준(crawler/job_criteria.py)이 바뀌면 검증 저장 대상 고르기도 같이 바뀐다 — 자기 숫자(8)를 따로 갖지 않는다(2단계 #978).
        import job_criteria
        self.assertFalse(topcv.db_gate_has_contact({"employer_phone": "123456"}))
        with mock.patch.object(job_criteria, "MIN_CONTACT_DIGITS", 6):
            self.assertTrue(topcv.db_gate_has_contact({"employer_phone": "123456"}))
            self.assertFalse(topcv.db_gate_has_contact({"contact_zalo": "12345"}))

    def test_source_url_search_uses_the_vietnam_date(self):
        # 서버 로컬 날짜(date.today)가 아니라 공통 베트남 날짜로 마감일 ±1일을 맞춘다(2단계 #978).
        import asyncio
        from datetime import date
        seen = {}
        def fake_match(title, company, deadline, candidates, today):
            seen["today"] = today
            return {"confidence": "NOT_FOUND", "url": None}
        with mock.patch.object(topcv, "search_source_url_candidates", mock.AsyncMock(return_value=[])), \
                mock.patch.object(topcv, "match_source_url_candidate", fake_match), \
                mock.patch.object(topcv, "today_vn", lambda: "2030-01-02"):
            asyncio.run(topcv.discover_source_url(None, {"title": "t", "company": "c"}))
        self.assertEqual(seen["today"], date(2030, 1, 2))

    def test_job_with_contact_is_not_saved(self):
        db = _VerifyDb()
        ingest = mock.Mock()
        with mock.patch.object(topcv, "supabase", db), mock.patch.object(topcv, "ingest_job", ingest), topcv.enable_writes():
            with self.assertRaises(topcv.VerifyWritePublishableError):
                topcv.upsert_job_record(_v24_job(employer_phone="0912345678"), {}, {}, verify_write=True)
        ingest.assert_not_called()

    def test_no_contact_job_saved_hidden_and_checked(self):
        db = _VerifyDb()
        result, ingest = self._save(db, _v24_job())
        self.assertEqual(result["id"], 777)
        self.assertIs(ingest.call_args.args[1]["active"], False)
        self.assertEqual(db.hidden, [{"admin_hidden": True}])

    def test_hide_failure_stops_run(self):
        with self.assertRaises(topcv.VerifyWriteIsolationError):
            self._save(_VerifyDb(hide_fails=True), _v24_job())

    def test_db_readback_publishable_stops_run(self):
        for row in ({"active": True, "admin_hidden": True, "publish_gate_reason": "no_application_path"},
                    {"active": False, "admin_hidden": False, "publish_gate_reason": "no_application_path"},
                    {"active": False, "admin_hidden": True, "publish_gate_reason": "ok"}):
            with self.subTest(row=row), self.assertRaises(topcv.VerifyWriteIsolationError):
                self._save(_VerifyDb(row=row), _v24_job())

    def test_batch_stops_after_isolation_failure(self):
        # 배치 흐름(#886 검토): 첫 공고 숨김 실패 → 다음 공고 저장 안 함, 실행은 실패(0 아닌 종료)
        import asyncio, os, tempfile
        saved = []

        def upsert(job, a, b, verify_write):
            saved.append(job["source_url"])
            raise topcv.VerifyWriteIsolationError("숨김 실패")

        async def from_detail(url, detail, hint=None):
            return {"source_url": url, "title": url, "company": "CTY A"}

        cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as d, mock.patch.object(topcv, "job_from_detail", from_detail), \
                mock.patch.object(topcv, "load_existing_lookup_maps", lambda: ({}, {})), mock.patch.object(topcv, "upsert_job_record", upsert):
            os.chdir(d)
            try:
                with self.assertRaises(SystemExit) as cm:
                    asyncio.run(topcv.process_urls_verify_write(["u1", "u2"], details=[{"url": "u1", "detail": {}}, {"url": "u2", "detail": {}}]))
            finally:
                os.chdir(cwd)
        self.assertEqual(saved, ["u1"])
        self.assertIn("격리 확인 실패", str(cm.exception.code))


class VerifyWriteFromDetails(unittest.TestCase):
    """#884 B안: VPS가 받은 상세(파일)를 GitHub 서버가 사이트 접속 없이 검증 저장한다."""

    def _args(self, argv):
        return topcv.resolve_cli_mode(topcv.build_arg_parser().parse_args(argv))

    def test_cli_modes(self):
        self.assertEqual(self._args(["--verify-write-details", "d.json", "--verify-write", "--confirm-write"]), "verify_write_details")
        self.assertEqual(self._args(["--dry-run-urls", "https://vieclam24h.vn/a.html", "--save-details-to", "d.json"]), "dry_run_urls")
        for argv in (["--verify-write-details", "d.json"], ["--verify-write-details", "d.json", "--verify-write"],
                     ["--save-details-to", "d.json", "--confirm-full-crawl"],
                     ["--verify-write-details", "d.json", "--verify-write", "--confirm-write", "--dry-run-urls", "https://vieclam24h.vn/a.html"]):
            with self.subTest(argv=argv), self.assertRaises(SystemExit):
                self._args(argv)

    def test_details_file_limits(self):
        import json, tempfile
        for items, ok in (([{"url": "u", "detail": {}}], True), ([], False), ([{"url": "u", "detail": {}}] * 11, False), ([{"url": "u"}], False)):
            with self.subTest(n=len(items), ok=ok), tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
                json.dump(items, f)
            if ok:
                self.assertEqual(len(topcv.load_details_file(f.name)), 1)
            else:
                with self.assertRaises(SystemExit):
                    topcv.load_details_file(f.name)

    def test_saves_without_browser(self):
        import asyncio, os, tempfile
        saved = []

        async def from_detail(url, detail, hint=None):
            return {"source_url": url, "title": detail["t"], "company": "CTY A"}

        def no_browser():
            raise AssertionError("검증 저장(파일)은 사이트에 접속하면 안 된다")

        cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as d, mock.patch.object(topcv, "browser_page", no_browser), \
                mock.patch.object(topcv, "job_from_detail", from_detail), \
                mock.patch.object(topcv, "load_existing_lookup_maps", lambda: ({}, {})), \
                mock.patch.object(topcv, "upsert_job_record", lambda job, a, b, verify_write: saved.append((job, verify_write)) or {"id": 5}):
            os.chdir(d)
            try:
                m = asyncio.run(topcv.process_urls_verify_write(["u1"], details=[{"url": "u1", "detail": {"t": "x"}}]))
            finally:
                os.chdir(cwd)
        self.assertEqual(m["created_ids"], [5])
        self.assertEqual(saved, [({"source_url": "u1", "title": "x", "company": "CTY A"}, True)])



class PublishOneFromDetails(unittest.TestCase):
    """#872(Lee 2026-11-18): 같은 보관 파일의 공고 1건을 숨김 없이 일반 등록 — 새 공고만, 1건만."""

    def _args(self, argv):
        return topcv.resolve_cli_mode(topcv.build_arg_parser().parse_args(argv))

    def test_cli_modes(self):
        self.assertEqual(self._args(["--verify-write-details", "d.json", "--publish-one", "--confirm-write"]), "publish_one_details")
        for argv in (["--publish-one", "--confirm-write"], ["--verify-write-details", "d.json", "--publish-one"],
                     ["--verify-write-details", "d.json", "--publish-one", "--confirm-write", "--verify-write"]):
            with self.subTest(argv=argv), self.assertRaises(SystemExit):
                self._args(argv)

    def _run(self, details):
        import asyncio, os, tempfile
        saved = []

        async def from_detail(url, detail, hint=None):
            return {"source_url": url, "title": url, "company": "CTY A", "employer_phone": "0987654321"}

        def upsert(job, a, b, verify_write=False, new_only=False):
            saved.append((job["source_url"], verify_write, new_only))
            return {"id": 9}

        cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as d, mock.patch.object(topcv, "job_from_detail", from_detail), \
                mock.patch.object(topcv, "load_existing_lookup_maps", lambda: ({}, {})), mock.patch.object(topcv, "upsert_job_record", upsert):
            os.chdir(d)
            try:
                m = asyncio.run(topcv.process_urls_verify_write([x["url"] for x in details], details=details, publish=True))
            finally:
                os.chdir(cwd)
        return m, saved

    def test_publishes_one_without_hiding_new_only(self):
        m, saved = self._run([{"url": "u1", "detail": {}}])
        self.assertEqual(m["mode"], "publish_one")
        self.assertEqual(m["created_ids"], [9])
        self.assertEqual(saved, [("u1", False, True)])

    def test_refuses_more_than_one(self):
        with self.assertRaises(SystemExit):
            self._run([{"url": "u1", "detail": {}}, {"url": "u2", "detail": {}}])

    def test_existing_job_is_not_touched(self):
        existing = {"id": 3, "origin": "crawler"}
        with mock.patch.object(topcv, "match_existing_row", lambda job, a, b: existing), \
                mock.patch.object(topcv, "_require_write_enabled", lambda: None):
            with self.assertRaises(topcv.VerifyWriteExistingMatchError):
                topcv.upsert_job_record({"source_url": "u1"}, {}, {}, verify_write=False, new_only=True)



def _fb_job(title: str, desc: str, **extra) -> dict:
    job = {"title": title, "company": "Cty ABC", "employer_phone": "0987654321", "category": "khac", "salary": "",
           "description": "[source:facebook] " + desc}
    job.update(extra)
    return job


class FacebookDecisionSplit(unittest.TestCase):
    """명백한 부적합과 '지금 근거로 판정 못 함'을 구별한다(Lee 2026-11-22 크롤링 정상화).
    예전에는 둘 다 ambiguous·missing_required로 '본 글' 기록이 돼 다시 판정할 기회 없이 영구 제외됐다."""

    def test_clear_unsuitable_posts_stay_final(self):
        # 전담 채권 추심(돈 문제) / 기업 간 계약 영업(정책 exclude) / 구직자 홍보 — 명백한 제외. 연락처 없음은 여기가 아니다(아래 review)
        self.assertEqual(fb.judge_parsed_job(_fb_job("Nhân viên thu hồi nợ", "Thu hồi nợ khách hàng, lương 10 triệu"))[0], "money")
        self.assertEqual(fb.judge_parsed_job(_fb_job(
            "Nhân viên kinh doanh B2B", "Tìm kiếm khách hàng doanh nghiệp, chăm sóc khách hàng doanh nghiệp, ký hợp đồng cung cấp với doanh nghiệp, bán hàng B2B."))[0],
            "policy_excluded")
        for code in ("money", "policy_excluded", "self_promo"):
            self.assertIn(code, fb.FINAL_DECISIONS)
            self.assertNotIn(code, fb.HOLD_DECISIONS)

    def test_recognition_failures_are_held_not_final(self):
        # 정책 review(근거 부족) / 제목 읽기 실패 / 직무 불분명 — 부적합이라는 근거가 아니다 → 보류(HOLD), '본 글'(FINAL)이 아니다
        cases = [
            _fb_job("Sale Executive", "Đại lý, ca 1/ca 2, thu nhập 30 triệu, hoa hồng là phần lớn thu nhập.", salary="30 triệu VND"),
            _fb_job("", "Cần tuyển phục vụ quán cafe, lương 7 triệu"),
            _fb_job("Tuyển gấp 5 bạn", "Tuyển gấp 5 bạn, lương cao."),
        ]
        for job in cases:
            code, reasons = fb.judge_parsed_job(dict(job))
            self.assertEqual(code, "review", (job["title"], reasons))
            self.assertIn(code, fb.HOLD_DECISIONS)
            self.assertNotIn(code, fb.FINAL_DECISIONS)
            self.assertNotIn(code, fb.RETRY_DECISIONS)
        self.assertEqual(fb.FINAL_DECISIONS & {"ambiguous"}, set(), "ambiguous는 더 이상 '본 글'로 기록하지 않는다")

    def test_body_not_acquired_is_retried_not_final(self):
        job = _fb_job("Phục vụ quán cafe", "Cần tuyển 2 bạn phục vụ quán cafe khu Kinh Bắc, lương 7 triệu/tháng, làm ca sáng, ưu tiên nữ ... Xem thêm")
        self.assertEqual(fb.judge_parsed_job(job)[0], "truncated")
        self.assertIn("truncated", fb.RETRY_DECISIONS)

    def test_complete_post_still_accepted(self):
        job = _fb_job("Tuyển phục vụ quán cafe", "Cần tuyển 2 bạn phục vụ quán cafe khu Kinh Bắc, lương 7 triệu/tháng, làm ca sáng, liên hệ 0987654321")
        self.assertEqual(fb.judge_parsed_job(job), ("accepted", []))

    def test_evaluate_post_returns_the_parsed_job_only_for_hold(self):
        now = fb.datetime(2026, 11, 22, 12, 0)
        fresh = {"estimate": "2026-11-22T10:00", "precision": "hour"}
        vague = "Tuyển gấp 5 bạn, lương cao. LH 0987654321"
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": ""}):
            code, reasons, job = fb.evaluate_post(vague, fresh, True, "Bắc Ninh", now=now)
            self.assertEqual(code, "review")
            self.assertTrue(job and job["title"], "보관할 수 있게 읽은 공고를 돌려준다")
            code, reasons, job = fb.evaluate_post("Cần tuyển nhân viên thu hồi nợ, lương 10 triệu. LH 0987654321", fresh, True, "Bắc Ninh", now=now)
            self.assertEqual((code, job), ("money", None))


class _FakeHoldTable:
    def __init__(self, store: dict, fail: bool):
        self.store, self.fail = store, fail

    def upsert(self, row, on_conflict=None, ignore_duplicates=False):
        self.row = row
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("db down")
        self.store.setdefault(self.row["name"], self.row)
        return type("R", (), {"data": [self.row]})()


class _FakeHoldClient:
    def __init__(self, fail_titles=()):
        self.store, self.fail_titles = {}, set(fail_titles)
        self._last = None

    def table(self, name):
        assert name == "research_artifacts", name
        outer = self

        class T(_FakeHoldTable):
            def upsert(self, row, on_conflict=None, ignore_duplicates=False):
                self.fail = row["payload"].get("title") in outer.fail_titles
                return super().upsert(row, on_conflict, ignore_duplicates)

        return T(self.store, False)


class FacebookReviewHold(unittest.TestCase):
    """판단 보류 글은 보류함(review)에 보관된 뒤에만 '본 글'로 기록된다 — 보관 실패는 기록하지 않아 다음 실행에서 다시 만난다."""

    def setUp(self):
        source_fields.JOB_ERRORS.reset()

    def _stats(self, jobs):
        return [{"group": "g", "state": "ok", "final_keys": ["done"], "hold_keys": [j["fb_post_key"] for j in jobs], "held_jobs": jobs}]

    def _job(self, key, title):
        return {**_fb_job(title, "Tuyển gấp, lương cao. 0987654321"), "fb_post_key": key, "_hold_reason": "incomplete_role_evidence",
                "source_text": "Tuyển gấp, lương cao. 0987654321", "location": "Bắc Ninh"}

    def test_held_post_is_stored_then_recorded_as_seen(self):
        client = _FakeHoldClient()
        stats = self._stats([self._job("id:1", "Tuyển gấp")])
        with mock.patch.object(fb, "supabase", client):
            self.assertEqual(fb.hold_review_posts(stats), 1)
        (row,) = client.store.values()
        self.assertEqual((row["kind"], row["meta"]["status"], row["meta"]["reason"]), ("location-hold", "review", "incomplete_role_evidence"))
        self.assertTrue(row["payload"]["source_url"].endswith("1") or row["payload"].get("source_url"), "원문 출처가 payload에 남는다(R3)")
        self.assertIn("id:1", stats[0]["final_keys"])
        self.assertTrue(row["meta"]["next_at"] > row["meta"]["held_at"], "첫 재판정은 하루 뒤")

    def test_store_failure_is_not_recorded_as_seen(self):
        client = _FakeHoldClient(fail_titles={"실패"})
        stats = self._stats([self._job("id:1", "실패"), self._job("id:2", "Tuyển gấp")])
        with mock.patch.object(fb, "supabase", client):
            self.assertEqual(fb.hold_review_posts(stats), 1, "한 건 실패가 다른 글의 보관을 막지 않는다")
        self.assertNotIn("id:1", stats[0]["final_keys"], "보관 못 한 글은 본 글로 기록하지 않는다 → 다음 실행에서 다시")
        self.assertIn("id:2", stats[0]["final_keys"])
        self.assertTrue(source_fields.JOB_ERRORS.failed, "실행 결과는 실패로 남는다")

    def test_save_and_mark_seen_records_only_stored_holds(self):
        client = _FakeHoldClient(fail_titles={"실패"})
        stats = self._stats([self._job("id:1", "실패"), self._job("id:2", "Tuyển gấp")])
        captured = {}
        with mock.patch.object(fb, "supabase", client), mock.patch.object(fb, "save_to_supabase", lambda jobs: []), \
                mock.patch.object(fb, "save_seen_state", lambda state, gs: captured.setdefault("keys", list(gs[0]["final_keys"]))):
            fb.save_and_mark_seen([], {}, stats)
        self.assertEqual(sorted(captured["keys"]), ["done", "id:2"])

    def test_recheck_clears_when_the_judgement_code_now_allows(self):
        """고친 판정 코드(예: 직무 낱말 보강)가 들어가면 보류 글이 허용으로 풀리고, 다시 읽은 칸이 payload에 반영된다."""
        text = "Tuyển gấp 5 bạn, lương cao. LH 0987654321"
        payload = {**fb.to_db_payload({**_fb_job("Tuyển gấp 5 bạn", text), "fb_post_key": "id:3", "source_text": text}), "source_text": text, "location": "Bắc Ninh"}
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": ""}):
            fixed, why, excluded = fb.review_recheck(payload)
            self.assertEqual((why, excluded), ("직무/연락처가 불분명한 일반 모집글", False), "코드가 그대로면 보류 유지")
            with mock.patch.object(fb, "is_ambiguous_job", lambda job: False):
                fixed, why, excluded = fb.review_recheck(payload)
        self.assertEqual((why, excluded), (None, False))
        self.assertEqual(fixed["source_url"], payload["source_url"], "원문 출처는 바꾸지 않는다")

    def test_recheck_ends_when_now_clearly_unsuitable(self):
        text = "Cần tuyển nhân viên thu hồi nợ, lương 10 triệu. LH 0987654321"
        payload = {"title": "x", "company": "y", "description": "[source:facebook] " + text, "source_text": text, "location": "Bắc Ninh"}
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": "CTY A"}):
            _p, why, excluded = fb.review_recheck(payload)
        self.assertEqual((why, excluded), ("dedicated_debt_collection", True))

    def test_recheck_keeps_hold_when_company_reader_is_down(self):
        payload = {"description": "[source:facebook] Tuyển gấp", "source_text": "Tuyển gấp 5 bạn. 0987654321", "location": "Bắc Ninh"}
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"reason": "precheck_unavailable"}):
            _p, why, excluded = fb.review_recheck(payload)
        self.assertEqual((why, excluded), ("company_read_unavailable", False), "읽기 서버 장애는 부적합도 오류 횟수도 아니다")

    def test_registered_for_facebook_source_tag(self):
        self.assertIs(fb.ingest_gateway.REVIEW_RECHECK["facebook"], fb.review_recheck)


class FacebookRetryHeldCli(unittest.TestCase):
    """정기 수집이 멈춰 있어도 보류 공고가 끊기지 않게 — Facebook 접속·쿠키 없이 보류함만 다시 확인하는 수동 입구."""

    def test_flag_runs_hold_retry_without_facebook_cookies(self):
        import asyncio
        calls = []
        with mock.patch.object(fb, "supabase", object()), mock.patch.object(fb, "FB_C_USER", ""), mock.patch.object(fb, "FB_XS", ""), \
                mock.patch.object(fb.ingest_gateway, "retry_held", lambda client: calls.append(client) or {"registered": 1}):
            self.assertEqual(asyncio.run(fb.main(["--retry-held"])), 0)
        self.assertEqual(len(calls), 1, "쿠키 없이 보류함 다시 확인만 한다(정기 수집을 켜는 것이 아니다)")

    def test_without_server_credentials_it_fails_loudly(self):
        import asyncio
        with mock.patch.object(fb, "supabase", None):
            self.assertEqual(asyncio.run(fb.main(["--retry-held"])), 1)



# ── 크롤링 정상화 1번 그룹(Lee 2026-11-22): 수집·인식·제외 규칙, 미리 보기 → 선택 저장 연결 ─────────────────────────────
# 판정은 네 갈래: 정상(accepted) / 인식 실패(review → 보류함) / 명백한 제외(근거 기록 후 종결) / 파서·수집기 오류(JOB_ERRORS, 보류함 아님).
import contextlib  # noqa: E402
import io  # noqa: E402
import json  # noqa: E402
import tempfile  # noqa: E402

_NOW = fb.datetime(2026, 11, 22, 12, 0)
_FRESH = {"estimate": "2026-11-22T10:00", "precision": "hour"}

FACTORY_POST = ("CÔNG TY TNHH ABC KCN QUẾ VÕ TUYỂN CÔNG NHÂN SẢN XUẤT 20 NAM NỮ\n"
                "Làm việc dưới sự hướng dẫn của kỹ sư và trưởng phòng sản xuất, ca ngày 8h.\n"
                "Lương 9 triệu - 12 triệu/tháng. Liên hệ 0987654321")
PAY_PHRASE_POST = "Quán Phở Hà Nội cần tuyển 2 bạn phục vụ. Quán trả 8 triệu/tháng, bao ăn trưa. Liên hệ 0987654321"
NEED_N_POST = "Quán cần 2 bạn, lương 8tr. Zalo 0987654321"
OFFICE_POST = "TUYỂN KẾ TOÁN TỔNG HỢP\nLương 12 triệu. Liên hệ 0987654321"
SCAM_POST = "Tôi nhiều tiền quá, muốn công đức thì sợ người ta bảo rửa tiền. 1 tháng tôi trả 100 triệu"
MULE_POST = "Cần người nhận chuyển khoản hộ, trả 50 triệu mỗi tháng, không cần kinh nghiệm"
VAGUE_POST = "Tuyển gấp 5 bạn, lương cao. LH 0987654321"
NO_CONTACT_POST = "Cần tuyển 2 bạn phục vụ quán cafe khu Kinh Bắc, lương 7 triệu/tháng, làm ca sáng, ưu tiên nữ nhanh nhẹn"
MONEY_POST = "Cần tuyển nhân viên thu hồi nợ, lương 10 triệu. LH 0987654321"
NORMAL_POST = "Cần tuyển 2 bạn phục vụ quán cafe khu Kinh Bắc, lương 7 triệu/tháng, làm ca sáng, liên hệ 0987654321"


class OverExclusionOfRealPosts(unittest.TestCase):
    """not_job·office 사전 거름이 실제 유효 구인 글을 보류함·등록 도달 전에 영구 제외하던 것 — 명백한 근거가 있을 때만 종결."""

    def test_factory_post_that_mentions_staff_titles_is_not_office(self):
        # 본문에 '상급자 직함'이 나올 뿐 모집 직무는 공장 직원 — 예전에는 office로 영구 제외
        self.assertFalse(fb.is_office_job(FACTORY_POST))

    def test_hiring_post_with_pay_phrase_is_a_job(self):
        # '8 triệu를 준다'는 보수 문구가 구인 글에도 흔하다 — 예전에는 not_job으로 영구 제외
        self.assertTrue(fb.is_job_post(PAY_PHRASE_POST))

    def test_explicit_need_n_people_is_a_job(self):
        self.assertTrue(fb.is_job_post(NEED_N_POST))

    def test_clear_evidence_is_still_excluded_with_the_evidence_recorded(self):
        self.assertFalse(fb.is_job_post(SCAM_POST), "자금 세탁·기부 낱말 — 명백한 비구인")
        self.assertFalse(fb.is_job_post(MULE_POST), "직무 근거 없이 보수만 내거는 글")
        code, reasons, job = fb.evaluate_post(OFFICE_POST, _FRESH, True, "Bắc Ninh", now=_NOW)
        self.assertEqual((code, job), ("office", None))
        self.assertIn("kế toán", reasons[0].lower(), "제외 근거(모집 직무 줄의 낱말)를 사유에 남긴다")
        code, reasons, _ = fb.evaluate_post(SCAM_POST, _FRESH, True, "Bắc Ninh", now=_NOW)
        self.assertEqual(code, "not_job")
        self.assertIn("자금 세탁", reasons[0], "비구인 근거를 사유에 남긴다")

    def test_over_excluded_posts_now_reach_the_normal_path(self):
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": "CTY ABC"}):
            for text in (FACTORY_POST, PAY_PHRASE_POST, NEED_N_POST):
                code, reasons, job = fb.evaluate_post(text, _FRESH, True, "Bắc Ninh", now=_NOW)
                self.assertNotIn(code, ("not_job", "office"), (text[:40], code, reasons))


class FourWayClassification(unittest.TestCase):
    """정상 / 인식 실패(review) / 명백한 제외 / 파서·수집기 오류 — 서로 다른 곳으로 간다."""

    def setUp(self):
        source_fields.JOB_ERRORS.reset()
        patcher = mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": "CTY ABC"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def _eval(self, text):
        return fb.evaluate_post(text, _FRESH, True, "Bắc Ninh", now=_NOW)

    def test_missing_contact_is_review_not_permanent_exclusion(self):
        code, reasons, job = self._eval(NO_CONTACT_POST)
        self.assertEqual((code, reasons), ("review", ["연락처 없음"]))
        self.assertTrue(job, "보관할 수 있게 읽은 공고를 돌려준다")
        self.assertIn(code, fb.HOLD_DECISIONS)
        self.assertNotIn(code, fb.FINAL_DECISIONS)
        self.assertNotIn("missing_required", fb.FINAL_DECISIONS, "연락처 미기재는 영구 제외 사유가 아니다")
        # 공개 불가는 그대로: 저장 직전 방어선은 연락처 없는 공고를 막는다
        self.assertIn("연락처 없음", fb.missing_required(job))

    def test_four_outcomes(self):
        self.assertEqual(self._eval(NORMAL_POST)[0], "accepted")
        self.assertEqual(self._eval(VAGUE_POST)[0], "review")
        self.assertEqual(self._eval(MONEY_POST)[0], "money")
        self.assertEqual(self._eval(OFFICE_POST)[0], "office")
        self.assertEqual(self._eval(SCAM_POST)[0], "not_job")

    def test_parser_exception_goes_to_error_record_not_hold_or_seen(self):
        with mock.patch.object(fb, "evaluate_post", side_effect=ValueError("DOM 구조 변경으로 제목 줄 추출 실패")):
            code, reasons, job = fb.evaluate_post_isolated("id:9", NORMAL_POST, _FRESH, True, "Bắc Ninh", None, _NOW, 3)
        self.assertEqual((code, job), ("parser_error", None))
        self.assertIn("ValueError", reasons[0])
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {"id:9"}, "공통 장애 기록(JOB_ERRORS)에 남는다")
        for group in (fb.FINAL_DECISIONS, fb.HOLD_DECISIONS):
            self.assertNotIn("parser_error", group, "보류함에 묻히지도 '본 글'로 기록되지도 않는다 → 다음 실행에서 다시")

    def test_normal_judgement_resets_error_streak_and_three_in_a_row_stops(self):
        with mock.patch.object(fb, "evaluate_post", side_effect=ValueError("x")):
            fb.evaluate_post_isolated("id:1", "t", _FRESH, True, "B", None, _NOW, 3)
            fb.evaluate_post_isolated("id:2", "t", _FRESH, True, "B", None, _NOW, 3)
        self.assertEqual(fb.evaluate_post_isolated("id:3", NORMAL_POST, _FRESH, True, "Bắc Ninh", None, _NOW, 3)[0], "accepted")
        with mock.patch.object(fb, "evaluate_post", side_effect=ValueError("x")):
            fb.evaluate_post_isolated("id:4", "t", _FRESH, True, "B", None, _NOW, 3)
            fb.evaluate_post_isolated("id:5", "t", _FRESH, True, "B", None, _NOW, 3)
            with self.assertRaises(RuntimeError):
                fb.evaluate_post_isolated("id:6", "t", _FRESH, True, "B", None, _NOW, 3)


class DryRunArtifactKeepsReviewCandidates(unittest.TestCase):
    """dryrun 비공개 아티팩트(1일 보관)에 인식 실패 공고의 전체 원문·출처·사유·다음 처리 조건이 담긴다(DB 키 없이)."""

    def test_review_candidates_carry_source_text_source_url_reason_and_next_step(self):
        text = VAGUE_POST
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": ""}):
            code, reasons, job = fb.evaluate_post(text, _FRESH, True, "Bắc Ninh", now=_NOW)
        job.update({"fb_post_key": "id:77", "_hold_reason": "; ".join(reasons)})
        (entry,) = fb.review_candidates([{"held_jobs": [job]}])
        self.assertEqual(entry["fb_post_key"], "id:77")
        self.assertEqual(entry["decision"], "review")
        self.assertEqual(entry["hold_reasons"], reasons)
        self.assertIn(text, entry["source_text"], "원문 전체")
        self.assertTrue(entry["source_url"], "출처")
        self.assertIn("선택 저장", entry["next_step"])
        json.dumps(entry, ensure_ascii=False)  # 비공개 아티팩트로 그대로 직렬화된다


def _artifact(entries_jobs, entries_review, path):
    path.write_text(json.dumps({"jobs": entries_jobs, "review_jobs": entries_review}, ensure_ascii=False), encoding="utf-8")


def _read(text, key):
    with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": "CTY ABC"}):
        job = fb.parse_post({"text": text, "location": "Bắc Ninh", "images": []})
    job.update({"fb_post_key": key, "fb_full_text_confirmed": True})
    return job


class _SaveHarness(unittest.TestCase):
    def setUp(self):
        source_fields.JOB_ERRORS.reset()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "facebook_dryrun.json"
        self.saved, self.held, self.seen_writes = [], [], []
        self.existing = []
        self.hold_error = None

        def fake_hold(client, payload, reason, status="held"):
            if self.hold_error:
                raise self.hold_error
            self.held.append((payload, reason, status))

        patches = [
            mock.patch.object(fb, "supabase", object()),
            mock.patch.object(fb, "fetch_existing_facebook_rows", lambda *a, **k: self.existing),
            mock.patch.object(fb, "save_to_supabase", lambda jobs: self.saved.extend(jobs) or [{"id": 900 + i, "title": j["title"]} for i, j in enumerate(jobs)]),
            mock.patch.object(fb.ingest_gateway, "hold_job", fake_hold),
            mock.patch.object(fb, "save_seen_state", lambda *a, **k: self.seen_writes.append(1)),
            mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"company": "CTY ABC"}),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def run_save(self, keys, max_save=2):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = fb.save_selected_from_dryrun(str(self.path), keys, max_save)
        return code, out.getvalue()


class SelectedSaveUsesTheSameJudgement(_SaveHarness):
    """dryrun → 선택 저장(save)도 일반 수집과 같은 판정 함수를 쓴다: 정상=등록 / 인식 실패=review 보관 / 명백한 제외=종결 / 오류=실패."""

    def test_same_text_gets_the_same_verdict_in_collection_and_manual_save(self):
        texts = {"normal": NORMAL_POST, "vague": VAGUE_POST, "no_contact": NO_CONTACT_POST, "money": MONEY_POST,
                 "office": OFFICE_POST, "scam": SCAM_POST, "factory": FACTORY_POST, "pay_phrase": PAY_PHRASE_POST}
        for name, text in texts.items():
            collected = fb.evaluate_post(text, _FRESH, True, "Bắc Ninh", now=_NOW)[0]
            manual = fb.judge_text(text, True, "Bắc Ninh", [])[0]
            self.assertEqual(collected, manual, name)

    def test_normal_post_is_registered_through_the_existing_save_stage(self):
        _artifact([_read(NORMAL_POST, "id:1")], [], self.path)
        code, out = self.run_save(["id:1"])
        self.assertEqual(code, 0, out)
        self.assertEqual(len(self.saved), 1)
        self.assertEqual(self.held, [], "정상 공고는 보류함에 넣지 않는다")
        self.assertEqual(self.seen_writes, [], "수동 선택 저장은 '본 글' 기록을 만들지 않는다")

    def test_review_post_is_kept_in_hold_box_as_review_only_after_success(self):
        _artifact([], [_read(VAGUE_POST, "id:2")], self.path)
        code, out = self.run_save(["id:2"])
        self.assertEqual(code, 0, out)
        (payload, reason, status), = self.held
        self.assertEqual(status, "review")
        self.assertIn("불분명", reason)
        self.assertTrue(payload.get("source_url") and payload.get("source_text"), "출처·원문이 보류함 payload에 남는다")
        self.assertEqual(self.saved, [], "공개·등록 경로로 보내지 않는다")
        self.assertIn("보류함(review) 보관 완료 —", out)

    def test_contactless_post_is_kept_as_review_not_registered(self):
        _artifact([], [_read(NO_CONTACT_POST, "id:3")], self.path)
        code, out = self.run_save(["id:3"])
        self.assertEqual(code, 0, out)
        self.assertEqual([h[2] for h in self.held], ["review"])
        self.assertEqual(self.saved, [])

    def test_clear_exclusion_is_closed_with_reason_and_not_stored(self):
        _artifact([], [_read(MONEY_POST, "id:4")], self.path)
        code, out = self.run_save(["id:4"])
        self.assertEqual(code, 0, out)
        self.assertEqual((self.saved, self.held), ([], []))
        self.assertIn("명백한 제외", out)
        self.assertIn("dedicated_debt_collection", out)

    def test_hold_failure_is_not_marked_complete_and_run_fails(self):
        self.hold_error = fb.ingest_gateway.HoldStoreError("hold_store_failed")
        _artifact([], [_read(VAGUE_POST, "id:5")], self.path)
        code, out = self.run_save(["id:5"])
        self.assertEqual(code, 1, out)
        self.assertEqual(self.held, [])
        self.assertIn("id:5", source_fields.JOB_ERRORS.failed_keys(), "실패는 공통 장애 기록에 남아 재수집 가능")
        self.assertNotIn("보관 완료 —", out, "보관 성공 전에는 완료라고 말하지 않는다")
        self.assertIn("보관 완료 0", out)
        self.assertEqual(self.seen_writes, [])

    def test_expired_or_missing_artifact_is_not_completion(self):
        code, out = self.run_save(["id:6"])  # 파일 없음(아티팩트 만료)
        self.assertEqual(code, 1)
        self.assertIn("완료 처리 안 함", out)
        self.assertEqual((self.saved, self.held, self.seen_writes), ([], [], []))

    def test_selected_key_not_in_artifact_is_a_failure_not_silent_success(self):
        _artifact([_read(NORMAL_POST, "id:1")], [], self.path)
        code, out = self.run_save(["id:404"])
        self.assertEqual(code, 1, out)
        self.assertEqual((self.saved, self.held), ([], []))

    def test_unselected_posts_are_never_stored(self):
        _artifact([_read(NORMAL_POST, "id:1")], [_read(VAGUE_POST, "id:2"), _read(NO_CONTACT_POST, "id:3")], self.path)
        code, out = self.run_save(["id:2"])
        self.assertEqual(code, 0, out)
        self.assertEqual([h[0]["source_url"].endswith("2") for h in self.held], [True])
        self.assertEqual(self.saved, [])

    def test_selection_over_limit_stores_nothing(self):
        _artifact([_read(NORMAL_POST, "id:1")], [_read(VAGUE_POST, "id:2")], self.path)
        code, out = self.run_save(["id:1", "id:2"], max_save=1)
        self.assertEqual(code, 1, out)
        self.assertEqual((self.saved, self.held), ([], []))

    def test_review_post_already_registered_is_not_held_again(self):
        job = _read(VAGUE_POST, "id:8")
        self.existing = [{"id": 5, "title": job["title"], "company": job["company"], "description": job["description"],
                          "source_text": job["source_text"], "source_url": fb.facebook_source_url("id:8")}]
        _artifact([], [job], self.path)
        code, out = self.run_save(["id:8"])
        self.assertEqual(code, 0, out)
        self.assertEqual(self.held, [])
        self.assertIn("DB 중복", out)

    def test_collector_error_while_rereading_is_a_failure_not_a_hold(self):
        _artifact([], [_read(VAGUE_POST, "id:9")], self.path)
        with mock.patch.object(fb.ingest_gateway, "READ_LOCATION", lambda t, r: {"reason": "precheck_unavailable"}):
            code, out = self.run_save(["id:9"])
        self.assertEqual(code, 1, out)
        self.assertEqual((self.saved, self.held), ([], []))
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {"id:9"})



class _FakeTable:
    def __init__(self, db, name):
        self.db, self.name, self.filters = db, name, []

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def in_(self, col, vals):
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def execute(self):
        rows = [r for r in self.db[self.name] if all(f(r) for f in self.filters)]
        return types.SimpleNamespace(data=rows)


class _FakeSupabase:
    def __init__(self, db):
        self.db = db

    def table(self, name):
        return _FakeTable(self.db, name)


class TopcvBranchJobs(unittest.TestCase):
    """지점별 독립 공고(Lee 2026-11-23, 이슈 #988): 원문 하나의 지점 A·B·C → 입구 3번, 같은 지점 여러 직무 → 1번,
    다시 수집에서 지점이 빠져도 기존 공고·줄을 건드리지 않고 새 지점만 새 공고."""

    A, B, C = "Lô A1, KCN Quế Võ, Bắc Ninh", "Lô D4, KCN Quế Võ, Bắc Ninh", "Lô E7, KCN Quế Võ, Bắc Ninh"
    URL = "https://example.vn/post-1"

    def _rows(self, *addrs):
        return [{"raw_address": a, "normalized_address": a.lower()} for a in addrs]

    def test_three_branches_make_three_independent_calls(self):
        calls = []
        def ingest(sb, payload, hold=True, **k):
            calls.append(payload)
            return len(calls)
        with mock.patch.object(topcv, "supabase", object()), mock.patch.object(topcv, "ingest_job", ingest):
            ids = topcv._ingest_branch_jobs({"title": "t", "source_url": self.URL}, self._rows(self.A, self.B, self.C))
        self.assertEqual(ids, [1, 2, 3])
        self.assertEqual([c["branch_location"] for c in calls], [self.A, self.B, self.C])
        for c in calls:
            self.assertEqual(len(c["work_locations"]), 1, "공고 하나 = 지점 하나의 근무지 줄")
            self.assertEqual(c["source_url"], self.URL)

    def test_one_branch_with_many_roles_is_one_call(self):
        calls = []
        with mock.patch.object(topcv, "supabase", object()), mock.patch.object(topcv, "ingest_job", lambda sb, p, hold=True, **k: calls.append(p) or 1):
            topcv._ingest_branch_jobs({"title": "t (3 직무)", "source_url": self.URL}, self._rows(self.A))
        self.assertEqual(len(calls), 1)

    def test_recollection_with_a_branch_missing_touches_nothing(self):
        db = {"local_jobs": [{"id": 1, "source_url": self.URL}, {"id": 2, "source_url": self.URL}, {"id": 3, "source_url": self.URL}],
              "job_work_locations": [{"job_id": 1, "raw_address": self.A}, {"job_id": 2, "raw_address": self.B}, {"job_id": 3, "raw_address": self.C}]}
        with mock.patch.object(topcv, "supabase", _FakeSupabase(db)):
            seen = self._rows(self.A, self.B)  # 이번 글에서 C가 안 보임
            self.assertEqual(topcv._own_branch_rows(1, seen), self._rows(self.A))
            self.assertEqual(topcv._own_branch_rows(2, seen), self._rows(self.B))
            self.assertEqual(topcv._own_branch_rows(3, seen), [], "이번 글에 없는 지점은 줄도 공고도 건드리지 않음")
            self.assertEqual(topcv._unregistered_branch_rows(self.URL, seen), [], "이미 있는 지점은 새 공고가 아님")
        self.assertEqual(len(db["local_jobs"]), 3)
        self.assertEqual(len(db["job_work_locations"]), 3)

    def test_recollection_new_branch_only_is_created(self):
        db = {"local_jobs": [{"id": 1, "source_url": self.URL}], "job_work_locations": [{"job_id": 1, "raw_address": self.A}]}
        with mock.patch.object(topcv, "supabase", _FakeSupabase(db)):
            fresh = topcv._unregistered_branch_rows(self.URL, self._rows(self.A, self.B))
        self.assertEqual([r["raw_address"] for r in fresh], [self.B])

    def test_legacy_multi_row_job_is_left_alone(self):
        db = {"local_jobs": [{"id": 1, "source_url": self.URL}],
              "job_work_locations": [{"job_id": 1, "raw_address": self.A}, {"job_id": 1, "raw_address": self.B}]}
        with mock.patch.object(topcv, "supabase", _FakeSupabase(db)):
            self.assertEqual(topcv._own_branch_rows(1, self._rows(self.A, self.B)), [], "전환 전 여러 줄 공고는 자동 작업이 안 건드림")


class FacebookCriteriaAlignment(unittest.TestCase):
    """1-B(F2·F3): Facebook 수집기가 마감·연락처를 DB·화면과 같은 기준으로 본다(마감 당일 열림, 연락처 숫자 8자리)."""

    def test_deadline_day_is_kept_and_a_past_date_is_still_just_dropped(self):
        with mock.patch.object(fb, "TODAY", "2026-11-23"):
            self.assertEqual(fb.extract_deadline("Hạn nộp hồ sơ: 23/11/2026"), "2026-11-23", "마감 당일은 기한으로 남긴다")
            self.assertEqual(fb.extract_deadline("Hạn nộp hồ sơ: 24/11/2026"), "2026-11-24")
            self.assertIsNone(fb.extract_deadline("Hạn nộp hồ sơ: 22/11/2026"), "지난 날짜는 기존대로 기한에서 뺀다(새 제외 규칙 없음)")

    def _problems(self, phone, zalo):
        job = {"title": "Tuyển công nhân may", "company": "CTY A", "employer_phone": phone, "zalo": zalo,
               "description": "Tuyển công nhân may, lương 8 triệu", "location": "Bắc Ninh"}
        return fb.missing_required(job)

    def test_normal_contacts_are_never_flagged_missing(self):
        for value in ["0912345678", "0912 345 678", "091.234.5678", "+84 912 345 678", "84912345678", "(028) 3822 1234", "09123456"]:
            self.assertNotIn("연락처 없음", self._problems(value, ""), value)
            self.assertNotIn("연락처 없음", self._problems("", value), value)

    def test_not_a_contact_is_flagged_missing(self):
        for value in ["", "0912345", "abc", "---"]:
            self.assertIn("연락처 없음", self._problems(value, ""), repr(value))

class RecollectKeepsConfirmedLocationText(unittest.TestCase):
    """지도 정상화 W4a: vieclam24h 다시 수집이 같은 지점의 표기만 다른 주소로 위치 글자를 바꿔 확정 좌표를 지우지 않는다
    (DB는 위치 글자가 바뀌면 그 줄 좌표를 지움). 판정은 Facebook 다시 수집과 같은 pin_guard.keeps_confirmed_location 한 곳."""
    OLD = "152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh"

    def _db(self, rows):
        class Q:
            def __getattr__(q, _):
                return lambda *a, **k: q
            def execute(q):
                return types.SimpleNamespace(data=rows)
        return types.SimpleNamespace(table=lambda name: Q())

    def _run(self, new_location, rows, extra=None):
        updates = {"location": new_location, "salary": "9tr", **(extra or {})}
        with mock.patch.object(topcv, "supabase", self._db(rows)):
            return topcv._keep_confirmed_location_text({"id": 7, "location": self.OLD}, updates)

    def test_notation_only_change_on_confirmed_row_keeps_text(self):
        rows = [{"raw_address": self.OLD, "lat": 21.18, "lng": 106.07, "point_authority": "admin_confirmed"}]
        out = self._run("152 Trần Hưng Đạo", rows)
        self.assertNotIn("location", out)
        self.assertEqual(out["salary"], "9tr", "다른 칸은 그대로 고친다")

    def test_other_branch_or_unconfirmed_updates_as_before(self):
        confirmed = [{"raw_address": self.OLD, "lat": 21.18, "lng": 106.07, "location_verified": True}]
        self.assertEqual(self._run("340 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh", confirmed)["location"], "340 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh")
        unconfirmed = [{"raw_address": self.OLD, "lat": 21.18, "lng": 106.07}]
        self.assertEqual(self._run("152 Trần Hưng Đạo", unconfirmed)["location"], "152 Trần Hưng Đạo")
        self.assertEqual(self._run("152 Trần Hưng Đạo", [])["location"], "152 Trần Hưng Đạo")

    def test_other_branch_job_keeps_its_branch_location(self):
        # 지점별 독립 공고(운영 #5992 2026-11-24 pin_lost): 이 공고가 글의 둘째 매장 지점이면 첫 매장 주소로 위치 글자를 바꾸지 않는다.
        rows = [{"raw_address": "148 Trần Phú, Từ Sơn, Bắc Ninh", "lat": 21.1187, "lng": 105.9608, "location_verified": True}]
        found = ["152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh", "148 Trần Phú, Từ Sơn, Bắc Ninh"]
        with mock.patch.object(topcv, "supabase", self._db(rows)):
            out = topcv._keep_confirmed_location_text({"id": 7, "location": "148 Trần Phú, Từ Sơn, Bắc Ninh"},
                                                     {"location": found[0], "salary": "9tr"}, found)
        self.assertNotIn("location", out)
        self.assertEqual(out["salary"], "9tr", "다른 칸은 그대로 고친다")

    def test_branch_kept_from_listing_text_when_geocode_returned_nothing(self):
        # 지도 조회가 일시 실패해 근무지 줄이 비어도(원문 주소 칸 글자만 있음) 지점 판정은 같다 — 첫 매장 주소로 덮어쓰지 않는다(Lee 2026-11-25).
        rows = [{"raw_address": "148 Trần Phú, Từ Sơn, Bắc Ninh", "lat": 21.1187, "lng": 105.9608, "location_verified": True}]
        listing = ["152 Trần Hưng Đạo, Kinh Bắc", "148 Trần Phú, Từ Sơn"]
        with mock.patch.object(topcv, "supabase", self._db(rows)):
            out = topcv._keep_confirmed_location_text({"id": 7, "location": "148 Trần Phú, Từ Sơn, Bắc Ninh"},
                                                     {"location": "152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh"}, listing)
        self.assertNotIn("location", out)

    def test_rows_query_failure_is_not_treated_as_no_rows(self):
        # 근무지 줄 조회 실패는 예외로 올라가 공고별 오류 기록·다음 실행 재시도로 간다 — '줄 없음'으로 보고 위치 글자를 고치지 않는다.
        class Q:
            def __getattr__(q, _):
                return lambda *a, **k: q
            def execute(q):
                raise ConnectionError("db down")
        with mock.patch.object(topcv, "supabase", types.SimpleNamespace(table=lambda name: Q())):
            with self.assertRaises(ConnectionError):
                topcv._keep_confirmed_location_text({"id": 7, "location": self.OLD}, {"location": "340 Trần Hưng Đạo"}, [])

    def test_recollect_passes_listing_text_to_branch_check(self):
        # 호출하는 곳이 원문 주소 칸(지도 조회 전) 글자도 넘기는지 — 지도 조회가 실패해도 지점 판정이 바뀌지 않게.
        import inspect
        self.assertIn('job.get("_work_locations")', inspect.getsource(topcv.upsert_job_record))

    def test_no_location_change_does_not_query(self):
        with mock.patch.object(topcv, "supabase", None):  # 위치 칸이 안 바뀌면 DB를 묻지 않는다
            self.assertEqual(topcv._keep_confirmed_location_text({"id": 7, "location": self.OLD}, {"salary": "9tr"}), {"salary": "9tr"})


class RecollectRowsThroughEntry(unittest.TestCase):
    """지도 정상화 W4a 2차: 기존 공고 다시 수집의 근무지 줄은 입구(ingest_job)에 실어 한 트랜잭션으로 쓰고,
    달라진 것이 없으면 입구를 부르지 않는다(입구는 호출마다 원문을 기록하므로)."""
    ADDR = "12 Nguyễn Trãi, Thanh Xuân, Hà Nội"

    def _db(self, rows):
        class Q:
            def __getattr__(q, _):
                return lambda *a, **k: q
            def execute(q):
                return types.SimpleNamespace(data=rows)
        return types.SimpleNamespace(table=lambda name: Q())

    def _changed(self, current, new):
        with mock.patch.object(topcv, "supabase", self._db(current)):
            return topcv._work_locations_changed(7, new)

    def test_same_rows_are_not_a_change(self):
        cur = [{"raw_address": self.ADDR, "lat": 21.0, "lng": 105.8, "address_accuracy": "exact_text", "matched_recruitment_regions": ["Hà Nội"]}]
        new = [{"raw_address": "12 nguyễn trãi,  thanh xuân, hà nội", "lat": 21.0000001, "lng": 105.8, "address_accuracy": "exact_text", "matched_recruitment_regions": ["Hà Nội"]}]
        self.assertFalse(self._changed(cur, new), "표기(대소문자·공백)만 다른 같은 줄은 변화가 아니다")

    def test_new_address_or_coordinates_are_a_change(self):
        cur = [{"raw_address": self.ADDR, "lat": None, "lng": None}]
        self.assertTrue(self._changed(cur, [{"raw_address": self.ADDR, "lat": 21.0, "lng": 105.8}]), "좌표가 새로 생김")
        self.assertTrue(self._changed(cur, [{"raw_address": "99 Lê Lợi, Hà Nội", "lat": None, "lng": None}]), "다른 주소")
        self.assertTrue(self._changed([], [{"raw_address": self.ADDR, "lat": None, "lng": None}]), "줄이 없던 공고")

    def test_confirmed_row_coordinates_do_not_force_a_call(self):
        # 확정 줄 좌표는 DB 쓰기 함수가 지킨다 — 수집기 좌표가 달라도 매번 입구를 부르지 않는다
        for cur in ([{"raw_address": self.ADDR, "lat": 21.5, "lng": 105.1, "location_verified": True}],
                    [{"raw_address": self.ADDR, "lat": 21.5, "lng": 105.1, "point_authority": "admin_confirmed"}]):
            self.assertFalse(self._changed(cur, [{"raw_address": self.ADDR, "lat": None, "lng": None}]))

    def _rows(self, *, had_existing, had_transient, own, changed=True):
        with mock.patch.object(topcv, "_has_existing_work_locations", lambda job_id: had_existing), \
                mock.patch.object(topcv, "_own_branch_rows", lambda job_id, resolved: own), \
                mock.patch.object(topcv, "_fetch_protected_work_locations", lambda job_id: []), \
                mock.patch.object(topcv, "_work_location_rpc_rows", lambda rows: [dict(r) for r in rows]), \
                mock.patch.object(topcv, "_work_locations_changed", lambda job_id, rows: changed):
            return topcv._recollect_rows_for_entry(7, own, had_transient)

    def test_existing_rules_kept(self):
        own = [{"raw_address": self.ADDR}]
        self.assertIsNone(self._rows(had_existing=True, had_transient=True, own=own), "geocode 일시 오류 + 지킬 줄 있음 → 쓰지 않음")
        self.assertEqual(len(self._rows(had_existing=False, had_transient=True, own=own)), 1, "일시 오류라도 줄이 0건이면 저장")
        self.assertIsNone(self._rows(had_existing=True, had_transient=False, own=[]), "이 지점 줄이 안 보이면 쓰지 않음")
        self.assertIsNone(self._rows(had_existing=True, had_transient=False, own=own, changed=False), "달라진 것 없음 → 입구를 부르지 않음")
        self.assertEqual(self._rows(had_existing=True, had_transient=False, own=own)[0]["sort_order"], 0, "보호 줄 합치기(merge_protected_work_locations)를 그대로 거친다")


class ApproximateCoordinatesNotSent(unittest.TestCase):
    """지도 정상화 W4c: 수집기의 Geoapify 대략 좌표(동·구·성 수준)는 위치 원본에 보내지 않는다 — 확정 좌표는
    위치 확인 우선순위(Google → VietMap → Goong)와 관리자 확정으로만. 원문 좌표로 검증된 줄만 좌표를 보낸다."""

    def test_only_verified_rows_carry_coordinates(self):
        f = topcv._coordinate_accuracy_for_db
        for tier in ("ward", "region", "unresolved"):
            out = f({"coordinate_accuracy": tier, "lat": 21.0, "lng": 105.8, "geocode_status": "success", "source_verified": False})
            self.assertEqual(out[0], tier, "주소 단계는 그대로")
            self.assertEqual((out[1], out[2]), (None, None), f"{tier}: 대략 좌표는 보내지 않음")
        self.assertEqual(f({"coordinate_accuracy": "exact_candidate", "lat": 21.0, "lng": 105.8, "geocode_status": "success", "source_verified": True})[:3],
                         ("exact", 21.0, 105.8), "원문 좌표로 검증된 줄은 그대로 보냄")
        self.assertEqual(f({"coordinate_accuracy": "exact_candidate", "lat": 21.0, "lng": 105.8, "geocode_status": "success", "source_verified": False})[:3],
                         ("unresolved", None, None), "검증 안 된 후보 좌표는 예전처럼 비움")

    def test_rpc_rows_keep_address_text(self):
        rows = topcv._work_location_rpc_rows([{"raw_address": "Phường Võ Cường, Bắc Ninh", "normalized_address": "phuong vo cuong bac ninh",
                                               "lat": 21.17, "lng": 106.06, "geocode_status": "success", "geocode_source": "geoapify",
                                               "coordinate_accuracy": "ward", "source_verified": False}])
        self.assertEqual((rows[0]["lat"], rows[0]["lng"]), (None, None))
        self.assertEqual(rows[0]["raw_address"], "Phường Võ Cường, Bắc Ninh", "주소 글자는 그대로 보존")
        self.assertIs(rows[0]["location_verified"], False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
