# Issue 18 Fix11 Spec Review After Catch Fix

- Fixed point: `c8b0eeb8ce24d4a3d8cea5bdcab153ea19b8abe9`
- Diff reviewed: `git diff c8b0eeb -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs`
- Scope: spec review of code/test diff only

## Observables

- `git rev-parse c8b0eeb` resolved the fixed point.
- `git diff --check c8b0eeb -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs` exited 0.
- Existing required logs were present and non-empty:
  - `.omo/evidence/18-fix11-tutorials-importer.log`
  - `.omo/evidence/18-fix11-npm-check.log`
  - `.omo/evidence/18-fix11-tutorials-contract.log`
  - `.omo/evidence/18-fix11-diff-check.log`

## Review Notes

- `scripts/lib/tutorial-importer.mjs:1551-1604` treats any existing journal path as reserved. A committed matching journal can return idempotent only when `idempotentResult` proves matching manifests and the returned operation id matches the requested id.
- `scripts/lib/tutorial-importer.mjs:2599-2603` runs the operation uniqueness guard before `assertOwnership`.
- `scripts/lib/tutorial-importer.mjs:1797-1807` preserves existing journals during failure recording when the current invocation did not create the journal.
- `scripts/lib/tutorial-importer.mjs:2713-2726` converts non-duplicate errors after seeing a reserved journal into `duplicate-operation`.
- `scripts/check-tutorial-importer.mjs:760-808` covers committed-journal reuse with an ownership conflict and stable duplicate output.
- `scripts/check-tutorial-importer.mjs:1307-1342` covers failed-journal reuse, preserving journal bytes, actor, and phase with stable duplicate output.

Finding: no missing or partial spec requirement found in the reviewed diff.
