# CHATGPT_HANDOFF — server browser console (2026-10-23)

## 1. Current state
- Production/master remains 6269d56; this task changes no website UI, DB, existing crawler/cron, SSH, passwords or public ports.
- Branch ops/browser-console adds ops/browser-console.sh. Default --check is read-only. Explicit --install provisions official Chrome + Xorg/openbox, a dedicated locked non-root jobi-browser user and private /var/lib/jobi-browser/profile, and jobi-console-browser.service on physical tty7 with Xauthority and -nolisten tcp.
- User screenshots directly show Ubuntu server root console, 957MB RAM / 624MB available / 1GB swap, Playwright 1.44.0, Chromium cache 1117, Xvfb, /dev/dri and /dev/fb0. Xorg/xinit/startx absent. noVNC clipboard Paste actually types text; multiple lines concatenate, so send one shell line only.
- Syntax, read-only/error-argument guards, failure cleanup tests, tsc and build passed. Reviewer recovery issue fixed. Installer NOT executed on VPS; physical graphics/input/Chrome/sandbox/login not verified. This bootstrap does NOT itself connect Codex to the VPS, implement automatic phone extraction, or prove PC-off collection.

## 2. Next three tasks
1. Give one pinned GitHub download + bash --install line for existing VNC Clipboard. User clears white Clipboard text only, Paste once, console click + Enter. Verify real GUI and Muaban sign-in; if failure, use preserved tty1/logs, not repeated unrelated login requests.
2. Establish scoped server-side execution/control and a two-job collector using server profile after real login. Do not claim merely opening Chrome solves agent access or phone retrieval. No public unauthenticated browser ports or unrestricted self-hosted runner on public repo.
3. Continue Bac Ninh two-job validation; TEFAL phone shown in user screenshot, BOSCH excluded for imprecise workplace. No bulk crawl or automatic publication.

## 3. Required rules
- Follow AGENTS.md/CLAUDE.md; no keys/data/work files on company PC; no field visits. Preserve approved UI and production data.
- User wants short factual reports with [직접 확인]/[기존 기록]/[추정]. No completed claim before real server/browser verification. Do not repeat failed Google auth/cloud takeover/local-Chrome settings paths.
- On installer failure stop only new browser service, return tty1; preserve profile and allow only recognized root-owned installer recovery. No --no-sandbox, xhost +, firewall opening, root credential changes or mass-crawl enablement.
