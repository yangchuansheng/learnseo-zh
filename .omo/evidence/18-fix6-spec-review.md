# Issue 18 Fix 6 Spec Review

- Verdict: PASS
- Fixed point: `18bd5738ebe2a261ce1fc9cacbb9187fb20d880e`
- Reviewed diff: `git diff HEAD -- scripts/collect-learningseo-tutorial.mjs scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs`
- Report path: `.omo/evidence/18-fix6-spec-review.md`

## Scope Reviewed

Parent task: fix the remaining B3 blocker so `scripts/collect-learningseo-tutorial.mjs` uses the same generated safe `operationId`, actor handling, and durable `recordCliFailure` audit as import/recover for parser, option, and collection failures. Preserve collect behavior and add deterministic importer contract assertions for collect CLI failures.

Issue #18 asks for the minimum command contract and transformation pipeline to turn a selected Pilot Tutorial URL into reviewable English and Simplified Chinese content, local media, provenance metadata, and manifest changes with sanitization and validation.

Latest gate blocker B3 required every CLI failure to print stable code plus operation id and retain operation id plus actor in audit evidence, including parser failures and invalid supplied operation ids.

## Findings

No blocking findings.

The collect CLI now stores `process.argv.slice(2)` before parsing and sends every caught error through `recordCliFailure` before `logFailure`, matching the import/recover CLI failure path (`scripts/collect-learningseo-tutorial.mjs:12`, `scripts/collect-learningseo-tutorial.mjs:15`, `scripts/collect-learningseo-tutorial.mjs:21`; comparison paths at `scripts/import-learningseo-tutorial.mjs:12`, `scripts/import-learningseo-tutorial.mjs:21`, `scripts/recover-tutorial.mjs:10`, `scripts/recover-tutorial.mjs:18`).

`recordCliFailure` derives a safe operation id and actor from either the structured error or raw argv, writes the failure journal, and returns the original error enriched with audit identity for logging (`scripts/lib/tutorial-importer.mjs:189`, `scripts/lib/tutorial-importer.mjs:196`, `scripts/lib/tutorial-importer.mjs:199`, `scripts/lib/tutorial-importer.mjs:203`). The journal persists operation id, actor, failed phase, current failure, and failure history (`scripts/lib/tutorial-importer.mjs:1655`, `scripts/lib/tutorial-importer.mjs:1665`, `scripts/lib/tutorial-importer.mjs:1667`, `scripts/lib/tutorial-importer.mjs:1671`, `scripts/lib/tutorial-importer.mjs:1672`).

`validateCollectOptions` now mirrors import validation by allocating audit context before option validation, rejecting invalid operation ids with a generated safe id, and passing identity into missing/forbidden option failures (`scripts/lib/tutorial-importer.mjs:252`, `scripts/lib/tutorial-importer.mjs:256`, `scripts/lib/tutorial-importer.mjs:258`, `scripts/lib/tutorial-importer.mjs:261`).

The importer contract now includes deterministic collect CLI assertions for stray parser failure, missing option failure with generated id, invalid operation id fallback, and collection boundary failure with a durable journal (`scripts/check-tutorial-importer.mjs:404`, `scripts/check-tutorial-importer.mjs:415`, `scripts/check-tutorial-importer.mjs:430`, `scripts/check-tutorial-importer.mjs:449`).

## Verification

- Scenario: confirm fixed review point. Invocation: `git rev-parse HEAD`. Binary observable: exit 0 and stdout `18bd5738ebe2a261ce1fc9cacbb9187fb20d880e`. Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`.
- Scenario: inspect scoped implementation diff. Invocation: `git diff HEAD -- scripts/collect-learningseo-tutorial.mjs scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs`. Binary observable: exit 0, 3-file scoped diff with collect CLI audit hook, collect option audit identity, and collect CLI failure tests. Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`.
- Scenario: confirm issue intent. Invocation: `gh issue view 18 --repo yangchuansheng/learnseo-zh`. Binary observable: exit 0, open issue titled `Prototype the on-demand Tutorial Import`. Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`.
- Scenario: confirm prior B3 blocker. Invocation: `sed -n '1,220p' .omo/evidence/18-gate-review.md`. Binary observable: exit 0 and B3 states parser/invalid-operation CLI failures lacked operation identity and audit record. Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`.
- Scenario: verify collect/import/recover CLI failure contract. Invocation: `npm run tutorials:importer`. Binary observable: exit 0 and output `Tutorial importer contract passed: deterministic fixture collect/import, collect/import/recover CLI failure audit...`. Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`; executor log also exists at `.omo/evidence/18-fix6-tutorials-importer.log`.
- Scenario: verify tutorial lifecycle contract. Invocation: `npm run tutorials:check -- --contract`. Binary observable: exit 0 and output `Tutorial lifecycle acceptance contract passed.` Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`; executor log exists at `.omo/evidence/18-fix6-tutorials-contract.log`.
- Scenario: verify whitespace hygiene. Invocation: `git diff --check`. Binary observable: exit 0 with no output. Captured artifact path: `.omo/evidence/18-fix6-spec-review.md`; executor log exists at `.omo/evidence/18-fix6-diff-check.log`.
- Scenario: inspect executor full-suite evidence. Invocation: `head -n 40 .omo/evidence/18-fix6-npm-check.log` and `tail -n 80 .omo/evidence/18-fix6-npm-check.log`. Binary observable: log contains `npm run check` passing through data, tutorials, lint, typecheck, build, and smoke checks. Captured artifact path: `.omo/evidence/18-fix6-npm-check.log`.

## Residual Risk

This review independently reran the B3-relevant contract and whitespace checks. The full `npm run check` evidence was inspected from `.omo/evidence/18-fix6-npm-check.log`; it was not rerun during this spec review because B3 is covered by `npm run tutorials:importer` plus `npm run tutorials:check -- --contract`.
