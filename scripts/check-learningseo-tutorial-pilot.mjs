import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSourceKey } from "../src/lib/tutorials/source-key.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tutorialRoot = path.join(repositoryRoot, "src/content/tutorials");
const publicRoot = path.join(repositoryRoot, "public");
const mediaPrefix = "/sites/learningseo-io-071dae18/tutorials/";
const sourceCanonical = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide";
const pilotSlug = "google-seo-starter-guide";
const pilotMetrics = {
  h1: 1,
  h2: 11,
  h3: 13,
  p: 63,
  ul: 6,
  li: 17,
  a: 54,
  img: 4,
  table: 2,
  code: 16,
};
const checklistKeys = [
  "contentComplete",
  "dataPreserved",
  "factsPreserved",
  "logicPreserved",
  "terminologyCorrect",
  "chineseNatural",
  "authorVoicePreserved",
  "linksPreserved",
  "mediaVerified",
  "attributionPresent",
  "seoVerified",
];
const allowedTags = new Set([
  "a",
  "article",
  "blockquote",
  "br",
  "code",
  "cite",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "ul",
  "iframe",
]);
const iframeHosts = new Set([
  "embeds.beehiiv.com",
  "player.vimeo.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

function assertHex(value, label) {
  assert.match(value, /^[a-f0-9]{64}$/i, `${label} must be a SHA-256 hex digest`);
}

function tags(html) {
  return [...html.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)].map((match) => match[1].toLowerCase());
}

function openingTags(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b`, "gi"))];
}

function attributes(tagSource) {
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

function attributeValues(html, attribute) {
  return [...html.matchAll(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "gi"))].map(
    (match) => match[2],
  );
}

function visibleText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function headingIds(html) {
  return [...html.matchAll(/<h[1-6]\b[^>]*\bid\s*=\s*(["'])(.*?)\1[^>]*>/gi)].map(
    (match) => match[2],
  );
}

function metrics(html) {
  return Object.fromEntries(
    Object.keys(pilotMetrics).map((tag) => [tag, openingTags(html, tag).length]),
  );
}

function assertMetrics(html, expected, label) {
  const actual = metrics(html);
  for (const [tag, count] of Object.entries(expected)) {
    assert.equal(actual[tag], count, `${label} ${tag} count changed`);
  }
  return actual;
}

function validateMarkup(html, label) {
  assertString(html, `${label} HTML`);
  for (const tag of tags(html)) {
    assert.ok(allowedTags.has(tag), `${label} contains unsupported <${tag}>`);
  }
  assert.doesNotMatch(html, /<(?:script|style|object|embed|base|meta|link|form)\b/i,
    `${label} contains a dangerous tag`);
  assert.doesNotMatch(html, /\bon[a-z-]+\s*=|\bsrcdoc\s*=|\bstyle\s*=/i,
    `${label} contains an executable or inline-style attribute`);
  assert.doesNotMatch(html, /(?:javascript|vbscript|data:text\/html):/i,
    `${label} contains a dangerous URL protocol`);
  for (const source of attributeValues(html, "src")) {
    assert.doesNotMatch(source, /[\x00-\x20\x7f]/, `${label} has control whitespace in src`);
  }
  for (const source of attributeValues(html, "href")) {
    assert.doesNotMatch(source, /[\x00-\x1f\x7f]/, `${label} has control whitespace in href`);
    if (/^(?:https?:|mailto:|tel:|#|\/)/i.test(source)) continue;
    assert.fail(`${label} has an unresolved relative URL: ${source}`);
  }
  for (const source of tagSources(html, "img").map((tag) => attributes(tag).get("src"))) {
    assertString(source, `${label} image src`);
    assert.ok(source.startsWith(mediaPrefix), `${label} contains a non-local image: ${source}`);
  }
  for (const source of tagSources(html, "img").map((tag) => attributes(tag).get("src"))) {
    assertString(source, `${label} image src`);
    if (source.includes("..") || decodeURIComponent(source).includes(".."))
      assert.fail(`${label} image path escapes media root: ${source}`);
  }
  for (const source of tagSources(html, "iframe").map((tag) => attributes(tag).get("src"))) {
    assertString(source, `${label} iframe src`);
    const parsed = new URL(source);
    assert.equal(parsed.protocol, "https:", `${label} iframe URL must use HTTPS`);
    assert.ok(iframeHosts.has(parsed.hostname), `${label} iframe host is outside the allowlist`);
  }
  for (const attribute of ["data-src", "data-cookieblock-src", "srcset"])
    for (const source of attributeValues(html, attribute))
      assert.fail(`${label} retains deferred media ${attribute}: ${source}`);
}

function validateAccessibility(html, label) {
  assert.equal(openingTags(html, "h1").length, 1, `${label} must contain one h1`);
  let previousLevel = 0;
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>/gi)) {
    const level = Number(match[1]);
    assert.ok(level <= previousLevel + 1, `${label} heading hierarchy jumps from h${previousLevel}`);
    previousLevel = level;
  }
  for (const source of tagSources(html, "img")) {
    const alt = attributes(source).get("alt");
    assertString(alt, `${label} image alt`);
  }
  for (const source of tagSources(html, "a")) {
    const attrs = attributes(source);
    assert.ok(attrs.get("href"), `${label} anchor is missing href`);
  }
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = attributes(match[1]);
    const imageAlt = [...match[2].matchAll(/<img\b[^>]*\balt\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
      .map((image) => image[2])
      .join(" ");
    const name = attrs.get("aria-label") || attrs.get("title") ||
      `${visibleText(match[2])} ${imageAlt}`.trim();
    assertString(name, `${label} anchor accessible name`);
  }
  for (const source of tagSources(html, "iframe")) {
    assertString(attributes(source).get("title"), `${label} iframe title`);
  }
  for (const source of tagSources(html, "table")) {
    const end = html.indexOf("</table>", html.indexOf(source));
    const table = end < 0 ? source : html.slice(html.indexOf(source), end + 8);
    assert.match(table, /<tr\b/i, `${label} table has no rows`);
    assert.match(table, /<(?:td|th)\b/i, `${label} table has no cells`);
  }
}

async function validateMedia(html, record, label) {
  const sources = tagSources(html, "img").map((tag) => attributes(tag).get("src"));
  assert.equal(sources.length, 4, `${label} must contain four pilot media sources`);
  assert.equal(new Set(sources).size, 4, `${label} media sources must be distinct`);
  assert.ok(Array.isArray(record.media), `${label} media manifest must be an array`);
  for (const source of sources) {
    assert.ok(source.startsWith(mediaPrefix), `${label} media must be repository-local`);
    const target = path.resolve(publicRoot, source.slice(1));
    assert.ok(target.startsWith(publicRoot + path.sep), `${label} media path escapes public`);
    const entry = record.media.find((item) => item.path === source || item.src === source);
    assert.ok(entry, `${label} media manifest is missing ${source}`);
    const mediaHash = entry.sha256 || entry.hash || entry.contentHash;
    assertHex(mediaHash, `${label} media hash`);
    const mediaFile = await fs.stat(target);
    assert.ok(mediaFile.isFile(), `${label} media path is not a file: ${source}`);
    assert.equal(sha256(await fs.readFile(target)), mediaHash,
      `${label} media hash does not match ${source}`);
  }
}

function validateReview(record, label) {
  const translation = record.translation || {};
  const review = record.review || {};
  const qualification = record.qualification || record.eligibility || {};
  assert.equal(record.status, "published", `${label} status must be published`);
  assert.equal(review.decision, "approved", `${label} review must be approved`);
  assertString(review.reviewer, `${label} reviewer`);
  assertString(review.notes, `${label} review notes`);
  assert.ok(Number.isFinite(Date.parse(review.reviewedAt)), `${label} reviewedAt must be a date`);
  assert.equal(translation.sourceLanguage, "en", `${label} source language must be en`);
  assert.equal(translation.language, "zh-CN", `${label} translation language must be zh-CN`);
  const sourceSections = translation.sourceSections ?? translation.sourceSectionCount;
  const translatedSections = translation.translatedSections ?? translation.translatedSectionCount;
  assert.equal(sourceSections, translatedSections,
    `${label} translation section count differs`);
  for (const key of checklistKeys) assert.equal(review.checklist?.[key], true,
    `${label} review checklist ${key} must be true`);
  if (qualification.checklist) {
    for (const value of Object.values(qualification.checklist)) assert.equal(value, true,
      `${label} qualification checklist must be true`);
  }
}

function validateProvenance(record, html, label) {
  const source = record.source || {};
  const snapshot = record.snapshot || {};
  const license = typeof source.license === "string" ? source.license : source.license?.text;
  assert.equal(normalizeSourceKey(source.canonicalUrl), normalizeSourceKey(sourceCanonical),
    `${label} source canonical changed`);
  assertString(source.title, `${label} source title`);
  assertString(source.provider, `${label} source provider`);
  assert.equal(source.sourcePath, "/seo_roadmap/seo-fundamentals/", `${label} source path changed`);
  assertString(license, `${label} source license`);
  assert.equal(snapshot.canonicalMatched, true, `${label} canonical match is unverified`);
  const requestedUrl = snapshot.requestedUrl || source.requestedUrl || source.canonicalUrl;
  const finalUrl = snapshot.finalUrl || source.finalUrl || snapshot.pageCanonicalUrl;
  assert.equal(normalizeSourceKey(requestedUrl), normalizeSourceKey(sourceCanonical),
    `${label} requested URL changed`);
  assert.equal(normalizeSourceKey(finalUrl), normalizeSourceKey(sourceCanonical),
    `${label} final URL changed`);
  assertString(snapshot.pageCanonicalUrl, `${label} page canonical URL`);
  assertString(snapshot.capturedAt, `${label} capturedAt`);
  assert.ok(Number.isFinite(Date.parse(snapshot.capturedAt)), `${label} capturedAt must be a date`);
  assertString(snapshot.sourceUpdatedAt, `${label} sourceUpdatedAt`);
  assert.equal(snapshot.contentType || snapshot.responseContentType, "text/html",
    `${label} source content type must be text/html`);
  assertHex(snapshot.sourceContentHash, `${label} sourceContentHash`);
  assert.ok(attributeValues(html, "href").some((href) => {
    try {
      return normalizeSourceKey(href) === normalizeSourceKey(sourceCanonical);
    } catch {
      return false;
    }
  }),
  `${label} visible attribution must link to the source canonical`);
}

async function validateRecord(record, locale, html, contentPath) {
  const label = `${locale} pilot`;
  assert.equal(record.slug, pilotSlug, `${label} slug changed`);
  assert.equal(record.path, locale === "en" ? `/en/tutorials/${pilotSlug}/` : `/tutorials/${pilotSlug}/`,
    `${label} route changed`);
  assertString(record.title, `${label} title`);
  assertString(record.description, `${label} description`);
  assertString(record.provider, `${label} provider`);
  assertString(record.contentFile, `${label} contentFile`);
  const snapshot = record.snapshot || {};
  const translation = record.translation || {};
  const contentHash = locale === "en" ? snapshot.contentHash : snapshot.translationContentHash;
  assert.ok(Number.isInteger(snapshot.version) && snapshot.version > 0, `${label} snapshot version is invalid`);
  assertHex(contentHash, `${label} contentHash`);
  if (locale === "zh-CN") {
    assertHex(translation.contentHash, `${label} translation contentHash`);
    assert.equal(translation.contentHash, snapshot.translationContentHash,
      `${label} translation contentHash must match snapshot.translationContentHash`);
    assert.equal(translation.contentFile, record.contentFile,
      `${label} translation contentFile must match contentFile`);
  }
  assert.equal(path.basename(contentPath, ".html"), contentHash,
    `${label} contentFile must be named after contentHash`);
  assert.equal(contentHash, sha256(awaitFileBytes.get(contentPath)),
    `${label} contentHash does not match contentFile`);
  assert.ok(Array.isArray(snapshot.history), `${label} snapshot history must be an array`);
  assertMetrics(html, pilotMetrics, label);
  assert.deepEqual(record.contentMetrics, metrics(html), `${label} contentMetrics drifted from HTML`);
  validateMarkup(html, label);
  validateAccessibility(html, label);
  await validateMedia(html, record, label);
  validateReview(record, label);
  validateProvenance(record, html, label);
  const seo = record.seo || {};
  assertString(seo.title, `${label} SEO title`);
  assertString(seo.description, `${label} SEO description`);
  assert.equal(seo.indexable, true, `${label} must be indexable after publication`);
}

const awaitFileBytes = new Map();

async function readManifest(filePath, locale) {
  const data = JSON.parse(await fs.readFile(filePath, "utf8"));
  assert.equal(data.locale, locale, `${filePath} locale mismatch`);
  const records = data.routes || data.records || data.tutorials;
  assert.ok(Array.isArray(records), `${filePath} must contain route records`);
  const matches = records.filter((record) => record.slug === pilotSlug);
  assert.equal(matches.length, 1, `${filePath} must contain one pilot record`);
  return { data, record: matches[0] };
}

async function contentPath(record) {
  const rawPath = record.contentFile;
  assertString(rawPath, "contentFile");
  const candidates = [
    path.resolve(repositoryRoot, rawPath),
    path.resolve(tutorialRoot, rawPath),
  ];
  const target = candidates.find((candidate) => candidate.startsWith(tutorialRoot + path.sep));
  assert.ok(target, `contentFile escapes tutorial root: ${rawPath}`);
  await fs.access(target);
  awaitFileBytes.set(target, await fs.readFile(target));
  return target;
}

async function readLinkReport(zhManifest) {
  const embedded = zhManifest.data.resourceLinkReport || zhManifest.data.linkReport || zhManifest.data.sourceLinkMap;
  if (embedded) return embedded;
  for (const relative of [
    "src/content/tutorials/source-link-map.json",
    "src/content/tutorials/link-map.json",
    "src/content/tutorials/resource-link-report.json",
  ]) {
    try {
      return JSON.parse(await fs.readFile(path.join(repositoryRoot, relative), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Published tutorial is missing a resource-link report");
}

function validateLinkReport(report) {
  const { total, unique, converted, fallback, rendered, occurrences } = report;
  assert.equal(total, 2152, "resource occurrence total changed");
  assert.equal(unique, 914, "normalized source-key total changed");
  assert.equal(rendered, 4304, "bilingual rendered-anchor total changed");
  assert.equal(converted + fallback, total, "resource conversion report is not partitioned");
  assert.ok(Array.isArray(occurrences), "resource-link report must expose occurrences");
  assert.equal(occurrences.length, total, "resource occurrence evidence total changed");
  assert.equal(new Set(occurrences.map((entry) => normalizeSourceKey(entry.sourceKey))).size, unique,
    "resource occurrence evidence unique count changed");
  assert.equal(occurrences.filter((entry) => entry.converted).length, converted,
    "resource occurrence evidence converted count changed");
  assert.equal(occurrences.filter((entry) => !entry.converted && entry.fragment !== null).length,
    report.unknownFragments, "resource occurrence unknown-fragment evidence changed");
  const slugBySourceKey = new Map();
  for (const [index, entry] of occurrences.entries()) {
    assertString(entry.sourceKey, `resource occurrence ${index} sourceKey`);
    assert.ok(entry.fragment === null || typeof entry.fragment === "string",
      `resource occurrence ${index} fragment must be string or null`);
    assert.equal(typeof entry.converted, "boolean", `resource occurrence ${index} converted must be boolean`);
    if (entry.converted) {
      assertString(entry.slug, `resource occurrence ${index} slug`);
      const sourceKey = normalizeSourceKey(entry.sourceKey);
      const slug = slugBySourceKey.get(sourceKey);
      assert.ok(!slug || slug === entry.slug, `resource occurrence ${index} sourceKey changed slug`);
      slugBySourceKey.set(sourceKey, entry.slug);
    }
  }
  const pilotEntries = occurrences.filter((entry) =>
    normalizeSourceKey(entry.sourceKey) === normalizeSourceKey(sourceCanonical),
  );
  assert.ok(pilotEntries.length > 1, "pilot duplicate occurrences are missing from the report");
  assert.equal(new Set(pilotEntries.filter((entry) => entry.converted !== false).map((entry) => entry.slug)).size, 1,
    "duplicate pilot occurrences must share one slug");
}

function validateGeneration(zhManifest, enManifest) {
  const zhGeneration = zhManifest.data.generation ?? zhManifest.data.commitGeneration;
  const enGeneration = enManifest.data.generation ?? enManifest.data.commitGeneration;
  assertString(String(zhGeneration || ""), "Chinese manifest generation");
  assert.equal(zhGeneration, enGeneration, "locale manifests have different commit generations");
}

function validatePair(zhRecord, enRecord, zhHtml, enHtml) {
  const label = "bilingual pilot";
  assert.equal(zhRecord.slug, enRecord.slug, `${label} slug differs`);
  assert.equal(normalizeSourceKey(zhRecord.source.canonicalUrl), normalizeSourceKey(enRecord.source.canonicalUrl),
    `${label} source differs`);
  assert.equal(zhRecord.snapshot.version, enRecord.snapshot.version, `${label} snapshot version differs`);
  for (const tag of Object.keys(pilotMetrics)) {
    assert.equal(openingTags(zhHtml, tag).length, openingTags(enHtml, tag).length,
      `${label} ${tag} structure differs`);
  }
  assert.deepEqual(headingIds(zhHtml), headingIds(enHtml), `${label} heading IDs differ`);
  assert.deepEqual(attributeValues(zhHtml, "src"), attributeValues(enHtml, "src"),
    `${label} media identity/order differs`);
  assert.deepEqual(attributeValues(zhHtml, "href"), attributeValues(enHtml, "href"),
    `${label} link identity/order differs`);
  assert.match(zhHtml, /[\u3400-\u9fff]/, "Chinese pilot has no Simplified Chinese text");
  const sourceTags = tags(enHtml).filter((tag) => tag !== "html" && tag !== "body");
  const localizedTags = tags(zhHtml).filter((tag) => tag !== "html" && tag !== "body");
  assert.deepEqual(localizedTags, sourceTags, `${label} semantic tag order differs`);
}

function validateLifecycleEvidence(evidence) {
  const duplicate = evidence.duplicateLinks;
  assert.ok(duplicate, "duplicate-link evidence is missing");
  assert.equal(duplicate.converted + duplicate.fallback, duplicate.total,
    "duplicate-link evidence is not partitioned");
  assert.equal(new Set(duplicate.occurrences.map((item) => item.sourceKey)).size, 1,
    "duplicate links must normalize to one source key");
  assert.equal(new Set(duplicate.occurrences.filter((item) => item.converted).map((item) => item.slug)).size, 1,
    "duplicate links must resolve to one slug");
  assert.equal(duplicate.unknownFragments, 1, "unknown fragment warning evidence is missing");

  const refresh = evidence.refreshDrift;
  assert.ok(refresh, "refresh evidence is missing");
  assert.ok(refresh.candidate.version > refresh.published.version, "refresh must increment version");
  assert.ok(["draft", "stale"].includes(refresh.candidate.status), "refresh candidate must remain preview");
  assert.equal(refresh.activeVersion, refresh.published.version, "refresh changed active version early");
  assert.ok(refresh.history.some((item) => item.version === refresh.published.version),
    "refresh did not preserve the published version in history");
  assert.equal(refresh.unchanged.idempotent, true, "unchanged refresh must be idempotent");
  assert.equal(refresh.canonicalDrift.failureCode, "canonical-mismatch",
    "canonical drift must use canonical-mismatch");

  const recovery = evidence.partialCommit;
  assert.ok(recovery, "partial-commit evidence is missing");
  assert.notEqual(recovery.candidate.generation, recovery.active.generation,
    "interrupted commit must expose a generation mismatch");
  assert.ok(["completed", "restored", "recovery-conflict"].includes(recovery.result),
    "recovery result must be explicit");
  assert.equal(recovery.idempotent, true, "recovery must be idempotent");
  assert.equal(recovery.liveLocalePairIntact, true, "recovery exposed a mixed locale pair");

  const rollback = evidence.rollback;
  assert.ok(rollback, "rollback evidence is missing");
  assert.equal(rollback.candidate.version, rollback.activeVersion + 1,
    "rollback candidate must increment version");
  assert.equal(rollback.candidate.rollbackOf, rollback.targetVersion, "rollback target is missing");
  assert.equal(rollback.candidate.status, "draft", "rollback candidate must require review");
  assert.equal(rollback.candidate.reviewDecision, "pending", "rollback review must start pending");
  assert.equal(rollback.beforeApproval.activeVersion, rollback.activeVersion,
    "rollback changed the active pointer before approval");
  assert.equal(rollback.failedAttempt.liveStateChanged, false,
    "failed rollback changed live state");
}

function lifecycleContractFixture() {
  const key = normalizeSourceKey(sourceCanonical);
  return {
    duplicateLinks: {
      total: 3,
      converted: 2,
      fallback: 1,
      unknownFragments: 1,
      occurrences: [
        { sourceKey: key, slug: pilotSlug, fragment: "#overview", converted: true },
        { sourceKey: key, slug: pilotSlug, fragment: "#overview", converted: true },
        { sourceKey: key, slug: null, fragment: "#missing", converted: false },
      ],
    },
    refreshDrift: {
      published: { version: 1, status: "published" },
      candidate: { version: 2, status: "draft" },
      activeVersion: 1,
      history: [{ version: 1 }],
      unchanged: { idempotent: true },
      canonicalDrift: { failureCode: "canonical-mismatch" },
    },
    partialCommit: {
      active: { generation: "generation-1" },
      candidate: { generation: "generation-2" },
      result: "restored",
      idempotent: true,
      liveLocalePairIntact: true,
    },
    rollback: {
      activeVersion: 2,
      targetVersion: 1,
      candidate: { version: 3, rollbackOf: 1, status: "draft", reviewDecision: "pending" },
      beforeApproval: { activeVersion: 2 },
      failedAttempt: { liveStateChanged: false },
    },
  };
}

async function runtimeCheck() {
  const baseUrl = process.env.BASE_URL;
  assertString(baseUrl, "BASE_URL");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [locale, route] of [
      ["zh-CN", `/tutorials/${pilotSlug}/`],
      ["en", `/en/tutorials/${pilotSlug}/`],
    ]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "domcontentloaded" });
      assert.equal(await page.locator("html").getAttribute("lang"), locale, `${locale} lang mismatch`);
      assert.equal(await page.locator("h1").count(), 1, `${locale} runtime h1 mismatch`);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),
        `https://learningseo.io${route}`, `${locale} canonical mismatch`);
      assert.ok(await page.locator('link[rel="alternate"][hreflang="zh-CN"]').count(),
        `${locale} missing zh-CN alternate`);
      assert.ok(await page.locator('link[rel="alternate"][hreflang="en"]').count(),
        `${locale} missing en alternate`);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      assert.ok(!robots || !/noindex/i.test(robots), `${locale} published route is noindex`);
      const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
      assert.ok(jsonLd.some((value) => {
        try {
          const data = JSON.parse(value);
          const basedOn = typeof data.isBasedOn === "string" ? data.isBasedOn : data.isBasedOn?.url;
          return (data["@type"] === "TechArticle" || data["@type"]?.includes?.("TechArticle")) &&
            data.inLanguage === locale && basedOn === sourceCanonical &&
            ["headline", "description", "dateModified", "author", "publisher",
              "mainEntityOfPage"].every((key) => data[key]);
        } catch {
          return false;
        }
      }), `${locale} TechArticle JSON-LD is incomplete`);
      assert.ok(await page.locator(`a[href="${sourceCanonical}"]`).count(),
        `${locale} source attribution link is missing`);
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.locator("body").isVisible(), `${locale} body is hidden at ${width}px`);
        const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(horizontalOverflow, false, `${locale} document overflows at ${width}px`);
      }
      const tablesHaveOverflow = await page.locator("table").evaluateAll((tables) =>
        tables.every((table) => {
          let node = table.parentElement;
          while (node && node !== document.body) {
            if (["auto", "scroll"].includes(getComputedStyle(node).overflowX)) return true;
            node = node.parentElement;
          }
          return false;
        }),
      );
      assert.equal(tablesHaveOverflow, true, `${locale} tables lack narrow-screen overflow`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--contract")) {
    validateLifecycleEvidence(lifecycleContractFixture());
    console.log("Tutorial lifecycle acceptance contract passed.");
    return;
  }

  const zhManifest = await readManifest(path.join(tutorialRoot, "manifest.json"), "zh-CN");
  const enManifest = await readManifest(path.join(tutorialRoot, "manifest.en.json"), "en");
  validateGeneration(zhManifest, enManifest);
  const zhPath = await contentPath(zhManifest.record);
  const enPath = await contentPath(enManifest.record);
  const zhHtml = await fs.readFile(zhPath, "utf8");
  const enHtml = await fs.readFile(enPath, "utf8");
  await validateRecord(zhManifest.record, "zh-CN", zhHtml, zhPath);
  await validateRecord(enManifest.record, "en", enHtml, enPath);
  validatePair(zhManifest.record, enManifest.record, zhHtml, enHtml);
  validateLinkReport(await readLinkReport(zhManifest));
  validateLifecycleEvidence(lifecycleContractFixture());
  if (args.has("--runtime")) await runtimeCheck();
  console.log("Tutorial Pilot acceptance contract passed.");
}

export {
  checklistKeys,
  lifecycleContractFixture,
  metrics,
  normalizeSourceKey,
  pilotMetrics,
  pilotSlug,
  sourceCanonical,
  validateLifecycleEvidence,
  validateMarkup,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Tutorial Pilot acceptance contract failed: ${error.message}`);
    process.exitCode = 1;
  });
}
