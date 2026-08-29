# Issue 18 Fix 5 Evidence

Base: `c45e1e5ab608a00241ad9c3d1874094fcf1e3d45`

Changed files:

- `scripts/lib/tutorial-importer.mjs`
- `scripts/import-learningseo-tutorial.mjs`
- `scripts/recover-tutorial.mjs`
- `scripts/check-tutorial-importer.mjs`
- `src/lib/tutorials/model.ts`

## Success Criteria

| Criterion | Exact scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| B1 public DNS boundary | Source collection injects IPv6 DNS answers `::`, `::1`, `100::1`, `2001:2::1`, `2001:db8::1`, `2002::1`, `3fff::1`, `fc00::1`, `fe80::1`, and `ff00::1`; `https.request` toggles `requested=true` if called. | `npm run tutorials:importer` | Exit 0; assertions confirm code `unavailable` and `requested === false` for every source answer. Test lines: `scripts/check-tutorial-importer.mjs:660-690`. | `.omo/evidence/18-fix5-evidence.md` |
| B1 media DNS boundary | Media download injects `::10.0.0.1`, `100::1`, `2001:2::1`, and `3fff::1`; `https.request` toggles `mediaRequested=true` if called. | `npm run tutorials:importer` | Exit 0; assertions confirm code `unavailable`, operation `tutorial-import-private-media-dns-test`, and `mediaRequested === false`. Test lines: `scripts/check-tutorial-importer.mjs:692-718`. | `.omo/evidence/18-fix5-evidence.md` |
| B1 implementation | IPv6 normalization is expanded before DNS pinning and rejects embedded IPv4 forms plus non-global ranges outside `2000::/3`, `2001::/23`, `2001:2::/48`, `2001:db8::/32`, `2002::/16`, and `3fff::/20`. | `npm run tutorials:importer` | Exit 0; pinned request test still connects to `93.184.216.34` for public IPv4 while non-global IPv6 probes never reach `https.request`. Code lines: `scripts/lib/tutorial-importer.mjs:342-378`. | `.omo/evidence/18-fix5-evidence.md` |
| B2 refresh-candidate pairing | A valid bilingual refresh candidate is cloned, then Chinese candidate `media`, `toc`, `contentMetrics`, and `seo.dateModified` are each changed one at a time. | `npm run tutorials:importer` | Exit 0; each mutation throws the matching `refresh candidate ... pairing` error. Test lines: `scripts/check-tutorial-importer.mjs:1367-1381`. | `.omo/evidence/18-fix5-evidence.md` |
| B2 recovery candidate rejection | A published pair is refreshed with `failBeforeFirstContent`, then the staged Chinese refresh-candidate media list is cleared and the journal hash is updated to make candidate proof reach manifest validation. | `npm run tutorials:importer` | Exit 0; `recoverTutorialImport` returns code `recovery-conflict`, and live `manifest.json` / `manifest.en.json` bytes equal the pre-recovery published pair. Test lines: `scripts/check-tutorial-importer.mjs:1382-1432`. | `.omo/evidence/18-fix5-evidence.md` |
| B2 restore from proven backup/live set | Partial restore scenario leaves only one manifest backup, puts a staged manifest into live Chinese, removes English and marker backups, then runs recovery twice. | `npm run tutorials:importer` | Exit 0; recovery returns `restored` both times and the live bilingual pair equals the original bytes. Existing test lines: `scripts/check-tutorial-importer.mjs:1265-1313`. | `.omo/evidence/18-fix5-evidence.md` |
| B3 import CLI parser failures | `scripts/import-learningseo-tutorial.mjs` is spawned with missing input, forbidden content root, boolean translator, stray arg, invalid operation id, and missing translation. | `npm run tutorials:importer` | Exit 0; stderr contains `[tutorial-importer] usage operation=<id>:` and each failure journal records `operationId`, `actor`, `phase=failed`, and `failure.code=usage`. Test lines: `scripts/check-tutorial-importer.mjs:288-368`. | `.omo/evidence/18-fix5-evidence.md` |
| B3 recover CLI actor identity | `scripts/recover-tutorial.mjs --operation tutorial-import-cli-recover-missing-journal-test --actor cli.operator` runs with no journal. | `npm run tutorials:importer` | Exit 0; stderr contains `recovery-conflict operation=tutorial-import-cli-recover-missing-journal-test`, and the failure journal actor is `cli.operator`. Test lines: `scripts/check-tutorial-importer.mjs:369-383`; CLI passes actor at `scripts/recover-tutorial.mjs:13`. | `.omo/evidence/18-fix5-evidence.md` |
| B3 programmatic failures | Programmatic import validation, translation, media, sanitizer, commit, and recovery failures run through `errorWithOperation` and `recordFailureJournal`; invalid operation uses a generated safe operation id. | `npm run tutorials:importer` | Exit 0; assertions verify failure journal fields for translation, media, sanitizer, commit, and recovery paths. Code lines: `scripts/lib/tutorial-importer.mjs:189-203`, `2162-2245`, `2331-2343`, `2396-2404`. | `.omo/evidence/18-fix5-evidence.md` |
| Code review | Standards and Spec review agents inspected `git diff c45e1e5 -- scripts/lib/tutorial-importer.mjs scripts/import-learningseo-tutorial.mjs scripts/recover-tutorial.mjs scripts/check-tutorial-importer.mjs src/lib/tutorials/model.ts`. | `code-review` subagents `issue18_fix5_standards_review` and `issue18_fix5_spec_review` | Standards found unused `filePath` and speculative `options`; both were removed. Spec found recover CLI actor loss; fixed and covered by test. Remaining standards note about media projection was resolved by `comparableMedia`. | `.omo/evidence/18-fix5-evidence.md` |

## Verification Commands

| Invocation | Exit | Observable |
| --- | --- | --- |
| `npm run tutorials:importer` | 0 | `Tutorial importer contract passed: deterministic fixture collect/import, in-process recovery/restore coverage, marker gating, non-global IPv6 rejection, tuple idempotency, failure audit, lock scope, provenance metadata, duplicate media staging, and refresh candidate preservation.` |
| `npm run check` | 0 | `Validated 161 routes`; `Tutorial content model contract passed`; `Tutorial SEO production contract passed`; `Tutorial renderer contract passed`; `Tutorial importer contract passed`; `eslint`; `tsc --noEmit`; `next build` compiled successfully; `LearningSEO production smoke test passed.` |
| `npm run tutorials:check -- --contract` | 0 | `Tutorial lifecycle acceptance contract passed.` |
| `git diff --check` | 0 | No whitespace errors. |
| `find src/content/tutorials/.import-journal -maxdepth 1 -type f -print 2>/dev/null` | 0 | No default CLI test journals remained after cleanup. |

## Review Notes

- `recordCliFailure` writes durable CLI failure journals under the default tutorial content root and returns the wrapped error so stderr always includes `operation=<safe-id>`.
- `recoverTutorialImport` now allocates operation id and actor before validation, records recovery failures, and accepts CLI actor forwarding.
- `restoreCommittedBackups` now validates backup/live zh/en plus backup/live/no-marker combinations before restoring a pair.
- `validateTutorialManifestPair` now validates refresh-candidate metrics, TOC shape, media identity/order, and shared SEO fields.
