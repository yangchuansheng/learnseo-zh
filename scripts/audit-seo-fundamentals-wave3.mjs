import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalFromHtml,
  extractElementByClass,
  fetchSourceHtml,
  sha256,
  writeJsonFile,
} from "./lib/tutorial-importer.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = path.join(repositoryRoot, ".omo/evidence/wave3-external-dispositions.json");
const generatedRoot = path.join(repositoryRoot, "src/components/sites/learningseo-io-071dae18/subpages/generated");
const prohibitedEvidenceKeys = new Set(["html", "bodyHtml", "fullBody", "fullText", "mediaBytes"]);

const sources = Object.freeze([
  Object.freeze({
    sourceId: "moz-beginners-guide",
    provider: "Moz",
    requestedUrl: "https://moz.com/beginners-guide-to-seo",
    canonicalUrl: "https://moz.com/beginners-guide-to-seo",
    redirectStatus: 200,
    disposition: "manual-series",
    importMode: "manual-series-child-only",
    termsUrl: "https://moz.com/terms-of-use",
    termsAssertions: ["Moz Trademarks", "prior written consent"],
    cardTitles: { en: "The Beginner’s Guide to SEO", zh: "SEO 初学者指南" },
  }),
  Object.freeze({
    sourceId: "contentking-conductor-hub",
    provider: "ContentKing/Conductor",
    requestedUrl: "https://www.contentkingapp.com/academy/seo-guide/",
    canonicalUrl: "https://www.conductor.com/academy/technical-seo-hub/",
    redirectStatus: 301,
    disposition: "external-collection",
    importMode: "external-only",
    termsUrl: "https://www.conductor.com/legal/terms-of-use/",
    termsAssertions: ["personal, non-commercial use only", "must not reproduce"],
    cardTitles: { en: "Technical SEO articles", zh: "技术 SEO 文章" },
  }),
  Object.freeze({
    sourceId: "semrush-seo-essentials-course",
    provider: "Semrush",
    requestedUrl: "https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/",
    canonicalUrl: "https://www.semrush.com/academy/courses/seo-essentials-with-semrush/",
    redirectStatus: 308,
    disposition: "external-course",
    importMode: "external-only",
    termsUrl: "https://www.semrush.com/company/legal/website-terms-of-use/",
    termsAssertions: ["may not be copied", "approved in writing"],
    cardTitles: { en: "SEO Essentials with Semrush", zh: "Semrush SEO 要点课程" },
  }),
]);

function decodeText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#0*39;|&#x27;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countTags(html) {
  return Object.fromEntries(
    ["h1", "h2", "h3", "p", "ul", "ol", "li", "a", "img", "iframe", "video", "audio", "form", "input", "button", "table", "pre", "code"]
      .map((tag) => [tag, (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length])
      .filter(([, count]) => count > 0),
  );
}

function titleFromHtml(html) {
  return decodeText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function headingFromHtml(html, level = 1) {
  return decodeText(html.match(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "i"))?.[1] ?? "");
}

function jsonLdDate(html, key) {
  const value = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\n]+)"`, "i"))?.[1];
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function requiredClass(html, fragment) {
  return new RegExp(`class=["'][^"']*${fragment}`, "i").test(html);
}

async function requestedResponse(definition) {
  const response = await fetch(definition.requestedUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  const location = response.headers.get("location");
  await response.body?.cancel();
  const finalUrl = location ? new URL(location, definition.requestedUrl).toString() : definition.requestedUrl;
  assert.equal(response.status, definition.redirectStatus, `${definition.sourceId} redirect status changed`);
  assert.equal(finalUrl, definition.canonicalUrl, `${definition.sourceId} redirect target changed`);
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    redirects: location ? [{ from: definition.requestedUrl, to: finalUrl, status: response.status }] : [],
  };
}

async function termsEvidence(definition) {
  const terms = await fetchSourceHtml(definition.termsUrl);
  const text = decodeText(terms.html).toLowerCase();
  assert.equal(terms.status, 200, `${definition.sourceId} terms status changed`);
  assert.ok(terms.contentType.startsWith("text/html"), `${definition.sourceId} terms stopped serving HTML`);
  assert.equal(terms.finalUrl, definition.termsUrl, `${definition.sourceId} terms canonical target changed`);
  for (const phrase of definition.termsAssertions) {
    assert.ok(text.includes(phrase.toLowerCase()), `${definition.sourceId} terms no longer contain: ${phrase}`);
  }
  return {
    requestedUrl: definition.termsUrl,
    finalUrl: terms.finalUrl,
    status: terms.status,
    contentType: terms.contentType,
    lastModified: terms.lastModified,
    contentHash: sha256(terms.html),
    contentLengthBytes: Buffer.byteLength(terms.html),
    assertions: Object.fromEntries(definition.termsAssertions.map((phrase) => [phrase, true])),
  };
}

function mozTopology(html) {
  const body = extractElementByClass(html, "article-body");
  assert.ok(body, "Moz .article-body boundary is missing");
  assert.ok(requiredClass(html, "guides-chapter"), "Moz series shell is missing");
  const chapters = [...html.matchAll(/href=["'](?:https:\/\/moz\.com)?(\/beginners-guide-to-seo(?:\/[a-z0-9-]+)?)\/?["']/gi)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index);
  assert.equal(chapters.length, 10, "Moz series TOC changed; qualify children independently");
  return {
    kind: "series-index",
    selector: ".article-body within .guides-chapter",
    childPaths: chapters,
    bodyMetrics: countTags(body),
    excluded: ["site navigation", "series table of contents", "academy CTA", "lead form"],
    importBoundary: "one independently qualified child chapter",
  };
}

function conductorTopology(html) {
  assert.equal(headingFromHtml(html), "Technical SEO articles", "Conductor hub title changed");
  assert.ok(requiredClass(html, "FilterButtonsGroup"), "Conductor hub filters are missing");
  assert.ok(requiredClass(html, "ArticleCardBuilder"), "Conductor article-card grid is missing");
  return {
    kind: "collection-grid",
    selector: "filter controls plus ArticleCardBuilder cards",
    bodyMetrics: countTags(html),
    excluded: ["filter state", "article-card thumbnails", "tracking iframe", "lead form"],
    importBoundary: "one future article with its own canonical, body, and rights review",
  };
}

function semrushTopology(html) {
  assert.equal(headingFromHtml(html), "SEO Essentials with Semrush", "Semrush course title changed");
  assert.ok(requiredClass(html, "course-structure"), "Semrush course structure is missing");
  const courseItems = (html.match(/class=["'][^"']*course-structure-item__CourseStructureItemStyled/gi) ?? []).length;
  assert.equal(courseItems, 20, "Semrush course lesson structure changed");
  return {
    kind: "course-application",
    selector: ".course-default with .course-structure-item",
    bodyMetrics: countTags(html),
    courseItems,
    excluded: ["enrollment", "certificate", "account walkthroughs", "lesson playback"],
    importBoundary: "one future public lesson with its own canonical, body, and rights review",
  };
}

function topologyFor(definition, html) {
  if (definition.sourceId === "moz-beginners-guide") return mozTopology(html);
  if (definition.sourceId === "contentking-conductor-hub") return conductorTopology(html);
  return semrushTopology(html);
}

function updateEvidence(definition, html, source) {
  if (definition.sourceId === "moz-beginners-guide") {
    return {
      jsonLdDateModified: jsonLdDate(html, "dateModified"),
      httpLastModified: source.lastModified,
    };
  }
  return { jsonLdDateModified: null, httpLastModified: source.lastModified };
}

async function collectSource(definition) {
  const [requested, source, terms] = await Promise.all([
    requestedResponse(definition),
    fetchSourceHtml(definition.canonicalUrl),
    termsEvidence(definition),
  ]);
  const canonicalUrl = canonicalFromHtml(source.html, source.finalUrl);
  assert.equal(source.status, 200, `${definition.sourceId} source status changed`);
  assert.ok(source.contentType.startsWith("text/html"), `${definition.sourceId} stopped serving HTML`);
  assert.equal(source.finalUrl, definition.canonicalUrl, `${definition.sourceId} final URL changed`);
  assert.equal(canonicalUrl, definition.canonicalUrl, `${definition.sourceId} canonical URL changed`);
  return {
    sourceId: definition.sourceId,
    provider: definition.provider,
    requestedUrl: definition.requestedUrl,
    finalUrl: source.finalUrl,
    canonicalUrl,
    redirectChain: requested.redirects,
    requestedStatus: requested.status,
    requestedContentType: requested.contentType,
    httpStatus: source.status,
    contentType: source.contentType,
    httpLastModified: source.lastModified,
    httpEtag: source.etag,
    title: titleFromHtml(source.html),
    heading: headingFromHtml(source.html),
    sourceUpdatedAt: updateEvidence(definition, source.html, source),
    sourceContentHash: sha256(source.html),
    sourceContentLengthBytes: Buffer.byteLength(source.html),
    topology: topologyFor(definition, source.html),
    terms,
    disposition: definition.disposition,
    importMode: definition.importMode,
    routeSlug: null,
    persisted: { sourceBody: false, media: false, tutorialRoute: false },
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cardFor(html, canonicalUrl) {
  const match = html.match(new RegExp(
    `<div class="resource">\\s*<a href="${escapeRegExp(canonicalUrl)}"[^>]*title="([^"]*)"[^>]*><\\/a>\\s*<h2>([\\s\\S]*?)<\\/h2>`,
    "i",
  ));
  assert.ok(match, `Missing active external card for ${canonicalUrl}`);
  return { titleAttribute: decodeText(match[1]), heading: decodeText(match[2]) };
}

async function assertCards() {
  const cards = {};
  for (const [locale, manifestName, contentDirectory] of [
    ["en", "manifest.json", "content"],
    ["zh", "manifest.zh-CN.json", "content-zh-CN"],
  ]) {
    const manifest = JSON.parse(await fs.readFile(path.join(generatedRoot, manifestName), "utf8"));
    const route = manifest.routes.find(({ sourcePath, finalPath, contentFile }) =>
      sourcePath === "/seo_roadmap/seo-fundamentals/" && finalPath === "/seo_roadmap/seo-fundamentals/" && contentFile,
    );
    assert.ok(route, `${manifestName} lacks the SEO Fundamentals route`);
    const html = await fs.readFile(path.join(generatedRoot, contentDirectory, route.contentFile), "utf8");
    cards[locale] = Object.fromEntries(sources.map((definition) => {
      const card = cardFor(html, definition.canonicalUrl);
      assert.equal(card.titleAttribute, definition.cardTitles[locale], `${locale} card title attribute is stale for ${definition.sourceId}`);
      assert.equal(card.heading, definition.cardTitles[locale], `${locale} card heading is stale for ${definition.sourceId}`);
      return [definition.sourceId, card];
    }));
  }
  return cards;
}

async function assertExistingTutorialMappings() {
  for (const file of ["manifest.json", "manifest.en.json"]) {
    const manifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, "src/content/tutorials", file), "utf8"));
    const sourcesBySlug = new Map(manifest.routes.map((route) => [route.slug, route.sourceKey]));
    for (const [slug, sourceKey] of [
      ["google-seo-starter-guide", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"],
      ["google-search-works", "https://developers.google.com/search/docs/fundamentals/how-search-works"],
      ["google-search-essentials", "https://developers.google.com/search/docs/essentials"],
    ]) assert.equal(sourcesBySlug.get(slug), sourceKey, `${file} lost ${slug}`);
    for (const definition of sources) {
      assert.ok(!manifest.routes.some((route) => route.sourceKey === definition.canonicalUrl), `${file} created a Wave 3 tutorial route for ${definition.sourceId}`);
    }
  }
}

function assertNoProhibitedKeys(value, label = "evidence") {
  if (Array.isArray(value)) return value.forEach((entry, index) => assertNoProhibitedKeys(entry, `${label}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!prohibitedEvidenceKeys.has(key), `${label} persisted restricted field ${key}`);
    assertNoProhibitedKeys(child, `${label}.${key}`);
  }
}

export async function collectWave3Audit() {
  const [records, cards] = await Promise.all([
    Promise.all(sources.map(collectSource)),
    assertCards(),
  ]);
  await assertExistingTutorialMappings();
  return {
    schemaVersion: 1,
    kind: "seo-fundamentals-wave-3-external-dispositions",
    waveId: "wave-3-manual-or-external",
    capturedAt: new Date().toISOString(),
    policy: {
      htmlPersisted: false,
      mediaDownloaded: false,
      tutorialRoutesCreated: false,
      livePreflightRequired: true,
    },
    cards,
    sources: records,
  };
}

export function validateWave3Audit(evidence) {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.kind, "seo-fundamentals-wave-3-external-dispositions");
  assert.equal(evidence.waveId, "wave-3-manual-or-external");
  assert.equal(evidence.policy.htmlPersisted, false);
  assert.equal(evidence.policy.mediaDownloaded, false);
  assert.equal(evidence.policy.tutorialRoutesCreated, false);
  assertNoProhibitedKeys(evidence);
  assert.deepEqual(evidence.sources.map(({ sourceId }) => sourceId), sources.map(({ sourceId }) => sourceId));
  for (const definition of sources) {
    const source = evidence.sources.find(({ sourceId }) => sourceId === definition.sourceId);
    assert.equal(source.requestedUrl, definition.requestedUrl);
    assert.equal(source.finalUrl, definition.canonicalUrl);
    assert.equal(source.canonicalUrl, definition.canonicalUrl);
    assert.equal(source.requestedStatus, definition.redirectStatus);
    assert.equal(source.httpStatus, 200);
    assert.ok(source.contentType.startsWith("text/html"));
    assert.equal(source.disposition, definition.disposition);
    assert.equal(source.importMode, definition.importMode);
    assert.equal(source.routeSlug, null);
    assert.deepEqual(source.persisted, { sourceBody: false, media: false, tutorialRoute: false });
    assert.match(source.sourceContentHash, /^[a-f0-9]{64}$/);
    assert.match(source.terms.contentHash, /^[a-f0-9]{64}$/);
    assert.equal(source.terms.status, 200);
    assert.equal(source.terms.finalUrl, definition.termsUrl);
  }
  return true;
}

async function main() {
  const check = process.argv.includes("--check");
  const evidence = await collectWave3Audit();
  validateWave3Audit(evidence);
  if (!check) await writeJsonFile(defaultOutput, evidence);
  console.log(`[wave3-external-dispositions] validated ${sources.length} live sources and bilingual external cards`);
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) await main();
