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
import re
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
        self.assertEqual(len(commands), 1)  # 시험 수집(저장 없음)만 — 운영 DB 저장 단계 없음(#881)
        command = shlex.split(commands[0].replace('"$SAMPLE_LIMIT"', "3"))
        self.assertEqual(command[:2], ["python", "crawler/crawl_topcv.py"])
        self.assertEqual(mode_for(command[2:]), "full_crawl")
        self.assertEqual(enter_cli(command[2:])[0][0], "main")
        self.assertIn("--sample-limit", command)
        self.assertNotIn("--site", command)  # 기본 --site = vieclam24h(crawl_topcv.py는 vieclam24h 수집기)
        self.assertEqual(pure_namespace()["build_arg_parser"]().parse_args(command[2:]).site, "vieclam24h")

    def test_actions_manual_confirmation_is_opt_in(self):
        # Lee 2026-11-17 #872·#881: 예약 계기 없음(정기 수집 불가), 열쇠 없음(저장 불가), 수동 시험만
        source = (ROOT / ".github/workflows/crawl.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", source)
        self.assertNotIn("schedule:", source)
        self.assertNotIn("cron:", source)
        self.assertNotIn("secrets.", source)
        self.assertNotIn("environment: ops-keys", source)
        job_if = [l.strip() for l in source.splitlines() if l.startswith("    if:")]
        self.assertEqual(job_if, ["if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master' && inputs.dry_run"])
        self.assertIn("'^([1-9]|10)$'", source)

    def test_facebook_account_users_share_one_state_dir(self):
        # #881: 같은 Facebook 계정을 쓰는 실행이 모두 같은 계정 잠금·본 글 기록 폴더를 본다 — 수집기 기본값과 run_daily가 같은 곳,
        # 워크플로가 다른 폴더를 넘기지 않는다(한국 조사 워크플로는 안 고침: korea-fb-survey는 파일이 바뀌면 병합 때 자동으로 돌기 때문)
        fb = (ROOT / "crawler/crawl_facebook.py").read_text(encoding="utf-8")
        self.assertIn('else Path.home() / "jobi-crawler-state" / "facebook"', fb)
        daily = (ROOT / "crawler/run_daily.sh").read_text(encoding="utf-8")
        self.assertIn('export CRAWLER_STATE_DIR="${CRAWLER_STATE_DIR:-$HOME/jobi-crawler-state/facebook}"', daily)
        for wf in sorted((ROOT / ".github/workflows").glob("*.yml")):
            for m in re.finditer(r"CRAWLER_STATE_DIR=([^\s\"]+)", wf.read_text(encoding="utf-8")):
                self.assertEqual(m.group(1), "$d", wf.name)
            src = wf.read_text(encoding="utf-8")
            if "CRAWLER_STATE_DIR=$d" in src:
                self.assertIn('d="$HOME/jobi-crawler-state/facebook"', src, wf.name)

    def test_daily_wrapper_sees_shared_account_lock(self):
        # run_daily.sh를 실제로 돌려, 다른 작업이 공용 폴더에 만든 계정 잠금을 보고 Facebook을 건너뛰는지(#881 검토관)
        if not shutil.which("bash"):
            self.skipTest("bash unavailable")
        with tempfile.TemporaryDirectory(prefix="crawler-lock-") as folder:
            work = Path(folder)
            (work / "run_daily.sh").write_text((ROOT / "crawler/run_daily.sh").read_text(encoding="utf-8"), encoding="utf-8")
            (work / ".env").write_text("FB_C_USER=x\nFB_XS=y\n", encoding="utf-8")
            home = work / "home"
            lock_dir = home / "jobi-crawler-state" / "facebook"
            lock_dir.mkdir(parents=True)
            (lock_dir / "FACEBOOK_ACCOUNT_LOCK").write_text("checkpoint", encoding="utf-8")
            bin_dir = work / "bin"; bin_dir.mkdir()
            (bin_dir / "timeout").write_text('#!/bin/sh\necho "RAN $*" >> "$CLI_CAPTURE"\nexit 0\n', encoding="utf-8")
            (bin_dir / "timeout").chmod(0o755)
            capture = work / "ran.txt"
            env = {k: v for k, v in os.environ.items() if k in {"PATH", "LANG", "TMPDIR"}}
            env.update({"HOME": str(home), "PATH": str(bin_dir) + os.pathsep + env.get("PATH", ""), "CLI_CAPTURE": str(capture)})
            result = subprocess.run(["bash", str(work / "run_daily.sh"), "--confirm-scheduled-run"], cwd=work, env=env,
                                    capture_output=True, text=True, timeout=10)
            self.assertIn("Facebook crawler locked", result.stdout)
            self.assertNotIn("crawl_facebook.py", capture.read_text() if capture.exists() else "")
            self.assertNotEqual(result.returncode, 0)  # 잠금은 실패로 기록

    def test_daily_wrapper_honours_legacy_lock(self):
        if not shutil.which("bash"):
            self.skipTest("bash unavailable")
        with tempfile.TemporaryDirectory(prefix="crawler-legacy-") as folder:
            work = Path(folder)
            (work / "run_daily.sh").write_text((ROOT / "crawler/run_daily.sh").read_text(encoding="utf-8"), encoding="utf-8")
            (work / ".env").write_text("FB_C_USER=x\nFB_XS=y\n", encoding="utf-8")
            (work / "state").mkdir()
            (work / "state" / "FACEBOOK_PAUSED").write_text("", encoding="utf-8")
            bin_dir = work / "bin"; bin_dir.mkdir()
            (bin_dir / "timeout").write_text('#!/bin/sh\necho "RAN $*" >> "$CLI_CAPTURE"\nexit 0\n', encoding="utf-8")
            (bin_dir / "timeout").chmod(0o755)
            capture = work / "ran.txt"
            env = {k: v for k, v in os.environ.items() if k in {"PATH", "LANG", "TMPDIR"}}
            env.update({"HOME": str(work / "home"), "PATH": str(bin_dir) + os.pathsep + env.get("PATH", ""), "CLI_CAPTURE": str(capture)})
            result = subprocess.run(["bash", str(work / "run_daily.sh"), "--confirm-scheduled-run"], cwd=work, env=env,
                                    capture_output=True, text=True, timeout=10)
            self.assertIn("Skipping Facebook crawler: paused", result.stdout)
            self.assertNotIn("crawl_facebook.py", capture.read_text() if capture.exists() else "")

    def test_facebook_keys_only_in_steps_that_need_them(self):
        # Lee 2026-11-17 #881(S4 열쇠 분리 유지): 미리 보기 = Facebook 쿠키만, 저장 = DB·판독 열쇠만. 잡 전체에는 비밀값 없음.
        src = (ROOT / ".github/workflows/crawl-facebook-one.yml").read_text(encoding="utf-8")
        job = src.split("\njobs:\n", 1)[1]
        job_env = job.split("    steps:", 1)[0]
        self.assertNotIn("secrets.", job_env)
        steps = re.split(r"\n(?=      - (?:name|uses):)", job.split("    steps:", 1)[1])
        def step(title):
            found = [b for b in steps if title in b.split("\n", 1)[0]]
            self.assertEqual(len(found), 1, title)
            return found[0]
        dry, save = step("미리 보기(저장 없음)"), step("고른 1건만 입구")
        self.assertIn("secrets.FB_C_USER", dry)
        for k in ("SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"):
            self.assertNotIn(f"secrets.{k}", dry, k)
            self.assertIn(f"secrets.{k}", save, k)
        self.assertNotIn("secrets.FB_", save)
        self.assertNotIn("mode == 'run'", src)  # 시험 정상 실행(운영 DB 저장) 모드는 저장 시험 승인 뒤 따로(#881)
        others = [b for b in steps if b not in (dry, save)]
        for b in others:
            self.assertNotRegex(b, r"secrets\.(?!GITHUB_TOKEN)", b.split("\n", 1)[0])

    def test_self_hosted_jobs_never_use_sparse_checkout(self):
        # #877 회귀(run 44008399438): VPS 실행기는 작업 폴더를 모든 워크플로가 같이 쓴다 — 한 곳의 부분 받기 설정이 남아
        # 다른 수집 작업이 crawler/requirements.txt를 못 찾았다. 자체 실행기 워크플로에서는 부분 받기를 쓰지 않는다.
        for wf in sorted((ROOT / ".github/workflows").glob("*.yml")):
            src = wf.read_text(encoding="utf-8")
            jobs = src.split("\njobs:\n", 1)[-1]
            for block in re.split(r"\n(?=  [A-Za-z0-9_-]+:\s*$)", jobs, flags=re.M):
                runs_on = [l for l in block.splitlines() if l.strip().startswith("runs-on:")]
                if any("self-hosted" in l for l in runs_on):
                    self.assertNotIn("sparse-checkout:", block, f"{wf.name}: 자체 실행기 잡에 부분 받기")
        diag = (ROOT / ".github/workflows/vps-diag.yml").read_text(encoding="utf-8")
        # 작업 폴더 초기화는 이 저장소 실행기 작업 폴더일 때만 지운다(다른 경로면 멈춤)
        self.assertIn('"$HOME"/actions-runner/_work/jobi-app/jobi-app) find "$GITHUB_WORKSPACE" -mindepth 1 -maxdepth 1', diag)
        self.assertIn('예상 밖 작업 폴더 — 지우지 않음', diag)

    def test_actions_environment_can_install_requirements(self):
        # 2026-08-24~28 실제 실행 5건 모두 설치 실패(ubuntu-latest=24.04 + playwright 1.44 → libasound2 없음).
        # vietnam-provinces(requirements.txt)는 Python 3.12 이상. 재개 전에 같은 실패가 나지 않게 고정한다.
        source = (ROOT / ".github/workflows/crawl.yml").read_text(encoding="utf-8")
        reqs = (ROOT / "crawler/requirements.txt").read_text(encoding="utf-8")
        runs_on = [l.split(":", 1)[1].strip() for l in source.splitlines() if l.strip().startswith("runs-on:")]
        # Lee 2026-11-17 #872: GitHub 서버는 vieclam24h가 403으로 막음 → 기존 VPS 실행기에서 소량 시험(Facebook과 폴더 분리)
        self.assertEqual(runs_on, ["[self-hosted, Linux, X64]"])
        self.assertIn("path: vieclam24h-run", source)
        self.assertIn("working-directory: vieclam24h-run", source)
        self.assertNotIn("/tmp/", source)
        self.assertNotIn("CRAWLER_STATE_DIR", source)
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY: ''", source)
        versions = re.findall(r"python-version:\s*'(\d+)\.(\d+)'", source)
        self.assertEqual(len(versions), 1)
        self.assertGreaterEqual(tuple(map(int, versions[0])), (3, 12))
        self.assertIn("playwright==1.44.0", reqs)  # 판을 올리면 24.04 지원 여부를 다시 확인하고 이 시험도 고친다
        self.assertIn("vietnam-provinces==2026.9.0", reqs)
        # 설치 확인 잡(crawler-cli-tests.yml crawl-install)이 crawl.yml과 같은 환경·명령을 실제로 돌린다
        ci = (ROOT / ".github/workflows/crawler-cli-tests.yml").read_text(encoding="utf-8")
        job = ci.split("crawl-install:", 1)[1]
        self.assertIn("runs-on: ubuntu-22.04", job)
        self.assertIn("python-version: '3.12'", job)
        self.assertIn("python -m pip install -r crawler/requirements.txt", source)
        self.assertIn("python -m playwright install chromium", source)  # VPS 실행기 계정은 관리자 권한 없음(Facebook 미리 보기와 같은 명령)
        for cmd in ("python -m pip install -r crawler/requirements.txt", "python -m playwright install --with-deps chromium"):
            self.assertIn(cmd, job)

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
            result = subprocess.run(["bash", str(script), "--confirm-scheduled-run"], cwd=work, env=env,
                                    capture_output=True, text=True, timeout=10)
            self.assertNotIn("Running Facebook", result.stdout)
            self.assertEqual(capture.read_text().splitlines(),
                             ["7m", "python3", "-u", "crawl_topcv.py",
                              "--confirm-full-crawl"])
            # Captured real Bash argv goes through the actual parser/dispatch.
            self.assertEqual(enter_cli(capture.read_text().splitlines()[4:])[0][0],
                             "main")
            return result.returncode

    def test_daily_no_argument_stays_paused_before_env_or_timeout(self):
        result = subprocess.run(["bash", str(ROOT / "crawler/run_daily.sh")],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Collection paused", result.stdout)
        self.assertNotIn("Daily crawler started", result.stdout)

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
