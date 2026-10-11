"""Offline caller/entrypoint regression: no crawler imports, browser, keys or DB.

Execute only the production parser, resolver and __main__ AST nodes.
Every async handler is a recorder. run_daily.sh runs with a fake timeout that
records arguments without invoking Python or Facebook. All fixtures are synthetic.
"""
import argparse
import ast
import asyncio
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import shlex
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "crawler/crawl_topcv.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"), filename=str(SOURCE))
FUNCTIONS = [node for node in TREE.body
             if isinstance(node, ast.FunctionDef)
             and node.name in {"build_arg_parser", "resolve_cli_mode"}]
assert len(FUNCTIONS) == 2
ENTRYPOINTS = [node for node in TREE.body if isinstance(node, ast.If)
              and ast.unparse(node.test) == "__name__ == '__main__'"]
assert len(ENTRYPOINTS) == 1


def pure_namespace():
    namespace = {"argparse": argparse}
    exec(compile(ast.Module(body=FUNCTIONS, type_ignores=[]),
                 str(SOURCE), "exec"), namespace)
    return namespace


def mode_for(argv):
    ns = pure_namespace()
    return ns["resolve_cli_mode"](ns["build_arg_parser"]().parse_args(argv))


def enter_cli(argv):
    """Execute the unchanged actual CLI dispatch with stubbed async handlers."""
    ns = pure_namespace()
    calls = []

    def recorder(name):
        async def record(*args, **kwargs):
            calls.append((name, args, kwargs))
            return {}
        return record

    ns.update({"__name__": "__main__", "asyncio": asyncio, "json": json})
    for name in ("main", "process_single_url", "reprocess_jobs",
                 "process_urls_verify_write", "process_urls_dry_run"):
        ns[name] = recorder(name)
    with patch.object(sys, "argv", ["crawl_topcv.py", *argv]):
        with contextlib.redirect_stdout(io.StringIO()):
            try:
                exec(compile(ast.Module(body=ENTRYPOINTS, type_ignores=[]),
                             str(SOURCE), "exec"), ns)
            except SystemExit:
                if calls:
                    raise AssertionError("rejected CLI already dispatched a handler")
                raise
    return calls


class CliEntrypointTests(unittest.TestCase):
    def test_no_argument_rejected_before_dispatch(self):
        with self.assertRaisesRegex(SystemExit, "confirm-full-crawl"):
            enter_cli([])

    def test_explicit_manual_full_crawl_dispatches_only_stub(self):
        self.assertEqual(enter_cli(["--confirm-full-crawl"]), [
            ("main", (), {"sample_limit": None, "sample_offset": 0,
                          "new_only": False, "site": "vieclam24h"})])

    def test_manual_sample_options_reach_handler(self):
        self.assertEqual(enter_cli([
            "--confirm-full-crawl", "--sample-limit", "5",
            "--new-only", "--site", "vietnamworks",
        ]), [("main", (), {"sample_limit": 5, "sample_offset": 0,
                          "new_only": True, "site": "vietnamworks"})])

    def test_invalid_arguments_rejected_before_dispatch(self):
        cases = [
            ["--confirm-full-craw"],
            ["--unknown"],
            ["--confirm-full-crawl", "--site", "unknown"],
            ["--confirm-full-crawl", "--sample-limit", "11"],
            ["--confirm-full-crawl", "--sample-limit", "0"],
            ["--confirm-full-crawl", "--sample-offset", "-1"],
            ["--confirm-full-crawl", "--new-only"],
            ["--process-url", "https://example.invalid/job"],
            ["--reprocess-ids", "123"],
            ["--verify-write-urls", "https://example.invalid/job"],
        ]
        for argv in cases:
            with self.subTest(argv=argv):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit):
                        enter_cli(argv)

    def test_full_crawl_confirmation_cannot_mix_with_targeted_modes(self):
        for option, value, extra in [
            ("--process-url", "https://example.invalid/job", ["--confirm-write"]),
            ("--reprocess-ids", "123", ["--confirm-write"]),
            ("--verify-write-urls", "https://example.invalid/job",
             ["--confirm-write", "--verify-write"]),
            ("--dry-run-urls", "https://example.invalid/job", []),
        ]:
            with self.subTest(option=option):
                with self.assertRaisesRegex(SystemExit, "confirm-full-crawl"):
                    enter_cli(["--confirm-full-crawl", option, value, *extra])

    def test_two_target_modes_rejected(self):
        with self.assertRaisesRegex(SystemExit, "하나만"):
            enter_cli(["--process-url", "https://example.invalid/job",
                       "--confirm-write", "--dry-run-urls",
                       "https://example.invalid/other"])

    def test_targeted_manual_dispatch_preserved(self):
        self.assertEqual(enter_cli([
            "--process-url", "https://example.invalid/job", "--confirm-write",
        ]), [("process_single_url", ("https://example.invalid/job",),
              {"confirm_write": True, "verify_write": False})])
        self.assertEqual(enter_cli([
            "--reprocess-ids", "123,456", "--confirm-write",
        ]), [("reprocess_jobs", ([123, 456],), {"confirm_write": True})])

    def test_existing_dry_run_dispatch_preserved(self):
        self.assertEqual(enter_cli([
            "--dry-run-urls", "https://example.invalid/a,https://example.invalid/b",
        ]), [("process_urls_dry_run",
              (["https://example.invalid/a", "https://example.invalid/b"],), {})])

    def test_existing_cli_safety_suite_without_import_side_effects(self):
        module = types.ModuleType("crawl_topcv")
        module.__dict__.update(pure_namespace())
        # Existing tests unchanged; replacing only their import avoids load_dotenv,
        # Supabase client construction and Playwright imports at module top level.
        with patch.dict(sys.modules, {"crawl_topcv": module}):
            with contextlib.redirect_stdout(io.StringIO()):
                with contextlib.redirect_stderr(io.StringIO()):
                    legacy = runpy.run_path(str(ROOT / "crawler/test_cli_safety.py"))
                    self.assertEqual(legacy["main"](), 0)


class ScheduledCallerTests(unittest.TestCase):
    def test_actions_command_enters_full_mode(self):
        source = (ROOT / ".github/workflows/crawl.yml").read_text(encoding="utf-8")
        commands = [line.strip()[5:] for line in source.splitlines()
                    if line.strip().startswith("run: python crawler/crawl_topcv.py")]
        self.assertEqual(len(commands), 1)
        command = shlex.split(commands[0])
        self.assertEqual(command[:2], ["python", "crawler/crawl_topcv.py"])
        self.assertEqual(mode_for(command[2:]), "full_crawl")
        self.assertEqual(enter_cli(command[2:])[0][0], "main")

    def test_actions_manual_confirmation_is_opt_in(self):
        # Configuration contract only; GitHub's scheduler itself is not executed.
        source = (ROOT / ".github/workflows/crawl.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", source)
        self.assertIn("confirm_full_crawl:", source)
        self.assertIn("type: boolean", source)
        self.assertIn("default: false", source)
        self.assertIn("if: github.event_name == 'schedule' || "
                      "(github.event_name == 'workflow_dispatch' && "
                      "inputs.confirm_full_crawl == true)", source)

    def run_daily_with_fake_timeout(self, exit_code):
        if not shutil.which("bash"):
            self.skipTest("bash unavailable; caller integration not executed")
        with tempfile.TemporaryDirectory(prefix="crawler-cli-offline-") as folder:
            work = Path(folder)
            script = work / "run_daily.sh"
            script.write_text((ROOT / "crawler/run_daily.sh").read_text(
                encoding="utf-8"), encoding="utf-8")
            (work / ".env").write_text("# synthetic fixture; no credentials\n",
                                      encoding="utf-8")
            bin_dir = work / "bin"
            bin_dir.mkdir()
            fake_timeout = bin_dir / "timeout"
            fake_timeout.write_text(
                '#!/bin/sh\nprintf "%s\\n" "$@" > "$CLI_CAPTURE"\n'
                'exit "$CLI_EXIT"\n', encoding="utf-8")
            fake_timeout.chmod(0o755)
            capture = work / "argv.txt"
            env = {key: value for key, value in os.environ.items()
                   if key in {"PATH", "HOME", "LANG", "TMPDIR"}}
            env.update({"PATH": str(bin_dir) + os.pathsep + env.get("PATH", ""),
                        "CLI_CAPTURE": str(capture), "CLI_EXIT": str(exit_code),
                        "TOPCV_CRAWLER_TIMEOUT": "7m"})
            result = subprocess.run(["bash", str(script)], cwd=work, env=env,
                                    capture_output=True, text=True, timeout=10)
            self.assertNotIn("Running Facebook", result.stdout)
            self.assertEqual(capture.read_text().splitlines(),
                             ["7m", "python3", "-u", "crawl_topcv.py",
                              "--confirm-full-crawl"])
            # Captured real Bash argv goes through the actual parser/dispatch.
            self.assertEqual(enter_cli(capture.read_text().splitlines()[4:])[0][0],
                             "main")
            return result.returncode

    def test_daily_wrapper_passes_confirmation_and_timeout(self):
        self.assertEqual(self.run_daily_with_fake_timeout(0), 0)

    def test_daily_wrapper_preserves_failure_status(self):
        self.assertEqual(self.run_daily_with_fake_timeout(124), 1)

    def test_daily_bash_syntax(self):
        if not shutil.which("bash"):
            self.skipTest("bash unavailable; syntax check not executed")
        result = subprocess.run(["bash", "-n", str(ROOT / "crawler/run_daily.sh")],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
