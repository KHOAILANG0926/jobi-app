# Multi-PC Git Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Viecganban work resumable from home or office without confusing a pushed work branch with Production deployment.

**Architecture:** GitHub is the shared source of truth. Short-lived `work/*` branches preserve unapproved work across PCs, `master` is the integration branch, and `production` is updated only after explicit user approval and subsequent production verification.

**Tech Stack:** Git, GitHub, Markdown project instructions, React/Vite verification commands.

**Spec:** User requirements in the 2026-08-21 Codex task.

## Global Constraints

- Do not modify Home UI during this task.
- Do not create a new project or substitute a different repository.
- Do not deploy Production without explicit user approval.
- Do not ask the user to perform terminal, Git, or file-navigation work that the AI can perform.

---

### Task 1: Restore and verify the repository

- [x] Confirm `origin` is `https://github.com/KHOAILANG0926/jobi-app.git`.
- [x] Fetch remote branches and compare local `master`, `origin/master`, and `origin/production`.
- [x] Confirm the restored worktree is clean before documentation changes.

### Task 2: Record the multi-PC workflow

- [x] Define `IMPLEMENTED`, `VERIFIED`, `APPROVED`, `SYNCED`, and `DEPLOYED` independently.
- [x] Record the startup sequence: repository → remote → remote branches → fetch/sync → handoff restoration → continue.
- [x] Record that work-branch push is not Production deployment.
- [x] Record that the AI handles all technically possible terminal/Git/file operations.

### Task 3: Synchronize and verify

- [ ] Verify the three state documents contain the same five-state workflow.
- [ ] Confirm no Home UI source file changed.
- [ ] Commit only the workflow documentation on `work/multi-pc-sync`.
- [ ] Push `work/multi-pc-sync` to GitHub without updating `production`.
- [ ] Fetch again and confirm local/remote work-branch commit equality.
