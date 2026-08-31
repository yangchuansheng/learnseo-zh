import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = path.join(
  repositoryRoot,
  "docs/research/wayfinder-seo-fundamentals-migration-waves.md",
);
const waveIds = [
  "wave-0-pilot",
  "wave-1-official-google",
  "wave-2-rights-reviewed",
  "wave-3-manual-or-external",
];
const gateIds = [
  "bilingual-fidelity",
  "provenance",
  "media-integrity",
  "accessibility",
  "security-sanitization",
  "metadata",
  "resource-card-conversion",
  "runtime-routes",
  "rollback-readiness",
];
const expectedSources = [
  ["google-seo-starter-guide", "wave-0-pilot", "pilot-baseline", "google-seo-starter-guide", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"],
  ["google-search-works", "wave-1-official-google", "eligible-direct", "google-search-works", "https://developers.google.com/search/docs/fundamentals/how-search-works", "https://developers.google.com/search/docs/fundamentals/how-search-works"],
  ["google-search-essentials", "wave-1-official-google", "eligible-direct", "google-search-essentials", "https://developers.google.com/search/docs/essentials", "https://developers.google.com/search/docs/essentials"],
  ["ahrefs-seo-basics", "wave-2-rights-reviewed", "authorized-internalized", "ahrefs-seo-basics", "https://ahrefs.com/blog/seo-basics/", "https://ahrefs.com/seo/seo-basics"],
  ["mangools-complete-seo-guide", "wave-2-rights-reviewed", "authorized-internalized", "mangools-complete-seo-guide", "https://mangools.com/blog/learn-seo/", "https://mangools.com/blog/learn-seo/"],
  ["moz-beginners-guide", "wave-3-manual-or-external", "manual-series", null, "https://moz.com/beginners-guide-to-seo", "https://moz.com/beginners-guide-to-seo"],
  ["contentking-conductor-hub", "wave-3-manual-or-external", "external-collection", null, "https://www.contentkingapp.com/academy/seo-guide/", "https://www.conductor.com/academy/technical-seo-hub/"],
  ["semrush-seo-essentials-course", "wave-3-manual-or-external", "external-course", null, "https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/", "https://www.semrush.com/academy/courses/seo-essentials-with-semrush/"],
];

function contractFrom(document) {
  const match = document.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(match, "migration-wave artifact must contain a JSON contract fence");
  return JSON.parse(match[1]);
}

function sourceMap(contract) {
  return new Map(contract.sources.map((source) => [source.sourceId, source]));
}

function validateDocument(document) {
  assert.match(document, /^# SEO Fundamentals Migration-Wave, Throughput, and Promotion Decision\n/m);
  for (const reference of [
    "issues/23)",
    "wayfinder-seo-fundamentals-inventory.md",
    "wayfinder-seo-fundamentals-source-decisions.md",
    "tutorial-internalization-release-gates.md",
    "tutorial-internalization-lifecycle.md",
  ]) assert.ok(document.includes(reference), `artifact is missing ${reference}`);
  for (const evidence of ["37,933", "4,337 ms", "2,948 ms", "global tutorial write lock"]) {
    assert.ok(document.includes(evidence), `artifact is missing throughput evidence ${evidence}`);
  }
  assert.match(document, /partial[- ]wave/i);
  assert.match(document, /zero new slugs/i);
  assert.match(document, /no bulk migration\s+runner/i);
}

function validateBaseline(contract) {
  assert.deepEqual(contract.baseline, {
    pilotSlug: "google-seo-starter-guide",
    sourceCanonical: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
    resourceOccurrences: 2152,
    bilingualRenderedAnchors: 4304,
    normalizedSourceKeys: 912,
  }, "Pilot baseline drifted");
}

function validateThroughput(contract) {
  assert.deepEqual(contract.throughput, {
    collectionConcurrency: 2,
    importConcurrency: 1,
    reviewConcurrency: 1,
    promotionConcurrency: 1,
    writeLock: "global-tutorial-write-lock",
    mediaConcurrencyPerSource: 1,
  }, "throughput policy drifted");
}

function validateWaves(contract) {
  assert.deepEqual(contract.waves.map((wave) => wave.id), waveIds, "wave order drifted");
  const expected = [
    [1, ["google-seo-starter-guide"], "baseline-preservation"],
    [2, ["google-search-works", "google-search-essentials"], "all-imported-items-or-zero"],
    [1, ["ahrefs-seo-basics", "mangools-complete-seo-guide"], "one-rights-approved-item-per-boundary"],
    [1, ["moz-beginners-guide", "contentking-conductor-hub", "semrush-seo-essentials-course"], "disposition-only-until-qualified"],
  ];
  for (const [index, [batchSize, orderedSourceIds, promotionMode]] of expected.entries()) {
    const wave = contract.waves[index];
    assert.equal(wave.batchSize, batchSize, `${wave.id} batch size drifted`);
    assert.equal(wave.importConcurrency, 1, `${wave.id} import concurrency must be serial`);
    assert.deepEqual(wave.orderedSourceIds, orderedSourceIds, `${wave.id} source order drifted`);
    assert.equal(wave.promotionMode, promotionMode, `${wave.id} promotion mode drifted`);
    assert.equal(new Set(wave.orderedSourceIds).size, wave.orderedSourceIds.length, `${wave.id} contains duplicate units`);
  }
}

function validateSources(contract) {
  assert.equal(contract.sources.length, expectedSources.length, "source mapping is incomplete");
  const actual = sourceMap(contract);
  for (const [sourceId, waveId, disposition, routeSlug, requestedUrl, canonicalUrl] of expectedSources) {
    const source = actual.get(sourceId);
    assert.ok(source, `missing source mapping ${sourceId}`);
    assert.deepEqual(
      [source.sourceId, source.waveId, source.disposition, source.routeSlug, source.requestedUrl, source.canonicalUrl],
      [sourceId, waveId, disposition, routeSlug, requestedUrl, canonicalUrl],
      `${sourceId} source identity drifted`,
    );
    assert.ok(Array.isArray(source.dependencies) && source.dependencies.length > 0, `${sourceId} dependencies are missing`);
    assert.ok(contract.waves.find((wave) => wave.id === waveId)?.orderedSourceIds.includes(sourceId), `${sourceId} is outside its wave`);
    if (disposition === "eligible-direct") {
      assert.equal(source.importMode, "direct", `${sourceId} direct import mode drifted`);
      assert.ok(source.dependencies.includes("translation-handoff"), `${sourceId} translation dependency is missing`);
      assert.ok(source.dependencies.includes("all-release-gates"), `${sourceId} release-gate dependency is missing`);
    }
    if (disposition === "authorized-internalized") {
      assert.equal(source.importMode, "authorized-internalized", `${sourceId} authorized import mode drifted`);
      for (const dependency of ["project-owner-authorization", "per-asset-rights", "translation-handoff", "all-release-gates"]) {
        assert.ok(source.dependencies.includes(dependency), `${sourceId} lacks ${dependency}`);
      }
    }
    if (disposition === "manual-series") {
      assert.equal(source.routeSlug, null, "Moz series index cannot own a route slug");
      assert.ok(source.dependencies.includes("child-page-qualification"), "Moz child qualification is missing");
    }
    if (["external-collection", "external-course"].includes(disposition)) {
      assert.equal(source.routeSlug, null, `${sourceId} external unit has a route slug`);
      assert.equal(source.importMode, "external-only", `${sourceId} external unit entered import`);
    }
    if (requestedUrl !== canonicalUrl) assert.ok(source.dependencies.includes("canonical-rebind"), `${sourceId} redirect lacks canonical-rebind`);
  }
  assert.equal(new Set(contract.sources.map((source) => source.sourceId)).size, expectedSources.length, "source ids must be unique");
}

function validateReviewOrder(contract) {
  assert.deepEqual(contract.mozChildReviewOrder, [
    "introduction",
    "quick-start-guide",
    "why-search-engine-marketing-is-necessary",
    "how-search-engines-operate",
    "keyword-research",
    "on-page-seo",
    "technical-seo",
    "growing-popularity-and-links",
    "measuring-and-tracking-success",
    "seo-glossary",
  ], "Moz child review order drifted");
}

function validatePromotion(contract) {
  const rule = contract.promotionRule;
  assert.equal(rule.stagedStatus, "draft", "staged status must be draft");
  assert.equal(rule.stagedIndexable, false, "staged candidates must be noindex");
  assert.equal(rule.stagedResourceLinks, "external", "staged links must remain external");
  assert.equal(rule.reviewDecision, "approved", "promotion requires approval");
  assert.deepEqual(rule.requiredGateIds, gateIds, "promotion gate set drifted");
  assert.equal(rule.allImportedItemsMustPass, true, "promotion must be all-or-zero");
  assert.equal(rule.atomicLocalePair, true, "locale pair must promote atomically");
  assert.deepEqual(rule.generationUnit, ["manifest.json", "manifest.en.json", "import-generation.json", "resource-link-map"]);
  assert.deepEqual(rule.onSuccess, {
    publishedSlugs: "all-imported-items",
    activeGeneration: "candidateGeneration",
    resourceLinks: "published-slugs-only",
  });
  assert.deepEqual(rule.onFailure, {
    publishedSlugs: [],
    activeGeneration: "previousGeneration",
    resourceLinks: "previousGeneration",
  });
}

function validateFailureAndRollback(contract) {
  assert.deepEqual(contract.partialWaveFailure, {
    publishNewSlugs: 0,
    activeGeneration: "previousGeneration",
    pilotBaselinePreserved: true,
    successfulCandidates: "retain-staged-preview",
    failedCandidate: "retain-journal-and-failure-code",
    retryUnit: "failed-source-only-after-correction",
    resourceLinkMap: "previousGeneration",
  });
  assert.deepEqual(contract.rollbackRule, {
    boundary: "wave-candidate-generation",
    restoreTarget: "previousGeneration",
    restoreUnit: ["manifest.json", "manifest.en.json", "import-generation.json", "resource-link-map"],
    activePointerBeforeApproval: "unchanged",
    preserve: ["routes-published-before-wave", "content-addressed-history", "source-identities-and-aliases"],
  });
}

function validateContract(contract) {
  assert.equal(contract.schemaVersion, 1, "unsupported migration-wave schema");
  assert.equal(contract.checked, "2026-08-31", "migration-wave evidence date drifted");
  validateBaseline(contract);
  validateThroughput(contract);
  validateWaves(contract);
  validateSources(contract);
  validateReviewOrder(contract);
  validatePromotion(contract);
  validateFailureAndRollback(contract);
}

const document = await fs.readFile(artifactPath, "utf8");
const contract = contractFrom(document);
validateDocument(document);
validateContract(contract);
assert.throws(() => validateContract({
  ...contract,
  promotionRule: {
    ...contract.promotionRule,
    onFailure: { ...contract.promotionRule.onFailure, publishedSlugs: ["google-search-works"] },
  },
}), /publishedSlugs/);
assert.throws(() => validateContract({
  ...contract,
  partialWaveFailure: { ...contract.partialWaveFailure, activeGeneration: "candidateGeneration" },
}), /activeGeneration/);
console.log(`Validated migration waves: ${contract.waves.length} waves, ${contract.sources.length} source units, serial promotion, and all-or-zero failure isolation.`);
