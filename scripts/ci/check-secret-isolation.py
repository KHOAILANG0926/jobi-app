#!/usr/bin/env python3
"""S4(#808) 워크플로 검사: 열쇠(비밀값·쓰기 토큰·id-token)를 가진 잡이 PR·브랜치 코드를 실행하지 못하게 막는다.

규칙(잡마다):
  R1 열쇠 있는 잡이 PR·브랜치 코드를 펼치면(actions/checkout ref가 기본 브랜치가 아님 / pull_request 계열 이벤트의 기본·자기 커밋 /
     git checkout·switch·reset·apply 등 / gh pr checkout) 그 뒤 run 단계는 '허용 명령'만 쓸 수 있다(허용 목록 방식 — 검토 지적 5).
     허용: git·gh·curl·jq 등 데이터 다루기 명령, 기준 사본($RUNNER_TEMP/trusted 또는 그 경로를 담은 "$T")의 스크립트,
     상자 실행기(sandbox-run.sh — PR 사본을 열쇠 없는 컨테이너에서만 실행). 그 밖(npm·npx·node·bun·tsx·python·make·sh·env·
     node_modules/.bin·./스크립트 …)은 모두 문제. bash 아닌 shell:, uses: ./(PR 쪽 action)도 문제.
     다른 폴더에 펼친 경우(git worktree add)는 그 폴더를 가리키는 명령에 같은 규칙.
  R2 그 체크아웃은 persist-credentials: false (쓰기 토큰을 .git에 남기지 않음).
  R3 그 잡의 claude-code-action은 PR 코드 실행 명령(Bash(npm/npx/node/python/make…))을 허용하지 않는다.
  R5 PR 코드 위에서 Claude를 돌리면 --setting-sources user·disableAllHooks·hold-pr-claude-settings.sh(기준 사본) 셋 다.
  R6 비신뢰 글(PR·이슈·리뷰)을 읽는 Claude 잡은 쓰기 권한·id-token 없음 + github_token(읽기 전용) 지정. 쓰기는 게시 잡(claude-publish.mjs)만.
     (1·2차 독립 검토에서 'Claude 명령 제한'만으로는 두 번 뚫려 구조로 바꿈 — 그래서 '내보낼 수 있는 명령' 검사는 없앴다.)
  R7 id-token(앱 토큰)·Claude 잡의 셸 글에 바뀔 수 있는 ${{ }} 값 직접 넣기 금지(env로).
  R8 운영 열쇠(GITHUB_TOKEN·Claude 구독 열쇠·ANTHROPIC_API_KEY 밖의 비밀값)를 쓰는 잡은 environment가 ops-keys여야 한다
     (GitHub 설정에서 ops-keys 환경을 master만 쓰게 하고 열쇠를 그 환경으로 옮기면, 브랜치·PR의 워크플로가 바뀌어도 열쇠를 못 받음 — S4 3차).
     데모 배포처럼 브랜치 코드를 빌드하는 잡은 운영 DB 열쇠 없이 demo-deploy 환경만(vercel-deploy.yml).
  R4 다른 실행의 artifact를 받는 곳(download-artifact run-id·gh run download·artifacts API)은 그 전에 verify-artifact-run.sh를
     명령으로 실행해 출처를 확인한다(echo 글자·continue-on-error·|| true는 확인으로 치지 않음).
범위: 정직한 실수를 잡는 검사다. 워크플로 파일 자체를 악의로 바꾸는 PR은 이 검사도 바꿀 수 있으므로 .github/·scripts/ci/ 변경은
     Lee 승인 대상(decision-approval-gate GATE_CODE, S4 L5)이 막는다.
사용: check-secret-isolation.py [워크플로 폴더 또는 파일...] (기본 .github/workflows). 문제 있으면 줄마다 출력하고 1로 끝낸다.
"""
import glob
import os
import re
import shlex
import sys

import yaml

ALLOWED_CMDS = {
    'git', 'gh', 'curl', 'jq', 'echo', 'printf', 'cat', 'tail', 'head', 'grep', 'sed', 'awk', 'find', 'sort', 'uniq', 'cut',
    'tr', 'wc', 'sha256sum', 'test', '[', '[[', ']', ']]', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'cd', 'set', 'exit', 'true',
    'false', 'date', 'sleep', 'read', 'ls', 'basename', 'dirname', 'tee', 'export', 'local', 'return', 'continue', 'break',
    ':', 'shift', 'unset', 'seq', 'diff', 'cmp', 'touch', 'stat', 'readlink', 'realpath', 'base64', 'mktemp', 'wait',
    'if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', '{', '}', '(', ')', '!',
}
KEYWORD_PREFIX = {'if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '(', 'time', 'exec'}
TRUSTED_PATH = re.compile(r'^(\$RUNNER_TEMP|\$\{RUNNER_TEMP\}|\$\{\{\s*runner\.temp\s*\}\})/trusted/|^\$T/')
CLAUDE_CODE_TOOLS = re.compile(r'Bash\((npm|npx|node|yarn|pnpm|bun|deno|tsx|python3?|make|pip3?|sh|env)\b')
PR_EVENTS = {'pull_request', 'pull_request_review', 'pull_request_review_comment'}
VERIFY = re.compile(r'^(bash\s+)?(\$RUNNER_TEMP/trusted/|\$T/)?scripts/ci/verify-artifact-run\.sh\s')
ARTIFACT_FETCH = re.compile(r'gh\s+run\s+download|actions/artifacts/\S*/zip|/actions/runs/\S*/artifacts')
SEPARATORS = re.compile(r'\$\(|`|&&|\|\||[;|&\n]|\bthen\b|\bdo\b|\belse\b')
SWITCHING = ('checkout', 'switch', 'reset', 'apply', 'am', 'merge', 'pull', 'restore', 'stash', 'cherry-pick', 'rebase')


def text(v):
    return yaml.safe_dump(v) if not isinstance(v, str) else v


def has_secret(obj):
    return any(name != 'GITHUB_TOKEN' for name in re.findall(r'secrets\.([A-Za-z0-9_]+)', text(obj)))


def writes(perms):
    if perms == 'write-all':
        return True
    if isinstance(perms, dict):
        return any(v == 'write' for v in perms.values())
    return False


def privileged(wf, job):
    perms = job.get('permissions', wf.get('permissions'))
    # 권한 선언이 없으면 저장소 기본 토큰 권한(쓰기일 수 있음)을 따른다 → 열쇠 있는 것으로 본다.
    return has_secret(wf.get('env')) or has_secret(job) or writes(perms) or perms is None


def events(wf):
    on = wf.get('on', wf.get(True))  # PyYAML은 'on'을 True로 읽는다
    if isinstance(on, str):
        return {on}
    if isinstance(on, list):
        return set(on)
    return set((on or {}).keys())


def trusted_ref(ref, evs):
    ref = ref.strip()
    if ref in ('master', 'main', 'refs/heads/master', '${{ github.event.repository.default_branch }}'):
        return True
    # 기본값·자기 커밋: pull_request 계열 이벤트에서는 PR 코드다(검토 지적 5). 그 밖에서는 워크플로 파일과 같은 출처.
    if ref in ('', '${{ github.ref }}', '${{ github.sha }}'):
        return not (evs & PR_EVENTS)
    return False


BOUNDARY = {';', '&&', '||', '|', '&', '(', ')', ';;', '|&'}


def strip_heredocs(code):
    out, delim = [], None
    for line in code.split('\n'):
        if delim is not None:
            if line.strip() == delim:
                delim = None
            continue
        m = re.search(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?", line)
        if m:
            delim = m.group(1)
        out.append(line)
    return '\n'.join(out)


def commands(code):
    """run 글을 단순 명령 단위로 나눈다(따옴표를 지키는 shlex 토큰 — 여러 줄 따옴표 포함, 줄바꿈은 명령 경계,
    heredoc 본문은 건너뜀, "$( … )" 안쪽도 검사). 정확한 셸 해석이 아니라 '각 명령의 첫 낱말'을 보기 위한 근사다."""
    code = strip_heredocs(code.replace('\\\n', ' '))
    for inner in re.findall(r'\$\(([^()]*)\)', code) + re.findall(r'`([^`]*)`', code):
        yield from commands(inner)
    try:
        lex = shlex.shlex(code, posix=True, punctuation_chars='();<>|&\n')
        lex.whitespace = ' \t\r'
        lex.whitespace_split = True
        lex.commenters = '#'
        toks = list(lex)
    except ValueError:
        toks = code.split()
    cur = []
    for t in toks + [';']:
        if t in BOUNDARY or (t and set(t) <= set('();&|\n')):
            words = cur
            while words and (re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', words[0]) or words[0] in KEYWORD_PREFIX):
                words = words[1:]
            if words:
                yield ' '.join(cur), words
            cur = []
        else:
            cur.append(t)


def command_ok(words, raw):
    cmd = words[0]
    if cmd in ('bash', 'node') and len(words) > 1 and TRUSTED_PATH.search(words[1]):
        return True
    if cmd == 'xargs':
        rest = [w for w in words[1:] if not w.startswith('-') and not re.match(r'^(\{\}|[0-9]+)$', w)]
        return bool(rest) and rest[0] in ALLOWED_CMDS
    if cmd == 'docker':
        return len(words) > 1 and words[1] == 'pull'
    # 허용 명령이라도 다른 프로그램을 실행시키는 쓰임은 막는다(검토 2차 지적 6)
    if cmd == 'find' and any(w in ('-exec', '-execdir', '-ok', '-okdir') for w in words):
        return False
    if cmd == 'awk' and 'system' in raw:
        return False
    return cmd in ALLOWED_CMDS


def check_job(path, wf, name, job):
    out = []
    evs = events(wf)
    steps = job.get('steps') or []
    priv = privileged(wf, job)
    untrusted = False
    foreign_dirs = []
    verified_artifact = False
    held = False
    eff = job.get('permissions', wf.get('permissions'))
    id_token = isinstance(eff, dict) and eff.get('id-token') == 'write' or eff == 'write-all'
    claude_job = any(str(x.get('uses', '')).startswith('anthropics/claude-code-action') for x in steps)
    for i, st in enumerate(steps):
        where = f'{path} jobs.{name}.steps[{i}] {st.get("name") or st.get("uses") or ""}'.strip()
        uses = st.get('uses') or ''
        w = st.get('with') or {}
        if uses.startswith('actions/checkout'):
            ref = str(w.get('ref', ''))
            sub = str(w.get('path', '')).strip().strip('./')
            if not trusted_ref(ref, evs) and sub and not sub.startswith('.trusted'):
                foreign_dirs.append(sub)  # 다른 폴더에 펼친 PR 사본 = 데이터(그 폴더 코드를 실행하면 R1)
                if priv and str(w.get('persist-credentials', 'true')).lower() != 'false':
                    out.append(f'R2 {where}: 열쇠 있는 잡이 PR·브랜치 코드를 체크아웃하면서 persist-credentials: false가 없음')
            elif not trusted_ref(ref, evs):
                untrusted = True
                if priv and str(w.get('persist-credentials', 'true')).lower() != 'false':
                    out.append(f'R2 {where}: 열쇠 있는 잡이 PR·브랜치 코드를 체크아웃하면서 persist-credentials: false가 없음')
        if uses.startswith('./') and priv and untrusted:
            out.append(f'R1 {where}: PR·브랜치 코드를 펼친 뒤 저장소 안 action({uses}) 실행')
        run = st.get('run') or ''
        # R7: 앱 토큰을 받을 수 있는 잡(id-token)·Claude 잡에서는 바뀔 수 있는 값(${{ github.event.* / needs.*.outputs / steps.*.outputs / inputs.* / head_ref }})을
        #     셸 글에 바로 넣지 않는다 — 브랜치 이름 같은 값으로 명령을 끼워 넣을 수 있다(독립 검토 3차 지적 6). env로 넘기고 "$이름"으로 쓴다.
        if run and (id_token or claude_job):
            for m in re.findall(r'\$\{\{([^}]*)\}\}', run):
                if re.search(r'github\.event\.(issue|comment|pull_request|review|head_commit|inputs|discussion)|github\.head_ref|needs\.[\w-]+\.outputs|steps\.[\w-]+\.outputs|inputs\.', m):
                    out.append(f'R7 {where}: 셸 글에 바뀔 수 있는 값을 바로 넣음 — ${{{{{m.strip()}}}}} (env로 넘길 것)')
        shell = str(st.get('shell', 'bash'))
        if run and priv and untrusted and shell.split()[0] not in ('bash', 'sh') and not re.search(r'(^|\s)/bin/bash\s', shell):
            out.append(f'R1 {where}: PR·브랜치 코드를 펼친 뒤 bash 아닌 shell({st.get("shell")}) 실행')
        soft = str(st.get('continue-on-error', 'false')).lower() == 'true'
        in_foreign = False
        for raw, words in commands(run):
            if words[0] in ('/bin/bash', '/usr/bin/bash', '/bin/sh'):
                words = ['bash'] + words[1:]
            cmd = words[0]
            if cmd == 'git' and len(words) > 1 and words[1] in SWITCHING:
                untrusted = True
            if cmd == 'gh' and words[1:3] == ['pr', 'checkout']:
                untrusted = True
            if cmd == 'git' and words[1:3] == ['worktree', 'add']:
                args = [a for a in words[3:] if not a.startswith('-')]
                if args:
                    foreign_dirs.append(args[0])
            if cmd == 'bash' and len(words) > 1 and TRUSTED_PATH.search(words[1]) and words[1].endswith('hold-pr-claude-settings.sh') and untrusted:
                held = True  # PR 체크아웃 뒤에 있어야 의미가 있다(순서 확인)
            if VERIFY.search(raw) and not soft and not re.search(r'verify-artifact-run\.sh[^\n]*\|\|\s*(true|:)', run):
                verified_artifact = True
            if ARTIFACT_FETCH.search(raw) and not verified_artifact:
                out.append(f'R4 {where}: 다른 실행의 artifact를 출처 확인(verify-artifact-run.sh) 없이 받음 — {raw[:100]}')
            if not priv:
                continue
            sandbox = cmd == 'bash' and 'sandbox-run.sh' in raw and (not untrusted or command_ok(words, raw))
            inside = lambda x: any(d and (x == d or x.startswith(d + '/') or x.endswith('/' + d) or ('/' + d + '/') in x) for d in foreign_dirs)
            if cmd == 'cd':
                in_foreign = len(words) > 1 and inside(words[1])
            # 다른 폴더의 PR 사본: 그 폴더에서(cd) 실행하거나, 그 안의 파일을 실행하거나, 패키지 도구를 그 폴더로 돌리면 문제. 기준 스크립트가 그 폴더를 데이터로 읽는 것은 허용.
            touches_foreign = in_foreign or (len(words) > 1 and inside(words[1]) and cmd in ('bash', 'sh', 'node', 'python', 'python3')) \
                or inside(cmd) or (cmd in ('npm', 'npx', 'yarn', 'pnpm', 'make') and any(inside(x.split('=', 1)[-1]) for x in words[1:]))
            if (untrusted or touches_foreign) and not sandbox and not command_ok(words, raw):
                out.append(f'R1 {where}: 열쇠 있는 잡이 PR·브랜치 코드를 펼친 뒤 허용 밖 명령 실행 — {raw.strip()[:120]}')
        if uses.startswith('anthropics/claude-code-action') and priv and untrusted:
            tools = text(w.get('claude_args', '')) + text(w.get('allowed_tools', ''))
            allowed = ' '.join(re.findall(r'--allowedTools[ =]"([^"]*)"', tools)) + ' ' + str(w.get('allowed_tools', ''))
            m = CLAUDE_CODE_TOOLS.search(tools) or re.search(r'Bash\((\*|bash:\*|git:\*|gh:\*)\)|(?<![\w(])Bash(?=[,\s]|$)', allowed) \
                or re.search(r'bypassPermissions|dangerously|--allowed-tools|acceptEdits', tools)
            if m:
                out.append(f'R3 {where}: PR 코드를 체크아웃한 잡의 Claude가 코드 실행·권한 끄기 명령을 허용 — {m.group(0)}')
            # R5: PR 쪽 Claude 설정(hook·허용 목록·MCP)이 열쇠 있는 컴퓨터에서 적용되지 않게
            sources = re.search(r'--setting-sources[ =](\S+)', tools)
            hooks_off = re.search(r'"disableAllHooks"\s*:\s*true', tools)
            if not sources or sources.group(1).strip('"\'') != 'user' or not hooks_off or not held:
                out.append(f'R5 {where}: PR 코드 위에서 Claude 실행 — --setting-sources user·disableAllHooks·hold-pr-claude-settings.sh(기준 사본) 셋 다 필요')
        # R6(S4 3차): 비신뢰 글·PR 코드를 읽는 Claude 잡에는 쓰기 권한·id-token이 없어야 하고, 액션에 읽기 전용 토큰(github_token)을 직접 줘야 한다
        #   (안 주면 액션이 id-token으로 쓰기 앱 토큰을 받는다). 커밋·push·댓글은 기준 사본만 실행하는 게시 잡이 한다.
        if uses.startswith('anthropics/claude-code-action'):
            # 예외 없음(지시 작업도 비신뢰 글을 받을 수 있음 — 독립 검토 3차 지적 1·10)
            perms = job.get('permissions', wf.get('permissions'))
            if writes(perms) or perms is None or str(w.get('github_token', '')).replace(' ', '') != '${{github.token}}':
                out.append(f'R6 {where}: Claude 잡에 쓰기 권한·id-token이 있거나 github_token이 읽기 전용 토큰(github.token)이 아님 — 쓰기는 게시 잡으로')
            others = [k for k in re.findall(r'secrets\.([A-Za-z0-9_]+)', text(job.get('env')) + text(st.get('env')) + text({k: v for k, v in w.items() if k not in ('claude_code_oauth_token', 'anthropic_api_key')}))
                      if k not in ('GITHUB_TOKEN',)]
            if others:
                out.append(f'R6 {where}: Claude 잡에 인증 열쇠 말고 다른 비밀값이 있음 — {", ".join(sorted(set(others)))}')
            # 독립 검토 4차 지적 1·2: ':*'(뒤에 아무 인자나) 허용은 인자 오류 글로 열쇠를 찍거나 --output으로 파일을 쓰게 한다 → 정확한 명령만.
            #   액션의 뒤쪽 bash 단계(줄 댓글 게시)는 끈다(Claude가 바꿨을지 모를 환경을 따르는 단계를 남기지 않음).
            allowed_all = ' '.join(re.findall(r'--allowedTools[ =]"([^"]*)"', text(w.get('claude_args', '')))) + ' ' + str(w.get('allowed_tools', ''))
            wild = re.findall(r'Bash\([^)]*(?::\*|\s\*)\)', allowed_all)
            if wild:
                out.append(f'R6 {where}: Claude Bash 허용에 와일드카드 — {", ".join(wild[:3])} (정확한 명령만)')
            # 작업 폴더 밖 읽기 차단은 permissions 안에 있어야 실제로 켜진다(독립 검토 5차 지적 1 — 맨 위에 두면 무시돼 Grep으로 /proc/self/environ이 읽힘)
            if not re.search(r'"permissions"\s*:\s*\{[^}]*"blockFileToolReadsOutsideWorkingDirectories"\s*:\s*true[^}]*"blockReadsOutsideWorkingDirectories"\s*:\s*true', text(w.get('claude_args', ''))):
                out.append(f'R6 {where}: --settings에 permissions.blockFileToolReadsOutsideWorkingDirectories·blockReadsOutsideWorkingDirectories(true) 없음')
            if str(w.get('classify_inline_comments', '')).strip("'\"") != 'false':
                out.append(f'R6 {where}: classify_inline_comments: false 아님(액션 뒤쪽 bash 단계가 남음)')
        if uses.startswith('actions/download-artifact') and w.get('run-id') and not verified_artifact:
            out.append(f'R4 {where}: 다른 실행의 artifact를 출처 확인(verify-artifact-run.sh) 없이 받음')
    return out


AI_OR_DEFAULT_KEYS = {'GITHUB_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'}
ENV_NAMES = {'ops-keys', 'demo-deploy'}
STATUS_PROTECTED = re.compile(r'(^|/)\.github/workflows/status-[^/]*\.ya?ml$')


def check_environment(path, wf, name, job):
    """R8: 운영 열쇠를 쓰는 잡은 ops-keys 환경(master만)에서만"""
    used = set(re.findall(r'secrets\.([A-Za-z0-9_]+)', str(job) + str(wf.get('env', '')))) - AI_OR_DEFAULT_KEYS
    if not used:
        return []
    env = job.get('environment')
    env = env.get('name', '') if isinstance(env, dict) else str(env or '')
    # 이름이 정확히 ops-keys(또는 식 안의 이름이 모두 ops-keys·demo-deploy 중 하나이고 ops-keys 포함)여야 한다 — 'ops-keys-x' 같은 비슷한 이름 거절(독립 검토 지적 L)
    names = [n for n in re.findall(r"'([^']*)'", env) if not n.startswith('refs/')] if '${{' in env else [env.strip()]
    ok = bool(names) and all(n in ENV_NAMES for n in names) and 'ops-keys' in names
    if not ok:
        msg = f'R8 {path} jobs.{name}: 운영 열쇠({", ".join(sorted(used))})를 쓰는데 environment가 ops-keys가 아님 — 브랜치 워크플로가 열쇠를 받을 수 있음'
        # STATUS 보호 파일(status-* 워크플로)은 Lee만 바꿀 수 있다(check-repository-policy PROTECTED와 같은 이름 규칙) — 실패 대신 경고로 남겨 Lee 조치 목록에 둔다
        if STATUS_PROTECTED.search(path.replace(os.sep, '/')):
            print(f'::warning::{msg} (STATUS 보호 파일 — Lee 조치 필요)')
            return []
        return [msg]
    return []


def check_file(path):
    with open(path, encoding='utf-8') as f:
        wf = yaml.safe_load(f) or {}
    problems = []
    for name, job in (wf.get('jobs') or {}).items():
        if isinstance(job, dict):
            problems += check_job(path, wf, name, job)
            problems += check_environment(path, wf, name, job)
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
