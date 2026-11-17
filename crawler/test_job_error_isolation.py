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
