# Issue 18 Fix 12 Spec Review

- Reviewed at: 2026-08-30T02:49:22Z
- Fixed point: `058f8f52457297c32e62c5661e91b4d96a0a706f`
- Review command: `git diff 058f8f5...HEAD -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs .omo/evidence/18-fix12-summary.md`
- Commit list command: `git log 058f8f5..HEAD --oneline`

## Findings

1. HIGH - Required fix is not committed, so the requested fixed-point review sees an empty diff.
   Spec line: "Run tutorials:importer, npm run check, tutorials:check -- --contract, git diff --check and commit focused English message/evidence."
   Evidence: `git log 058f8f5..HEAD --oneline` returned no commits; `git diff 058f8f5...HEAD -- ...` returned no output; `git status --short` shows modified `scripts/check-tutorial-importer.mjs` and `scripts/lib/tutorial-importer.mjs` plus untracked fix12 evidence.

2. MEDIUM - The claimed `git diff --check` evidence artifact is empty.
   Spec line: "Run tutorials:importer, npm run check, tutorials:check -- --contract, git diff --check and commit focused English message/evidence."
   Evidence: `wc -c .omo/evidence/18-fix12-diff-check.log` returned `0`. A live `git diff --check` returned exit code 0, but the recorded artifact has no captured observable.

## Implemented Correctly

- `scripts/lib/tutorial-importer.mjs:2154-2189` checks marker slug and normalized sourceKey against routes in both parsed manifests.
- `scripts/lib/tutorial-importer.mjs:2265-2273` applies the route-backed predicate during restore candidate selection and keeps the marker-absent bootstrap path.
- `scripts/lib/tutorial-importer.mjs:2381-2389` applies the same predicate after restore.
- `scripts/check-tutorial-importer.mjs:1823-1879` adds the adversarial backup-marker tampering scenario, expects `recovery-conflict`, and asserts live files stay unchanged.

## Live Verification

- `npm run tutorials:importer`: exit 0; output included `Tutorial importer contract passed`.
- `npm run tutorials:check -- --contract`: exit 0; output included `Tutorial lifecycle acceptance contract passed`.
- `npm run check`: exit 0; output included `LearningSEO production smoke test passed`.
- `git diff --check`: exit 0; no output.

## Remediation

- Finding 1 resolved before handoff: the focused fix and fix12 evidence were committed.
- Finding 2 resolved before handoff: `.omo/evidence/18-fix12-diff-check.log` now records invocation text, exit code, and binary observable for both unstaged and staged diff checks.
