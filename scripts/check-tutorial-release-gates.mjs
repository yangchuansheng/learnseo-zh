import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import {
  lifecycleContractFixture,
  pilotMetrics,
  pilotSlug,
  sourceCanonical,
  validateLifecycleEvidence,
} from "./check-learningseo-tutorial-pilot.mjs";
import { normalizeSourceKey } from "../src/lib/tutorials/source-key.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tutorialRoot = path.join(repositoryRoot, "src/content/tutorials");
const contentRoot = path.join(tutorialRoot, "content");
const publicRoot = path.join(repositoryRoot, "public");
const inventoryPath = path.join(repositoryRoot, "docs/research/wayfinder-seo-fundamentals-inventory.md");
const releaseGateDocPath = path.join(repositoryRoot, "docs/research/tutorial-internalization-release-gates.md");
const mediaPrefix = "/sites/learningseo-io-071dae18/tutorials/";
const siteOrigin = "https://learningseo.io";

const GATE_IDS = [
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
const OFFLINE_GATE_IDS = GATE_IDS.filter((gate) => gate !== "runtime-routes");
const WAVE_IDS = [
  "wave-0-pilot",
  "wave-1-official-google",
  "wave-2-rights-reviewed",
  "wave-3-manual-or-external",
];

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
  jsx: true,
});
const [model, manifest, seo, url] = await Promise.all([
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/manifest.ts")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/seo.tsx")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/url.ts")),
]);

function assertString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

function assertHash(value, label) {
  assert.match(value, /^[a-f0-9]{64}$/i, `${label} must be a SHA-256 digest`);
}

function readAttributes(tagSource) {
  return new Map(
    [...tagSource.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [
      match[1].toLowerCase(),
      match[3],
    ]),
  );
}

function tagSources(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function openingTagCount(html, tag) {
  return tagSources(html, tag).length;
}

function semanticTagSequence(html) {
  const semanticTags = new Set(model.TUTORIAL_SEMANTIC_TAGS);
  return [...html.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)]
    .map((match) => match[1].toLowerCase())
    .filter((tag) => semanticTags.has(tag));
}

function attributeValues(html, attribute) {
  return [...html.matchAll(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "gi"))]
    .map((match) => match[2]);
}

function headingSignature(html) {
  return [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => {
    const attrs = readAttributes(match[0]);
    return { id: attrs.get("id") ?? null, level: Number(match[1]) };
  });
}

function contentMetrics(html) {
  return Object.fromEntries(
    model.TUTORIAL_SEMANTIC_TAGS
      .map((tag) => [tag, openingTagCount(html, tag)])
      .filter(([, count]) => count > 0),
  );
}

function licenseText(license) {
  return typeof license === "string" ? license : license?.text;
}

function assertHttpsIdentity(value, label) {
  assertString(value, label);
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "https:", `${label} must use HTTPS`);
  assert.equal(parsed.username, "", `${label} must not contain credentials`);
  assert.equal(parsed.password, "", `${label} must not contain credentials`);
  return normalizeSourceKey(value);
}

function assertLocalMediaPath(value, label) {
  assertString(value, label);
  const parsed = new URL(value, siteOrigin);
  assert.equal(parsed.origin, siteOrigin, `${label} must be repository-local`);
  assert.equal(parsed.pathname, value, `${label} must not contain query or fragment data`);
  assert.ok(value.startsWith(mediaPrefix), `${label} must stay under the tutorial media root`);
  const target = path.resolve(publicRoot, value.slice(1));
  assert.equal(target, path.join(publicRoot, value.slice(1)), `${label} must resolve below public`);
  assert.ok(target.startsWith(`${publicRoot}${path.sep}`), `${label} escapes public root`);
  assert.ok(!decodeURIComponent(value).split("/").includes(".."), `${label} contains path traversal`);
  return target;
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error.message}`);
  }
}

async function loadCurrentPair() {
  const [zhRaw, enRaw, marker] = await Promise.all([
    readJson(path.join(tutorialRoot, "manifest.json"), "Chinese tutorial manifest"),
    readJson(path.join(tutorialRoot, "manifest.en.json"), "English tutorial manifest"),
    readJson(path.join(tutorialRoot, "import-generation.json"), "tutorial generation marker"),
  ]);
  const zh = model.parseTutorialManifest(zhRaw, "zh-CN", "manifest.json");
  const en = model.parseTutorialManifest(enRaw, "en", "manifest.en.json");
  model.validateTutorialManifestPair(zh, en);
  assert.ok(manifest.tutorialManifestPairMatchesGenerationMarker(zh, en, marker),
    "locale manifests and generation marker do not describe one committed pair");
  return { zhRaw, enRaw, zh, en, marker };
}

function sourceRecordKey(record) {
  return normalizeSourceKey(record.sourceKey || record.source.canonicalUrl);
}

function routeBySlug(manifestValue) {
  return new Map(manifestValue.routes.map((route) => [route.slug, route]));
}

function validateTableSemantics(html, label) {
  for (const match of html.matchAll(/<table\b[^>]*>/gi)) {
    const start = match.index ?? 0;
    const end = html.indexOf("</table>", start);
    assert.ok(end >= start, `${label} table is not closed`);
    const table = html.slice(start, end + "</table>".length);
    assert.match(table, /<tr\b/i, `${label} table has no rows`);
    assert.match(table, /<(?:td|th)\b/i, `${label} table has no cells`);
  }
}

function assertPreviewRecord(record, locale) {
  assert.ok(["draft", "review", "stale"].includes(record.status),
    `${locale}/${record.slug} has an unsupported preview status`);
  assert.equal(record.seo.indexable, false, `${locale}/${record.slug} preview must be noindex`);
}

function validateProvenance(record, locale) {
  const label = `${locale}/${record.slug}`;
  const source = record.source;
  const snapshot = record.snapshot;
  assertString(source.title, `${label} source.title`);
  assertString(source.provider, `${label} source.provider`);
  assert.ok(source.author === null || typeof source.author === "string",
    `${label} source.author must be nullable text`);
  const canonical = assertHttpsIdentity(source.canonicalUrl, `${label} source.canonicalUrl`);
  assert.equal(sourceRecordKey(record), canonical, `${label} sourceKey must match canonical`);
  assert.equal(assertHttpsIdentity(source.requestedUrl, `${label} source.requestedUrl`),
    assertHttpsIdentity(snapshot.requestedUrl, `${label} snapshot.requestedUrl`));
  assert.equal(assertHttpsIdentity(source.finalUrl, `${label} source.finalUrl`),
    assertHttpsIdentity(snapshot.finalUrl, `${label} snapshot.finalUrl`));
  assert.equal(assertHttpsIdentity(snapshot.pageCanonicalUrl, `${label} snapshot.pageCanonicalUrl`), canonical);
  assert.equal(snapshot.canonicalMatched, true, `${label} canonical verification is missing`);
  assert.equal(source.contentType.split(";", 1)[0].trim().toLowerCase(), "text/html",
    `${label} source content type must be text/html`);
  assertString(snapshot.capturedAt, `${label} snapshot.capturedAt`);
  assert.ok(Number.isFinite(Date.parse(snapshot.capturedAt)), `${label} snapshot.capturedAt must be a date`);
  assertString(snapshot.sourceUpdatedAt, `${label} snapshot.sourceUpdatedAt`);
  assert.ok(Number.isFinite(Date.parse(snapshot.sourceUpdatedAt)), `${label} snapshot.sourceUpdatedAt must be a date`);
  assertString(licenseText(source.license), `${label} source license evidence`);
  assertHash(snapshot.sourceContentHash, `${label} sourceContentHash`);
  assertHash(snapshot.contentHash, `${label} contentHash`);
  assertHash(snapshot.translationContentHash, `${label} translationContentHash`);
}

async function readContent(record, locale) {
  const label = `${locale}/${record.slug}`;
  const expectedHash = locale === "en"
    ? record.snapshot.contentHash
    : record.snapshot.translationContentHash;
  assertHash(expectedHash, `${label} content hash`);
  assert.equal(record.contentFile, `${expectedHash}.html`, `${label} contentFile hash mismatch`);
  const target = path.resolve(contentRoot, record.contentFile);
  assert.equal(target, path.join(contentRoot, record.contentFile), `${label} content path escapes root`);
  const html = await fs.readFile(target, "utf8");
  model.validateContentHash(html, expectedHash, `${label} content`);
  const validation = model.validateTutorialHtml(html, `${label} content`);
  validateTableSemantics(html, label);
  assert.deepEqual(validation.metrics, record.contentMetrics, `${label} contentMetrics drifted from HTML`);
  return { html, validation };
}

async function validateMedia(record, html, locale) {
  const label = `${locale}/${record.slug}`;
  const images = tagSources(html, "img").map((source) => readAttributes(source));
  assert.equal(images.length, record.media.length, `${label} media manifest count differs from HTML`);
  for (const [index, media] of record.media.entries()) {
    const attrs = images[index];
    assert.ok(attrs, `${label} media ${index + 1} is missing from HTML`);
    assert.equal(attrs.get("src"), media.path, `${label} media ${index + 1} path differs`);
    assertString(attrs.get("alt"), `${label} media ${index + 1} alt`);
    if (locale === "en") {
      assert.equal(attrs.get("alt"), media.alt, `${label} media ${index + 1} alt differs`);
    }
    const target = assertLocalMediaPath(media.path, `${label} media ${index + 1}`);
    const bytes = await fs.readFile(target);
    assert.equal(model.sha256(bytes), media.sha256, `${label} media ${index + 1} hash differs`);
  }
}

function validateBilingualFidelity(zhRecord, enRecord, zhHtml, enHtml) {
  const label = `bilingual/${zhRecord.slug}`;
  assert.equal(zhRecord.translation.sourceSections, zhRecord.translation.translatedSections,
    `${label} section counts differ`);
  assert.ok(zhRecord.translation.sourceSections > 0, `${label} section count must be positive`);
  assert.deepEqual(contentMetrics(zhHtml), contentMetrics(enHtml), `${label} semantic metrics differ`);
  assert.deepEqual(semanticTagSequence(zhHtml), semanticTagSequence(enHtml), `${label} semantic order differs`);
  assert.deepEqual(headingSignature(zhHtml), headingSignature(enHtml), `${label} heading identity differs`);
  assert.deepEqual(attributeValues(zhHtml, "href"), attributeValues(enHtml, "href"), `${label} links differ`);
  assert.deepEqual(attributeValues(zhHtml, "src"), attributeValues(enHtml, "src"), `${label} media/embed identity differs`);
  assert.match(zhHtml, /[\u3400-\u9fff]/, `${label} Chinese content is missing`);
  assert.notEqual(zhHtml, enHtml, `${label} locales contain identical HTML`);
}

function validateMetadata(record, locale) {
  const label = `${locale}/${record.slug}`;
  const expectedUrl = url.tutorialUrl(record.slug, locale);
  assert.equal(record.seo.indexable, true, `${label} must be indexable after publication`);
  const metadata = seo.createTutorialMetadata(record, locale, {
    indexable: true,
    includeAlternates: true,
  });
  assert.equal(metadata.alternates?.canonical, expectedUrl, `${label} canonical metadata differs`);
  assert.deepEqual(metadata.alternates?.languages, url.tutorialAlternates(record.slug),
    `${label} locale alternates differ`);
  assert.equal(metadata.robots?.index, true, `${label} robots index differs`);
  assert.equal(metadata.robots?.follow, true, `${label} robots follow differs`);
  const structured = seo.createTutorialStructuredData(record, locale);
  assert.equal(structured["@type"], "TechArticle", `${label} JSON-LD type differs`);
  assert.equal(structured.inLanguage, locale, `${label} JSON-LD locale differs`);
  assert.equal(structured.isBasedOn, record.source.canonicalUrl, `${label} JSON-LD source differs`);
  assert.equal(structured.mainEntityOfPage["@id"], expectedUrl, `${label} JSON-LD route differs`);
  for (const field of ["headline", "description", "dateModified", "author", "publisher", "mainEntityOfPage"]) {
    assert.ok(structured[field], `${label} JSON-LD ${field} is missing`);
  }
}

async function validatePublishedRecord(zhRecord, enRecord) {
  validateProvenance(zhRecord, "zh-CN");
  validateProvenance(enRecord, "en");
  const [{ html: zhHtml }, { html: enHtml }] = await Promise.all([
    readContent(zhRecord, "zh-CN"),
    readContent(enRecord, "en"),
  ]);
  validateBilingualFidelity(zhRecord, enRecord, zhHtml, enHtml);
  await Promise.all([
    validateMedia(zhRecord, zhHtml, "zh-CN"),
    validateMedia(enRecord, enHtml, "en"),
  ]);
  validateMetadata(zhRecord, "zh-CN");
  validateMetadata(enRecord, "en");
  return { zhHtml, enHtml };
}

function historySignature(entry) {
  return {
    version: entry.version,
    canonicalUrl: normalizeSourceKey(entry.canonicalUrl),
    sourceContentHash: entry.sourceContentHash,
    contentHash: entry.contentHash,
    translationContentHash: entry.translationContentHash ?? null,
    contentFile: entry.contentFile ?? null,
    translationContentFile: entry.translationContentFile ?? null,
  };
}

async function validateHistory(record, locale) {
  const label = `${locale}/${record.slug}`;
  for (const [index, entry] of record.snapshot.history.entries()) {
    const entryLabel = `${label} history[${index}]`;
    assert.equal(normalizeSourceKey(entry.canonicalUrl), sourceRecordKey(record), `${entryLabel} canonical differs`);
    assertHash(entry.sourceContentHash, `${entryLabel} sourceContentHash`);
    assertHash(entry.contentHash, `${entryLabel} contentHash`);
    assertHash(entry.translationContentHash, `${entryLabel} translationContentHash`);
    assert.equal(entry.contentFile, `${entry.contentHash}.html`, `${entryLabel} contentFile is not content-addressed`);
    assert.equal(entry.translationContentFile, `${entry.translationContentHash}.html`,
      `${entryLabel} translationContentFile is not content-addressed`);
    for (const [hash, file, fileLabel] of [
      [entry.contentHash, entry.contentFile, "English"],
      [entry.translationContentHash, entry.translationContentFile, "Chinese"],
    ]) {
      const target = path.resolve(contentRoot, file);
      assert.equal(target, path.join(contentRoot, file), `${entryLabel} ${fileLabel} path escapes root`);
      const bytes = await fs.readFile(target);
      assert.equal(model.sha256(bytes), hash, `${entryLabel} ${fileLabel} hash differs`);
    }
  }
}

async function validateRollbackReadiness(zhRecord, enRecord) {
  const label = `rollback/${zhRecord.slug}`;
  assert.equal(zhRecord.activeVersion, enRecord.activeVersion, `${label} active versions differ`);
  assert.equal(zhRecord.snapshot.version, enRecord.snapshot.version, `${label} snapshot versions differ`);
  assert.deepEqual(
    zhRecord.snapshot.history.map(historySignature),
    enRecord.snapshot.history.map(historySignature),
    `${label} historical pair differs`,
  );
  await Promise.all([
    validateHistory(zhRecord, "zh-CN"),
    validateHistory(enRecord, "en"),
  ]);
  for (const record of [zhRecord, enRecord]) {
    if (!record.refreshCandidate) continue;
    assert.ok(["draft", "review", "stale"].includes(record.refreshCandidate.status),
      `${label} refresh candidate must remain preview-only`);
    assert.equal(record.refreshCandidate.seo.indexable, false,
      `${label} refresh candidate must be noindex`);
  }
}

function reportObject(value, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

async function readResourceLinkReport(zhRaw, enRaw) {
  const embeddedZh = zhRaw.resourceLinkReport ?? zhRaw.linkReport ?? zhRaw.sourceLinkMap;
  const embeddedEn = enRaw.resourceLinkReport ?? enRaw.linkReport ?? enRaw.sourceLinkMap;
  if (embeddedZh || embeddedEn) {
    assert.deepEqual(embeddedZh, embeddedEn, "locale resource-link reports differ");
    return reportObject(embeddedZh ?? embeddedEn, "resource-link report");
  }
  return reportObject(
    await readJson(path.join(tutorialRoot, "resource-link-report.json"), "resource-link report"),
    "resource-link report",
  );
}

function validateResourceLinkReport(report, zhManifest, enManifest) {
  const { total, unique, converted, fallback, rendered, duplicateOccurrences, unknownFragments, occurrences } = report;
  for (const [key, value] of Object.entries({ total, unique, converted, fallback, rendered, duplicateOccurrences, unknownFragments })) {
    assert.ok(Number.isInteger(value) && value >= 0, `resource-link report ${key} must be a non-negative integer`);
  }
  assert.ok(Array.isArray(occurrences), "resource-link report occurrences must be an array");
  assert.equal(occurrences.length, total, "resource-link report total differs from occurrence evidence");
  assert.equal(converted + fallback, total, "resource-link report is not partitioned");
  assert.equal(rendered, total * 2, "resource-link report rendered count is not bilingual");
  assert.equal(duplicateOccurrences, total - unique, "resource-link report duplicate count differs");
  assert.equal(new Set(occurrences.map((entry) => normalizeSourceKey(entry.sourceKey))).size, unique,
    "resource-link report unique source-key count differs");

  const routes = [...zhManifest.routes, ...enManifest.routes];
  const routesBySlug = new Map(routes.map((route) => [route.slug, route]));
  const aliases = [...zhManifest.aliases, ...enManifest.aliases];
  const publishedByKey = new Map(
    routes
      .filter((route) => route.status === "published" && route.redirectTo === undefined)
      .map((route) => [sourceRecordKey(route), route.slug]),
  );
  const slugByKey = new Map();
  let convertedCount = 0;
  let unknownFragmentCount = 0;
  for (const [index, occurrence] of occurrences.entries()) {
    const label = `resource occurrence ${index}`;
    const key = normalizeSourceKey(occurrence.sourceKey);
    assert.equal(occurrence.sourceKey, key, `${label} sourceKey must be normalized`);
    assert.equal(typeof occurrence.converted, "boolean", `${label} converted must be boolean`);
    assert.ok(occurrence.fragment === null || typeof occurrence.fragment === "string",
      `${label} fragment must be nullable text`);
    if (occurrence.fragment !== null) assert.match(occurrence.fragment, /^#/, `${label} fragment must start with #`);
    if (!occurrence.converted) {
      assert.equal(occurrence.slug, null, `${label} fallback must not expose a slug`);
      if (occurrence.fragment !== null) unknownFragmentCount += 1;
      continue;
    }
    convertedCount += 1;
    assertString(occurrence.slug, `${label} converted slug`);
    const target = routesBySlug.get(occurrence.slug);
    const aliasTarget = aliases.find((alias) => normalizeSourceKey(alias.sourceKey) === key);
    const ownerKey = aliasTarget ? sourceRecordKey(routesBySlug.get(aliasTarget.slug)) : key;
    assert.equal(target?.status, "published", `${label} converted target must be published`);
    assert.equal(publishedByKey.get(ownerKey) ?? target?.slug, occurrence.slug,
      `${label} converted target does not own its source key`);
    const previousSlug = slugByKey.get(key);
    assert.ok(!previousSlug || previousSlug === occurrence.slug, `${label} source key maps to multiple slugs`);
    slugByKey.set(key, occurrence.slug);
  }
  assert.equal(convertedCount, converted, "resource-link report converted count differs");
  assert.equal(unknownFragmentCount, unknownFragments, "resource-link report unknown-fragment count differs");
  assert.ok(occurrences.some((entry) => normalizeSourceKey(entry.sourceKey) === normalizeSourceKey(sourceCanonical)),
    "resource-link report is missing the Pilot source key");
}

function validatePilotBaseline(zhManifest, enManifest, report) {
  const zh = zhManifest.routes.find((route) => route.slug === pilotSlug);
  const en = enManifest.routes.find((route) => route.slug === pilotSlug);
  assert.ok(zh && en, "published Pilot route pair is missing");
  assert.equal(zh.status, "published", "Pilot Chinese route is no longer published");
  assert.equal(en.status, "published", "Pilot English route is no longer published");
  for (const [tag, count] of Object.entries(pilotMetrics)) {
    assert.equal(en.contentMetrics[tag], count, `Pilot ${tag} baseline changed`);
    assert.equal(zh.contentMetrics[tag], count, `Pilot Chinese ${tag} baseline changed`);
  }
  assert.equal(report.total, 2152, "Pilot resource occurrence baseline changed");
  assert.equal(report.rendered, 4304, "Pilot bilingual rendered-anchor baseline changed");
  assert.equal(report.unique, 912, "Pilot normalized source-key baseline changed");
  assert.equal(report.occurrences.filter((entry) =>
    entry.converted && normalizeSourceKey(entry.sourceKey) === normalizeSourceKey(sourceCanonical),
  ).length, 1, "Pilot conversion baseline changed");
  return { zh, en };
}

function validateWaveEvidence(evidence) {
  assert.ok(WAVE_IDS.includes(evidence.waveId), `unknown migration wave: ${evidence.waveId}`);
  assert.ok(Array.isArray(evidence.slugs) && evidence.slugs.length > 0, "wave must list ordered slugs");
  for (const slug of evidence.slugs) assertString(slug, "wave slug");
  assert.equal(new Set(evidence.slugs).size, evidence.slugs.length, "wave slugs must be unique");
  assert.ok(Array.isArray(evidence.tutorials), "wave tutorial evidence must be an array");
  assert.equal(evidence.tutorials.length, evidence.slugs.length, "wave tutorial evidence is incomplete");
  assertString(evidence.previousGeneration, "wave previous generation");
  assertString(evidence.candidateGeneration, "wave candidate generation");
  assert.equal(typeof evidence.runtimeRequested, "boolean", "wave runtimeRequested must be boolean");
  assert.equal(evidence.atomicLocalePair, true, "wave must promote both locales atomically");
  assert.equal(evidence.resourceReportPartitioned, true, "wave resource report must be partitioned");
  assert.equal(evidence.pilotBaselinePreserved, true, "wave must preserve the Pilot baseline");
  assert.equal(typeof evidence.failed, "boolean", "wave failed must be boolean");
  assert.ok(Array.isArray(evidence.publishedSlugs), "wave published slugs must be an array");
  for (const [index, tutorial] of evidence.tutorials.entries()) {
    assert.equal(tutorial.slug, evidence.slugs[index], `wave tutorial ${index} order differs`);
    assert.ok(Array.isArray(tutorial.gates), `wave tutorial ${tutorial.slug} gates are missing`);
    const byId = new Map(tutorial.gates.map((gate) => [gate.id, gate.status]));
    assert.equal(byId.size, GATE_IDS.length, `${evidence.waveId}/${tutorial.slug} gate set is incomplete`);
    for (const gateId of OFFLINE_GATE_IDS) assert.equal(byId.get(gateId), "pass",
      `${evidence.waveId}/${tutorial.slug} gate ${gateId} did not pass`);
    const runtimeStatus = byId.get("runtime-routes");
    assert.ok(runtimeStatus === "pass" || runtimeStatus === "deferred",
      `${evidence.waveId}/${tutorial.slug} runtime gate is unresolved`);
    if (runtimeStatus === "deferred") assert.equal(evidence.runtimeRequested, false,
      "runtime gate cannot be deferred when runtime validation was requested");
  }
  if (evidence.failed) {
    assert.deepEqual(evidence.publishedSlugs, [], "failed wave published a partial set");
    assert.equal(evidence.activeGeneration, evidence.previousGeneration,
      "failed wave changed the active generation");
  } else {
    assert.deepEqual(evidence.publishedSlugs, evidence.slugs, "successful wave omitted a tutorial");
    assert.equal(evidence.activeGeneration, evidence.candidateGeneration,
      "successful wave did not activate its candidate generation");
  }
}

function waveContractFixture() {
  return {
    waveId: "wave-1-official-google",
    slugs: ["google-search-works", "google-search-essentials"],
    previousGeneration: "generation-pilot",
    candidateGeneration: "generation-wave-1",
    activeGeneration: "generation-wave-1",
    runtimeRequested: false,
    atomicLocalePair: true,
    resourceReportPartitioned: true,
    pilotBaselinePreserved: true,
    failed: false,
    publishedSlugs: ["google-search-works", "google-search-essentials"],
    tutorials: ["google-search-works", "google-search-essentials"].map((slug) => ({
      slug,
      gates: GATE_IDS.map((id) => ({ id, status: id === "runtime-routes" ? "deferred" : "pass" })),
    })),
  };
}

function validateWaveContractFixture() {
  const fixture = waveContractFixture();
  validateWaveEvidence(fixture);
  assert.throws(
    () => validateWaveEvidence({ ...fixture, pilotBaselinePreserved: false }),
    /Pilot baseline/,
  );
  assert.throws(
    () => validateWaveEvidence({ ...fixture, publishedSlugs: [fixture.slugs[0]] }),
    /successful wave omitted/,
  );
  assert.throws(
    () => validateWaveEvidence({
      ...fixture,
      failed: true,
      activeGeneration: fixture.candidateGeneration,
      publishedSlugs: [],
    }),
    /failed wave changed/,
  );
}

async function validateGateDocument() {
  const document = await fs.readFile(releaseGateDocPath, "utf8");
  assert.match(document, /^# SEO Fundamentals Tutorial Release Gates\n/m);
  assert.match(document, /Issue #21/);
  assert.match(document, /tutorial-internalization-acceptance\.md/);
  assert.match(document, /tutorial-internalization-lifecycle\.md/);
  assert.match(document, /npm run tutorials:check/);
  for (const gateId of GATE_IDS) assert.match(document, new RegExp(`\\\`${gateId}\\\``),
    `release-gate document is missing ${gateId}`);
  for (const waveId of WAVE_IDS) assert.match(document, new RegExp(`\\\`${waveId}\\\``),
    `release-gate document is missing ${waveId}`);
  const inventory = await fs.readFile(inventoryPath, "utf8");
  assert.match(inventory, /issues\/20\)/, "release gate is detached from the #20 inventory");
}

async function runtimeCheck(pairs) {
  const baseUrl = process.env.BASE_URL;
  assertString(baseUrl, "BASE_URL");
  const { chromium } = await import("playwright");
  const systemChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
    (await fs.access(systemChromePath).then(() => systemChromePath).catch(() => undefined));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const { zh, en } of pairs) {
      for (const [locale, record] of [["zh-CN", zh], ["en", en]]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const browserErrors = [];
        page.on("pageerror", (error) => browserErrors.push(String(error)));
        page.on("console", (message) => {
          if (message.type() === "error") browserErrors.push(message.text());
        });
        for (const width of [390, 768, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          const response = await page.goto(new URL(record.path, baseUrl).toString(), {
            waitUntil: "domcontentloaded",
          });
          assert.equal(response?.status(), 200, `${locale}/${record.slug} returned ${response?.status()}`);
          assert.equal(await page.locator("html").getAttribute("lang"), locale,
            `${locale}/${record.slug} lang differs at ${width}px`);
          assert.equal(await page.locator("h1").count(), 1, `${locale}/${record.slug} h1 differs at ${width}px`);
          assert.ok(await page.locator("main").isVisible(), `${locale}/${record.slug} body is hidden at ${width}px`);
          assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),
            url.tutorialUrl(record.slug, locale), `${locale}/${record.slug} canonical differs`);
          assert.ok(await page.locator('link[rel="alternate"][hreflang="zh-CN"]').count(),
            `${locale}/${record.slug} missing zh-CN alternate`);
          assert.ok(await page.locator('link[rel="alternate"][hreflang="en"]').count(),
            `${locale}/${record.slug} missing en alternate`);
          const robots = await page.locator('meta[name="robots"]').getAttribute("content");
          assert.ok(!robots || !/noindex/i.test(robots), `${locale}/${record.slug} is noindex`);
          const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
          assert.ok(jsonLd.some((value) => {
            try {
              const data = JSON.parse(value);
              return data["@type"] === "TechArticle" && data.inLanguage === locale &&
                data.isBasedOn === record.source.canonicalUrl && data.mainEntityOfPage?.["@id"] === url.tutorialUrl(record.slug, locale);
            } catch {
              return false;
            }
          }), `${locale}/${record.slug} JSON-LD is incomplete`);
          assert.ok(await page.locator(`a[href="${record.source.canonicalUrl}"]`).count(),
            `${locale}/${record.slug} source attribution is missing`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
            `${locale}/${record.slug} document overflows at ${width}px`);
        }
        const tableOverflow = await page.locator("table").evaluateAll((tables) => tables.every((table) => {
          let node = table.parentElement;
          while (node && node !== document.body) {
            if (["auto", "scroll"].includes(getComputedStyle(node).overflowX)) return true;
            node = node.parentElement;
          }
          return false;
        }));
        assert.equal(tableOverflow, true, `${locale}/${record.slug} tables lack overflow handling`);
        assert.deepEqual(browserErrors, [], `${locale}/${record.slug} browser errors: ${browserErrors.join("; ")}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function validateCurrentRelease({ runtime = false } = {}) {
  const { zhRaw, enRaw, zh, en } = await loadCurrentPair();
  const zhBySlug = routeBySlug(zh);
  const enBySlug = routeBySlug(en);
  assert.deepEqual([...zhBySlug.keys()], [...enBySlug.keys()], "locale route slug order differs");
  const report = await readResourceLinkReport(zhRaw, enRaw);
  validateResourceLinkReport(report, zh, en);
  validatePilotBaseline(zh, en, report);

  const publishedPairs = [];
  for (const slug of zhBySlug.keys()) {
    const zhRecord = zhBySlug.get(slug);
    const enRecord = enBySlug.get(slug);
    assert.equal(zhRecord.status, enRecord.status, `${slug} locale statuses differ`);
    if (zhRecord.status !== "published") {
      assertPreviewRecord(zhRecord, "zh-CN");
      assertPreviewRecord(enRecord, "en");
      continue;
    }
    const content = await validatePublishedRecord(zhRecord, enRecord);
    await validateRollbackReadiness(zhRecord, enRecord);
    publishedPairs.push({ zh: zhRecord, en: enRecord, ...content });
  }

  const evidence = {
    waveId: publishedPairs.length === 1 && publishedPairs[0].zh.slug === pilotSlug
      ? "wave-0-pilot"
      : "wave-1-official-google",
    slugs: publishedPairs.map(({ zh: record }) => record.slug),
    previousGeneration: zh.generation,
    candidateGeneration: zh.generation,
    activeGeneration: zh.generation,
    runtimeRequested: runtime,
    atomicLocalePair: zh.generation === en.generation,
    resourceReportPartitioned: report.converted + report.fallback === report.total,
    pilotBaselinePreserved: true,
    failed: false,
    publishedSlugs: publishedPairs.map(({ zh: record }) => record.slug),
    tutorials: publishedPairs.map(({ zh: record }) => ({
      slug: record.slug,
      gates: GATE_IDS.map((id) => ({ id, status: id === "runtime-routes" && !runtime ? "deferred" : "pass" })),
    })),
  };
  validateWaveEvidence(evidence);
  if (runtime) await runtimeCheck(publishedPairs);
  return { publishedPairs, report };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  await validateGateDocument();
  validateWaveContractFixture();
  validateLifecycleEvidence(lifecycleContractFixture());
  if (args.has("--contract")) {
    console.log("Tutorial release-gate contract passed: wave atomicity, Pilot baseline, and lifecycle evidence.");
    return;
  }
  const result = await validateCurrentRelease({ runtime: args.has("--runtime") });
  const message = args.has("--runtime")
    ? "Tutorial release gates passed"
    : "Tutorial artifact gates passed (runtime-routes deferred)";
  console.log(`${message}: ${result.publishedPairs.length} published tutorial pair(s).`);
}

export {
  GATE_IDS,
  OFFLINE_GATE_IDS,
  WAVE_IDS,
  validateCurrentRelease,
  validateGateDocument,
  validateResourceLinkReport,
  validateRollbackReadiness,
  validateWaveEvidence,
  waveContractFixture,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Tutorial release gates failed: ${error.message}`);
    process.exitCode = 1;
  });
}
