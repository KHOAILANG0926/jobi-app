# CHATGPT_HANDOFF — VPS runner bootstrap (2026-10-23)

## 1. Current state
- Production UI release: master 6269d56 / PR201 (GitHub ref checked this session). No UI/DB changes in this task.
- Branch ops/runner-bootstrap adds ops/r.sh: download official Linux x64 runner 2.338.0, verify official release asset SHA256, extract under unprivileged crawler-runner account. Existing runner directory is never overwritten.
- Script does not register/start a runner, read secrets, install cron, change root password or existing app/relay. VPS execution NOT verified. Browser VNC is already root; clipboard fails. PC SSH reaches password prompt, user does not know password. Do not ask for password again.
- Goal remains reusable server login and two-job extraction in Bac Ninh. No collected jobs published. Chotot account locked; Muaban full phones require login. User takeover of cloud browser unavailable.

## 2. Next three tasks
1. Preserve tested script on GitHub, give short VNC commands fetching this branch and running script. No master merge required for console bootstrap.
2. Before runner registration, resolve public-repo self-hosted runner isolation; prefer private ops repository. Never register an unrestricted runner with server login sessions to public jobi-app. Do not claim script alone connects Codex to VPS.
3. Finish reusable server browser login and verify two real jobs with full phones, salary conditions and official occupation evidence. No bulk collection or publication without applicable approval.

## 3. Required rules
- Follow AGENTS.md/CLAUDE.md. No PC key/data/work-file storage, no secrets in chat/logs, no field visits.
- Existing workflows/cron/relay/app/DB unchanged. Existing account/runner directory inspected before modification. Stop on failed checksum or unexpected home/architecture.
- Report direct evidence separately from records/inference. No success claim for VPS installation/login/crawling before actual verification.
