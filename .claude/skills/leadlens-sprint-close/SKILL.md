---
name: leadlens-sprint-close
description: Close out a LeadLens sprint — verify, scope-check, one reversible commit (no push), update persistent memory, and produce the completion report with the exact verdict/git block. Invoke at the end of an implementation sprint, or when the user says "close the sprint", "wrap up", or "commit and report".
---

# leadlens-sprint-close

The end-of-sprint procedure. Follow `CLAUDE.md` rules; run `/leadlens-verify` as step 1.

## Procedure
1. **Verify:** run `/leadlens-verify` (tsc + relevant fixtures + build). Do not proceed on red.
2. **Scope check:** `git status --short | grep -vE "AUDIT|DIRECTION|PROOF|SYSTEM"`. Confirm ONLY the files this sprint intended changed. If unrelated changes (e.g. another session's work, `.leadlens/*` churn) are present, do **not** sweep them into the commit — `git add` your specific files by path only. Revert runtime artifacts: `git checkout -- .leadlens/`.
3. **No product drift** (unless the sprint is explicitly about it): confirm no diff to pricing, landing (`app/demo-pipeline/page.tsx`), providers, or DB schema.
4. **Commit** one coherent commit of the intended files by path (`git add <paths>` then `git commit`). Message: what changed + why + the verdict + tests green. End with the Co-Authored-By trailer. **Never `git push`** (the guard blocks it; git push ≠ deployed).
5. **Update memory:** update `~/.claude/projects/-Users-martingaleano/memory/` — the relevant project file (new commit hash, unpushed state, verdict, any FOUNDER ACTION) and the `MEMORY.md` index line. Keep it one fact per file.
6. **Report** with the required blocks: `STATUS`, `PRODUCTION VERDICT` (exact wording the prompt asked for), then the section-by-section answers, ending with `GIT` (final HEAD/commit hash, files changed, worktree clean, push status = not pushed) and any `FOUNDER ACTION REQUIRED`.

## Output
A committed sprint (hash), updated memory, and a completion report. If a migration was created but not applied, state `FOUNDER ACTION REQUIRED` explicitly and do not claim the DB is live (`/leadlens-migration-safe`).
