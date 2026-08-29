# Issue 18 Blocker Recheck

- Fixed point: `42eb66fe28508495e8a9f7c475b30425b36c0e1c`
- Diff inspected: `git diff HEAD`
- Worktree checked with `git status --short`; source files were not edited by this recheck.

## Scenario

Blocker focus: after a published tutorial route already has a `refreshCandidate`, importing a second different refresh must be a new operation, must return `idempotent: false`, must preserve the published route, and must create a higher candidate version.

## Evidence

- Invocation: `npm run tutorials:importer`
- Binary observable: exit code `0`
- Captured output: `Tutorial importer contract passed: fixture collect/import, idempotency, failure taxonomy, media trust boundaries, transaction rollback/recovery, lock scope, snapshot provenance, and refresh preservation.`
- Covered assertions: `scripts/check-tutorial-importer.mjs` asserts first refresh keeps `status: "published"`, same refresh is `idempotent: true`, second different refresh is `idempotent: false`, published `snapshot.version` stays unchanged, and `refreshCandidate.version` increments from the prior candidate.

## BLOCK/HIGH Recheck

- H1 refresh preservation: `scripts/lib/tutorial-importer.mjs` writes published refreshes into `refreshCandidate`; render path reads `record.contentFile`, so the active published body remains selected.
- H2 media trust: current diff adds public HTTPS/DNS redirect validation, streamed size checks, fixture-root checks, and active SVG rejection.
- H3 lock scope: manifest read/ownership/idempotence/merge now run inside `withImportLock`.
- H4 rollback/recovery: current diff adds phase journal entries, staged hashes, rollback tracking, and `recoverTutorialImport`.
- H5 provenance: snapshot `sourceContentHash` is recomputed before import.
- H6 tests: importer test now injects commit failures and recovery, plus refresh preservation.

## Additional Checks

- Invocation: `npm run tutorials:model`; binary observable: exit code `0`.
- Invocation: `npm run lint`; binary observable: exit code `0`.
- Invocation: `npm run typecheck`; binary observable: exit code `0`.
- Invocation: `git diff --check HEAD`; binary observable: exit code `0`.
- Invocation: `npm run check`; binary observable: exit code `0`.

## Residual Landing Note

`package.json` references `scripts/recover-tutorial.mjs`, and `git status --short` shows that script as untracked. Include that untracked file when landing the package change.
