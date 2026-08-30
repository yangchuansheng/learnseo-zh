# Issue 18 Fix 12 Evidence

- Base: `058f8f5`
- Scope:
  - `scripts/lib/tutorial-importer.mjs`
  - `scripts/check-tutorial-importer.mjs`

## Change

- `markerMatchesManifestPair` now validates marker shape without deriving expected fields from the marker itself.
- Recovery marker matching now requires the marker `slug` and normalized `sourceKey` to identify an actual route in both `zh-CN` and `en` manifests.
- Backup restore selection treats a missing backup marker as the only marker-absent bootstrap candidate.
- Post-restore verification uses the same route-backed marker predicate as restore selection.
- The importer contract now includes an adversarial backup-marker tampering scenario with different `slug` and `sourceKey`, expects `recovery-conflict`, and asserts live manifest/marker bytes remain unchanged.

## Validation

- `npm run tutorials:importer`
  - Result: pass
  - Artifact: `.omo/evidence/18-fix12-tutorials-importer.log`
- `npm run tutorials:check -- --contract`
  - Result: pass
  - Artifact: `.omo/evidence/18-fix12-tutorials-check-contract.log`
- `npm run check`
  - Result: pass
  - Artifact: `.omo/evidence/18-fix12-npm-check.log`
- `git diff --check`
  - Result: pass
  - Artifact: `.omo/evidence/18-fix12-diff-check.log`

## Review

- Standards review artifact: `.omo/evidence/18-fix12-standards-review.md`
  - Findings addressed before final validation: removed the redundant `undefined` filter and collapsed repeated live-file reads in the tampered backup-marker test.
- Spec review artifact: `.omo/evidence/18-fix12-spec-review.md`
  - Findings addressed before handoff: final commit includes the focused fix/evidence, and diff-check evidence is now non-empty with invocation and exit code.
