import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalFromHtml,
  extractElementByClass,
  fetchSourceHtml,
  sha256,
  sourceUpdatedAtFromHtml,
  TutorialImportError,
  writeJsonFile,
} from "./lib/tutorial-importer.mjs";
import { normalizeSourceKey } from "../src/lib/tutorials/source-key.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = path.join(repositoryRoot, ".omo/evidence/wave2-rights-audit.json");
const auditKind = "seo-fundamentals-wave-2-rights-audit";
const auditSchemaVersion = 1;
const allowedEmbedHosts = new Set([
  "embeds.beehiiv.com",
  "player.vimeo.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
]);
const semanticTags = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "a",
  "table",
  "code",
  "pre",
  "blockquote",
  "img",
  "iframe",
  "form",
  "input",
  "button",
];
const ignoredTags = new Set(["script", "style", "template", "noscript"]);
const prohibitedEvidenceKeys = new Set([
  "html",
  "bodyHtml",
  "fullText",
  "fullBody",
  "contentHtml",
  "mediaBytes",
]);

export const sourceDefinitions = Object.freeze([
  Object.freeze({
    sourceId: "ahrefs-seo-basics",
    provider: "Ahrefs",
    author: "Joshua Hardwick",
    slug: "ahrefs-seo-basics",
    sourcePath: "/seo_roadmap/seo-fundamentals/",
    requestedUrl: "https://ahrefs.com/blog/seo-basics/",
    expectedCanonicalUrl: "https://ahrefs.com/seo/seo-basics",
    termsUrl: "https://ahrefs.com/legal/terms",
    adapter: "ahrefs-seo-basics",
    expectedRawMetrics: { h1: 1, h2: 7, h3: 28, h4: 8, p: 130, ul: 7, ol: 1, li: 34, a: 241, img: 49 },
    expectedRenderedMetrics: { h1: 1, h2: 7, h3: 28, h4: 8, p: 130, ul: 7, ol: 1, li: 34, a: 241, img: 47 },
    expectedBodyMetrics: { h1: 1, h2: 6, h3: 18, h4: 8, p: 79, ul: 7, ol: 1, li: 34, a: 51, img: 17 },
    expectedFailureCodes: [
      "canonical-rebind-required",
      "source-update-missing",
      "written-text-permission-missing",
      "per-asset-rights-unverified",
    ],
    termsAssertions: [
      ["intellectual-property-section", "12. Intellectual Property"],
      ["ahrefs-ownership", "Ahrefs retains sole ownership of all intellectual property rights in Ahrefs Services"],
      ["express-grant-limit", "Other than what is expressly granted in the Terms, we do not grant you any rights"],
    ],
  }),
  Object.freeze({
    sourceId: "mangools-complete-seo-guide",
    provider: "Mangools",
    author: "Vlado Pavlik",
    slug: "mangools-complete-seo-guide",
    sourcePath: "/seo_roadmap/seo-fundamentals/",
    requestedUrl: "https://mangools.com/blog/learn-seo/",
    expectedCanonicalUrl: "https://mangools.com/blog/learn-seo/",
    termsUrl: "https://mangools.com/conditions",
    adapter: "mangools-wordpress",
    expectedRawMetrics: { h1: 11, h2: 36, h3: 116, h4: 33, h5: 5, p: 712, ul: 78, ol: 5, li: 338, img: 124, iframe: 1, form: 6, input: 92, button: 14, blockquote: 4 },
    expectedRenderedMetrics: { h1: 11, h2: 36, h3: 116, h4: 33, h5: 5, p: 711, ul: 78, ol: 5, li: 338, img: 124, iframe: 1, form: 6, input: 92, button: 14, blockquote: 4 },
    expectedBodyMetrics: { h1: 8, h2: 35, h3: 107, h4: 29, p: 702, ul: 68, ol: 5, li: 280, img: 80, iframe: 1, form: 2, input: 85, button: 2, blockquote: 4 },
    expectedFailureCodes: [
      "written-text-permission-missing",
      "per-asset-rights-unverified",
      "unsupported-interaction",
      "third-party-embed-rights-unverified",
    ],
    termsAssertions: [
      ["license-scope-section", "1. License Scope and User Rights"],
      ["ip-rights-ownership", "All Intellectual Property Rights"],
      ["written-consent-requirement", "You may not use any IP Rights without our prior written consent."],
    ],
  }),
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function attributeValue(tagSource, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tagSource.match(new RegExp(`(?:^|\\s)${escapedName}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+)))?`, "i"));
  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null;
}

function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function semanticMetrics(html) {
  const metrics = Object.fromEntries(semanticTags.map((tag) => [tag, 0]));
  const tokenPattern = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  let ignoredTag = null;
  for (const match of html.matchAll(tokenPattern)) {
    const token = match[0];
    const tag = match[1]?.toLowerCase();
    if (!tag || token.startsWith("<!--")) continue;
    const closing = /^<\//.test(token);
    if (ignoredTag) {
      if (closing && tag === ignoredTag) ignoredTag = null;
      continue;
    }
    if (closing) continue;
    if (ignoredTags.has(tag)) {
      ignoredTag = tag;
      continue;
    }
    if (tag in metrics) metrics[tag] += 1;
  }
  return Object.fromEntries(Object.entries(metrics).filter(([, count]) => count > 0));
}

export function lexicalMetrics(html) {
  return Object.fromEntries(
    semanticTags
      .map((tag) => [tag, (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length])
      .filter(([, count]) => count > 0),
  );
}

function metricDiff(observed, expected) {
  const diff = {};
  for (const [tag, expectedCount] of Object.entries(expected)) {
    if ((observed[tag] ?? 0) !== expectedCount) diff[tag] = { observed: observed[tag] ?? 0, expected: expectedCount };
  }
  return diff;
}

function ahrefsArticleWindow(html) {
  const headingStart = html.search(/<h1\b/i);
  if (headingStart < 0) throw new AuditError("extraction-failure", "Ahrefs article H1 is missing");
  const start = html.lastIndexOf("<section", headingStart);
  if (start < 0) throw new AuditError("extraction-failure", "Ahrefs article hero boundary is missing");
  const referenceOpen = [...html.matchAll(/<section\b[^>]*\bid=["']references["'][^>]*>/gi)][0];
  if (!referenceOpen) throw new AuditError("extraction-failure", "Ahrefs references boundary is missing");
  const sectionTokenPattern = /<\/?section\b[^>]*>/gi;
  let depth = 0;
  let referenceEnd = -1;
  for (const match of html.matchAll(sectionTokenPattern)) {
    if ((match.index ?? -1) < (referenceOpen.index ?? -1)) continue;
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) {
      referenceEnd = (match.index ?? 0) + match[0].length;
      break;
    }
  }
  const end = referenceEnd >= 0 ? html.indexOf("<section", referenceEnd) : -1;
  if (end < 0) throw new AuditError("extraction-failure", "Ahrefs article end boundary is missing");
  return {
    html: html.slice(start, end),
    boundary: {
      start: "article hero section containing the first semantic h1",
      end: "section after #references",
      excluded: ["global header/navigation", "promotional banners", "related SEO Guide navigation"],
    },
  };
}

function updatedAtFromMangools(html) {
  const visible = visibleText(html);
  const visibleDate = visible.match(/Last updated:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
  const metaDate = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => ({
      property: attributeValue(match[0], "property"),
      content: attributeValue(match[0], "content"),
    }))
    .find(({ property }) => property?.toLowerCase() === "article:modified_time")?.content;
  const rawDate = metaDate ?? visibleDate;
  if (!rawDate) return undefined;
  const parsed = Date.parse(rawDate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function jsonLdDateModified(html) {
  const match = html.match(/"dateModified"\s*:\s*"([^"\n]+)"/i)?.[1];
  if (!match || !Number.isFinite(Date.parse(match))) return undefined;
  return new Date(match).toISOString();
}

function auditMedia(html, baseUrl) {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => {
    const dataSrc = attributeValue(match[0], "data-src")?.trim() ?? "";
    const src = attributeValue(match[0], "src")?.trim() ?? "";
    const alt = attributeValue(match[0], "alt")?.trim() ?? "";
    const selected = dataSrc || src;
    let host = "missing-url";
    try {
      if (selected) host = new URL(selected, baseUrl).hostname.toLowerCase();
    } catch {
      host = "invalid-url";
    }
    return { dataSrc: Boolean(dataSrc), src: Boolean(src), alt: Boolean(alt), host };
  });
  return {
    total: images.length,
    dataSrcCount: images.filter((image) => image.dataSrc).length,
    srcCount: images.filter((image) => image.src).length,
    missingAltCount: images.filter((image) => !image.alt).length,
    sourceHosts: [...new Set(images.map((image) => image.host))].sort(),
    normalizedSourceCount: images.filter((image) => image.dataSrc || image.src).length,
  };
}

function auditIframe(html, baseUrl) {
  const frames = [...html.matchAll(/<iframe\b[^>]*>/gi)].map((match) => {
    const sourceAttribute = attributeValue(match[0], "src")?.trim()
      ? "src"
      : attributeValue(match[0], "data-src")?.trim()
        ? "data-src"
        : null;
    const source = sourceAttribute ? attributeValue(match[0], sourceAttribute) : "";
    let host = "missing-url";
    try {
      if (source) host = new URL(source, baseUrl).hostname.toLowerCase();
    } catch {
      host = "invalid-url";
    }
    return {
      sourceAttribute,
      host,
      titlePresent: Boolean(attributeValue(match[0], "title")?.trim()),
      allowlisted: allowedEmbedHosts.has(host),
    };
  });
  return {
    count: frames.length,
    frames,
    rights: frames.length === 0 ? "none" : "unverified",
  };
}

function auditTermsSignals(html) {
  const text = visibleText(html).toLowerCase();
  return {
    ownershipLanguage: /copyright|intellectual property|proprietary/.test(text),
    permissionLanguage: /prior written consent|express written consent|permission/.test(text),
    copyRestrictionLanguage: /copy|reproduce|derivative|publish|distribute/.test(text),
    openLicenseLanguage: /creative commons|open license|apache license|mit license/.test(text),
  };
}

function sourceTermsAssertions(definition, html) {
  const text = visibleText(html).toLowerCase();
  return Object.fromEntries(
    definition.termsAssertions.map(([id, phrase]) => [id, text.includes(phrase.toLowerCase())]),
  );
}

class AuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

function errorCode(error) {
  if (error instanceof TutorialImportError || error instanceof AuditError) return error.code;
  return "unavailable";
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function termsEvidence(definition) {
  try {
    const terms = await fetchSourceHtml(definition.termsUrl);
    return {
      requestedUrl: definition.termsUrl,
      finalUrl: terms.finalUrl,
      status: terms.status,
      contentType: terms.contentType,
      capturedAt: new Date().toISOString(),
      contentHash: sha256(terms.html),
      contentLengthBytes: Buffer.byteLength(terms.html),
      redirects: terms.redirects,
      lastModified: terms.lastModified,
      signals: auditTermsSignals(terms.html),
      sourceAssertions: sourceTermsAssertions(definition, terms.html),
    };
  } catch (error) {
    return {
      requestedUrl: definition.termsUrl,
      finalUrl: null,
      status: "unavailable",
      contentType: null,
      capturedAt: new Date().toISOString(),
      contentHash: null,
      contentLengthBytes: null,
      redirects: [],
      lastModified: null,
      failureCode: errorCode(error),
      failureMessage: errorMessage(error),
      signals: null,
      sourceAssertions: Object.fromEntries(definition.termsAssertions.map(([id]) => [id, false])),
    };
  }
}

function sharedSourceRecord(definition, source, canonicalUrl, body, bodyBoundary) {
  const rawMetrics = semanticMetrics(source.html);
  const rawLexicalMetrics = lexicalMetrics(source.html);
  const bodyMetrics = semanticMetrics(body);
  const sourceUpdatedAt = sourceUpdatedAtFromHtml(source.html);
  return {
    sourceId: definition.sourceId,
    slug: definition.slug,
    provider: definition.provider,
    author: definition.author,
    requestedUrl: definition.requestedUrl,
    finalUrl: source.finalUrl,
    canonicalUrl,
    sourceKey: normalizeSourceKey(canonicalUrl),
    contentType: source.contentType.split(";", 1)[0].trim().toLowerCase(),
    httpStatus: source.status,
    redirects: source.redirects,
    sourceUpdatedAt: sourceUpdatedAt ?? null,
    httpLastModified: source.lastModified,
    httpEtag: source.etag,
    sourceContentHash: sha256(body),
    rawHtmlHash: sha256(source.html),
    rawMetrics,
    rawLexicalMetrics,
    bodyMetrics,
    topology: {
      rawBaseline: definition.expectedRawMetrics,
      renderedRawBaseline: definition.expectedRenderedMetrics,
      bodyBaseline: definition.expectedBodyMetrics,
      rawDiff: metricDiff(rawLexicalMetrics, definition.expectedRawMetrics),
      renderedRawDiff: metricDiff(rawMetrics, definition.expectedRenderedMetrics),
      bodyDiff: metricDiff(bodyMetrics, definition.expectedBodyMetrics),
      baselineStatus:
        Object.keys(metricDiff(rawLexicalMetrics, definition.expectedRawMetrics)).length === 0 &&
        Object.keys(metricDiff(rawMetrics, definition.expectedRenderedMetrics)).length === 0 &&
        Object.keys(metricDiff(bodyMetrics, definition.expectedBodyMetrics)).length === 0
          ? "baseline-match"
          : "drift",
    },
    bodyBoundary,
    capturedAt: new Date().toISOString(),
  };
}

export function analyzeSource(definition, source) {
  const canonicalUrl = canonicalFromHtml(source.html, source.finalUrl);
  if (!canonicalUrl) throw new AuditError("canonical-mismatch", "Source canonical link is missing");

  if (definition.adapter === "ahrefs-seo-basics") {
    const articleWindow = ahrefsArticleWindow(source.html);
    const record = sharedSourceRecord(definition, source, canonicalUrl, articleWindow.html, articleWindow.boundary);
    const media = auditMedia(articleWindow.html, canonicalUrl);
    return {
      ...record,
      adapter: definition.adapter,
      canonicalMatched: normalizeSourceKey(canonicalUrl) === normalizeSourceKey(definition.requestedUrl),
      canonicalVerified: normalizeSourceKey(canonicalUrl) === normalizeSourceKey(definition.expectedCanonicalUrl),
      canonicalRebindRequired: normalizeSourceKey(canonicalUrl) !== normalizeSourceKey(definition.requestedUrl),
      title: visibleText(source.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
      mediaTopology: media,
      iframeTopology: { count: 0, frames: [], rights: "none" },
      navigationTopology: {
        articleWindow: "first h1 through related-guide heading",
        excludedRegions: articleWindow.boundary.excluded,
        dynamicClassPolicy: "stable semantic markers only",
      },
      normalization: {
        bodyRoot: "semantic article window",
        transforms: [
          "exclude global navigation and promotional sections",
          "exclude related SEO Guide navigation",
          "retain article headings, paragraphs, lists, links, references, and reviewed media candidates",
          "run sanitizer and media rights review before any import",
        ],
      },
      authorRoles: {
        author: "Joshua Hardwick",
        contributors: ["Sam Oh", "Louise Linehan"],
        reviewer: "Ryan Law",
      },
      updateEvidence: {
        jsonLdDateModified: jsonLdDateModified(source.html) ?? null,
        articleModifiedTimeOrVisibleDate: updatedAtFromMangools(source.html) ?? null,
        httpLastModified: source.lastModified,
      },
    };
  }

  const body = extractElementByClass(source.html, "mg-post-content");
  if (!body) throw new AuditError("extraction-failure", "Mangools .mg-post-content boundary is missing");
  const record = sharedSourceRecord(definition, source, canonicalUrl, body, {
    selector: ".mg-post-content",
    excludedRegions: ["WordPress theme navigation", "newsletter and related-post shell"],
  });
  const media = auditMedia(body, canonicalUrl);
  const iframe = auditIframe(body, canonicalUrl);
  const headingCount = record.bodyMetrics.h1 ?? 0;
  const forms = [...body.matchAll(/<form\b[^>]*>/gi)].map((match) => attributeValue(match[0], "id") || "anonymous-form");
  const updatedAt = updatedAtFromMangools(source.html);
  const jsonLdUpdatedAt = jsonLdDateModified(source.html);
  return {
    ...record,
    adapter: definition.adapter,
    canonicalMatched: normalizeSourceKey(canonicalUrl) === normalizeSourceKey(definition.requestedUrl),
    canonicalVerified: normalizeSourceKey(canonicalUrl) === normalizeSourceKey(definition.expectedCanonicalUrl),
    canonicalRebindRequired: false,
    title: visibleText(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""),
    sourceUpdatedAt: jsonLdUpdatedAt ?? updatedAt ?? record.sourceUpdatedAt,
    updateEvidence: {
      jsonLdDateModified: jsonLdUpdatedAt,
      articleModifiedTimeOrVisibleDate: updatedAt,
      httpLastModified: source.lastModified,
    },
    mediaTopology: media,
    iframeTopology: iframe,
    headingNormalization: {
      rawH1: headingCount,
      targetH1: 1,
      demotedH1Count: Math.max(0, headingCount - 1),
      targetH2: (record.bodyMetrics.h2 ?? 0) + Math.max(0, headingCount - 1),
    },
    interactionTopology: {
      forms,
      formCount: forms.length,
      inputCount: record.bodyMetrics.input ?? 0,
      buttonCount: record.bodyMetrics.button ?? 0,
      disposition: "external-cta",
      localCapability: "static explanatory text and source link only",
    },
    normalization: {
      bodyRoot: ".mg-post-content",
      transforms: [
        "retain only .mg-post-content",
        "demote seven chapter-level H1 labels to H2 under one page H1",
        "prefer data-src for media and normalize it to src during an authorized import",
        "preserve titled YouTube iframe only after embed rights review",
        "replace quiz and certificate forms with reviewed external CTAs",
      ],
    },
  };
}

function rightsAssessment(definition, terms) {
  const failureCodes = [...definition.expectedFailureCodes];
  if (terms.status === "unavailable" && !failureCodes.includes("terms-unavailable")) failureCodes.push("terms-unavailable");
  return {
    status: "blocked",
    disposition: "rights-gated-external",
    textReuse: "unverified",
    mediaReuse: "unverified",
    thirdPartyMediaReuse: definition.sourceId === "mangools-complete-seo-guide" ? "unverified" : "not-observed",
    termsUrl: definition.termsUrl,
    termsStatus: terms.status,
    reasonCodes: failureCodes,
    requiredEvidence: [
      "written permission covering translated full-text republication",
      "per-asset image ownership or reuse permission",
      ...(definition.sourceId === "ahrefs-seo-basics" ? ["auditable source update date"] : []),
      ...(definition.sourceId === "mangools-complete-seo-guide" ? ["static quiz/certificate CTA approval", "YouTube embed rights decision"] : []),
    ],
  };
}

async function auditDefinition(definition) {
  let source;
  let analyzed;
  let collection;
  try {
    source = await fetchSourceHtml(definition.requestedUrl);
    analyzed = analyzeSource(definition, source);
    collection = {
      status: "collected-in-memory",
      failureCode: null,
      failureMessage: null,
    };
  } catch (error) {
    collection = {
      status: "failed",
      failureCode: errorCode(error),
      failureMessage: errorMessage(error),
    };
    analyzed = {
      sourceId: definition.sourceId,
      slug: definition.slug,
      provider: definition.provider,
      author: definition.author,
      requestedUrl: definition.requestedUrl,
      finalUrl: source?.finalUrl ?? null,
      canonicalUrl: null,
      sourceKey: null,
      contentType: source?.contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? null,
      httpStatus: source?.status ?? null,
      redirects: source?.redirects ?? [],
      sourceUpdatedAt: null,
      httpLastModified: source?.lastModified ?? null,
      httpEtag: source?.etag ?? null,
      sourceContentHash: null,
      rawHtmlHash: null,
      rawMetrics: {},
      bodyMetrics: {},
      topology: { rawBaseline: definition.expectedRawMetrics, renderedRawBaseline: definition.expectedRenderedMetrics, bodyBaseline: definition.expectedBodyMetrics, rawDiff: {}, renderedRawDiff: {}, bodyDiff: {}, baselineStatus: "unavailable" },
      bodyBoundary: null,
      capturedAt: new Date().toISOString(),
      adapter: definition.adapter,
      canonicalMatched: false,
      canonicalVerified: false,
      canonicalRebindRequired: normalizeSourceKey(definition.expectedCanonicalUrl) !== normalizeSourceKey(definition.requestedUrl),
      mediaTopology: null,
      iframeTopology: null,
      normalization: { bodyRoot: null, transforms: [] },
    };
  }

  const terms = await termsEvidence(definition);
  return {
    ...analyzed,
    collection,
    rights: rightsAssessment(definition, terms),
    terms,
    importArtifacts: {
      fullBodyPersisted: false,
      mediaPersisted: false,
      draftCreated: false,
      reviewCreated: false,
      published: false,
    },
    externalDisposition: {
      cardAction: "keep-external",
      canonicalCardUrl: analyzed.canonicalUrl ?? definition.expectedCanonicalUrl,
      routeSlug: null,
      sourceKeyProvenance: {
        requestedUrl: definition.requestedUrl,
        finalUrl: analyzed.finalUrl,
        canonicalUrl: analyzed.canonicalUrl ?? definition.expectedCanonicalUrl,
      },
    },
    review: {
      decision: "pending-rights-review",
      reviewer: null,
      approvedForPromotion: false,
    },
  };
}

export async function collectRightsAudit() {
  const sources = [];
  for (const definition of sourceDefinitions) {
    sources.push(await auditDefinition(definition));
  }
  const resourceReport = await readJson(path.join(repositoryRoot, "src/content/tutorials/resource-link-report.json"));
  return {
    schemaVersion: auditSchemaVersion,
    kind: auditKind,
    waveId: "wave-2-rights-reviewed",
    capturedAt: new Date().toISOString(),
    policy: {
      collectionConcurrency: 1,
      htmlPersisted: false,
      mediaDownloaded: false,
      termsBodiesPersisted: false,
      sourceTermsReviewed: true,
      promotionBarrier: "rights approval plus all release gates",
    },
    resourceLinkDisposition: {
      sharedLinksAction: "preserve-published-source-map",
      newInternalMappings: [],
      reportPath: "src/content/tutorials/resource-link-report.json",
      reportStatus: "unchanged",
      reportBaseline: {
        total: resourceReport.total,
        unique: resourceReport.unique,
        converted: resourceReport.converted,
        fallback: resourceReport.fallback,
        rendered: resourceReport.rendered,
      },
    },
    sources,
  };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function assertNoProhibitedKeys(value, label = "evidence") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProhibitedKeys(item, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!prohibitedEvidenceKeys.has(key), `${label} contains restricted body key ${key}`);
    assertNoProhibitedKeys(child, `${label}.${key}`);
  }
}

export async function assertActiveExternalCardTargets() {
  const generatedRoot = path.join(repositoryRoot, "src/components/sites/learningseo-io-071dae18/subpages/generated");
  const cardFiles = await Promise.all(
    [
      ["manifest.json", "content"],
      ["manifest.zh-CN.json", "content-zh-CN"],
    ].map(async ([manifestName, contentDirectory]) => {
      const manifest = await readJson(path.join(generatedRoot, manifestName));
      const route = manifest.routes.find(
        ({ sourcePath, finalPath, contentFile }) =>
          sourcePath === "/seo_roadmap/seo-fundamentals/" &&
          finalPath === "/seo_roadmap/seo-fundamentals/" &&
          contentFile,
      );
      assert.ok(route, `${manifestName} lacks the active SEO Fundamentals route`);
      return path.join(generatedRoot, contentDirectory, route.contentFile);
    }),
  );
  const cards = await Promise.all(cardFiles.map((file) => fs.readFile(file, "utf8")));
  for (const card of cards) {
    assert.match(card, /href="https:\/\/ahrefs\.com\/seo\/seo-basics"/);
    assert.match(card, /href="https:\/\/mangools\.com\/blog\/learn-seo\/"/);
  }

  const linksPath = path.join(repositoryRoot, "src/components/sites/learningseo-io-071dae18/shared/links.ts");
  const links = await fs.readFile(linksPath, "utf8");
  assert.doesNotMatch(links, /ahrefs\.com\/(?:blog\/seo-basics|seo\/seo-basics)/);
  assert.doesNotMatch(links, /mangools\.com\/blog\/learn-seo/);
}

async function assertNoTutorialRoutes() {
  const contentRoot = path.join(repositoryRoot, "src/content/tutorials");
  for (const file of ["manifest.json", "manifest.en.json"]) {
    const manifest = await readJson(path.join(contentRoot, file));
    for (const route of manifest.routes ?? []) {
      assert.ok(
        !["https://ahrefs.com/seo/seo-basics", "https://mangools.com/blog/learn-seo"].includes(route.sourceKey),
        `${file} unexpectedly owns a Wave 2 rights-gated source route`,
      );
    }
  }
}

export async function validateAuditEvidence(evidence) {
  assert.equal(evidence.schemaVersion, auditSchemaVersion);
  assert.equal(evidence.kind, auditKind);
  assert.equal(evidence.waveId, "wave-2-rights-reviewed");
  assert.deepEqual(evidence.sources.map((source) => source.sourceId), sourceDefinitions.map((source) => source.sourceId));
  assert.equal(evidence.policy.htmlPersisted, false);
  assert.equal(evidence.policy.mediaDownloaded, false);
  assert.equal(evidence.policy.termsBodiesPersisted, false);
  assert.equal(evidence.resourceLinkDisposition.reportStatus, "unchanged");
  assert.deepEqual(evidence.resourceLinkDisposition.newInternalMappings, []);
  assertNoProhibitedKeys(evidence);
  for (const definition of sourceDefinitions) {
    const source = evidence.sources.find((item) => item.sourceId === definition.sourceId);
    assert.ok(source, `Missing rights audit source ${definition.sourceId}`);
    assert.equal(source.requestedUrl, definition.requestedUrl);
    assert.equal(source.provider, definition.provider);
    assert.equal(source.author, definition.author);
    assert.equal(source.rights.status, "blocked");
    assert.equal(source.rights.disposition, "rights-gated-external");
    assert.equal(source.review.approvedForPromotion, false);
    assert.equal(source.importArtifacts.fullBodyPersisted, false);
    assert.equal(source.importArtifacts.mediaPersisted, false);
    assert.equal(source.importArtifacts.published, false);
    assert.equal(source.terms.requestedUrl, definition.termsUrl);
    assert.equal(source.terms.status, 200, `${definition.sourceId} terms preflight failed`);
    assert.equal(source.terms.contentType?.split(";", 1)[0].toLowerCase(), "text/html");
    assert.equal(normalizeSourceKey(source.terms.finalUrl), normalizeSourceKey(definition.termsUrl));
    assert.match(source.terms.contentHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      source.terms.sourceAssertions,
      Object.fromEntries(definition.termsAssertions.map(([id]) => [id, true])),
      `${definition.sourceId} terms evidence drifted`,
    );
    for (const failureCode of definition.expectedFailureCodes) {
      assert.ok(source.rights.reasonCodes.includes(failureCode), `${definition.sourceId} lacks ${failureCode}`);
    }
    assert.equal(source.collection.status, "collected-in-memory", `${definition.sourceId} source preflight failed`);
    assert.equal(source.canonicalUrl, definition.expectedCanonicalUrl);
    assert.equal(source.httpStatus, 200);
    assert.equal(source.contentType, "text/html");
    assert.equal(source.canonicalVerified, true);
    assert.equal(
      source.canonicalMatched,
      normalizeSourceKey(definition.requestedUrl) === normalizeSourceKey(definition.expectedCanonicalUrl),
    );
    assert.match(source.sourceContentHash, /^[a-f0-9]{64}$/);
    assert.match(source.rawHtmlHash, /^[a-f0-9]{64}$/);
    assert.equal(source.topology.baselineStatus, "baseline-match");
    assert.equal(source.externalDisposition.routeSlug, null);
    assert.equal(source.externalDisposition.cardAction, "keep-external");
  }
  await assertActiveExternalCardTargets();
  await assertNoTutorialRoutes();
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = path.resolve(args.output || defaultOutput);
  if (args.check) {
    await validateAuditEvidence(await readJson(path.resolve(args.input || output)));
    console.log(`[wave2-rights-audit] validated ${sourceDefinitions.length} rights-gated sources`);
    return;
  }
  const evidence = await collectRightsAudit();
  await writeJsonFile(output, evidence);
  await validateAuditEvidence(evidence);
  console.log(`[wave2-rights-audit] recorded ${evidence.sources.length} rights-gated external dispositions at ${output}`);
}

const currentFile = path.resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedFile === currentFile) await main();
