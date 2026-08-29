# Issue 18 Final Path Recheck

SCENARIO: final blocker-only standards/security recheck for tutorial importer recovery paths

INVOCATION: git rev-parse HEAD

OBSERVABLE: `42eb66fe28508495e8a9f7c475b30425b36c0e1c`

INVOCATION: git diff --name-only HEAD

OBSERVABLE:

- `package.json`
- `scripts/check-tutorial-importer.mjs`
- `scripts/lib/tutorial-importer.mjs`
- `scripts/recover-tutorial.mjs`
- `src/lib/tutorials/manifest.ts`
- `src/lib/tutorials/model.ts`

INVOCATION: rg key path-safety symbols

OBSERVABLE:

- `scripts/recover-tutorial.mjs` imports and calls `recoverTutorialImport`.
- `package.json` exposes `tutorials:recover`.
- `scripts/check-tutorial-importer.mjs` includes invalid operation id and `public/../escaped.txt` recovery-conflict scenarios.
- `scripts/lib/tutorial-importer.mjs` includes `operationIdPattern`, `assertOperationId`, `assertSafeStagedRelative`, `safeStagedTarget`, and recovery/import operation id validation.

INVOCATION: npm run tutorials:importer

OBSERVABLE: exit 0; output contains `media trust boundaries, transaction rollback/recovery, lock scope, snapshot provenance, and refresh preservation`.

ARTIFACT: `/Users/longnv/.codex/worktrees/4968/learnseo-zh/.omo/evidence/18-fix-tutorials-importer.log`
