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

        def ingest(sb, payload, hold=True, job_id=None, update_fields=None):
            if job_id is not None:
                return job_id
            url = payload["source_url"]
            self.inserts.append(url)
            if url in self.fail_insert:
                raise RuntimeError("500 Internal Server Error")
            row = {k: payload.get(k) for k in ("title", "company", "salary", "application_deadline", "description",
                                                 "location", "source_url", "active", "admin_hidden")}
            row.update(id=len(self.rows) + 1, origin="crawler")
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
            "publish_gate_reason": "ok", "crawler_version": "t", "_resolved_locations": [{"raw_address": "Bắc Ninh"}],
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
        u2 = "https://vieclam24h.vn/job-2.html"
        self.fail_locations = {u2}
        topcv.save_to_supabase(self._jobs())
        self.assertIn(u2, self.rows)                      # 공고는 들어갔지만
        self.assertFalse(self.rows[u2].get("_has_locations"))  # 근무지는 못 씀
        self.assertEqual(source_fields.JOB_ERRORS.failed_keys(), {u2})
        source_fields.JOB_ERRORS.reset()
        self.fail_locations = set()
        self.inserts.clear()
        topcv.save_to_supabase(self._jobs())
        self.assertEqual(self.inserts, [])                 # 중복 등록 없음
        self.assertTrue(self.rows[u2].get("_has_locations"))  # 다음 수집에서 근무지 채움


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


class SharedCounter(unittest.TestCase):
    def setUp(self):
        source_fields.JOB_ERRORS.reset()

    def test_limit_matches_crawl_guard_three(self):
        self.assertEqual(source_fields.JobErrors.LIMIT, 3)

    def test_reset_clears(self):
        source_fields.JOB_ERRORS.add("a", RuntimeError("x"), key="k")
        source_fields.JOB_ERRORS.reset()
        self.assertEqual(source_fields.JOB_ERRORS.failed, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
