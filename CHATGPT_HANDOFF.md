# CHATGPT_HANDOFF — server Muaban sign-in (2026-10-24)

## 1. Current state
- Production/master untouched at 6269d56; no DB/publication/schedule changes.
- VPS runner crawler is registered, service enabled/active; actual GitHub job 40036312942 succeeded. Never repeat installation/registration without new evidence.
- Branch ops/runner-connection-check-20261024 contains diagnostics. Latest credential-free form inspection run 40037111685 succeeded on crawler. Previous run 40036825073 installed official Playwright 1.64.1 and Chromium 1248 for crawler-runner only; sandboxed browser launch PASS and TEFAL page HTTP 200.
- TEFAL reveal click opens visible input[name=phone] type tel and Tiếp tục button; 0 full phones visible while signed out. This is a login requirement, not phone invalidity or proven account lock.
- ops/muaban-login.py prepares interactive server-only login with hidden phone/password/OTP entry and private ~/.jobi-muaban/profile. Auth flow is not yet verified; script must be deployed to /home/crawler-runner/jobi-muaban-login.py before asking Lee to run it.
- Script syntax/phone rejection/private permissions/symlink/root guards tested; no credentials, OTPs, session files or full job records in GitHub. Public-repository workflow conditions are not a repository-wide security boundary; do not claim all external PR execution is blocked.

## 2. Next three tasks
1. Finish pinned script deployment and run credential-free -- no-input preflight on server; give Lee the short runuser Python command only after actual deployment verification. Login requires Lee's input in the existing root VNC console; never ask for secrets in chat.
2. Confirm real login and full advertised TEFAL phone using saved server profile; no CAPTCHA bypass, account creation or messages/calls to posters. If new-account/security flow appears, stop that flow for user review.
3. Bac Ninh only, batches of two, varied jobs. BOSCH excluded for insufficient address. Verify extraction/storage path before any automatic schedule or publication. No bulk crawl enabled.

## 3. Required rules
- AGENTS.md/CLAUDE.md; no keys/data/work files on company PC or field visits. Existing app/relay/root credentials unchanged.
- Report [직접 확인]/[기존 기록]/[추정] briefly. Separate server connection, browser launch, login and extraction.
- noVNC multiline paste concatenates and duplicate Paste duplicates commands. User entered registration token privately; do not ask to repeat it. Completed root prompt recovery shown in screenshots.
