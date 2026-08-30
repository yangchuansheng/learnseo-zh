# Issue 18 Fix 11 Standards Review After Catch Fix

Fixed point: `c8b0eeb8ce24d4a3d8cea5bdcab153ea19b8abe9`

Reviewed diff:

`git diff c8b0eeb -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs`

Standards sources read:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `/Users/longnv/.agents/skills/code-review/SKILL.md`

Direct checks:

- `git rev-parse c8b0eeb` resolved to `c8b0eeb8ce24d4a3d8cea5bdcab153ea19b8abe9`.
- `git diff --stat c8b0eeb -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs` reported 2 files changed, 176 insertions, 12 deletions.
- `git diff --check c8b0eeb -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs` produced no output and exited 0.

Findings:

1. No documented-standard violation found in the reviewed diff.

2. Judgment-call smell risk: duplicated test setup in `scripts/check-tutorial-importer.mjs`.
   The new duplicate-operation assertions repeat the same `captureImportError` call shape and option bags around lines 769-810, 1309-1335, and 2085-2095. This is test-only duplication. Current material risk is low because each block exercises a distinct scenario, but future edits to duplicate-operation expectations may require parallel updates across the file.

Recommendation:

Keep the production diff as-is for standards. Consider a tiny local helper for repeated duplicate-operation retry assertions only when another similar case is added.
