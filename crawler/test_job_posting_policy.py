"""Offline shared fixtures and exact Python/JS result parity; no crawler import."""
import ast
import json
from pathlib import Path
import subprocess
import unittest
from job_posting_policy import evaluate_job_posting_policy, crawler_policy_errors, has_excluded_money_role
import job_quality

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "policy/job-posting-fixtures.json").read_text("utf-8"))


class PostingPolicyTests(unittest.TestCase):
    def test_shared_cases_and_skip(self):
        for fixture in CASES:
            with self.subTest(fixture=fixture["id"]):
                result = evaluate_job_posting_policy(fixture["input"])
                self.assertEqual(result["decision"], fixture["expected"])
                self.assertEqual(bool(crawler_policy_errors(fixture["input"])), fixture["expected"] != "allow")
                self.assertEqual(job_quality.has_excluded_money_terms(
                    **{key: fixture["input"][key] for key in ("title", "company", "description", "category")}
                ), has_excluded_money_role(fixture["input"]))

    def test_python_javascript_exact_parity(self):
        result = subprocess.run(["node", str(ROOT / "scripts/job-policy-results.mjs")],
                                capture_output=True, text=True, check=True, timeout=15)
        self.assertEqual(json.loads(result.stdout),
                         [evaluate_job_posting_policy(f["input"]) for f in CASES])

    def test_policy_change_reentry_does_not_trust_cached_allow(self):
        for fixture in CASES:
            if fixture["expected"] == "allow":
                continue
            self.assertTrue(crawler_policy_errors({
                **fixture["input"], "policy_decision": "allow", "policy_version": "old",
            }))

    def test_topcv_final_upsert_rejects_new_and_existing_without_db(self):
        tree = ast.parse((ROOT / "crawler/crawl_topcv.py").read_text("utf-8"))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "upsert_job_record")
        # Run the actual final write boundary only. Any escaped INSERT/UPDATE,
        # location sync or top-level crawler import would fail this namespace.
        for fixture in CASES:
            if fixture["expected"] == "allow":
                continue
            for existing in (None, {"id": 7, "active": True, "admin_hidden": False}):
                ns = {"_require_write_enabled": lambda: None,
                      "match_existing_row": lambda *args, row=existing: row,
                      "crawler_policy_errors": crawler_policy_errors}
                exec(compile(ast.Module(body=[fn], type_ignores=[]), "upsert-offline", "exec"), ns)
                result = ns["upsert_job_record"](fixture["input"], {}, {})
                self.assertEqual(result["action"], "policy_skipped")
                self.assertEqual(result["id"], 7 if existing else None)

    def test_facebook_final_required_guard(self):
        tree = ast.parse((ROOT / "crawler/crawl_facebook.py").read_text("utf-8"))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "missing_required")
        ns = {"crawler_policy_errors": crawler_policy_errors,
              "SEE_MORE_LABELS": ("See more",), "is_self_promotion": lambda text: False}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "facebook-offline", "exec"), ns)
        for fixture in CASES:
            job = {**fixture["input"], "employer_phone": "synthetic", "location": "Synthetic"}
            self.assertEqual(any(p.startswith("posting policy skip") for p in ns["missing_required"](job)),
                             fixture["expected"] != "allow")

    def test_shift_does_not_override_professional_sales_or_brand_ambiguity(self):
        self.assertEqual(evaluate_job_posting_policy({
            "title": "Sale Executive", "company": "Synthetic",
            "description": "Đại lý, ca 1/ca 2, thu nhập 30 triệu, hoa hồng là phần lớn thu nhập.",
            "salary": "30 triệu VND",
        })["decision"], "review")
        self.assertEqual(evaluate_job_posting_policy({
            "title": "Sales", "company": "Kinh Đô", "description": "Thông tin sản phẩm do đại lý giới thiệu.",
        })["decision"], "review")

    def test_source_tag_is_not_role_evidence(self):
        self.assertEqual(evaluate_job_posting_policy({
            "title": "Công nhân", "description": "[source:legacy]",
        })["decision"], "review")


if __name__ == "__main__":
    unittest.main(verbosity=2)
