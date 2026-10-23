# CHATGPT_HANDOFF — server Muaban sign-in (2026-10-24)

## 1. Current state
- Production/master untouched at 6269d56; no DB/publication/schedule changes.
- VPS runner crawler is registered, service enabled/active; actual GitHub job 40036312942 succeeded. Never repeat installation/registration without new evidence.
- Branch ops/runner-connection-check-20261024 contains diagnostics. Latest credential-free form inspection run 40037111685 succeeded on crawler. Previous run 40036825073 installed official Playwright 1.64.1 and Chromium 1248 for crawler-runner only; sandboxed browser launch PASS and TEFAL page HTTP 200.
- TEFAL reveal click opens visible input[name=phone] type tel and Tiếp tục button; 0 full phones visible while signed out. This is a login requirement, not phone invalidity or proven account lock.
- ops/muaban-login.py prepares interactive server-only login with hidden phone/password/OTP entry and private ~/.jobi-muaban/profile. User sign-in and fresh-process profile reuse VERIFIED; script DEPLOYED to /home/crawler-runner/jobi-muaban-login.py; checksum and credential-free --check passed on crawler in run 40037582015 (job 120700728041). Source 9bb716778fbfbc8fce6417ecd32d7e3cffa05808; SHA256 e2c2790092d740a1cf9b22cc579e92a3dcca73b259d0a9e47825cdd652229f47.
- Script syntax/phone rejection/private permissions/symlink/root guards tested; no credentials, OTPs, session files or full job records in GitHub. Public-repository workflow conditions are not a repository-wide security boundary; do not claim all external PR execution is blocked.

## 2. Next three tasks
1. Login COMPLETE. User screenshot image(20261023-233203).png shows LOGIN_SAVED. Fresh-process GitHub run 40040560572 (job 120710377950, runner crawler) succeeded: SAVED_SERVER_LOGIN_REUSED=PASS and TEFAL_AD_PHONE_MATCHES_USER_SCREENSHOT=PASS. Do not request login/installation/registration again without new failure evidence.
2. Continue Bac Ninh two-job validation: TEFAL selected; BOSCH excluded for insufficient address. Select a different occupation for second job. Public listing navigation observed: /viec-lam/viec-tim-nguoi-bac-ninh. Existing private research_artifacts #126 still needs contact evidence update; no public insertion yet.
3. Complete extraction and private storage validation before schedule/publication. No bulk crawl enabled. Login persistence does not mean scheduled full extraction is complete.

## 3. Required rules
- AGENTS.md/CLAUDE.md; no keys/data/work files on company PC or field visits. Existing app/relay/root credentials unchanged.
- Report [직접 확인]/[기존 기록]/[추정] briefly. Separate server connection, browser launch, login and extraction.
- noVNC multiline paste concatenates and duplicate Paste duplicates commands. User entered registration token privately; do not ask to repeat it. Completed root prompt recovery shown in screenshots.

## 2026-10-24 06:36 +07 — persisted login directly verified
- Workflow source remote 6fc135c28d18fc7a6f69e35d2d3bb3d547692e43; local 34d9962; identical tree e9520f4aedb06e4022cb0208aaafe806da01cc0c.
- https://github.com/KHOAILANG0926/jobi-app/actions/runs/40040560572 succeeded on crawler. Fresh persistent Chromium process reused server profile, revealed exact advertised TEFAL phone without credentials/user input, and matched user screenshot.
- tsc/build, YAML/bash/Python syntax, scope guards and diff checks passed. Production/master, public jobs and recurring schedule unchanged.
