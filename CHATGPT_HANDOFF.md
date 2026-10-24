# CHATGPT_HANDOFF — Muaban two-job foundation (2026-10-24)

## 1. Current state
- Branch: ops/runner-connection-check-20261024; master and Production deployment not modified in this task.
- GitHub Actions 40047914154: self-hosted crawler extracted and stored TEFAL (#126) and ADTEK (#127) phones in private Supabase research_artifacts. Both checked; no bulk crawl, no auto publication.
- Pilot script ops/muaban-private-pilot.py now captures authentic Muaban listing text in private research_artifacts; runs on branch push via muaban-private-pilot.yml. Credentials and account session remain on server.
- TEFAL original duties and Bắc Ninh store address 33 Lý Thái Tổ are confirmed from captured page. ADTEK original says lao động / sản xuất at Quế Võ III; broad category is sufficient; precise building/lot is not assumed. Candidate company registry address Lô CN6-2B, KCN Quế Võ III needs linkage check before labeling exact workplace.
- Live local_jobs INSERT dry-run found R1 trigger error: public.map_r1_on_job_saved() uses CASE with NEW.job_id on local_jobs, which has no job_id column. Root cause directly confirmed by function definition. No live R1 function changes applied. Proposed fix staged at supabase/pending/20261024_map_r1_trigger_new_record_fix.sql.
- Rollback-only dry-run using the proposed fix passed for both private app records, with active=false/admin_hidden=true, occupation codes 52230 and broad production 93. Never claim these dry-run records were saved; local_jobs actual count from these source URLs = 0. Exact two-record draft staged at supabase/pending/20261024_muaban_two_job_private_insert.sql.

## 2. Next three tasks
1. Obtain separate explicit production DDL approval for staged R1 trigger fix; preserve existing map R1 behavior and verify after migration.
2. After approved fix, apply two-record private insertion script and verify local_jobs rows, publication flags, existing no-publication rule, and app/admin private flow without modifying current approved CTY KDA layout.
3. Promote the verified 2-job ingestion pattern to reusable guarded collector; keep bulk schedules disabled. Separate app visibility check and address/coordinate approval per existing R1 policy.

## 3. Required rules
- Read AGENTS.md and CLAUDE.md. No local PC secrets/files; server/GitHub/Supabase only. User alone merges.
- Do not rerun runner registration, Muaban login setup or completed phone verification without failure evidence.
- No auto public listing, no mass collection, no unauthorized DDL, no fabricated street/address or map coordinates.
- Production/master state must be checked against status branch STATUS.md; no unverified completion reports.
