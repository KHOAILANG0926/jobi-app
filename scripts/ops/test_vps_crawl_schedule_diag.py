"""vps-crawl-schedule-diag.py 시험: 예약 명령 원문·비밀값이 출력에 절대 안 나오는지, 진단 실패와 정상 상태 구분(#877 Lee 지적)."""
import contextlib
import importlib.util
import io
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("diag", Path(__file__).with_name("vps-crawl-schedule-diag.py"))
diag = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diag)

SECRETS = ["sk-live-AAAA1111", "xs=9%3Aabc", "Bearer eyJhbGciOi", "p4ssw0rd", "TOKEN=zzz"]
CRONTAB = "\n".join([
    "SUPABASE_SERVICE_ROLE_KEY=sk-live-AAAA1111",
    "# 0 1 * * * old comment run_daily.sh",
    "0 15 * * * cd /home/u/jobi-app/crawler && FB_XS='xs=9%3Aabc' ./run_daily.sh --confirm-scheduled-run >> cron.log 2>&1",
    "30 2 * * 1-5 curl -H 'Authorization: Bearer eyJhbGciOi' http://x/ ; python3 crawl_topcv.py --pw p4ssw0rd",
    "@daily TOKEN=zzz /home/u/jobi-app/crawler/run_daily.sh",
    "*/5 * * * * /usr/bin/backup.sh p4ssw0rd",
    "0 p4ssw0rd * * * run_daily.sh",
])


def run_main(crontab_out="", rc=0, stderr="", home=None):
    fake = subprocess.CompletedProcess(["crontab", "-l"], rc, crontab_out, stderr)
    out = io.StringIO()
    with mock.patch.object(diag.subprocess, "run", return_value=fake), \
            mock.patch.object(diag.os.path, "expanduser", return_value=str(home or tempfile.mkdtemp())), \
            mock.patch.object(diag, "system_cron", return_value=(None, 0)), contextlib.redirect_stdout(out):
        code = diag.main()
    return code, out.getvalue()


class Diag(unittest.TestCase):
    def test_no_raw_command_or_secret_in_output(self):
        code, out = run_main(CRONTAB)
        self.assertEqual(code, 0)
        for s in SECRETS + ["cron.log", "curl", "/home/u", "Authorization", "backup.sh", "cd "]:
            self.assertNotIn(s, out)
        self.assertIn("일정 [0 15 * * *] / 대상 run_daily.sh / 승인 인자 있음", out)
        self.assertIn("일정 [30 2 * * 1-5] / 대상 crawl_topcv.py / 승인 인자 없음", out)
        self.assertIn("일정 [@daily] / 대상 run_daily.sh / 승인 인자 없음", out)
        self.assertIn("일정 [(형식 확인 불가)]", out)  # 일정 칸에 이상한 글자가 있으면 그것도 안 보여 줌
        self.assertNotIn("backup", out)  # 수집과 관계없는 예약은 보고하지 않음

    def test_no_crontab_is_normal_state(self):
        code, out = run_main("", rc=1, stderr="no crontab for runner")
        self.assertEqual(code, 0)
        self.assertIn("수집 예약: 없음", out)
        self.assertIn("진단 결과: 완료", out)

    def test_crontab_error_is_diagnosis_failure(self):
        code, out = run_main("", rc=126, stderr="permission denied")
        self.assertEqual(code, 1)
        self.assertIn("진단 실패", out)
        self.assertIn("진단 결과: 실패", out)
        self.assertNotIn("수집 예약: 없음", out)

    def test_lock_and_env_reported_without_values(self):
        home = Path(tempfile.mkdtemp())
        d = home / "jobi-app" / "crawler"
        (d / "state").mkdir(parents=True)
        (d / "run_daily.sh").write_text('if [[ "$1" != "--confirm-scheduled-run" ]]; then exit 2; fi')
        (d / "state" / "FACEBOOK_ACCOUNT_LOCK").write_text("checkpoint secret-reason p4ssw0rd")
        (d / ".env").write_text("FB_C_USER=123\nFB_XS=xs=9%3Aabc\nSUPABASE_SERVICE_ROLE_KEY=sk-live-AAAA1111\n")
        (d / "state" / "facebook_last_run.json").write_text('{"finished_at":"2026-09-30T22:00:00","dry_run":false,"stop_state":"checkpoint p4ssw0rd","candidates":7,"saved_ids":[1,2]}')
        code, out = run_main("", rc=1, stderr="no crontab", home=home)
        self.assertEqual(code, 0)
        for s in SECRETS + ["checkpoint", "123"]:
            self.assertNotIn(s, out)
        self.assertIn("FACEBOOK_ACCOUNT_LOCK: 있음", out)
        self.assertIn("FACEBOOK_PAUSED: 없음", out)
        self.assertIn("승인 인자 필요형: 예", out)
        self.assertIn("Facebook 쿠키 설정: 있음 / DB 열쇠 설정: 있음", out)
        self.assertIn("후보 7 / 저장 2", out)

    def test_shared_state_dir_reported(self):
        home = Path(tempfile.mkdtemp())
        d = home / "jobi-crawler-state" / "facebook"
        d.mkdir(parents=True)
        (d / "FACEBOOK_ACCOUNT_LOCK").write_text("checkpoint p4ssw0rd")
        (d / "facebook_last_run.json").write_text('{"finished_at":"2026-11-17T10:00:00","dry_run":true,"stop_state":null,"candidates":30,"saved_ids":[]}')
        (d / "facebook_seen.json").write_text('{"g":{"keys":["a","b"]}}')
        code, out = run_main("", rc=1, stderr="no crontab", home=home)
        self.assertEqual(code, 0)
        self.assertNotIn("p4ssw0rd", out)
        self.assertIn("공용 수집 상태 폴더(~/jobi-crawler-state/facebook): 있음", out)
        self.assertIn("FACEBOOK_ACCOUNT_LOCK: 있음", out)
        self.assertIn("후보 30 / 저장 0", out)
        self.assertIn("본 글 기록: 2건", out)

    def test_unreadable_state_is_failure(self):
        home = Path(tempfile.mkdtemp())
        d = home / "jobi-app" / "crawler"
        (d / "state").mkdir(parents=True)
        (d / "run_daily.sh").write_text("x")
        (d / "state" / "facebook_last_run.json").write_text("{broken")
        code, out = run_main("", rc=1, stderr="no crontab", home=home)
        self.assertEqual(code, 1)
        self.assertIn("마지막 실행 기록 읽기 실패", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
