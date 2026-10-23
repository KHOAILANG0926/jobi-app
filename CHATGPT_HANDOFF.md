# CHATGPT_HANDOFF — runner connection check (2026-10-24)

## 1. Current state
- Production/master untouched at 6269d56. No DB/site/crawl schedule changes.
- User screenshots directly show runner files installed, GitHub authentication and runner registration succeeded, Settings Saved, service enabled and active (running) on AZDIGI.
- Runner user crawler-runner; directory /home/crawler-runner/actions-runner; registered name crawler. User-pasted custom label was truncated; use observed default Linux/X64 labels for the one-time check.
- Branch ops/runner-connection-check-20261024 adds a read-only push-triggered connection check: non-root UID, success marker, runner name, Python version and Playwright module presence only. No checkout, tokens, sessions, private files, artifacts, installation, DB, or scheduled collection. This workflow's event restrictions are not a repository-wide security boundary.
- Actual remote job result is pending; do not call the full browser/phone extraction task complete.

## 2. Next three tasks
1. Verify this branch's connection-check job actually executes on crawler and retrieve its logs. Do not repeat completed registration.
2. Review public-repository runner execution isolation before granting browser session/data access. No root/sudo or unrestricted public-PR execution; no unsupported claims that one workflow condition restricts every workflow.
3. Continue authorized Bac Ninh two-job validation using server browser only after real sign-in. No bulk crawl/automatic publication. TEFAL advertised full phone is in user screenshot; BOSCH excluded for insufficient workplace address.

## 3. Required rules
- Follow AGENTS.md/CLAUDE.md. No keys/data/work files on company PC, field visits, unsolicited messages, root password reset or existing app/relay changes.
- Short reports: [직접 확인]/[기존 기록]/[추정]. Distinguish service running, job execution, browser login and phone extraction.
- noVNC paste sends keystrokes, multiline concatenates, repeat Paste duplicates. Send one complete quote-free shell line when possible. Unclosed quote was safely cancelled with a closing quote plus unmatched parenthesis; screenshot shows syntax error then root prompt.
