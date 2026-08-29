import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
});
const model = await jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts"));

const hex = (value) => value.repeat(64);
const allTrue = (keys) => Object.fromEntries(keys.map((key) => [key, true]));

function record(locale, overrides = {}) {
  const contentHash = hex("a");
  const sourceHash = hex("b");
  const translationHash = hex("c");
  return {
    slug: "semantic-guide",
    path: locale === "en" ? "/en/tutorials/semantic-guide/" : "/tutorials/semantic-guide/",
    title: locale === "en" ? "Semantic Guide" : "语义指南",
    description: "A durable tutorial model fixture.",
    provider: "Example Publisher",
    status: "published",
    activeVersion: 1,
    sourceKey: "https://example.com/guide",
    source: {
      title: "Semantic Guide",
      provider: "Example Publisher",
      author: null,
      canonicalUrl: "https://example.com/guide",
      sourcePath: "/roadmap/guide/",
      requestedUrl: "https://example.com/guide",
      finalUrl: "https://example.com/guide",
      contentType: "text/html",
      license: { text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    snapshot: {
      version: 1,
      capturedAt: "2026-08-29T00:00:00.000Z",
      sourceUpdatedAt: "2026-08-28T00:00:00.000Z",
      pageCanonicalUrl: "https://example.com/guide",
      canonicalMatched: true,
      requestedUrl: "https://example.com/guide",
      finalUrl: "https://example.com/guide",
      sourceContentHash: sourceHash,
      contentHash,
      translationContentHash: translationHash,
      history: [],
    },
    translation: {
      sourceLanguage: "en",
      language: "zh-CN",
      translator: "Translator",
      translatedAt: "2026-08-29T00:00:00.000Z",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      sourceSections: 2,
      translatedSections: 2,
      contentHash: translationHash,
    },
    review: {
      decision: "approved",
      reviewer: "Reviewer",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      notes: "Reviewed fixture.",
      checklist: allTrue(model.TUTORIAL_REVIEW_CHECKLIST_KEYS),
      history: [],
    },
    qualification: {
      decision: "qualified",
      reviewer: "Reviewer",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      checklist: allTrue(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS),
    },
    contentFile: `${contentHash}.html`,
    toc: [{ id: "semantic-guide", title: "Semantic Guide", level: 1 }],
    media: [{
      path: "/sites/example/tutorials/diagram.png",
      sha256: hex("d"),
      alt: "A semantic diagram",
      sourceUrl: "https://example.com/diagram.png",
    }],
    contentMetrics: { h1: 1, h2: 1, p: 2, pre: 1, code: 1, blockquote: 1, iframe: 1 },
    seo: {
      title: "Semantic Guide",
      description: "A durable tutorial model fixture.",
      indexable: true,
      dateModified: "2026-08-29T00:00:00.000Z",
    },
    ...overrides,
  };
}

const zh = model.parseTutorialManifest({
  schemaVersion: 1,
  locale: "zh-CN",
  generation: "generation-1",
  activeVersion: 1,
  routes: [record("zh-CN")],
  aliases: [],
}, "zh-CN");
const en = model.parseTutorialManifest({
  schemaVersion: 1,
  locale: "en",
  generation: "generation-1",
  activeVersion: 1,
  routes: [record("en")],
  aliases: [],
}, "en");

assert.equal(zh.routes[0].sourceKey, "https://example.com/guide");
assert.equal(zh.routes[0].contentFile, `${hex("a")}.html`);
assert.deepEqual(model.validateTutorialManifestPair(zh, en).generation, "generation-1");
assert.equal(model.isSha256(hex("f")), true);
assert.equal(model.isSha256("invalid"), false);

const fixture = await fs.readFile(
  path.join(repositoryRoot, "src/content/tutorials/fixtures/semantic-fixture.html"),
  "utf8",
);
const fixtureResult = model.validateTutorialHtml(fixture, "semantic fixture", {
  requireTags: ["pre", "blockquote", "iframe"],
});
assert.equal(fixtureResult.metrics.pre, 1);
assert.equal(fixtureResult.metrics.blockquote, 1);
assert.equal(fixtureResult.metrics.iframe, 1);

assert.throws(
  () => model.parseTutorialManifest({
    locale: "zh-CN",
    generation: "generation-1",
    routes: [record("zh-CN", { contentFile: "../guide.html" })],
    aliases: [],
  }, "zh-CN"),
  /content-addressed SHA-256 filename/,
);
assert.throws(
  () => model.parseTutorialManifest({
    locale: "zh-CN",
    generation: "generation-1",
    routes: [record("zh-CN", { source: { ...record("zh-CN").source, canonicalUrl: "http://example.com/guide" } })],
    aliases: [],
  }, "zh-CN"),
  /absolute HTTPS URL/,
);
assert.throws(
  () => model.validateTutorialHtml(fixture.replace("www.youtube-nocookie.com", "evil.example.com")),
  /outside the allowlist/,
);
assert.throws(
  () => model.validateTutorialHtml(fixture.replace("<blockquote", "<script><blockquote")),
  /unsupported <script>/,
);
assert.throws(
  () => model.validateTutorialManifestPair(zh, { ...en, generation: "generation-2" }),
  /share one generation/,
);
assert.throws(
  () => model.parseTutorialManifest({
    locale: "zh-CN",
    generation: "generation-1",
    routes: [record("zh-CN", { sourceKey: "https://example.com/other" })],
    aliases: [],
  }, "zh-CN"),
  /sourceKey does not match/,
);

console.log("Tutorial content model contract passed.");
