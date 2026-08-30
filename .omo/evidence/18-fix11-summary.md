# Issue 18 Fix11 Evidence

## Implementation

- Scenario: any existing operation journal reserves its operationId.
  Invocation: `npm run tutorials:importer`
  Binary observable: exit code 0; `duplicate-operation` is asserted for failed journal reuse, committed journal conflicting source reuse, committed journal missing snapshot reuse, and guarded reclaim retry reuse.
  Artifact: `.omo/evidence/18-fix11-tutorials-importer.log`

- Scenario: failed operation journal retry preserves original audit bytes.
  Invocation: `npm run tutorials:importer`
  Binary observable: exit code 0; test asserts journal bytes are unchanged and original actor `audit.operator` plus phase `failed` remain.
  Artifact: `.omo/evidence/18-fix11-tutorials-importer.log`

- Scenario: committed operation journal with ownership conflict preserves original audit bytes.
  Invocation: `npm run tutorials:importer`
  Binary observable: exit code 0; test asserts stable `duplicate-operation` output, unchanged journal bytes, original actor `importer.test`, and phase `committed`.
  Artifact: `.omo/evidence/18-fix11-tutorials-importer.log`

- Scenario: full project regression check.
  Invocation: `npm run check`
  Binary observable: exit code 0; data checks, tutorial model/SEO/renderer/importer, lint, typecheck, build, and smoke all pass.
  Artifact: `.omo/evidence/18-fix11-npm-check.log`

- Scenario: tutorial lifecycle acceptance contract.
  Invocation: `npm run tutorials:check -- --contract`
  Binary observable: exit code 0; `Tutorial lifecycle acceptance contract passed.`
  Artifact: `.omo/evidence/18-fix11-tutorials-contract.log`

- Scenario: whitespace and conflict marker check.
  Invocation: `git diff --check`
  Binary observable: exit code 0; `git diff --check passed for issue 18 fix11`.
  Artifact: `.omo/evidence/18-fix11-diff-check.log`

- Scenario: staged whitespace and conflict marker check.
  Invocation: `git diff --cached --check`
  Binary observable: exit code 0; `git diff --cached --check passed for issue 18 fix11`.
  Artifact: `.omo/evidence/18-fix11-cached-diff-check.log`

## Code Review

- Standards axis: 0 documented-standard violations. One low-risk test duplication judgment call was accepted because each repeated call targets a separate duplicate-operation scenario.
- Spec axis: 0 findings after the catch-path duplicate-operation fix.
