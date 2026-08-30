# Issue 18 Fix 6 Evidence

## Scope

Collector CLI failures now use the same generated safe operation id, actor normalization, durable failure journal, and stderr operation identity as the import and recovery CLIs.

## Success Criteria

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Collector parser failures are auditable | Stray argument followed by `--operation-id tutorial-import-collect-cli-stray-test --actor cli.operator` | `npm run tutorials:importer` | Exit `0`; contract asserts stderr includes `usage operation=tutorial-import-collect-cli-stray-test` and journal records actor `cli.operator` with code `usage` | `.omo/evidence/18-fix6-tutorials-importer.log` |
| Collector missing option failures receive a generated safe operation id | Missing `--output` with actor `cli.operator` | `npm run tutorials:importer` | Exit `0`; contract extracts `tutorial-import-<uuid>` from stderr and verifies a matching failure journal with actor `cli.operator` and code `usage` | `.omo/evidence/18-fix6-tutorials-importer.log` |
| Collector invalid operation ids fall back to a generated safe operation id | `--operation-id INVALID` with valid collect args | `npm run tutorials:importer` | Exit `0`; contract extracts generated `tutorial-import-<uuid>` from stderr and verifies a matching failure journal with actor `cli.operator` and code `usage` | `.omo/evidence/18-fix6-tutorials-importer.log` |
| Collector collection-boundary failures are auditable | Public-HTTPS validation rejects `http://127.0.0.1/tutorial` after option validation | `npm run tutorials:importer` | Exit `0`; contract asserts stderr includes `unavailable operation=tutorial-import-collect-cli-boundary-test` and journal records actor `cli.operator` with code `unavailable` | `.omo/evidence/18-fix6-tutorials-importer.log` |
| Full project contract remains green | Data checks, tutorial model/SEO/renderer/importer, lint, typecheck, Next build, smoke | `npm run check` | Exit `0`; log reaches `LearningSEO production smoke test passed.` | `.omo/evidence/18-fix6-npm-check.log` |
| Tutorial lifecycle acceptance remains green | Pilot lifecycle contract mode | `npm run tutorials:check -- --contract` | Exit `0`; log contains `Tutorial lifecycle acceptance contract passed.` | `.omo/evidence/18-fix6-tutorials-contract.log` |
| Diff whitespace is clean | Current worktree diff | `git diff --check` | Exit `0`; log contains `git diff --check passed` | `.omo/evidence/18-fix6-diff-check.log` |
| Pre-commit review passed | Standards and spec review of current diff | `code-review` skill with two reviewer agents | Both reports have `Verdict: PASS` | `.omo/evidence/18-fix6-standards-review.md`, `.omo/evidence/18-fix6-spec-review.md` |

## Changed Files

- `scripts/collect-learningseo-tutorial.mjs`
- `scripts/lib/tutorial-importer.mjs`
- `scripts/check-tutorial-importer.mjs`
