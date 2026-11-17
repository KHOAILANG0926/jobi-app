"""VPS Facebook 수집 예약·잠금 상태 읽기 전용 진단(vps-diag.yml ④, #872·#877).

출력하지 않는 것: 예약 명령 원문, .env 값, 로그 내용. 명령 안에 비밀값이 어떤 모양으로 들어 있어도 로그에 나가지 않게
명령 글자는 아래 고정된 낱말 존재 여부로만 판정하고, 출력은 정해진 칸(일정·스크립트 이름·예/아니오)뿐이다.
종료 코드: 0 = 진단 완료(상태가 무엇이든), 1 = 진단 실패(명령·파일을 읽지 못함 — 상태를 모름).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS = ("run_daily.sh", "crawl_facebook.py", "crawl_topcv.py")
SCHEDULE_RX = re.compile(r"^(@(?:reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)|(?:[\d*/,\-]+\s+){4}[\d*/,\-A-Za-z]+)\s+")


NAMES = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|sun|mon|tue|wed|thu|fri|sat)"
FIELD = re.compile(rf"^(?:[\d*/,\-]+|{NAMES}(?:[,\-]{NAMES})*)$", re.I)


def SAFE_SCHEDULE(s: str) -> bool:
    if s.startswith("@"):
        return bool(re.fullmatch(r"@(?:reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)", s))
    parts = s.split()
    return len(parts) == 5 and all(FIELD.match(p) for p in parts)


def classify(cmd_line: str) -> dict | None:
    """crontab 한 줄 → 안전한 칸만. 수집과 관계없는 줄·주석·환경 줄은 None."""
    line = cmd_line.strip()
    if not line or line.startswith("#"):
        return None
    m = SCHEDULE_RX.match(line)
    rest = line[m.end():] if m else line
    targets = [s for s in SCRIPTS if s in rest]
    if not targets:
        return None  # 수집과 관계없는 줄(NAME=value 환경 줄 등) — 내용은 출력하지 않는다
    # 수집 스크립트가 든 줄인데 일정 모양을 못 읽으면 숨기지 않고 '확인 불가'로 보고한다
    sched = " ".join(m.group(1).split()) if m else "(형식 확인 불가)"
    if not SAFE_SCHEDULE(sched):
        sched = "(형식 확인 불가)"  # 일정 칸도 정해진 모양일 때만 그대로 보여 준다
    return {"schedule": " ".join(sched.split()), "targets": targets,
            "confirm_arg": "--confirm-scheduled-run" in rest}


def read_crontab() -> tuple[str | None, list[dict]]:
    """(오류, 수집 예약 목록). 'no crontab'은 정상 상태(예약 없음)."""
    try:
        r = subprocess.run(["crontab", "-l"], capture_output=True, text=True, timeout=20)
    except Exception as e:  # noqa: BLE001
        return f"crontab 실행 실패({type(e).__name__})", []
    if r.returncode != 0:
        return (None, []) if "no crontab" in (r.stderr or "").lower() else (f"crontab 읽기 실패(코드 {r.returncode})", [])
    return None, [c for c in (classify(l) for l in r.stdout.splitlines()) if c]


def system_cron() -> tuple[str | None, int]:
    d = Path("/etc/cron.d")
    if not d.is_dir():
        return None, 0
    n = 0
    try:
        for f in d.iterdir():
            try:
                if any(s in f.read_text(errors="ignore") for s in SCRIPTS):
                    n += 1
            except PermissionError:
                continue
    except Exception as e:  # noqa: BLE001
        return f"/etc/cron.d 읽기 실패({type(e).__name__})", 0
    return None, n


def crawler_dirs(home: Path) -> list[Path]:
    out = []
    for p in home.glob("**/crawler/run_daily.sh"):
        if "actions-runner" in p.parts or len(p.relative_to(home).parts) > 6:
            continue
        out.append(p.parent)
    return sorted(set(out))


def describe(d: Path) -> tuple[list[str], list[str]]:
    lines, errors = [], []
    try:
        lines.append(f"   run_daily.sh 승인 인자 필요형: {'예' if '--confirm-scheduled-run' in (d / 'run_daily.sh').read_text(errors='ignore') else '아니오(옛 판)'}")
    except Exception as e:  # noqa: BLE001
        errors.append(f"{d.name}/run_daily.sh 읽기 실패({type(e).__name__})")
    for f in ("FACEBOOK_ACCOUNT_LOCK", "FACEBOOK_PAUSED"):
        p = d / "state" / f
        lines.append(f"   {f}: {'있음' if p.exists() else '없음'}")
    last = d / "state" / "facebook_last_run.json"
    if last.exists():
        try:
            j = json.loads(last.read_text(encoding="utf-8"))
            lines.append(f"   마지막 Facebook 실행: {str(j.get('finished_at'))[:19]} / 시험 실행 {bool(j.get('dry_run'))} / 중단 {'있음' if j.get('stop_state') else '없음'}"
                         f" / 후보 {int(j.get('candidates') or 0)} / 저장 {len(j.get('saved_ids') or [])}")
        except Exception as e:  # noqa: BLE001
            errors.append(f"마지막 실행 기록 읽기 실패({type(e).__name__})")
    else:
        lines.append("   마지막 Facebook 실행 기록: 없음")
    env = d / ".env"
    if env.exists():
        try:
            keys = {k for k, v in (l.split("=", 1) for l in env.read_text(errors="ignore").splitlines() if "=" in l and not l.lstrip().startswith("#")) if v.strip()}
            lines.append(f"   .env Facebook 쿠키 설정: {'있음' if {'FB_C_USER', 'FB_XS'} <= keys else '없음'} / DB 열쇠 설정: {'있음' if 'SUPABASE_SERVICE_ROLE_KEY' in keys else '없음'}")
        except Exception as e:  # noqa: BLE001
            errors.append(f".env 읽기 실패({type(e).__name__})")
    else:
        lines.append("   .env: 없음")
    return lines, errors


def main() -> int:
    errors: list[str] = []
    err, entries = read_crontab()
    if err:
        errors.append(err)
    print("== 예약 실행(crontab, 수집 관련 줄만 — 명령 원문은 출력하지 않음)")
    if err:
        print(f"   진단 실패: {err}")
    elif not entries:
        print("   수집 예약: 없음")
    for e in entries:
        print(f"   수집 예약: 일정 [{e['schedule']}] / 대상 {', '.join(e['targets'])} / 승인 인자 {'있음' if e['confirm_arg'] else '없음'}")
    err2, n = system_cron()
    if err2:
        errors.append(err2)
    print(f"== 시스템 예약(/etc/cron.d) 수집 관련 파일: {'진단 실패' if err2 else f'{n}개'}")
    home = Path(os.path.expanduser("~"))
    dirs = crawler_dirs(home)
    print(f"== 수집 코드 사본(실행기 작업 폴더 제외): {len(dirs)}곳")
    for d in dirs:
        print(f"-- {d.relative_to(home)}")
        lines, errs = describe(d)
        print("\n".join(lines))
        errors += errs
    shared = home / "jobi-crawler-state" / "facebook"  # GitHub 실행 경로 공용 상태 폴더(#881)
    print(f"== 공용 수집 상태 폴더(~/jobi-crawler-state/facebook): {'있음' if shared.is_dir() else '없음'}")
    if shared.is_dir():
        for f in ("FACEBOOK_ACCOUNT_LOCK", "FACEBOOK_PAUSED"):
            print(f"   {f}: {'있음' if (shared / f).exists() else '없음'}")
        seen = shared / "facebook_seen.json"
        if seen.exists():
            try:
                print(f"   본 글 기록: {sum(len(v.get('keys', [])) for v in json.loads(seen.read_text(encoding='utf-8')).values())}건")
            except Exception as e:  # noqa: BLE001
                errors.append(f"공용 본 글 기록 읽기 실패({type(e).__name__})")
        else:
            print("   본 글 기록: 없음")
    print()
    if errors:
        print("진단 결과: 실패 — 상태를 다 읽지 못함: " + "; ".join(errors))
        return 1
    print("진단 결과: 완료(위 상태가 실제 상태)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
