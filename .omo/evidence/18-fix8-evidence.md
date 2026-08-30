# Issue 18 Fix 8 Evidence

## Scope

- Fixed I18-RECOVERY-ATOMICITY on top of `56dd380`.
- Updated `restoreCommittedBackups` so malformed live manifest or marker candidates are skipped independently while valid backup candidates remain eligible.
- Restored `manifest.json`, `manifest.en.json`, and `import-generation.json` through unique temp files followed by rename with rollback and temp cleanup.
- Added deterministic restore failure injection after the first restore rename, then retried recovery and asserted the restored manifests and marker equal the proven prior pair.

## Implementation Pointers

- Candidate parsing skips malformed backup/live manifest or marker candidates independently: `scripts/lib/tutorial-importer.mjs:2046`.
- Restore temp staging and rollback helpers: `scripts/lib/tutorial-importer.mjs:2120`.
- `recoverTutorialImport` passes restore test hooks into backup restoration: `scripts/lib/tutorial-importer.mjs:2283`.
- Atomic restore retry test: `scripts/check-tutorial-importer.mjs:1441`.

## Verification

### Scenario: malformed live manifest and marker do not block valid backup restore

- Invocation: `npm run tutorials:importer`
- Binary observable: exit `0`; output contains `atomic restore retry coverage`.
- Artifact: `.omo/evidence/18-fix8-tutorials-importer.log`

### Scenario: restore failure after first rename rolls back temps and recovery retries proven pair idempotently

- Invocation: `npm run tutorials:importer`
- Binary observable: exit `0`; test injects `failAfterRestoreRenameRelative: "manifest.json"`, verifies no `.restore-tutorial-import-atomic-restore-test.` temp files remain, retries recovery, and asserts restored `manifest.json`, `manifest.en.json`, and `import-generation.json` equal the prior pair.
- Artifact: `.omo/evidence/18-fix8-tutorials-importer.log`

### Scenario: full repository quality gate

- Invocation: `npm run check`
- Binary observable: exit `0`; output includes successful data checks, tutorial model, SEO, renderer, importer, ESLint, typecheck, Next build, and production smoke.
- Artifact: `.omo/evidence/18-fix8-npm-check.log`

### Scenario: tutorial lifecycle acceptance contract

- Invocation: `npm run tutorials:check -- --contract`
- Binary observable: exit `0`; output contains `Tutorial lifecycle acceptance contract passed.`
- Artifact: `.omo/evidence/18-fix8-tutorials-check-contract.log`

### Scenario: whitespace-safe diff

- Invocation: `git diff --check`
- Binary observable: exit `0`; output recorded as `git diff --check passed with no whitespace errors.`
- Artifact: `.omo/evidence/18-fix8-diff-check.log`

## Review

- `$implement` skill read and followed.
- `$code-review` skill read and used with two read-only subagents.
- Standards review initially found duplicated temp-write shape and an over-strong helper name; both were corrected.
- Spec review found the final diff aligned with the requested recovery atomicity behavior.
