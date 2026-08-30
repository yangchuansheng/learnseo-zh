# Issue 18 Fix 9 Evidence

Commit base: `c89cbcdc32386dec064fcfbb1bd47bacf2529ef4`

## Runtime blockers fixed

1. Scenario: Node 24 custom `lookup` callback honors the `{ all: true }` contract in `pinnedHttpsRequest`.
   Invocation: `npm run tutorials:importer`
   Binary observable: exit `0`; deterministic HTTPS mock invokes `options.lookup("example.com", { all: true }, callback)` and observes `[{ address: "93.184.216.34", family: 4 }]`.
   Artifact: `.omo/evidence/18-fix9-tutorials-importer.log`

2. Scenario: benign Google DevSite captcha feature flag does not trigger bot-challenge detection, while a visible challenge fixture still fails.
   Invocation: `npm run tutorials:importer`
   Binary observable: exit `0`; fixture with `DevPro__enable_devsite_captcha = 'unusual traffic'` collects successfully, and fixture text `captcha enable JavaScript and cookies` rejects with `bot-challenge`.
   Artifact: `.omo/evidence/18-fix9-tutorials-importer.log`

3. Scenario: legal `.devsite-article-body` inline `style="display:block;margin:auto;"` reaches the sanitizer and is removed from imported content.
   Invocation: `npm run tutorials:importer`
   Binary observable: exit `0`; styled fixture snapshot retains the source style, import returns `draft`, and written English HTML has no `style=` attribute.
   Artifact: `.omo/evidence/18-fix9-tutorials-importer.log`

4. Scenario: exact public Google Pilot URL can be collected through `collectTutorialSnapshot`.
   Invocation: `node --input-type=module -e 'import { collectTutorialSnapshot, writeJsonFile } from "./scripts/lib/tutorial-importer.mjs"; ...'`
   Binary observable: exit `0`; canonical/final URL is `https://developers.google.com/search/docs/fundamentals/seo-starter-guide`, content type is `text/html`, media count is `4`, title is `Search Engine Optimization (SEO) Starter Guide`, HTML bytes are `37933`.
   Artifacts: `.omo/evidence/18-fix9-real-pilot-collect.log`, `.omo/evidence/18-fix9-pilot-snapshot.json`

## Verification

1. Scenario: tutorial model contract.
   Invocation: `npm run tutorials:model`
   Binary observable: exit `0`.
   Artifact: `.omo/evidence/18-fix9-tutorials-model.log`

2. Scenario: tutorial SEO production contract.
   Invocation: `npm run tutorials:seo`
   Binary observable: exit `0`.
   Artifact: `.omo/evidence/18-fix9-tutorials-seo.log`

3. Scenario: tutorial renderer contract.
   Invocation: `npm run tutorials:renderer`
   Binary observable: exit `0`.
   Artifact: `.omo/evidence/18-fix9-tutorials-renderer.log`

4. Scenario: lifecycle acceptance contract.
   Invocation: `npm run tutorials:check -- --contract`
   Binary observable: exit `0`.
   Artifact: `.omo/evidence/18-fix9-tutorials-check-contract.log`

5. Scenario: full repository gate.
   Invocation: `npm run check`
   Binary observable: exit `0`; data, model, SEO, renderer, importer, lint, typecheck, Next build, and production smoke all pass.
   Artifact: `.omo/evidence/18-fix9-npm-check.log`

6. Scenario: patch whitespace gate.
   Invocation: `git diff --check`
   Binary observable: exit `0`.
   Artifact: `.omo/evidence/18-fix9-diff-check.log`

## Review

- Standards review finding: stale unsafe-markup text still mentioned inline style after style became sanitizer-owned. Remediation: updated the diagnostic to `contains executable attributes`.
- Spec review finding: visible challenge phrases were matched against raw HTML. Remediation: challenge text now strips comments plus script/style/template/noscript blocks before matching visible challenge phrases, while `cf-chl`, `challenge-platform`, and `/sorry/` remain raw structural checks.
