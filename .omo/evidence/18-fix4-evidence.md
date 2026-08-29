# Issue 18 Fix4 Evidence

Commit base: `15fa07766a02a75d65cf6f1b414fd3dd362d4d67`

## B1 IPv4-Compatible IPv6 Boundary

Scenario: source and media DNS preflight rejects embedded private IPv4 answers inside IPv6 spellings before `https.request`.

Invocation:

```sh
npm run tutorials:importer
```

Binary observable: exit code `0`; contract log contains `embedded IPv4-in-IPv6 rejection`.

Artifact: `.omo/evidence/18-fix4-tutorials-importer.log`

## B2 Partial Backup Recovery

Scenario: interrupted commit with Chinese live manifest replaced, English live manifest untouched, only Chinese backup present, and English candidate proof missing restores the prior bilingual pair and remains idempotent on a second recovery call.

Invocation:

```sh
npm run tutorials:importer
```

Binary observable: exit code `0`; assertions verify mixed generations before recovery and exact byte equality with the prior locale pair after both recovery calls.

Artifact: `.omo/evidence/18-fix4-tutorials-importer.log`

## B3 Operation And Actor Audit

Scenario: CLI usage failures include `operation=<id>`; import failures for translation, media, sanitizer, validation, and commit carry operation identity and write failure journals with actor; successful import result and committed journal retain actor.

Invocation:

```sh
npm run tutorials:importer
```

Binary observable: exit code `0`; assertions cover missing input, `--content-root`, boolean `--translator`, failure journals, and success actor retention.

Artifact: `.omo/evidence/18-fix4-tutorials-importer.log`

## Regression Suite

Invocations and artifacts:

- `npm run tutorials:model` -> `.omo/evidence/18-fix4-tutorials-model.log`
- `npm run tutorials:seo` -> `.omo/evidence/18-fix4-tutorials-seo.log`
- `npm run tutorials:renderer` -> `.omo/evidence/18-fix4-tutorials-renderer.log`
- `npm run tutorials:check -- --contract` -> `.omo/evidence/18-fix4-tutorials-check-contract.log`
- `npm run check` -> `.omo/evidence/18-fix4-npm-check.log`
- `git diff --check` -> `.omo/evidence/18-fix4-git-diff-check.log`
- `git diff --cached --check` -> `.omo/evidence/18-fix4-git-cached-diff-check.log`

Binary observable: all commands exited `0`.

## Review

Invocation: `/code-review` skill via parallel Standards and Spec sub-agents.

Binary observable: Standards hard violations `0`; Spec recheck found no remaining B1, B2, or B3 blockers.

Artifact: `.omo/evidence/18-fix4-code-review.md`
