# Issue 18 Fix10 Evidence

## Scope

Fixes blockers from `.omo/evidence/18-gate-review.md` on top of `317e352`.

## Success Criteria

| Criterion | Exact scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- | --- |
| B1 unique operation audit | Import a tutorial, then retry the same `operationId` with changed English and Chinese content. | `npm run tutorials:importer` | Exit `0`; contract asserts `duplicate-operation`, unchanged first journal bytes, unchanged marker bytes, and unchanged backup filename set. | `.omo/evidence/18-fix10-tutorials-importer.log` |
| B2 atomic bilingual runtime | Run the runtime manifest reader against a valid pair, a mixed-generation pair, and a marker with a wrong slug. | `npm run tutorials:importer` | Exit `0`; valid pair returns both locales available; mixed generation and marker identity drift return both locales unavailable. | `.omo/evidence/18-fix10-tutorials-importer.log` |
| B3 recovery/import failure audit | Run import CLI missing-input, recovery CLI missing-journal, and recovery CLI invalid-actor failures. | `npm run tutorials:importer` | Exit `0`; each checked failure leaves exactly one `failures` entry and one `failed` phase; invalid actor reports `usage` and stores actor `unspecified`. | `.omo/evidence/18-fix10-tutorials-importer.log` |
| Lifecycle contract | Validate tutorial lifecycle acceptance contract. | `npm run tutorials:check -- --contract` | Exit `0`; lifecycle acceptance contract passed. | `.omo/evidence/18-fix10-tutorials-contract.log` |
| Full project check | Run data, tutorial model, SEO, renderer, importer, lint, typecheck, Next build, and smoke checks. | `npm run check` | Exit `0`; all package checks passed. | `.omo/evidence/18-fix10-npm-check.log` |
| Diff hygiene | Check whitespace/errors in current diff. | `git diff --check` | Exit `0`; artifact contains `git diff --check exit=0`. | `.omo/evidence/18-fix10-diff-check.log` |

## Review

Two-axis read-only subagent review completed with zero blocking findings.

- Standards review artifact: `.omo/evidence/18-fix10-code-review.md`
- Spec review artifact: `.omo/evidence/18-fix10-code-review.md`
