# Issue 18 Blocker Fix Evidence

Fixed on top of: `8570f15aae2fe5df36619ed1244c5ccd4b3f178e`

## Success Criteria

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Recovery safety rejects marker-only or partial journals and preserves live files | Contract creates a marker-only journal, runs recovery, asserts `recovery-conflict` with the same operation id, and byte-compares both live locale manifests before/after | `npm run tutorials:importer` via `npm run check` | Exit code 0; log includes `Tutorial importer contract passed` | `.omo/evidence/18-fix2-npm-check.log` |
| Recovery requires complete object journal entries with valid SHA-256 | Contract asserts invalid relative recovery journal entries fail with `recovery-conflict`; the importer validates object entries and 64-char sha256 values before moving files | `npm run tutorials:importer` via `npm run check` | Exit code 0; invalid journal assertions complete | `.omo/evidence/18-fix2-npm-check.log` |
| Missing/corrupt recovery journals map to `recovery-conflict` with operation id | Contract runs recovery for missing and corrupt journal files with explicit operation ids | `npm run tutorials:importer` via `npm run check` | Exit code 0; `expectImportError("recovery-conflict", operationId, ...)` passes | `.omo/evidence/18-fix2-npm-check.log` |
| Stale lock recovery works while active/fresh locks remain unavailable | Contract holds an active lock with a signal, verifies a contender returns `unavailable`, then validates complete dead-pid stale lock, stale empty lock, and reclaim-guard behavior | `npm run tutorials:importer` via `npm run check` | Exit code 0; log includes `stale and active lock scope` | `.omo/evidence/18-fix2-npm-check.log` |
| Runtime marker gate fails closed on generation mismatch while supporting bootstrap | Contract asserts `tutorialManifestMatchesGenerationMarker` accepts undefined marker and matching marker, rejects mismatched/corrupt marker; `readTutorialManifest` uses the same gate | `npm run tutorials:importer` via `npm run check` | Exit code 0; runtime marker assertions pass | `.omo/evidence/18-fix2-npm-check.log` |
| Backup cleanup failure cannot delete live manifests | Contract injects backup cleanup failure, asserts import still succeeds, live manifest generation is committed, route slug exists, and backup remains recoverable | `npm run tutorials:importer` via `npm run check` | Exit code 0; cleanup warning is logged and contract still passes | `.omo/evidence/18-fix2-npm-check.log` |
| DNS-rebinding SSRF is pinned to the validated HTTPS connection | Contract monkey-patches `dns.lookup` and `https.request`, asserts the request lookup returns the validated public IP, then asserts IPv4-mapped private IPv6 is rejected before HTTPS request creation | `npm run tutorials:importer` via `npm run check` | Exit code 0; log includes `DNS-pinned media/source trust boundaries` | `.omo/evidence/18-fix2-npm-check.log` |
| Refresh output describes a pending draft candidate with the live route still published | Contract imports a refresh over a published route, asserts result `status === "draft"`, `liveRouteStatus === "published"`, `resultKind === "refresh-candidate"`, and message text names pending review | `npm run tutorials:importer` via `npm run check` | Exit code 0; refresh candidate assertions pass | `.omo/evidence/18-fix2-npm-check.log` |
| Repeated identical media staged paths are deduplicated while manifest occurrence order is retained | Contract imports two identical media entries, asserts two manifest media occurrences and one unique staged path | `npm run tutorials:importer` via `npm run check` | Exit code 0; log includes `duplicate media staging` | `.omo/evidence/18-fix2-npm-check.log` |
| Full project validation stays green | Project check runs data validation, tutorial model/SEO/renderer/importer checks, lint, typecheck, Next build, and smoke test | `npm run check` | Exit code 0; log ends with `LearningSEO production smoke test passed.` | `.omo/evidence/18-fix2-npm-check.log` |
| Diff whitespace is clean | Git whitespace check over current diff | `node -e 'spawn git diff --check and print pass on status 0'` | Exit code 0; log contains `git diff --check passed` | `.omo/evidence/18-fix2-diff-check.log` |

## Code Review

Standards axis recheck: PASS. The prior refresh idempotency and lock reclaim race findings were rechecked after the guard-based lock reclamation fix; current lock recovery BLOCK count is 0.

Spec axis recheck: PASS. H1-H6, M1, and M3 no longer have a remaining BLOCK under the explicit bootstrap-without-marker requirement.
