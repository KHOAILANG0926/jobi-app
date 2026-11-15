#!/usr/bin/env python3
"""S4(#808) 워크플로 검사: 열쇠(비밀값·쓰기 토큰·id-token)를 가진 잡이 PR·브랜치 코드를 실행하지 못하게 막는다.

규칙(잡마다):
  R1 열쇠 있는 잡이 PR·브랜치 코드를 작업 폴더에 펼치면(actions/checkout ref가 기본 브랜치·자기 커밋이 아님, 또는 run의 git checkout/switch/reset)
     그 뒤 run 단계에서 저장소 코드를 실행하지 않는다(npm·npx·node·python·pip·make·bash scripts/·./scripts).
     다른 폴더에 펼친 경우(git worktree add)는 그 폴더를 가리키는 코드 실행 줄을 막는다.
     허용: 기준 사본($RUNNER_TEMP/trusted)의 스크립트, 상자 실행기(sandbox-run.sh — PR 사본을 열쇠 없는 컨테이너에서만 실행).
  R2 그 체크아웃은 persist-credentials: false (쓰기 토큰을 .git에 남기지 않음).
  R3 그 잡의 claude-code-action은 PR 코드 실행 명령(Bash(npm/npx/node/python/make…))을 허용하지 않는다.
  R4 run-id로 다른 실행의 artifact를 받는 잡은 그 전에 verify-artifact-run.sh로 출처를 확인한다.
사용: check-secret-isolation.py [워크플로 폴더 또는 파일...] (기본 .github/workflows). 문제 있으면 줄마다 출력하고 1로 끝낸다.
"""
import glob
import os
import re
import sys

import yaml

CODE_RUN = re.compile(r'(^|[\s;&|(`$])((npm|npx|node|yarn|pnpm|python3?|pip3?|make)(\s|$)|(bash|sh)\s+\S*scripts/|\./scripts/)')
TRUSTED = re.compile(r'(\$RUNNER_TEMP|\$\{\{\s*runner\.temp\s*\}\}|"\$T")/?(trusted)?')
# 작업 폴더를 다른 커밋으로 바꾸는 명령(-C 다른 폴더는 제외). git fetch만으로는 작업 폴더가 바뀌지 않는다.
GIT_SWITCH = re.compile(r'git\s+(?!-C\b)(checkout|switch|reset)\b[^\n]*(\$|origin/)')
# 다른 커밋을 다른 폴더에 펼치는 명령: 그 폴더의 코드는 상자(sandbox-run.sh)로만 실행해야 한다.
WORKTREE = re.compile(r'git\s+worktree\s+add\s+(?:-\S+\s+)*("[^"]+"|\S+)')
CLAUDE_CODE_TOOLS = re.compile(r'Bash\((npm|npx|node|yarn|pnpm|python3?|make|pip3?)\b')
# 기본 브랜치, 또는 이 실행 자신의 커밋(github.ref/sha — 워크플로 파일과 같은 출처라 더 믿을 것도 덜 믿을 것도 없음.
# 브랜치에서 돈 실행 자체의 비밀값 접근은 이 검사가 아니라 Environment(master 전용, S4 L2)가 막는다).
DEFAULT_REFS = ('', 'master', 'main', '${{ github.event.repository.default_branch }}', 'refs/heads/master',
                '${{ github.ref }}', '${{ github.sha }}')


def text(v):
    return yaml.safe_dump(v) if not isinstance(v, str) else v


def has_secret(obj):
    return any(name != 'GITHUB_TOKEN' for name in re.findall(r'secrets\.([A-Za-z0-9_]+)', text(obj)))


def writes(perms):
    if perms in ('write-all',):
        return True
    if isinstance(perms, dict):
        return any(v == 'write' for v in perms.values())
    return False


def privileged(wf, job):
    perms = job.get('permissions', wf.get('permissions'))
    # 권한 선언이 없으면 저장소 기본 토큰 권한(쓰기일 수 있음)을 따른다 → 열쇠 있는 것으로 본다.
    return has_secret(wf.get('env')) or has_secret(job) or writes(perms) or perms is None


def line_trusted(line):
    return bool(TRUSTED.search(line)) and 'trusted' in line or '"$T/' in line


def check_job(path, wf, name, job):
    out = []
    steps = job.get('steps') or []
    priv = privileged(wf, job)
    untrusted = False
    foreign_dirs = []
    verified_artifact = False
    for i, st in enumerate(steps):
        where = f'{path} jobs.{name}.steps[{i}] {st.get("name") or st.get("uses") or ""}'.strip()
        uses = st.get('uses') or ''
        w = st.get('with') or {}
        if uses.startswith('actions/checkout'):
            ref = str(w.get('ref', '')).strip()
            if ref not in DEFAULT_REFS and not ref.startswith('refs/heads/master'):
                untrusted = True
                if priv and str(w.get('persist-credentials', 'true')).lower() != 'false':
                    out.append(f'R2 {where}: 열쇠 있는 잡이 PR·브랜치 코드를 체크아웃하면서 persist-credentials: false가 없음')
        run = st.get('run') or ''
        if run:
            for ln in run.splitlines():
                code = ln.split('#', 1)[0]
                if GIT_SWITCH.search(code):
                    untrusted = True
                m = WORKTREE.search(code)
                if m:
                    foreign_dirs.append(m.group(1).strip('"'))
                # 상자 실행기는 믿을 수 있는 사본일 때만 허용: 작업 폴더가 PR 코드로 바뀌었으면 기준 사본 경로여야 한다.
                sandbox_ok = 'sandbox-run.sh' in code and (not untrusted or line_trusted(code))
                runs_code = CODE_RUN.search(code) and not line_trusted(code) and not sandbox_ok
                if priv and runs_code and (untrusted or any(d in code for d in foreign_dirs)):
                    out.append(f'R1 {where}: 열쇠 있는 잡이 PR·브랜치 코드를 실행 — {code.strip()[:120]}')
            if 'verify-artifact-run.sh' in run:
                verified_artifact = True
        if uses.startswith('anthropics/claude-code-action') and priv and untrusted:
            tools = text(w.get('claude_args', '')) + text(w.get('allowed_tools', ''))
            m = CLAUDE_CODE_TOOLS.search(tools)
            if m:
                out.append(f'R3 {where}: PR 코드를 체크아웃한 잡의 Claude가 코드 실행 명령을 허용 — {m.group(0)}')
        if uses.startswith('actions/download-artifact') and w.get('run-id') and not verified_artifact:
            out.append(f'R4 {where}: 다른 실행의 artifact를 출처 확인(verify-artifact-run.sh) 없이 받음')
    return out


def check_file(path):
    with open(path, encoding='utf-8') as f:
        wf = yaml.safe_load(f) or {}
    problems = []
    for name, job in (wf.get('jobs') or {}).items():
        if isinstance(job, dict):
            problems += check_job(path, wf, name, job)
    return problems


def main(args):
    targets = args or ['.github/workflows']
    files = []
    for t in targets:
        files += sorted(glob.glob(os.path.join(t, '*.yml')) + glob.glob(os.path.join(t, '*.yaml'))) if os.path.isdir(t) else [t]
    problems = [p for f in files for p in check_file(f)]
    for p in problems:
        print(p)
    print(f'secret-isolation: 워크플로 {len(files)}개, 문제 {len(problems)}건')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
