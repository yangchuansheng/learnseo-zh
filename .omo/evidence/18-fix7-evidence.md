# Issue 18 Fix 7 Evidence

- Fixed point: `737e9cd`
- Scope: close B1 from `.omo/evidence/18-gate-review.md`
- Code review: Standards PASS; Spec PASS

## Success Criteria

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Overlong supplied operation IDs are bounded before filename/journal use | `assertOverlongOperationCliFailure` runs import, collect, and recover CLI with `tutorial-import-` plus 400 `a` characters | `npm run tutorials:importer` | Exit `0`; test asserts stderr contains `operation=tutorial-import-<uuid>` with `Invalid operation id`, omits the overlong id, writes `.import-journal/<safe-id>.json`, and leaves no overlong journal | `.omo/evidence/18-fix7-tutorials-importer.log` |
| Parse/validate/import CLI failures print a safe operation id and durable failure journal | Import CLI missing input, disallowed content root, empty translator, stray arg, invalid operation id, missing translation, and overlong operation id | `npm run tutorials:importer` | Exit `0`; each subprocess exits `1`; assertions verify `[tutorial-importer] <code> operation=<safe-id>:` plus journal `operationId`, `actor`, `phase=failed`, and `failure.code` | `.omo/evidence/18-fix7-tutorials-importer.log` |
| Collect CLI failures print a safe operation id and durable failure journal | Collect CLI stray arg, missing output, invalid operation id, overlong operation id, and public network boundary failure | `npm run tutorials:importer` | Exit `0`; each subprocess exits `1`; assertions verify safe operation output and failure journal with actor and stable code | `.omo/evidence/18-fix7-tutorials-importer.log` |
| Recover CLI failures print a safe operation id and durable failure journal | Recover CLI missing journal and overlong operation id | `npm run tutorials:importer` | Exit `0`; subprocess exits `1`; assertions verify `recovery-conflict` or `usage` with safe operation id and failure journal | `.omo/evidence/18-fix7-tutorials-importer.log` |
| Existing invalid operation behavior is preserved | Existing `"INVALID"` collect/import option and CLI cases | `npm run tutorials:importer` | Exit `0`; assertions verify generated UUID operation id and `usage` failure | `.omo/evidence/18-fix7-tutorials-importer.log` |
| Actor validation remains enforced | Import CLI invalid actor and failure journal actor cases | `npm run tutorials:importer` | Exit `0`; assertions verify invalid actor returns `usage` with supplied safe operation id; valid actor persists to failure journals | `.omo/evidence/18-fix7-tutorials-importer.log` |
| Full project validation passes | Data, model, SEO, renderer, importer, lint, typecheck, build, smoke | `npm run check` | Exit `0` | `.omo/evidence/18-fix7-npm-check.log` |
| Lifecycle contract still passes | Tutorial pilot lifecycle contract | `npm run tutorials:check -- --contract` | Exit `0` | `.omo/evidence/18-fix7-tutorials-check-contract.log` |
| Whitespace check passes | Current worktree diff and staged commit diff | `git diff --check`; `git diff --cached --check` | Both exit `0` | `.omo/evidence/18-fix7-diff-check.log` |

## Review Results

| Axis | Result | Observable |
| --- | --- | --- |
| Standards | PASS | No hard violations or baseline smells found in `scripts/lib/tutorial-importer.mjs` or `scripts/check-tutorial-importer.mjs` |
| Spec | PASS | B1 requirements verified: length bound, generated safe UUID fallback, import/collect/recover coverage, invalid operation behavior, actor validation |
